// src/shared/learning.ts

/** Chip types the adaptive-defaults engine can learn and the context menu can
 *  pin: affix-family mods, granted skills (issue #478), map/waystone property
 *  chips (issue #561) and Mercenary Warrant skills/supports - every one a plain
 *  enable/disable toggle rendered as a StatFilterRow. Ternary/min-max chips (chipState-driven, not a boolean) and
 *  chips governed by their own dedicated defaults (weapon DPS settings, computed
 *  defence/base-percentile) remain phase 2.
 *
 *  Map chips carry a scrubbable `min` as well, but only `enabled` is learned -
 *  the min stays derived from this item's roll and the search percentage. */
export const LEARNABLE_TYPES = new Set([
  'explicit',
  'implicit',
  'pseudo',
  'crafted',
  'fractured',
  'enchant',
  'imbued',
  'skill',
  'map',
  'mercenary',
])

export function isLearnable(f: { type: string }): boolean {
  return LEARNABLE_TYPES.has(f.type)
}
