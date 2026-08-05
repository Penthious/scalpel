// Verbatim port of poe.re's rarity/corrupted/unidentified map-state regex functions
// (veiset/poe-vendor-string): addRarityRegex, corruptedMapCheck, unidentifiedMap from
// src/pages/maps/OptimizedMapOutput.ts, plus the ENGLISH entries of MapStaticStatRegex
// (src/utils/Languages.ts: rarity_prefix, rarity_normal, rarity_magic, rarity_rare,
// corrupted, unidentified) that they read. Adapted only to compile standalone: the
// per-language statRegex lookup is inlined to the ENGLISH object and the `language`
// parameter dropped; the settings params are typed structurally instead of importing
// upstream's MapSettings. (Modulo Biome formatting applied by the pre-commit hook;
// semantics unchanged.) Parity fixture - do not edit. When parity fails, fix the port,
// never this file.

const MapStaticStatRegexEnglish = {
  rarity_prefix: 'y: ',
  rarity_normal: 'n',
  rarity_magic: 'm',
  rarity_rare: 'r',
  corrupted: 'pte',
  unidentified: 'tified',
}

export function unidentifiedMap(settings: { unidentified: { enabled: boolean; include: boolean } }): string {
  const statRegex = MapStaticStatRegexEnglish
  if (settings.unidentified.enabled) {
    return settings.unidentified.include ? statRegex.unidentified : `!${statRegex.unidentified}`
  }
  return ''
}

export function corruptedMapCheck(settings: { corrupted: { enabled: boolean; include: boolean } }): string {
  const statRegex = MapStaticStatRegexEnglish
  if (settings.corrupted.enabled) {
    return settings.corrupted.include ? statRegex.corrupted : `!${statRegex.corrupted}`
  }
  return ''
}

export function addRarityRegex(normal: boolean, magic: boolean, rare: boolean, include: boolean): string {
  const statRegex = MapStaticStatRegexEnglish
  if (normal && magic && rare) {
    return include
      ? ''
      : `"!${statRegex.rarity_prefix}(${statRegex.rarity_normal}|${statRegex.rarity_magic}|${statRegex.rarity_rare})"`
  }
  const normalRegex = normal ? statRegex.rarity_normal : ''
  const magicRegex = magic ? statRegex.rarity_magic : ''
  const rareRegex = rare ? statRegex.rarity_rare : ''
  const result = [normalRegex, magicRegex, rareRegex].filter((e) => e.length > 0).join('|')

  const excludePrefix = include ? '' : '!'
  if (result.length === 0) return ''
  if (result.length === 1) return `"${excludePrefix}${statRegex.rarity_prefix}${result}"`
  if (result.length > 1) return `"${excludePrefix}${statRegex.rarity_prefix}(${result})"`
  return ''
}
