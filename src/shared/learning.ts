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

export function isLearnable(f: { type: string; randomSupport?: boolean }): boolean {
  // Forbidden Shako's randomized supports are excluded: both of its support rows can
  // share one stat id (same support in both slots), and a decision is keyed by id, so
  // learning "on" would enable the twin the producer deliberately left off - a pair of
  // filters on one indexable id matches nothing on trade. There is no standing
  // preference to learn here either; which support rolled is per-item luck (#564).
  if (f.randomSupport) return false
  return LEARNABLE_TYPES.has(f.type)
}
