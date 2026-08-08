import vestigialPoe1 from './data/items/vestigial-poe1.json'

/** One mod a unique can hand to the item it becomes when enshrouded. `from` is
 *  the donor's own line (a rolled range), `to` is the fixed-value Vestigial
 *  implicit the result carries. */
export interface VestigialMod {
  from: string
  to: string
}

const DONORS = vestigialPoe1 as Record<string, VestigialMod[]>

/** Vestigial mods a PoE1 unique would donate, or undefined when it donates
 *  nothing. PoE1 only -- the mechanic does not exist in PoE2, so callers gate on
 *  version before asking. */
export function getVestigialMods(name: string): VestigialMod[] | undefined {
  const mods = DONORS[name]
  return mods && mods.length > 0 ? mods : undefined
}
