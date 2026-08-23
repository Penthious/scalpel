import { describe, expect, it } from 'vitest'
import { buildBaseTypeFilter } from './base-type'

describe('buildBaseTypeFilter', () => {
  it('defaults the chip on for charts', () => {
    const chip = buildBaseTypeFilter({
      baseType: 'Coral Forest Chart',
      rarity: 'Magic',
      itemClass: 'Chart',
      quality: 0,
    })[0]

    expect(chip).toMatchObject({ id: 'misc.basetype', text: 'Coral Forest Chart', enabled: true })
  })

  it('still defaults the chip off for an ordinary magic base', () => {
    const chip = buildBaseTypeFilter({
      baseType: 'Vaal Regalia',
      rarity: 'Magic',
      itemClass: 'Body Armours',
      quality: 0,
    })[0]

    expect(chip).toMatchObject({ id: 'misc.basetype', enabled: false })
  })

  it('defaults the chip on for every flask class', () => {
    // Flask bases are the market segment (a Granite and a Quicksilver with the
    // same suffix price differently), so the category search stays base-pinned.
    for (const itemClass of ['Flasks', 'Life Flasks', 'Mana Flasks', 'Hybrid Flasks', 'Utility Flasks']) {
      const chip = buildBaseTypeFilter({
        baseType: 'Granite Flask',
        rarity: 'Magic',
        itemClass,
        quality: 20,
      })[0]

      expect(chip, itemClass).toMatchObject({ id: 'misc.basetype', enabled: true })
    }
  })

  it('still defaults the chip on for tablets', () => {
    const chip = buildBaseTypeFilter({
      baseType: 'Breach Precursor Tablet',
      rarity: 'Rare',
      itemClass: 'Tablet',
      quality: 0,
    })[0]

    expect(chip).toMatchObject({ id: 'misc.basetype', enabled: true })
  })
})
