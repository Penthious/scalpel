// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeSettings } from '@shared/types'
import { MacrosStep } from './MacrosStep'

function installApi(): void {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getRegexPresets: vi.fn(async () => []),
    onRegexPresetsChanged: vi.fn(() => () => {}),
    pluginListRegisteredHotkeys: vi.fn(async () => []),
    onPluginHotkeysChanged: vi.fn(() => () => {}),
    listInstalledPlugins: vi.fn(async () => []),
  }
}

function settings(overrides: Partial<RuntimeSettings> = {}): RuntimeSettings {
  return {
    poeVersion: 1,
    hotkey: 'F5',
    priceCheckHotkey: 'F6',
    chatCommands: [],
    appMacros: [],
    activeProfile: null,
    ...overrides,
  } as unknown as RuntimeSettings
}

function renderStep(settingsValue: RuntimeSettings, onUpdate = vi.fn()): ReturnType<typeof render> {
  return render(
    <MacrosStep
      settings={settingsValue}
      onUpdate={onUpdate}
      onNext={vi.fn()}
      onBack={vi.fn()}
      stepNum={1}
      totalSteps={5}
    />,
  )
}

describe('MacrosStep starter chips', () => {
  beforeEach(() => installApi())

  it('appends a row carrying the suggested hotkey when it does not collide', () => {
    // This is the load-bearing assertion: applyStarter must check the hotkey
    // (against the row about to be appended) before appending, not after. If the
    // order were inverted, the new row would already be in settings at check
    // time and would collide with itself, so this hotkey would come back empty.
    const onUpdate = vi.fn()
    const { getByText } = renderStep(settings(), onUpdate)

    fireEvent.click(getByText('/hideout'))

    expect(onUpdate).toHaveBeenCalledWith('chatCommands', [{ hotkey: 'CommandOrControl+H', command: '/hideout' }])
  })

  it('appends a row with an empty hotkey, neither skipped nor stealing the binding, on a real collision', () => {
    const onUpdate = vi.fn()
    // Seed a genuine collision per findHotkeyCollision: the price-check slot is
    // scope 'both' unconditionally, so its value collides regardless of game.
    const { getByText } = renderStep(settings({ priceCheckHotkey: 'CommandOrControl+H' }), onUpdate)

    fireEvent.click(getByText('/hideout'))

    expect(onUpdate).toHaveBeenCalledWith('chatCommands', [{ hotkey: '', command: '/hideout' }])
  })

  it('narrows the new row to the current game when the suggested hotkey is held by an other-game-only entry', () => {
    // Seed a PoE1-only entry on the same hotkey /hideout suggests. For a PoE2
    // step this passes the collision check (scope 'poe1' doesn't apply to game
    // 2) but must still narrow the new row to 'poe2', or it collides back in
    // PoE1 at runtime per narrowScopeForCrossGameConflict.
    const onUpdate = vi.fn()
    const { getByText } = renderStep(
      settings({
        poeVersion: 2,
        chatCommands: [{ hotkey: 'CommandOrControl+H', command: '/other', scope: 'poe1' }],
      }),
      onUpdate,
    )

    fireEvent.click(getByText('/hideout'))

    expect(onUpdate).toHaveBeenCalledWith('chatCommands', [
      { hotkey: 'CommandOrControl+H', command: '/other', scope: 'poe1' },
      { hotkey: 'CommandOrControl+H', command: '/hideout', scope: 'poe2' },
    ])
  })

  it('renders a starter the user already has as a disabled, still-visible chip', () => {
    const { getByText } = renderStep(settings({ chatCommands: [{ hotkey: 'F7', command: '/exit', autoSubmit: true }] }))

    const chip = getByText('/exit')
    expect(chip).toBeVisible()
    expect(chip).toBeDisabled()
  })

  it('filters starters by game: a PoE1-only starter does not appear when rendering for PoE2', () => {
    // '/delve' is PoE1-only per POE1_ONLY_CHAT_COMMANDS in macro-scope.ts.
    const { queryByText } = renderStep(settings({ poeVersion: 2 }))

    expect(queryByText('/delve')).toBeNull()
  })
})
