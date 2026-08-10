import { describe, expect, it } from 'vitest'
import { currentTradeLeague, isHardcoreLeague, isPermanentLeague } from './leagues'

const LIVE_POE1 = [
  'Allflame',
  'Hardcore Allflame',
  'Ruthless Allflame',
  'HC Ruthless Allflame',
  'Standard',
  'Hardcore',
  'Ruthless',
  'Hardcore Ruthless',
]

describe('currentTradeLeague', () => {
  it('picks the softcore challenge league out of a live PoE1 list', () => {
    expect(currentTradeLeague(LIVE_POE1)).toBe('Allflame')
  })

  it('picks the hardcore challenge league when asked', () => {
    expect(currentTradeLeague(LIVE_POE1, { hardcore: true })).toBe('Hardcore Allflame')
  })

  it('handles the HC-prefix naming PoE2 uses', () => {
    const poe2 = ['Runes of Aldur', 'HC Runes of Aldur', 'Standard', 'Hardcore']
    expect(currentTradeLeague(poe2)).toBe('Runes of Aldur')
    expect(currentTradeLeague(poe2, { hardcore: true })).toBe('HC Runes of Aldur')
  })

  it('never picks Ruthless, even when it is the only challenge league listed', () => {
    expect(currentTradeLeague(['Ruthless Allflame', 'Standard', 'Hardcore'])).toBe('Standard')
    expect(currentTradeLeague(['Hardcore Ruthless', 'Standard', 'Hardcore'], { hardcore: true })).toBe('Hardcore')
  })

  it('falls back to the matching permanent league between leagues', () => {
    expect(currentTradeLeague(['Standard', 'Hardcore'])).toBe('Standard')
    expect(currentTradeLeague(['Standard', 'Hardcore'], { hardcore: true })).toBe('Hardcore')
  })

  it('returns null for an empty list', () => {
    expect(currentTradeLeague([])).toBeNull()
  })
})

describe('league name predicates', () => {
  it('recognises both hardcore naming styles', () => {
    expect(isHardcoreLeague('Hardcore Allflame')).toBe(true)
    expect(isHardcoreLeague('HC Runes of Aldur')).toBe(true)
    expect(isHardcoreLeague('Hardcore')).toBe(true)
    expect(isHardcoreLeague('Allflame')).toBe(false)
  })

  it('treats only Standard and Hardcore as permanent', () => {
    expect(isPermanentLeague('Standard')).toBe(true)
    expect(isPermanentLeague('Hardcore')).toBe(true)
    expect(isPermanentLeague('Hardcore Allflame')).toBe(false)
  })
})
