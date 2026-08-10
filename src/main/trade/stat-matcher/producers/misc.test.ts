import { afterEach, describe, it, expect } from 'vitest'
import { getPoeVersion, setPoeVersion } from '@main/game-state'
import { buildMiscFilters } from './misc'

const baseInfo = {
  itemClass: '',
  quality: 0,
  itemLevel: 0,
  corrupted: false,
  mirrored: false,
  identified: true,
}

describe('buildMiscFilters synthetic item level', () => {
  it('adds the placeholder ilvl chip for a synthetic gear item', () => {
    const filters = buildMiscFilters(
      { ...baseInfo, itemClass: 'Body Armours', rarity: 'Unique', isSynthetic: true },
      undefined,
      [],
    )
    const ilvl = filters.find((f) => f.id === 'misc.ilvl')
    expect(ilvl).toBeDefined()
    expect(ilvl?.enabled).toBe(true)
    expect(ilvl?.value).toBe(83)
  })

  it('omits the ilvl chip for a synthetic currency item (#418)', () => {
    // Sister-overlay currency (orbs, fragments, etc.) is built as a synthetic
    // Rarity: Currency item. An ilvl filter matches no currency listing, so it
    // must not be added or the trade search returns nothing.
    const filters = buildMiscFilters({ ...baseInfo, rarity: 'Currency', isSynthetic: true }, undefined, [])
    expect(filters.find((f) => f.id === 'misc.ilvl')).toBeUndefined()
  })
})

describe('buildMiscFilters level requirement row (#570)', () => {
  const original = getPoeVersion()
  afterEach(() => setPoeVersion(original))

  const reqLevelRow = (
    overrides: Partial<Parameters<typeof buildMiscFilters>[0]> & { requiredLevel?: number },
  ): ReturnType<typeof buildMiscFilters>[number] | undefined =>
    buildMiscFilters(
      { ...baseInfo, itemClass: 'Helmets', rarity: 'Rare', requiredLevel: 40, ...overrides },
      undefined,
      [],
    ).find((f) => f.id === 'misc.req_level')

  it('caps the search at the item requirement, min left open', () => {
    setPoeVersion(1)
    expect(reqLevelRow({ requiredLevel: 40 })).toMatchObject({
      text: 'Level Requirement',
      value: 40,
      min: null,
      max: 40,
      enabled: true,
      type: 'gem',
    })
  })

  it('PoE1 includes the cap level and excludes one above it', () => {
    setPoeVersion(1)
    expect(reqLevelRow({ requiredLevel: 48 })).toBeDefined()
    expect(reqLevelRow({ requiredLevel: 49 })).toBeUndefined()
  })

  it('PoE2 caps lower than PoE1', () => {
    setPoeVersion(2)
    expect(reqLevelRow({ requiredLevel: 36 })).toBeDefined()
    expect(reqLevelRow({ requiredLevel: 37 })).toBeUndefined()
    // A level PoE1 would still count as leveling gear is endgame in PoE2
    expect(reqLevelRow({ requiredLevel: 44 })).toBeUndefined()
  })

  it('is rares only', () => {
    setPoeVersion(1)
    for (const rarity of ['Normal', 'Magic', 'Unique']) {
      expect(reqLevelRow({ rarity })).toBeUndefined()
    }
  })

  it('skips jewels and flasks, whose requirement comes from the base', () => {
    setPoeVersion(1)
    // A rare Cobalt Jewel is Requires Level 20 off the base alone, so a default-on
    // cap there would silently narrow every rare-jewel check.
    expect(reqLevelRow({ itemClass: 'Jewels', requiredLevel: 20 })).toBeUndefined()
    expect(reqLevelRow({ itemClass: 'Abyss Jewels', requiredLevel: 20 })).toBeUndefined()
    expect(reqLevelRow({ itemClass: 'Flasks', requiredLevel: 20 })).toBeUndefined()
  })

  it('covers weapons, armour and accessories', () => {
    setPoeVersion(1)
    for (const itemClass of ['Bows', 'Body Armours', 'Rings', 'Amulets', 'Quivers']) {
      expect(reqLevelRow({ itemClass })).toBeDefined()
    }
  })

  it('skips items that print no level requirement', () => {
    setPoeVersion(1)
    expect(reqLevelRow({ requiredLevel: undefined })).toBeUndefined()
    expect(reqLevelRow({ requiredLevel: 0 })).toBeUndefined()
  })
})
