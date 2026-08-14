/** Hybrid Vaal gems whose Vaal half is NOT simply "Vaal <base skill>". The clipboard
 *  names a hybrid gem by its non-Vaal half ("Purity of Fire"), so building the trade
 *  type by prefixing "Vaal " produces a base type the trade API rejects outright with
 *  "Unknown item base type" -- a price check with zero results (#589). */
export const VAAL_GEM_NAMES: Record<string, string> = {
  'Dominating Blow': 'Vaal Domination',
  'Purity of Fire': 'Vaal Impurity of Fire',
  'Purity of Ice': 'Vaal Impurity of Ice',
  'Purity of Lightning': 'Vaal Impurity of Lightning',
}

/** The trade base type of a base skill's Vaal half: the renamed one where GGG renamed
 *  it, the plain "Vaal " prefix everywhere else. */
export function vaalGemType(baseSkill: string): string {
  return VAAL_GEM_NAMES[baseSkill] ?? `Vaal ${baseSkill}`
}
