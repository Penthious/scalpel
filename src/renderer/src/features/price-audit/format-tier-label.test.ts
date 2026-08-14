import { describe, expect, it } from 'vitest'
import { formatTierLabel } from './constants'

describe('formatTierLabel', () => {
  it('numbers FilterBlade PoE1 tiers', () => {
    expect(formatTierLabel('t1')).toBe('T1')
    expect(formatTierLabel('t12')).toBe('T12')
  })

  it('title-cases the suffix on a numbered tier', () => {
    expect(formatTierLabel('t1top')).toBe('T1 Top')
    expect(formatTierLabel('t4chaos')).toBe('T4 Chaos')
  })

  it('keeps the special-cased names', () => {
    expect(formatTierLabel('exhide')).toBe('Hidden')
    expect(formatTierLabel('restex')).toBe('Rest')
  })

  it('humanises PoE2 word slugs rather than leaking them raw', () => {
    // These reached user-facing copy verbatim before: "moving it to tier: ring_light".
    expect(formatTierLabel('ring_light')).toBe('Ring Light')
    expect(formatTierLabel('map-tier-14')).toBe('Map Tier 14')
  })

  it('title-cases a run-on slug it cannot split', () => {
    expect(formatTierLabel('exoticheistbases')).toBe('Exoticheistbases')
  })

  it('leaves an empty tier empty', () => {
    expect(formatTierLabel('')).toBe('')
  })
})
