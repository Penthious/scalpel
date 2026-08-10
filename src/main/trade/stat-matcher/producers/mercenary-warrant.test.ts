import { beforeEach, describe, expect, it } from 'vitest'
import { _setStatEntriesForTests } from '../index'
import { buildMercenaryWarrantFilters } from './mercenary-warrant'

// Skills and supports live in the live stats catalog under type 'mercenary';
// supports carry their tier in the text ("(Tier 3)"), the clipboard prints it
// with a colon ("(Tier: 3)"). GGG ships one text collision, which is why two
// entries here share "Gilded Extra Targets (Tier 3)".
const MERCENARY_ENTRIES = [
  { id: 'mercenary.skill_37202', text: 'Bladefall', type: 'mercenary' },
  { id: 'mercenary.skill_2792', text: 'Grace', type: 'mercenary' },
  { id: 'mercenary.support_64271', text: 'Brutality (Tier 2)', type: 'mercenary' },
  { id: 'mercenary.support_8607', text: 'Greater Faster Casting (Tier 3)', type: 'mercenary' },
  { id: 'mercenary.support_58471', text: 'Gilded Extra Targets (Tier 3)', type: 'mercenary' },
  { id: 'mercenary.support_37259', text: 'Gilded Extra Targets (Tier 3)', type: 'mercenary' },
]

beforeEach(() => {
  _setStatEntriesForTests(MERCENARY_ENTRIES)
})

// MercenaryWarrantItemInfo is module-private, so derive the fixture type from
// the signature rather than exporting it just for the test.
type WarrantInfo = NonNullable<Parameters<typeof buildMercenaryWarrantFilters>[0]>

const warrant = (over: Partial<WarrantInfo> = {}): WarrantInfo => ({
  baseType: 'Mercenary Warrant',
  mercenaryBuild: 'Mysterious Diver',
  mercenaryLevel: 83,
  ...over,
})

