/**
 * The buyout-currency catalog -- every value GGG's trade site offers for
 * `trade_filters.price.option`, per game.
 *
 * Transcribed from the live `/api/trade/data/filters` and
 * `/api/trade2/data/filters` payloads (2026-08-08). The two lists are largely
 * disjoint: Blessed/Chromatic/Gemcutter's/Fusing/Chance/Alteration/Scouring/
 * Regret/Jeweller's are PoE1-only, Augmentation/Transmutation/Annulment are
 * PoE2-only. Refresh with scripts/local/cloak/get-filters-poe{1,2}.mjs when GGG
 * adds or removes currencies -- roughly once a league, which is why this is
 * bundled rather than fetched at runtime.
 *
 * GGG models the "equivalent" mode as an option with a `null` id, meaning
 * "omit the price filter and do the equivalence math yourself". We give it a
 * synthetic string value (`chaos_equivalent` / `exalted_equivalent`) so it can
 * round-trip through settings, and drop the filter at query time instead --
 * see TradeDialect.priceEquivalent in main/trade/trade.ts.
 *
 * Labels are GGG's own text, with one exception: the two synthetic aggregates
 * lose the redundant "Orb(s)" noun ("Chaos or Divine", not "Chaos or Divine
 * Orbs"). GGG's full strings are 121px wide and the price-check panel's compact
 * three-up dropdown gives each label ~108px, so the two most-used options -- the
 * per-game defaults -- would clip in the closed state. The real currency names
 * stay verbatim; only "Mirror of Kalandra" still overruns, and only by a pixel.
 *
 * This is the single source of truth for the option list AND for the
 * `TradePriceOption` type: contracts/core.ts re-exports the derived union
 * rather than restating it.
 */

import type { GameVariant } from './contracts/game-variant'

export interface TradePriceOptionEntry {
  /** Sent as `trade_filters.price.option`, except for the two synthetic
   *  `*_equivalent` values which suppress the filter entirely. Typed as the
   *  derived union (declared below) so dropdowns infer it through to their
   *  onChange handlers instead of widening to `string`. */
  value: TradePriceOption
  /** GGG's own text for the option, verbatim. */
  label: string
  /** `<optgroup>` heading. Curated (commonly-used) entries omit it and render
   *  bare above the first group. */
  group?: string
}

/** Heading for the long tail of niche currencies. English by design: every
 *  other option label in this app's dropdowns is hardcoded English too, and
 *  translating one heading while its 21 siblings stay English reads worse than
 *  leaving the whole set alone. */
const OTHER = 'Other currencies'

/** Curated entries first (the ones almost everyone wants), then the rest under
 *  one group. The tail is ordered by the distinctive word rather than the
 *  literal string, so the eight "Orb of ..." entries don't clump together.
 *
 *  Deliberately un-annotated: `as const` has to survive so TradePriceOption can
 *  be derived from the literal values instead of widening to `string`. */
const POE1 = [
  { value: 'chaos_divine', label: 'Chaos or Divine' },
  { value: 'chaos_equivalent', label: 'Chaos Equivalent' },
  { value: 'chaos', label: 'Chaos Orb' },
  { value: 'divine', label: 'Divine Orb' },
  { value: 'alch', label: 'Orb of Alchemy', group: OTHER },
  { value: 'alt', label: 'Orb of Alteration', group: OTHER },
  { value: 'blessed', label: 'Blessed Orb', group: OTHER },
  { value: 'chance', label: 'Orb of Chance', group: OTHER },
  { value: 'chrome', label: 'Chromatic Orb', group: OTHER },
  { value: 'exalted', label: 'Exalted Orb', group: OTHER },
  { value: 'fusing', label: 'Orb of Fusing', group: OTHER },
  { value: 'gcp', label: "Gemcutter's Prism", group: OTHER },
  { value: 'jewellers', label: "Jeweller's Orb", group: OTHER },
  { value: 'mirror', label: 'Mirror of Kalandra', group: OTHER },
  { value: 'regal', label: 'Regal Orb', group: OTHER },
  { value: 'regret', label: 'Orb of Regret', group: OTHER },
  { value: 'scour', label: 'Orb of Scouring', group: OTHER },
  { value: 'vaal', label: 'Vaal Orb', group: OTHER },
] as const

const POE2 = [
  { value: 'exalted_divine', label: 'Exalted or Divine' },
  { value: 'exalted_equivalent', label: 'Exalted Equivalent' },
  { value: 'exalted', label: 'Exalted Orb' },
  { value: 'divine', label: 'Divine Orb' },
  { value: 'chaos', label: 'Chaos Orb' },
  { value: 'alch', label: 'Orb of Alchemy', group: OTHER },
  { value: 'annul', label: 'Orb of Annulment', group: OTHER },
  { value: 'aug', label: 'Orb of Augmentation', group: OTHER },
  { value: 'mirror', label: 'Mirror of Kalandra', group: OTHER },
  { value: 'regal', label: 'Regal Orb', group: OTHER },
  { value: 'transmute', label: 'Orb of Transmutation', group: OTHER },
  { value: 'vaal', label: 'Vaal Orb', group: OTHER },
] as const

export const TRADE_PRICE_OPTIONS: Record<GameVariant, readonly TradePriceOptionEntry[]> = {
  1: POE1,
  2: POE2,
}

/** Every option value either game accepts. Persisted profiles are typed against
 *  this, not against the per-game list, because one store holds both games. */
export type TradePriceOption = (typeof POE1)[number]['value'] | (typeof POE2)[number]['value']

/** The pre-selected option for a fresh profile: GGG's own default, the
 *  "baseline or divine" pair. */
export function defaultPriceOption(version: GameVariant): TradePriceOption {
  return version === 2 ? 'exalted_divine' : 'chaos_divine'
}

export function isValidPriceOption(value: unknown, version: GameVariant): value is TradePriceOption {
  return typeof value === 'string' && TRADE_PRICE_OPTIONS[version].some((o) => o.value === value)
}

/** Coerce a stored/incoming option to one this game actually offers.
 *
 *  The lists are mostly disjoint, so a value carried across games (or left over
 *  from an older catalog) would otherwise be shown as the first dropdown entry
 *  while the wrong id kept going out to GGG. Falling back to the default pair
 *  keeps display and query honest about each other. */
export function normalizePriceOption(value: unknown, version: GameVariant): TradePriceOption {
  return isValidPriceOption(value, version) ? value : defaultPriceOption(version)
}
