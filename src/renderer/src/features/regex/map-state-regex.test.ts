import { describe, expect, it } from 'vitest'
import { buildMapStateRegex } from './map-state-regex'
import { addRarityRegex, corruptedMapCheck, unidentifiedMap } from './__fixtures__/poere/MapStateOutput'
import { DEFAULT_MAP_STATE, sanitizeMapState, type MapStateSettings } from '@shared/data/regex/map-state'

/** Parity against poe.re's reference rarity/corrupted/unidentified functions. We sweep
 *  every rarity combination (2^4: normal/magic/rare/include) against every corrupted
 *  and unidentified tri-state and assert byte-for-byte equality with the joined,
 *  empty-part-dropped fixture output. */
describe('buildMapStateRegex: parity with poe.re reference', () => {
  const bools = [false, true]
  const triStates: Array<MapStateSettings['corrupted']> = ['off', 'include', 'exclude']

  for (const rarityNormal of bools) {
    for (const rarityMagic of bools) {
      for (const rarityRare of bools) {
        for (const rarityInclude of bools) {
          for (const corrupted of triStates) {
            for (const unidentified of triStates) {
              it(`normal=${rarityNormal} magic=${rarityMagic} rare=${rarityRare} include=${rarityInclude} corrupted=${corrupted} unidentified=${unidentified}`, () => {
                const settings: MapStateSettings = {
                  rarityNormal,
                  rarityMagic,
                  rarityRare,
                  rarityInclude,
                  corrupted,
                  unidentified,
                }
                const fixtureParts = [
                  addRarityRegex(rarityNormal, rarityMagic, rarityRare, rarityInclude),
                  corruptedMapCheck({ corrupted: { enabled: corrupted !== 'off', include: corrupted === 'include' } }),
                  unidentifiedMap({
                    unidentified: { enabled: unidentified !== 'off', include: unidentified === 'include' },
                  }),
                ]
                const expected = fixtureParts.filter(Boolean).join(' ')
                expect(buildMapStateRegex(settings)).toBe(expected)
              })
            }
          }
        }
      }
    }
  }
})

describe('buildMapStateRegex: explicit expectations', () => {
  it('rare-only include emits a bare-letter rarity term', () => {
    expect(buildMapStateRegex({ ...DEFAULT_MAP_STATE, rarityRare: true, rarityInclude: true })).toBe('"y: r"')
  })

  it('normal+magic exclude emits a grouped, negated rarity term', () => {
    expect(
      buildMapStateRegex({ ...DEFAULT_MAP_STATE, rarityNormal: true, rarityMagic: true, rarityInclude: false }),
    ).toBe('"!y: (n|m)"')
  })

  it('all three rarities excluded emits the full negated group', () => {
    expect(
      buildMapStateRegex({
        ...DEFAULT_MAP_STATE,
        rarityNormal: true,
        rarityMagic: true,
        rarityRare: true,
        rarityInclude: false,
      }),
    ).toBe('"!y: (n|m|r)"')
  })

  it('all three rarities included emits no constraint', () => {
    expect(
      buildMapStateRegex({
        ...DEFAULT_MAP_STATE,
        rarityNormal: true,
        rarityMagic: true,
        rarityRare: true,
        rarityInclude: true,
      }),
    ).toBe('')
  })

  it('corrupted exclude emits a bare negated token', () => {
    expect(buildMapStateRegex({ ...DEFAULT_MAP_STATE, corrupted: 'exclude' })).toBe('!pte')
  })

  it('corrupted include emits a bare token', () => {
    expect(buildMapStateRegex({ ...DEFAULT_MAP_STATE, corrupted: 'include' })).toBe('pte')
  })

  it('unidentified include emits a bare token', () => {
    expect(buildMapStateRegex({ ...DEFAULT_MAP_STATE, unidentified: 'include' })).toBe('tified')
  })

  it('unidentified exclude emits a bare negated token', () => {
    expect(buildMapStateRegex({ ...DEFAULT_MAP_STATE, unidentified: 'exclude' })).toBe('!tified')
  })

  it('combines rarity, corrupted, and unidentified in that order, space-separated', () => {
    expect(
      buildMapStateRegex({
        rarityNormal: false,
        rarityMagic: false,
        rarityRare: true,
        rarityInclude: true,
        corrupted: 'include',
        unidentified: 'exclude',
      }),
    ).toBe('"y: r" pte !tified')
  })

  it('the default settings emit no constraint', () => {
    expect(buildMapStateRegex(DEFAULT_MAP_STATE)).toBe('')
  })
})

describe('sanitizeMapState', () => {
  it('returns defaults for non-objects', () => {
    expect(sanitizeMapState(null)).toEqual(DEFAULT_MAP_STATE)
    expect(sanitizeMapState(undefined)).toEqual(DEFAULT_MAP_STATE)
    expect(sanitizeMapState('nope')).toEqual(DEFAULT_MAP_STATE)
    expect(sanitizeMapState(42)).toEqual(DEFAULT_MAP_STATE)
    expect(sanitizeMapState([])).toEqual(DEFAULT_MAP_STATE)
  })

  it('keeps valid fields', () => {
    const s = sanitizeMapState({
      rarityNormal: true,
      rarityMagic: false,
      rarityRare: true,
      rarityInclude: false,
      corrupted: 'exclude',
      unidentified: 'include',
    })
    expect(s).toEqual({
      rarityNormal: true,
      rarityMagic: false,
      rarityRare: true,
      rarityInclude: false,
      corrupted: 'exclude',
      unidentified: 'include',
    })
  })

  it('drops wrong-typed fields back to defaults', () => {
    const s = sanitizeMapState({
      rarityNormal: 'yes',
      rarityMagic: 1,
      rarityRare: null,
      rarityInclude: 'no',
      corrupted: 'maybe',
      unidentified: 1,
    })
    expect(s).toEqual(DEFAULT_MAP_STATE)
  })

  it('ignores foreign keys and merges a partial object over defaults', () => {
    const s = sanitizeMapState({ rarityRare: true, someForeignKey: 'nonsense', extra: { nested: true } })
    expect(s).toEqual({ ...DEFAULT_MAP_STATE, rarityRare: true })
  })

  it('rejects tri-state values outside the known set', () => {
    expect(sanitizeMapState({ corrupted: 'yes' }).corrupted).toBe('off')
    expect(sanitizeMapState({ unidentified: 'INCLUDE' }).unidentified).toBe('off')
  })

  it('returns a new object, never the DEFAULT_MAP_STATE reference', () => {
    expect(sanitizeMapState({})).not.toBe(DEFAULT_MAP_STATE)
    expect(sanitizeMapState(DEFAULT_MAP_STATE)).not.toBe(DEFAULT_MAP_STATE)
  })

  it('round-trips through JSON', () => {
    const original = sanitizeMapState({ rarityMagic: true, corrupted: 'include' })
    expect(sanitizeMapState(JSON.parse(JSON.stringify(original)))).toEqual(original)
  })
})
