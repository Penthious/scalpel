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

describe('buildMiscFilters item level cap', () => {
  const ilvlRow = (overrides: Partial<Parameters<typeof buildMiscFilters>[0]>) =>
    buildMiscFilters({ ...baseInfo, itemClass: 'Helmets', rarity: 'Rare', ...overrides }, undefined, [])?.find(
      (f) => f.id === 'misc.ilvl',
    )

  it('clamps an above-cap ilvl to 86 in the value, the min and the label', () => {
    expect(ilvlRow({ itemLevel: 100 })).toMatchObject({ text: 'ilvl: 86', value: 86, min: 86, max: null })
  })

  it('leaves an at-or-below-cap ilvl alone', () => {
    expect(ilvlRow({ itemLevel: 84 })).toMatchObject({ text: 'ilvl: 84', value: 84, min: 84 })
    expect(ilvlRow({ itemLevel: 86 })).toMatchObject({ text: 'ilvl: 86', value: 86, min: 86 })
  })

  it('does not clamp a Forbidden Tome, whose row is a max', () => {
    // A max pinned to 86 would exclude the tome itself from its own search.
    expect(ilvlRow({ itemClass: 'Sanctum Research', itemLevel: 100 })).toMatchObject({
      text: 'ilvl: 100',
      value: 100,
      min: null,
      max: 100,
    })
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

describe('buildMiscFilters intangibility row (#588)', () => {
  const intangRow = (
    overrides: Partial<Parameters<typeof buildMiscFilters>[0]>,
  ): ReturnType<typeof buildMiscFilters>[number] | undefined =>
    buildMiscFilters({ ...baseInfo, itemClass: 'Rings', rarity: 'Rare', ...overrides }, undefined, []).find(
      (f) => f.id === 'misc.intangibility',
    )

  it('caps the search at the item value and ships off', () => {
    // Low intangibility is what a crafting base sells on, so the row is a max, not
    // a min -- and it stays off because most buyers are not crafters.
    const row = intangRow({ intangibility: 12 })
    expect(row).toMatchObject({ value: 12, min: null, max: 12, enabled: false, type: 'gem' })
  })

  it('is emitted for a pristine 0% item too', () => {
    // An item that prints "Intangibility: 0%" is a fully craftable base -- the most
    // valuable state -- so the cap has to be available there as well.
    expect(intangRow({ intangibility: 0 })).toMatchObject({ max: 0 })
  })

  it('is absent on items that were never Allflame-crafted', () => {
    expect(intangRow({})).toBeUndefined()
  })
})

describe('buildMiscFilters sanctified chip (#597)', () => {
  const original = getPoeVersion()
  afterEach(() => setPoeVersion(original))

  const sanctifiedChip = (
    overrides: Partial<Parameters<typeof buildMiscFilters>[0]>,
  ): ReturnType<typeof buildMiscFilters>[number] | undefined =>
    buildMiscFilters({ ...baseInfo, itemClass: 'Rings', rarity: 'Rare', ...overrides }, undefined, []).find(
      (f) => f.id === 'misc.sanctified',
    )

  it('defaults to "yes" on a sanctified PoE2 rare', () => {
    setPoeVersion(2)
    expect(sanctifiedChip({ sanctified: true })).toMatchObject({ chipState: 'yes', enabled: false, type: 'misc' })
  })

  it('ships at Any (no chipState) on a plain PoE2 rare -- inert until the user flips it', () => {
    setPoeVersion(2)
    const chip = sanctifiedChip({})
    expect(chip).toBeDefined()
    expect(chip?.chipState).toBeUndefined()
    expect(chip?.enabled).toBe(false)
  })

  it('covers the full sanctifiable spread: gear, jewels, waystones and tablets', () => {
    // Probed 2026-08-19 (Runes of Aldur): sanctified listings exist under weapon,
    // armour, accessory, jewel and the map family -- not just equippable gear.
    setPoeVersion(2)
    for (const itemClass of ['Bows', 'Body Armours', 'Rings', 'Jewels', 'Waystones', 'Tablet']) {
      expect(sanctifiedChip({ itemClass })).toBeDefined()
    }
  })

  it('is absent on PoE2 non-rares -- only rares can be sanctified', () => {
    setPoeVersion(2)
    for (const rarity of ['Normal', 'Magic', 'Unique']) {
      expect(sanctifiedChip({ rarity })).toBeUndefined()
    }
  })

  it('is absent on every PoE1 item', () => {
    setPoeVersion(1)
    expect(sanctifiedChip({})).toBeUndefined()
    expect(sanctifiedChip({ rarity: 'Unique' })).toBeUndefined()
  })

  it('still appears via the marker fallback outside the standard gate', () => {
    // If the marker line ever shows up on something the gate does not cover, trust
    // the item over the gate.
    setPoeVersion(2)
    expect(sanctifiedChip({ rarity: 'Magic', sanctified: true })).toMatchObject({ chipState: 'yes' })
  })
})
