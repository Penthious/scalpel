// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeSettings } from '@shared/types'
import { GeneralTab } from './GeneralTab'

const LIVE = ['Allflame', 'Hardcore Allflame', 'Standard', 'Hardcore']
const PREVIOUS = ['Mirage', 'Hardcore Mirage', 'Standard', 'Hardcore']

function makeSettings(over: Partial<RuntimeSettings> = {}): RuntimeSettings {
  return {
    poeVersion: 1,
    startInTray: false,
    leaguesPoe1: LIVE,
    leaguesPoe2: [],
    activeProfile: { id: 'p1', name: 'PoE1', gameVariant: 1, league: 'Allflame' },
    updateChannel: 'stable',
    developerMode: false,
    ...over,
  } as unknown as RuntimeSettings
}

function withLeague(league: string, leaguesPoe1: string[] = LIVE): RuntimeSettings {
  return makeSettings({
    leaguesPoe1,
    activeProfile: { id: 'p1', name: 'PoE1', gameVariant: 1, league },
  } as unknown as Partial<RuntimeSettings>)
}

const props = {
  update: vi.fn(),
  updateProfile: vi.fn(async () => {}),
  onSettingsChange: vi.fn(),
}

function renderTab(settings: RuntimeSettings) {
  const view = render(<GeneralTab settings={settings} {...props} />)
  return {
    ...view,
    show: (next: RuntimeSettings) => view.rerender(<GeneralTab settings={next} {...props} />),
  }
}

const select = (): HTMLSelectElement => document.getElementById('league-select-unified') as HTMLSelectElement
const shownLeague = (): string => select().parentElement!.querySelector('.value')!.textContent!

beforeEach(() => {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getDebugLog: vi.fn(async () => ''),
    refreshLeagues: vi.fn(async () => ({})),
    getSettings: vi.fn(async () => makeSettings()),
    createBugReport: vi.fn(),
  }
})

afterEach(() => vi.restoreAllMocks())

describe('GeneralTab league row', () => {
  it('shows the active league when it is on the fetched list', async () => {
    renderTab(makeSettings())
    await waitFor(() => expect(shownLeague()).toBe('Allflame'))
  })

  it('follows the profile once a league rotation lands in two broadcasts', async () => {
    // Mount on last league's cached list, then replay what the refresh
    // broadcasts: the new list first, the migrated profile second.
    const { show } = renderTab(withLeague('Mirage', PREVIOUS))
    await waitFor(() => expect(shownLeague()).toBe('Mirage'))

    show(withLeague('Mirage', LIVE))
    show(withLeague('Allflame', LIVE))

    await waitFor(() => expect(shownLeague()).toBe('Allflame'))
    expect(select().value).toBe('Allflame')
    expect(screen.queryByPlaceholderText(/private/i)).not.toBeInTheDocument()
  })

  it('treats a league that is not on the list as a private league', async () => {
    renderTab(withLeague('Keith SSF'))
    await waitFor(() => expect(shownLeague()).toBe('Keith SSF'))
    expect(select().value).toBe('Private League')
    expect(screen.getByPlaceholderText(/private/i)).toHaveValue('Keith SSF')
  })

  it('opens in private mode when the saved profile has an unnamed private league', async () => {
    renderTab(withLeague(''))
    await waitFor(() => expect(select().value).toBe('Private League'))
    expect(shownLeague()).toBe('Private League')
    expect(screen.getByPlaceholderText(/private/i)).toHaveValue('')
  })

  it('stays in private mode after picking it, while the empty league writes back', async () => {
    const { show } = renderTab(makeSettings())
    fireEvent.change(select(), { target: { value: 'Private League' } })
    show(withLeague(''))

    await waitFor(() => expect(select().value).toBe('Private League'))
    expect(shownLeague()).toBe('Private League')
  })

  it('leaves private mode when a listed league is picked', async () => {
    const { show } = renderTab(withLeague('Keith SSF'))
    fireEvent.change(select(), { target: { value: 'Standard' } })
    show(withLeague('Standard'))

    await waitFor(() => expect(shownLeague()).toBe('Standard'))
    expect(screen.queryByPlaceholderText(/private/i)).not.toBeInTheDocument()
  })
})
