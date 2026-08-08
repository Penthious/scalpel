import { isLearnable } from '@shared/learning'
import type { StatFilter } from './types'

/**
 * Apply the learning engine's decisions as the final layer over the current
 * (post-base-mode) filters. A chip is marked `learned` only when the decision
 * changes its enabled state, so the icon appears only on genuine deviations from
 * the default the user would otherwise see. Defaults to an empty map so a
 * price-check restored across an auto-update from a pre-feature build (no
 * `learnedDecisions` in the saved payload) does not throw.
 */
export function applyLearnedDecisions(filters: StatFilter[], decisions: Record<string, boolean> = {}): StatFilter[] {
  return filters.map((f) => {
    // Rows the engine can't learn are also immune to a decision left behind by an
    // older build -- a Shako's two support rows can share one stat id, so applying a
    // by-id decision to both would resurrect the twin the producer left off (#564).
    if (!isLearnable(f)) return f
    if (!(f.id in decisions)) return f
    const want = decisions[f.id]
    if (want === f.enabled) return f
    return { ...f, enabled: want, learned: true }
  })
}
