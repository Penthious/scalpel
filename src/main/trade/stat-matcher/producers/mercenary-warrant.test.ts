import { describe, expect, it } from 'vitest'
import { buildMercenaryWarrantFilters } from './mercenary-warrant'

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
})
