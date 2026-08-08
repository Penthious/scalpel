import { MINMAX_CHIP_IDS, TERNARY_CHIP_IDS } from './constants'
import type { StatFilter } from './types'

/**
 * Flip one filter row, applying the knock-on rules a plain boolean toggle can't
 * express. Pure so the rules can be tested without mounting the panel; the
 * component just feeds it the previous state.
 */
export function toggleFilterAt(prev: StatFilter[], idx: number): StatFilter[] {
  const target = prev[idx]
  if (!target) return prev
  // Ternary and minmax chips are driven via chipState through the FilterChip's onChange path;
  // toggling them via this binary path would silently desync state.
  if (TERNARY_CHIP_IDS.has(target.id) || MINMAX_CHIP_IDS.has(target.id)) return prev
  const toggling = !target.enabled
  return prev.map((f, i) => {
    if (i === idx) {
      if (toggling && f.type === 'timeless') return { ...f, enabled: true }
      return { ...f, enabled: toggling }
    }
    // Timeless chips are mutually exclusive: enabling one disables the other
    if (f.type === 'timeless' && target.type === 'timeless' && toggling) {
      return { ...f, enabled: false }
    }
    // Auto-flip the Fractured chip to "yes" when a fractured-mod row is toggled on
    if (f.id === 'misc.fractured' && target.type === 'fractured' && toggling) {
      return { ...f, chipState: 'yes' }
    }
    // Switching a Mercenary Warrant skill off takes its supports with it: a
    // support is searched inside its skill's group, so one left on without its
    // skill would silently pull the skill back into the query. Switching the
    // skill back on does NOT restore them -- that would resurrect picks the user
    // may have cleared on purpose.
    if (!toggling && target.type === 'mercenary' && f.mercenarySkillId === target.id) {
      return { ...f, enabled: false }
    }
    return f
  })
}
