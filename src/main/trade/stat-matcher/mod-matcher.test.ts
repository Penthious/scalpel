import { describe, expect, it, vi } from 'vitest'

// Mock electron before importing stat-matcher
vi.mock('electron', () => ({
  net: {
    request: vi.fn(),
  },
}))

import { _setStatEntriesForTests, matchModToStat } from '../stat-matcher'

describe('matchModToStat result cache', () => {
  it('returns the correct match and isolates callers from mutating the cached copy', () => {
    _setStatEntriesForTests([{ id: 'explicit.stat_1671376347', text: '+#% to Fire Resistance', type: 'explicit' }])

    const first = matchModToStat('+42% to Fire Resistance')
    expect(first?.statId).toBe('explicit.stat_1671376347')
    expect(first?.value).toBe(42)

    // Mutate the returned object; a cached shallow copy must not leak this back out.
    first!.value = 999

    const second = matchModToStat('+42% to Fire Resistance')
    expect(second?.value).toBe(42)
  })

  it('returns null consistently for unmatchable text', () => {
    _setStatEntriesForTests([{ id: 'explicit.stat_1671376347', text: '+#% to Fire Resistance', type: 'explicit' }])

    expect(matchModToStat('completely unmatchable text line')).toBeNull()
    expect(matchModToStat('completely unmatchable text line')).toBeNull()
  })

  it('invalidates when the stat entries array reference swaps', () => {
    _setStatEntriesForTests([{ id: 'explicit.stat_AAA', text: '+#% to Fire Resistance', type: 'explicit' }])
    expect(matchModToStat('+42% to Fire Resistance')?.statId).toBe('explicit.stat_AAA')

    _setStatEntriesForTests([{ id: 'explicit.stat_BBB', text: '+#% to Fire Resistance', type: 'explicit' }])
    expect(matchModToStat('+42% to Fire Resistance')?.statId).toBe('explicit.stat_BBB')
  })
})
