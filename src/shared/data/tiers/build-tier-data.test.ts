import { describe, it, expect, test } from 'vitest'
// CJS module; import its pure exports.
import {
  buildCompact,
  buildDesecrated,
  buildModSources,
  familyToSource,
  normKey,
} from '../../../../scripts/build-tier-data.js'

const mbb = {
  Rings: {
    'ring,default': {
      bases: ['Metadata/Items/Rings/Ring1'],
      mods: {
        prefix: { IncreasedLife: { IncreasedLife1: 1, IncreasedLife2: 6 } },
        suffix: { FireResistance: { FireResist1: 1, FireResist2: 12 } },
      },
      conditional_mods: null,
    },
  },
}
const mods = {
  IncreasedLife2: {
    name: 'Healthy',
    required_level: 6,
    groups: ['IncreasedLife'],
    domain: 'item',
    stats: [{ id: 'base_maximum_life', min: 10, max: 19 }],
    text: '+(10-19) to maximum Life',
    generation_type: 'prefix',
  },
  IncreasedLife1: {
    name: 'Hale',
    required_level: 1,
    groups: ['IncreasedLife'],
    domain: 'item',
    stats: [{ id: 'base_maximum_life', min: 3, max: 9 }],
    text: '+(3-9) to maximum Life',
    generation_type: 'prefix',
  },
  FireResist1: {
    name: 'of the Cloud',
    required_level: 1,
    groups: ['FireResistance'],
    domain: 'item',
    stats: [{ id: 'base_fire_damage_resistance_%', min: 6, max: 11 }],
    text: '+(6-11)% to Fire Resistance',
    generation_type: 'suffix',
  },
  FireResist2: {
    name: 'of the Tundra',
    required_level: 12,
    groups: ['FireResistance'],
    domain: 'item',
    stats: [{ id: 'base_fire_damage_resistance_%', min: 12, max: 17 }],
    text: '+(12-17)% to Fire Resistance',
    generation_type: 'suffix',
  },
  // Non-item-domain mod that must be excluded:
  JunkCurrency1: {
    name: 'Junk',
    required_level: 1,
    groups: ['Junk'],
    domain: 'misc',
    stats: [{ id: 'x', min: 1, max: 2 }],
    text: 'junk',
    generation_type: 'prefix',
  },
}
const baseItems = {
  'Metadata/Items/Rings/Ring1': { name: 'Iron Ring', tags: ['ring', 'default'], item_class: 'Ring' },
}

describe('buildCompact', () => {
  it('joins, dedupes, orders tiers ascending by required_level, interns pools, and resolves base display names', () => {
    const out = buildCompact(mbb, mods, baseItems)
    expect(out.schemaVersion).toBe(1)
    const poolIdx = out.bases['Iron Ring']
    expect(poolIdx).toBeTypeOf('number')
    const ironRing = out.pools[poolIdx]
    expect(ironRing).toBeDefined()
    // IncreasedLife ordered worst-first (req_level 1 then 6)
    const lifeTiers = ironRing.IncreasedLife.map((i) => out.mods[i])
    expect(lifeTiers.map((m) => m.l)).toEqual([1, 6])
    expect(lifeTiers[0].n).toBe('Hale')
    expect(lifeTiers[0].s).toEqual([['base_maximum_life', 3, 9]])
    // Fire resistance present as a separate group
    expect(ironRing.FireResistance.map((i) => out.mods[i].l)).toEqual([1, 12])
  })

  it('excludes non-item-domain mods', () => {
    const out = buildCompact(mbb, mods, baseItems)
    expect(out.mods.some((m) => m.n === 'Junk')).toBe(false)
  })
})

test('buildDesecrated ladders a single-stat desecrated mod by normalized key', () => {
  const mods = {
    a: {
      domain: 'desecrated',
      required_level: 65,
      text: '(74-89)% increased [Spell] Damage with [Spell|Spells] that cost Life',
      stats: [{ id: 'x', min: 74, max: 89 }],
    },
    b: {
      domain: 'desecrated',
      required_level: 65,
      text: '(148-178)% increased [Spell] Damage with [Spell|Spells] that cost Life',
      stats: [{ id: 'x', min: 148, max: 178 }],
    },
    c: { domain: 'item', required_level: 1, text: '+(10-14) to maximum Mana', stats: [{ id: 'm', min: 10, max: 14 }] },
  }
  const ds = buildDesecrated(mods)
  const key = normKey('(74-89)% increased [Spell] Damage with [Spell|Spells] that cost Life')
  expect(key).toBe('#% INCREASED SPELL DAMAGE WITH SPELLS THAT COST LIFE')
  const mod = ds.mods.find((m) => m.key === key)
  expect(mod?.tiers).toEqual([
    { min: 74, max: 89, lvl: 65 },
    { min: 148, max: 178, lvl: 65 },
  ])
  expect(ds.mods.some((m) => m.key.includes('MANA'))).toBe(false)
})

