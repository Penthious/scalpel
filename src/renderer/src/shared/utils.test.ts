import { describe, expect, it } from 'vitest'
import { formatRate, formatVolume, promoteChaos, stripIpcErrorWrapper } from './utils'

describe('promoteChaos', () => {
  it('promotes to divine when divineValue >= 1', () => {
    expect(promoteChaos(400, 200, 1, 2)).toEqual({ text: '2', currencyKey: 'divine' })
  })

  it('stays in chaos below one divine (PoE1)', () => {
    expect(promoteChaos(50, 200, 1)).toEqual({ text: '50', currencyKey: 'chaos' })
  })

  it('uses exalted as the PoE2 baseline', () => {
    expect(promoteChaos(50, 200, 2)).toEqual({ text: '50', currencyKey: 'exalted' })
  })

  it('noPromote keeps the price in the baseline currency even past one divine (PoE1)', () => {
    expect(promoteChaos(220, 220, 1, 1, true)).toEqual({ text: '220', currencyKey: 'chaos' })
  })

  it('noPromote keeps the price in the baseline currency even past one divine (PoE2)', () => {
    expect(promoteChaos(141, 141, 2, 1, true)).toEqual({ text: '141', currencyKey: 'exalted' })
  })
})

describe('stripIpcErrorWrapper', () => {
  it('strips the full wrapper with inner Error: prefix', () => {
    expect(stripIpcErrorWrapper("Error invoking remote method 'bulk-exchange': Error: Rate limited")).toBe(
      'Rate limited',
    )
  })

  it('strips a wrapper without the inner Error: prefix (non-Error rejection)', () => {
    expect(stripIpcErrorWrapper("Error invoking remote method 'trade-search': boom")).toBe('boom')
  })

  it('passes through a message with no wrapper unchanged', () => {
    expect(stripIpcErrorWrapper("GGG's trade API timed out")).toBe("GGG's trade API timed out")
  })
})

describe('formatVolume', () => {
  it('leaves values under a thousand whole', () => {
    expect(formatVolume(0)).toBe('0')
    expect(formatVolume(13.83)).toBe('14')
    expect(formatVolume(999)).toBe('999')
  })

  it('abbreviates thousands', () => {
    expect(formatVolume(1000)).toBe('1k')
    expect(formatVolume(176079)).toBe('176k')
  })

  it('abbreviates millions to one decimal', () => {
    expect(formatVolume(1_000_000)).toBe('1.0m')
    expect(formatVolume(2_450_000)).toBe('2.5m')
  })
})

describe('formatRate', () => {
  it('matches formatPrice at or above 1', () => {
    expect(formatRate(9.69)).toBe('9.7')
    expect(formatRate(209.3)).toBe('209')
    expect(formatRate(1500)).toBe('1.5k')
    expect(formatRate(1)).toBe('1')
  })

  it('flips to the reciprocal below 0.1, where decimals lose their significant figures', () => {
    expect(formatRate(0.04895)).toBe('1/20')
    expect(formatRate(0.004779)).toBe('1/209')
    expect(formatRate(0.036)).toBe('1/28')
  })

  // A 20-stack of Orb of Annulment priced in divines lands here (0.04895 * 20).
  // The reciprocal degenerates to a meaningless "1/1" this close to one, so the
  // decimal has to win -- it is also still accurate at this magnitude.
  it('keeps decimals between 0.1 and 1 rather than degenerating to 1/1', () => {
    expect(formatRate(0.979)).toBe('0.98')
    expect(formatRate(0.5)).toBe('0.5')
    expect(formatRate(0.1)).toBe('0.1')
  })
})
