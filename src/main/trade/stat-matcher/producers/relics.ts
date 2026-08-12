import type { StatFilter } from '../../trade'
import { findAdvMod } from '../adv-mods'
import type { MatchContext } from '../context'
import { matchModToStat } from '../mod-matcher'

// Sanctum relics (PoE1 Sanctum, PoE2 Trial of the Sekhemas). Their prefix/suffix
// affixes live under the trade API's `sanctum.*` stat family, not `explicit.*`, so
// the normal explicit matcher never found them and the price checker showed no
// searchable chips. Match relic affixes against the sanctum stat list instead.

/** Sanctum stats that spell their count in words ("An additional Room"), so their
 *  trade text carries no `#` and the matcher hands back a null value -- but which
 *  the trade API still filters by value. Without the count these rolls searched as
 *  bare presence and were priced against the flood of 1-count relics (#582).
 *  Live-probed on Standard (2026-08-12), unfiltered / min:2 / min:3 listings:
 *    stat_386901949  (Rooms revealed)  1597 / 485 / 4
 *    stat_290775436  (Merchant Choice)  731 / 290 / 10
 *    stat_3878191575 (Forbidden Tomes)  975 / 340 / 0
 *  Curated per id: most valueless sanctum stats are genuinely binary ("Rooms are
 *  unknown on the Sanctum Map") and must stay presence-only. The one other stat of
 *  this shape, stat_1175354969 ("drops an additional Invocation"), is left out --
 *  it returns zero listings in any league, so there was nothing to probe. */
const VALUE_BEARING_VALUELESS_STATS = new Set([
  'sanctum.stat_386901949', // An additional Room is revealed on the Sanctum Map
  'sanctum.stat_290775436', // The Merchant has an additional Choice
  'sanctum.stat_3878191575', // The Herald of the Scourge drops an additional Forbidden Tome
])

export function buildRelicFilters(ctx: MatchContext): StatFilter[] {
  if (!ctx.isRelic) return []
  const { explicits, advancedMods, pct } = ctx
  const out: StatFilter[] = []
  for (const mod of explicits) {
    const cleaned = mod.trim()
    const matched = matchModToStat(cleaned, false, 'sanctum')
    if (!matched) continue

    // Adopt the count these stats hide in their text, and search it as an exact
    // MIN: these are small integers picked per affix tier (1 room on "of
    // Illumination", 2 on "of Clairvoyance"), and the percentage floor would drop
    // 2 back to 1 -- the same result as no filter at all. The value-1 phrasing
    // spells the count as "An", not "1", so an absent digit means one.
    let value = matched.value
    let isFixedCount = false
    if (value == null && VALUE_BEARING_VALUELESS_STATS.has(matched.statId)) {
      const digits = cleaned.match(/\d+/)
      value = digits ? parseInt(digits[0], 10) : 1
      isFixedCount = true
    }

    let modTier: number | undefined
    let modRange: { min: number; max: number } | undefined
    if (advancedMods) {
      const advMod = findAdvMod(advancedMods, cleaned, 'explicit')
      if (advMod) {
        if (advMod.tier > 0) modTier = advMod.tier
        const range = advMod.ranges.find((r) => r.value === value)
        if (range && range.min !== range.max) modRange = { min: range.min, max: range.max }
      }
    }

    out.push({
      id: matched.statId,
      text: cleaned,
      value,
      min: value == null ? null : isFixedCount ? value : Math.floor(value * pct),
      max: null,
      enabled: true,
      type: 'sanctum',
      option: matched.option,
      aggregated: matched.aggregated,
      modTier,
      modRange,
    })
  }
  return out
}