test('normKey collapses +N (OCR) and +(N-M) (template) to the same key', () => {
  // The leading + is consumed in both the plain-number and the range form, so an
  // OCR-read "+174 to Spirit" matches the dataset template "+(35-50) to Spirit".
  expect(normKey('+(35-50) to Spirit')).toBe('# TO SPIRIT')
  expect(normKey('+(35-50) to Spirit')).toBe(normKey('+174 to Spirit'))
})

test('buildDesecrated stores positive (absolute) ranges for negative "reduced" mods', () => {
  const mods = {
    r: {
      domain: 'desecrated',
      required_level: 1,
      text: '(25-35)% reduced Effect of Curses on You',
      stats: [{ id: 'curse_effect_+%', min: -35, max: -25 }],
    },
  }
  const ds = buildDesecrated(mods)
  const mod = ds.mods.find((m) => m.key === '#% REDUCED EFFECT OF CURSES ON YOU')
  expect(mod?.tiers).toEqual([{ min: 25, max: 35, lvl: 1 }])
})

describe('buildModSources', () => {
  // Rings host an influence family, so their ordinary affixes are in scope for the
  // collision check. Sentinels host none, so their reuse of a flavour name is ignored.
  const srcMbb = {
    Rings: {
      'ring,default': {
        bases: ['Metadata/Items/Rings/Ring1'],
        mods: {
          prefix: { IncreasedLife: { Plain1: 1 } },
          prefix_shaper: { SocketedGems: { Shaper1: 1 } },
          suffix_adjudicator: { FireResistance: { Warlord1: 1 } },
          delve_suffix: { ColdResistance: { Delve1: 1 } },
        },
        conditional_mods: null,
      },
    },
    Sentinels: {
      'sentinel,default': {
        bases: ['Metadata/Items/Sentinel1'],
        mods: { suffix: { Shrine: { SentinelShrine1: 1 } } },
        conditional_mods: null,
      },
    },
  }
  const stat = [{ id: 'x', min: 1, max: 2 }]
  const srcMods = {
    Plain1: { name: 'Healthy', domain: 'item', generation_type: 'prefix', stats: stat },
    Shaper1: { name: "The Shaper's", domain: 'item', generation_type: 'prefix', stats: stat },
    Warlord1: { name: 'of the Conquest', domain: 'item', generation_type: 'suffix', stats: stat },
    Delve1: { name: 'Subterranean', domain: 'delve', generation_type: 'suffix', stats: stat },
    // Not in mods_by_base at all; identified as temple purely by the Enhanced id.
    IncreasedLifeEnhancedMod: { name: "Guatelitzi's", domain: 'item', generation_type: 'prefix', stats: stat },
    // Sentinels reuse the Warlord suffix name for an unrelated shrine mod. Sentinels
    // host no source family, so this must not poison "of the Conquest".
    SentinelShrine1: { name: 'of the Conquest', domain: 'item', generation_type: 'suffix', stats: stat },
  }

  it('maps influence, delve and temple affix names to their source', () => {
    const out = buildModSources(srcMbb, srcMods)
    expect(out.schemaVersion).toBe(1)
    expect(out.sources).toEqual({
      "The Shaper's": 'shaper',
      'of the Conquest': 'warlord',
      Subterranean: 'delve',
      "Guatelitzi's": 'temple',
    })
  })

  it('scopes to the classes that host a source family, so off-equipment names are ignored', () => {
    const out = buildModSources(srcMbb, srcMods)
    expect(out.classes).toEqual(['Rings'])
    // Present despite the Sentinel mod of the same name.
    expect(out.sources['of the Conquest']).toBe('warlord')
  })

  it('leaves ordinary craftable affixes unbadged', () => {
    expect(buildModSources(srcMbb, srcMods).sources.Healthy).toBeUndefined()
  })

  it('throws when a source name is also an ordinary affix on a badged class', () => {
    // A ring prefix that reuses the Shaper name: on a real ring the badge could not
    // tell them apart, so this must break the build rather than mislabel the row.
    const clash = structuredClone(srcMbb) as Record<
      string,
      Record<string, { mods: Record<string, Record<string, Record<string, number>>> }>
    >
    clash.Rings['ring,default'].mods.prefix.IncreasedLife.Collide1 = 1
    const mods = {
      ...srcMods,
      Collide1: { name: "The Shaper's", domain: 'item', generation_type: 'prefix', stats: stat },
    }
    expect(() => buildModSources(clash, mods)).toThrow(/no longer unambiguous/)
  })

  it('throws when one name claims two different sources', () => {
    const mods = {
      ...srcMods,
      Delve1: { name: "The Shaper's", domain: 'delve', generation_type: 'suffix', stats: stat },
    }
    expect(() => buildModSources(srcMbb, mods)).toThrow(/The Shaper's/)
  })
})

test('familyToSource maps GGG internal conqueror names to their display names', () => {
  expect(familyToSource('prefix_basilisk')).toBe('hunter')
  expect(familyToSource('suffix_eyrie')).toBe('redeemer')
  expect(familyToSource('prefix_adjudicator')).toBe('warlord')
  expect(familyToSource('delve_prefix')).toBe('delve')
  expect(familyToSource('prefix')).toBeNull()
  expect(familyToSource('searing_exarch_implicit')).toBeNull()
})
