import { describe, expect, it } from 'vitest'
import { DEFAULT_BEAST_STATE, type BeastState } from '@shared/data/regex/beast-state'
import { generateBeastPresetTags } from './beast-preset-tags'
import { TAB_COLORS } from './mapmods-helpers'

function state(over: Partial<BeastState> = {}): BeastState {
  return { ...structuredClone(DEFAULT_BEAST_STATE), ...over }
}

const texts = (s: BeastState): string[] => generateBeastPresetTags(s).map((t) => t.text)

describe('generateBeastPresetTags', () => {
  it('falls back to a descriptive tag for default state', () => {
    expect(texts(state())).toEqual(['beasts by value'])
  })

  it('tags each qualifier', () => {
    expect(texts(state({ menagerieLimit: true }))).toContain('menagerie')
    expect(texts(state({ redOnly: true }))).toContain('red only')
    expect(texts(state({ includeHarvest: true }))).toContain('harvest')
  })

  it('tags the chaos bounds', () => {
    expect(texts(state({ minChaos: 25 }))).toContain('min 25c')
    expect(texts(state({ maxChaos: 900 }))).toContain('max 900c')
  })

  it('tags pins and mutes with their own sources and colors', () => {
    const tags = generateBeastPresetTags(state({ pinned: ['Woods Ursa'], muted: ['Host Cobra'] }))
    const pin = tags.find((t) => t.text === '+Woods Ursa')!
    const mute = tags.find((t) => t.text === '-Host Cobra')!
    expect(pin.source).toBe('want')
    expect(pin.color).toBe(TAB_COLORS.want)
    expect(mute.source).toBe('avoid')
    expect(mute.color).toBe(TAB_COLORS.avoid)
  })

  it('caps long pin and mute lists', () => {
    const t = texts(state({ pinned: ['A', 'B', 'C', 'D', 'E'], muted: ['V', 'W', 'X', 'Y'] }))
    expect(t).toContain('+A')
    expect(t).toContain('+C')
    expect(t).not.toContain('+D')
    expect(t).toContain('+2 more')
    expect(t).toContain('-1 more')
  })

  it('orders names deterministically regardless of input order', () => {
    expect(texts(state({ pinned: ['C', 'A', 'B'] }))).toEqual(texts(state({ pinned: ['B', 'C', 'A'] })))
  })

  it('drops the fallback tag once anything else is set', () => {
    expect(texts(state({ redOnly: true }))).not.toContain('beasts by value')
  })
})
