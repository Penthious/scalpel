import type { MapStateSettings } from '@shared/data/regex/map-state'

/** Port of poe.re's addRarityRegex (see __fixtures__/poere/MapStateOutput.ts), operating
 *  on MapStateSettings instead of discrete args. All-three-selected + include, or
 *  none-selected, emits no constraint. */
function buildRarityRegex(s: MapStateSettings): string {
  const rarityPrefix = 'y: '
  if (s.rarityNormal && s.rarityMagic && s.rarityRare) {
    return s.rarityInclude ? '' : `"!${rarityPrefix}(n|m|r)"`
  }
  const normalToken = s.rarityNormal ? 'n' : ''
  const magicToken = s.rarityMagic ? 'm' : ''
  const rareToken = s.rarityRare ? 'r' : ''
  const result = [normalToken, magicToken, rareToken].filter((e) => e.length > 0).join('|')

  const excludePrefix = s.rarityInclude ? '' : '!'
  if (result.length === 0) return ''
  if (result.length === 1) return `"${excludePrefix}${rarityPrefix}${result}"`
  return `"${excludePrefix}${rarityPrefix}(${result})"`
}

/** Port of poe.re's Maps "Map State" filters (rarity + corrupted + unidentified). See
 *  __fixtures__/poere/MapStateOutput.ts for the byte-parity reference. Joined
 *  rarity/corrupted/unidentified, space-separated, empty parts dropped. */
export function buildMapStateRegex(s: MapStateSettings): string {
  const rarity = buildRarityRegex(s)
  const corrupted = s.corrupted === 'off' ? '' : s.corrupted === 'include' ? 'pte' : '!pte'
  const unidentified = s.unidentified === 'off' ? '' : s.unidentified === 'include' ? 'tified' : '!tified'
  return [rarity, corrupted, unidentified].filter(Boolean).join(' ')
}
