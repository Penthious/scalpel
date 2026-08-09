import raw from './mod-sources-poe1.json'

/** Where a mod came from, when it isn't an ordinary craftable affix. Drives the
 *  small symbol shown beside the mod text on a price-check stat row. */
export type ModSource =
  | 'shaper'
  | 'elder'
  | 'crusader'
  | 'hunter'
  | 'redeemer'
  | 'warlord'
  | 'delve'
  | 'temple'
  | 'searing-exarch'
  | 'eater-of-worlds'

interface ModSourceDataset {
  schemaVersion: number
  classes: string[]
  sources: Record<string, string>
}

const DATA = raw as ModSourceDataset
const BADGED_CLASSES = new Set(DATA.classes)

/**
 * The origin of an affix, keyed on the name GGG prints in the advanced-copy header
 * (`{ Prefix Modifier "The Shaper's" (Tier: 1) — Damage }`).
 *
 * The name is the only identifier that pins a mod's origin exactly: per-base stat
 * ranges are ~50% ambiguous, mod groups mix sources, delve mods never enter the tier
 * pools (they are domain "delve"), and temple mods are absent from mods_by_base
 * entirely. See scripts/build-tier-data.js for the derivation.
 *
 * Scoped to the item classes that actually host these mods, because off-equipment
 * classes reuse the flavour names for unrelated affixes - a Sentinel's "of the Hunt"
 * grants a Hunter's Shrine, an Idol's "of the Underground" is a sulphite mod.
 *
 * PoE1 only, and English clients only: a translated client prints a translated affix
 * name, which won't match. Those rows get no badge rather than a wrong one.
 */
export function modSourceForAffix(affixName: string | undefined, itemClass: string | undefined): ModSource | undefined {
  if (!affixName || !itemClass) return undefined
  if (!BADGED_CLASSES.has(itemClass)) return undefined
  return DATA.sources[affixName] as ModSource | undefined
}
