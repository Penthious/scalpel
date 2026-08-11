import { describe, expect, it } from 'vitest'
import { APP_MACRO_DEFS } from '@renderer/features/settings/tabs/utils'
import { MACRO_STARTERS, isStarterApplied, starterKey, startersForGame } from './onboarding-macro-starters'

const empty = { chatCommands: [], appMacros: [] }

describe('startersForGame', () => {
  it('includes PoE1-only starters for PoE1', () => {
    expect(startersForGame(1).some((s) => s.kind === 'chat' && s.command === '/delve')).toBe(true)
  })

  it('excludes PoE1-only starters for PoE2', () => {
    expect(startersForGame(2).some((s) => s.kind === 'chat' && s.command === '/delve')).toBe(false)
    expect(startersForGame(2).some((s) => s.kind === 'macro' && s.action === 'openDivCards')).toBe(false)
  })

  it('includes cross-game starters for both', () => {
    for (const game of [1, 2] as const) {
      expect(startersForGame(game).some((s) => s.kind === 'chat' && s.command === '/hideout')).toBe(true)
    }
  })
})

describe('starterKey', () => {
  it('is stable and distinct across kinds', () => {
    const keys = MACRO_STARTERS.map(starterKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('isStarterApplied', () => {
  it('is false against empty settings', () => {
    for (const starter of MACRO_STARTERS) expect(isStarterApplied(starter, empty)).toBe(false)
  })

  it('matches a chat command already present regardless of hotkey', () => {
    const settings = { chatCommands: [{ hotkey: 'CommandOrControl+Z', command: '/hideout' }], appMacros: [] }
    const starter = MACRO_STARTERS.find((s) => s.kind === 'chat' && s.command === '/hideout')!
    expect(isStarterApplied(starter, settings)).toBe(true)
  })

  it('matches a chat command that differs only by case or padding', () => {
    const settings = { chatCommands: [{ hotkey: '', command: '  /HIDEOUT ' }], appMacros: [] }
    const starter = MACRO_STARTERS.find((s) => s.kind === 'chat' && s.command === '/hideout')!
    expect(isStarterApplied(starter, settings)).toBe(true)
  })

  it('matches an app macro already bound to the same action', () => {
    const settings = { chatCommands: [], appMacros: [{ action: 'openRegex', hotkey: 'CommandOrControl+P' }] }
    const starter = MACRO_STARTERS.find((s) => s.kind === 'macro' && s.action === 'openRegex')!
    expect(isStarterApplied(starter, settings)).toBe(true)
  })
})

describe('MACRO_STARTERS data', () => {
  it('never suggests a PoE-protected or already-defaulted hotkey', () => {
    const reserved = new Set([
      'CommandOrControl+D',
      'CommandOrControl+A',
      'CommandOrControl+F',
      'CommandOrControl+C',
      'CommandOrControl+Alt+C',
    ])
    for (const starter of MACRO_STARTERS) expect(reserved.has(starter.suggested)).toBe(false)
  })

  it('suggests each hotkey at most once', () => {
    const suggested = MACRO_STARTERS.map((s) => s.suggested)
    expect(new Set(suggested).size).toBe(suggested.length)
  })

  it('only references real app macro actions', () => {
    const ids = new Set(APP_MACRO_DEFS.map((d) => d.id))
    for (const starter of MACRO_STARTERS) {
      if (starter.kind === 'macro') expect(ids.has(starter.action)).toBe(true)
    }
  })
})
