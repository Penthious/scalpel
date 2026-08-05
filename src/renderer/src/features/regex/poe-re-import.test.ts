import { describe, expect, it } from 'vitest'
import { MAP_MODS } from '@shared/data/regex/map-mods'
import { DEFAULT_MAP_STATE } from '@shared/data/regex/map-state'
import { decodePoeReExport, extractPoeReMapSettings, poeReExportToMapsPreset } from './poe-re-import'

const NIGHTMARE_ID = MAP_MODS.find((m) => m.nightmare)!.id
const REGULAR_ID = MAP_MODS.find((m) => !m.nightmare)!.id

/** Encode the way poe.re does (UTF-8-safe Base64). */
function encodePoeRe(obj: unknown): string {
  const json = JSON.stringify(obj)
  return btoa(unescape(encodeURIComponent(json)))
}

describe('decodePoeReExport', () => {
  it('round-trips a UTF-8 profile delta', () => {
    const encoded = encodePoeRe({ map: { badIds: [1], goodIds: [2] }, name: 'My Maps' })
    expect(decodePoeReExport(encoded)).toEqual({
      map: { badIds: [1], goodIds: [2] },
      name: 'My Maps',
    })
  })

  it('rejects garbage', () => {
    expect(() => decodePoeReExport('not-base64!!!')).toThrow(/Base64/i)
  })
})

describe('extractPoeReMapSettings', () => {
  it('reads nested map from a SavedSettings-shaped export', () => {
    const { map, profileName } = extractPoeReMapSettings({
      name: 'juice',
      map: { badIds: [-2050206104], goodIds: [] },
    })
    expect(profileName).toBe('juice')
    expect(map.badIds).toEqual([-2050206104])
  })

  it('reads a multi-profile bag', () => {
    const { map, profileName } = extractPoeReMapSettings({
      active: 'default',
      profiles: {
        default: { name: 'default', map: { goodIds: [-2038489408], allGoodMods: false } },
      },
    })
    expect(profileName).toBe('default')
    expect(map.goodIds).toEqual([-2038489408])
    expect(map.allGoodMods).toBe(false)
  })
})

describe('poeReExportToMapsPreset', () => {
  it('maps avoid/want IDs, wantMode, qualifiers, and nightmare', () => {
    const encoded = encodePoeRe({
      name: 'League start',
      map: {
        badIds: [-2050206104, -2038489408, 999999999],
        goodIds: [-2038489408],
        allGoodMods: false,
        quantity: '80',
        packsize: '40',
        itemRarity: '50',
        mapDropChance: '15',
        displayNightmareMods: true,
        quality: { regular: '20', scarab: '10' },
        tradeExcludeValdo: true,
      },
    })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.generator).toBe('maps')
    expect(result.preset.name).toBe('League start')
    expect(result.preset.avoid).toEqual([-2050206104, -2038489408])
    expect(result.preset.want).toEqual([-2038489408])
    expect(result.preset.wantMode).toBe('any')
    expect(result.preset.nightmare).toBe(true)
    expect(result.preset.qualifiers).toEqual({
      quantity: 80,
      packsize: 40,
      rarity: 50,
      moremaps: 15,
      quality: 20,
      quality_scarab: 10,
    })
    expect(result.unknownModIds).toContain(999999999)
    expect(result.unsupported).toContain('exclude Valdo maps')
  })

  it('defaults wantMode to all and nightmare to true when omitted (poe.re defaults)', () => {
    const encoded = encodePoeRe({
      map: { badIds: [-2050206104] },
    })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.wantMode).toBe('all')
    expect(result.preset.nightmare).toBe(true)
    expect(result.preset.name).toBe('Imported from poe.re')
  })

  // poe.re's getSelectedIds strips nightmare mods out of the generated regex when the
  // toggle is off, so keeping them would import a stricter filter than the profile.
  it('drops nightmare ids when the profile had displayNightmareMods off', () => {
    const encoded = encodePoeRe({
      map: { badIds: [REGULAR_ID, NIGHTMARE_ID], goodIds: [NIGHTMARE_ID], displayNightmareMods: false },
    })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.avoid).toEqual([REGULAR_ID])
    expect(result.preset.want).toEqual([])
    expect(result.nightmareSkipped).toBe(2)
  })

  it('keeps nightmare ids when the toggle is on (the poe.re default)', () => {
    const encoded = encodePoeRe({ map: { badIds: [REGULAR_ID, NIGHTMARE_ID] } })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.avoid).toEqual([REGULAR_ID, NIGHTMARE_ID])
    expect(result.nightmareSkipped).toBe(0)
  })

  // anyQuality defaults on and so never appears in a delta export; the divergence has
  // to be inferred from the number of quality values instead of read off a key.
  it('flags quality match-any once more than one quality value is set', () => {
    const encoded = encodePoeRe({ map: { quality: { regular: '20', scarab: '12' } } })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.unsupported).toContain('quality match-any (Scalpel requires all of them)')
  })

  it('does not flag quality match-any for a single value, or when anyQuality is off', () => {
    const single = poeReExportToMapsPreset(encodePoeRe({ map: { quality: { regular: '20' } } }))
    expect(single.unsupported).toEqual([])

    const allOf = poeReExportToMapsPreset(
      encodePoeRe({ map: { quality: { regular: '20', scarab: '12' }, anyQuality: false } }),
    )
    expect(allOf.unsupported).toEqual([])
  })
})

describe('poeReExportToMapsPreset: mapState', () => {
  it('maps a rarity object into the four rarity fields', () => {
    const encoded = encodePoeRe({
      map: { rarity: { normal: false, magic: false, rare: true, include: true } },
    })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.mapState).toEqual({
      rarityNormal: false,
      rarityMagic: false,
      rarityRare: true,
      rarityInclude: true,
      corrupted: 'off',
      unidentified: 'off',
    })
  })

  it('maps corrupted enabled+exclude to the exclude tri-state', () => {
    const encoded = encodePoeRe({ map: { corrupted: { enabled: true, include: false } } })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.mapState?.corrupted).toBe('exclude')
  })

  it('maps unidentified enabled with an absent include to exclude (poe.re default)', () => {
    const encoded = encodePoeRe({ map: { unidentified: { enabled: true } } })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.mapState?.unidentified).toBe('exclude')
  })

  it('defaults to DEFAULT_MAP_STATE when rarity/corrupted/unidentified are all absent', () => {
    const encoded = encodePoeRe({ map: { badIds: [-2050206104] } })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.preset.mapState).toEqual(DEFAULT_MAP_STATE)
  })

  it('no longer flags rarity/corrupted/unidentified as unsupported', () => {
    const encoded = encodePoeRe({
      map: {
        rarity: { rare: true },
        corrupted: { enabled: true },
        unidentified: { enabled: true },
      },
    })
    const result = poeReExportToMapsPreset(encoded)
    expect(result.unsupported).not.toContain('map rarity include/exclude')
    expect(result.unsupported).not.toContain('corrupted filter')
    expect(result.unsupported).not.toContain('unidentified filter')
  })
})
