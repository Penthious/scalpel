/** State model for the PoE1 Maps "Map State" filters (poe.re's rarity/corrupted/
 *  unidentified toggles): type, defaults, and sanitizer. Lives in shared because
 *  it doubles as a saved RegexPreset field, which crosses the IPC boundary. Same
 *  arrangement as items-state.ts / beast-state.ts. */

export interface MapStateSettings {
  rarityNormal: boolean
  rarityMagic: boolean
  rarityRare: boolean
  /** true = Include, false = Exclude (poe.re radio pair) */
  rarityInclude: boolean
  corrupted: 'off' | 'include' | 'exclude'
  unidentified: 'off' | 'include' | 'exclude'
}

export const DEFAULT_MAP_STATE: MapStateSettings = {
  rarityNormal: false,
  rarityMagic: false,
  rarityRare: false,
  rarityInclude: true,
  corrupted: 'off',
  unidentified: 'off',
}

const TRI_STATES = new Set(['off', 'include', 'exclude'])

/** Coerce an untrusted persisted value into a valid MapStateSettings. Field-by-field
 *  merge over defaults: unknown fields drop, missing ones heal to defaults, junk
 *  resets wholesale. */
export function sanitizeMapState(raw: unknown): MapStateSettings {
  const s = structuredClone(DEFAULT_MAP_STATE)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return s
  const src = raw as Record<string, unknown>

  if (typeof src.rarityNormal === 'boolean') s.rarityNormal = src.rarityNormal
  if (typeof src.rarityMagic === 'boolean') s.rarityMagic = src.rarityMagic
  if (typeof src.rarityRare === 'boolean') s.rarityRare = src.rarityRare
  if (typeof src.rarityInclude === 'boolean') s.rarityInclude = src.rarityInclude
  if (typeof src.corrupted === 'string' && TRI_STATES.has(src.corrupted)) {
    s.corrupted = src.corrupted as MapStateSettings['corrupted']
  }
  if (typeof src.unidentified === 'string' && TRI_STATES.has(src.unidentified)) {
    s.unidentified = src.unidentified as MapStateSettings['unidentified']
  }

  return s
}