describe('buildMercenaryWarrantFilters', () => {
  it('returns nothing when there is no item info', () => {
    expect(buildMercenaryWarrantFilters(undefined)).toEqual([])
  })

  it('returns nothing for another map fragment', () => {
    expect(buildMercenaryWarrantFilters({ baseType: 'Sacrifice at Dusk', mercenaryLevel: 83 })).toEqual([])
  })

  it('emits the build chip enabled by default', () => {
    const build = buildMercenaryWarrantFilters(warrant()).find((f) => f.id === 'misc.mercenary_build')!

    expect(build).toMatchObject({ text: 'Mysterious Diver', enabled: true, type: 'misc' })
  })

  it('emits the Infamous build as its own chip text', () => {
    const info = warrant({ mercenaryBuild: 'Infamous Mysterious Diver' })
    const build = buildMercenaryWarrantFilters(info).find((f) => f.id === 'misc.mercenary_build')!

    expect(build.text).toBe('Infamous Mysterious Diver')
  })

  it('emits no build chip for a build the trade API does not index', () => {
    // Better an all-builds search than a type the API rejects.
    const filters = buildMercenaryWarrantFilters(warrant({ mercenaryBuild: 'Chronomancer' }))

    expect(filters.find((f) => f.id === 'misc.mercenary_build')).toBeUndefined()
  })

  it('emits no build chip when the build was not parsed', () => {
    const filters = buildMercenaryWarrantFilters(warrant({ mercenaryBuild: undefined }))

    expect(filters.find((f) => f.id === 'misc.mercenary_build')).toBeUndefined()
  })

  it('emits the mercenary level as an editable ilvl row, floored at the roll', () => {
    const level = buildMercenaryWarrantFilters(warrant({ mercenaryLevel: 78 })).find((f) => f.id === 'misc.ilvl')!

    expect(level).toMatchObject({ text: 'Mercenary Level', value: 78, min: 78, max: null, enabled: true, type: 'gem' })
  })

  it('emits no level row when the level was not parsed', () => {
    const filters = buildMercenaryWarrantFilters(warrant({ mercenaryLevel: undefined }))

    expect(filters.find((f) => f.id === 'misc.ilvl')).toBeUndefined()
  })

  it('still emits the level row when the build is unknown', () => {
    const filters = buildMercenaryWarrantFilters(warrant({ mercenaryBuild: 'Chronomancer' }))

    expect(filters.find((f) => f.id === 'misc.ilvl')?.value).toBe(83)
  })

  describe('mercenary skills', () => {
    it('emits a skill row enabled by default -- skills are the comparable set', () => {
      const filters = buildMercenaryWarrantFilters(warrant({ mercenarySkills: [{ name: 'Bladefall', supports: [] }] }))

      expect(filters.find((f) => f.id === 'mercenary.skill_37202')).toMatchObject({
        text: 'Bladefall',
        value: null,
        min: null,
        max: null,
        enabled: true,
        type: 'mercenary',
      })
    })

    it('emits a Tier 3 support disabled, matched by the tier in its text, bound to its skill', () => {
      // Tier 3 is not the prize -- a warrant averages about six of them, so
      // requiring the lot describes exactly one item (this one) and prices
      // nothing. Supports arrive off and the tightening pass picks which to add.
      const filters = buildMercenaryWarrantFilters(
        warrant({ mercenarySkills: [{ name: 'Bladefall', supports: ['Greater Faster Casting (Tier: 3)'] }] }),
      )

      expect(filters.find((f) => f.id === 'mercenary.support_8607')).toMatchObject({
        text: 'Greater Faster Casting (Tier: 3)',
        enabled: false,
        type: 'mercenary',
        mercenarySkillId: 'mercenary.skill_37202',
      })
    })

    it('leaves Tier 1-2 supports off -- they are filler', () => {
      const filters = buildMercenaryWarrantFilters(
        warrant({ mercenarySkills: [{ name: 'Bladefall', supports: ['Brutality (Tier: 2)'] }] }),
      )

      expect(filters.find((f) => f.id === 'mercenary.support_64271')?.enabled).toBe(false)
    })

    it('keeps the clipboard reading order: each skill, then its supports', () => {
      const filters = buildMercenaryWarrantFilters(
        warrant({
          mercenarySkills: [
            { name: 'Bladefall', supports: ['Brutality (Tier: 2)'] },
            { name: 'Grace', supports: [] },
          ],
        }),
      )

      expect(filters.filter((f) => f.type === 'mercenary').map((f) => f.id)).toEqual([
        'mercenary.skill_37202',
        'mercenary.support_64271',
        'mercenary.skill_2792',
      ])
    })

    it('gives a support shared by two skills a row under each', () => {
      // Same stat id, different parent: trade scopes each to its own skill group.
      const filters = buildMercenaryWarrantFilters(
        warrant({
          mercenarySkills: [
            { name: 'Bladefall', supports: ['Brutality (Tier: 2)'] },
            { name: 'Grace', supports: ['Brutality (Tier: 2)'] },
          ],
        }),
      )

      expect(filters.filter((f) => f.id === 'mercenary.support_64271').map((f) => f.mercenarySkillId)).toEqual([
        'mercenary.skill_37202',
        'mercenary.skill_2792',
      ])
    })

    it('drops the supports of a skill the catalog has no id for', () => {
      // Without the skill id there is no group to scope them to.
      const filters = buildMercenaryWarrantFilters(
        warrant({ mercenarySkills: [{ name: 'Skill Shipped Last Patch', supports: ['Brutality (Tier: 2)'] }] }),
      )

      expect(filters.some((f) => f.type === 'mercenary')).toBe(false)
    })

    it('skips a skill the live catalog has no id for', () => {
      const filters = buildMercenaryWarrantFilters(
        warrant({ mercenarySkills: [{ name: 'Skill Shipped Last Patch', supports: [] }] }),
      )

      expect(filters.some((f) => f.type === 'mercenary')).toBe(false)
    })

    it('skips a support whose text maps to two live ids rather than guessing', () => {
      const filters = buildMercenaryWarrantFilters(
        warrant({ mercenarySkills: [{ name: 'Bladefall', supports: ['Gilded Extra Targets (Tier: 3)'] }] }),
      )

      expect(filters.filter((f) => f.type === 'mercenary').map((f) => f.id)).toEqual(['mercenary.skill_37202'])
    })

    it('emits nothing extra for a warrant with no skill blocks', () => {
      expect(buildMercenaryWarrantFilters(warrant()).some((f) => f.type === 'mercenary')).toBe(false)
    })
  })
})
