import { describe, it, expect } from 'vitest'
import {
  TRADE_PRICE_OPTIONS,
  defaultPriceOption,
  isValidPriceOption,
  normalizePriceOption,
} from './trade-price-options'

const VERSIONS = [1, 2] as const

describe('TRADE_PRICE_OPTIONS', () => {
  it.each(VERSIONS)('has no duplicate values (PoE%i)', (version) => {
    const values = TRADE_PRICE_OPTIONS[version].map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it.each(VERSIONS)('puts every ungrouped entry ahead of the first grouped one (PoE%i)', (version) => {
    const firstGrouped = TRADE_PRICE_OPTIONS[version].findIndex((o) => o.group)
    const lastBare = TRADE_PRICE_OPTIONS[version].map((o) => !o.group).lastIndexOf(true)
    expect(firstGrouped).toBeGreaterThan(0)
    expect(lastBare).toBeLessThan(firstGrouped)
  })

  it.each(VERSIONS)('groups the tail under a single heading (PoE%i)', (version) => {
    const groups = new Set(TRADE_PRICE_OPTIONS[version].filter((o) => o.group).map((o) => o.group))
    expect([...groups]).toEqual(['Other currencies'])
  })

  it.each(VERSIONS)('offers the default option (PoE%i)', (version) => {
    expect(isValidPriceOption(defaultPriceOption(version), version)).toBe(true)
    expect(TRADE_PRICE_OPTIONS[version][0].value).toBe(defaultPriceOption(version))
  })

  it.each(VERSIONS)('gives every entry a non-empty label (PoE%i)', (version) => {
    for (const o of TRADE_PRICE_OPTIONS[version]) expect(o.label.trim()).not.toBe('')
  })

  it('matches the option ids GGG serves for trade_filters.price.option', () => {
    // Transcribed from /api/trade/data/filters and /api/trade2/data/filters.
    // GGG's "equivalent" entry has a null id; we model it as a synthetic string
    // and never send it, so it is excluded from these sets.
    expect(new Set(TRADE_PRICE_OPTIONS[1].map((o) => o.value))).toEqual(
      new Set([
        'chaos_equivalent',
        'chaos_divine',
        'chaos',
        'exalted',
        'divine',
        'mirror',
        'blessed',
        'chrome',
        'gcp',
        'jewellers',
        'scour',
        'regret',
        'fusing',
        'chance',
        'alt',
        'alch',
        'regal',
        'vaal',
      ]),
    )
    expect(new Set(TRADE_PRICE_OPTIONS[2].map((o) => o.value))).toEqual(
      new Set([
        'exalted_equivalent',
        'exalted_divine',
        'aug',
        'transmute',
        'exalted',
        'regal',
        'chaos',
        'vaal',
        'alch',
        'divine',
        'annul',
        'mirror',
      ]),
    )
  })
})

describe('normalizePriceOption', () => {
  it('passes through options the game offers', () => {
    expect(normalizePriceOption('mirror', 1)).toBe('mirror')
    expect(normalizePriceOption('chaos_equivalent', 1)).toBe('chaos_equivalent')
    expect(normalizePriceOption('annul', 2)).toBe('annul')
  })

  it('falls back when an option belongs to the other game', () => {
    // PoE1-only currencies must not survive into a PoE2 query, and vice versa.
    expect(normalizePriceOption('chrome', 2)).toBe('exalted_divine')
    expect(normalizePriceOption('gcp', 2)).toBe('exalted_divine')
    expect(normalizePriceOption('chaos_divine', 2)).toBe('exalted_divine')
    expect(normalizePriceOption('annul', 1)).toBe('chaos_divine')
    expect(normalizePriceOption('transmute', 1)).toBe('chaos_divine')
    expect(normalizePriceOption('exalted_divine', 1)).toBe('chaos_divine')
  })

  it('falls back for missing or junk values', () => {
    expect(normalizePriceOption(undefined, 1)).toBe('chaos_divine')
    expect(normalizePriceOption(null, 2)).toBe('exalted_divine')
    expect(normalizePriceOption('', 1)).toBe('chaos_divine')
    expect(normalizePriceOption(7, 1)).toBe('chaos_divine')
    expect(normalizePriceOption('retired-currency', 1)).toBe('chaos_divine')
  })
})
