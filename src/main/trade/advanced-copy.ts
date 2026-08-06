import { SKILL_GEM_CLASSES } from '@shared/poe-item'
import type { PoeItem } from '@shared/types'

/**
 * Both games now emit the advanced item description (the brace-wrapped
 * `{ Prefix Modifier "Sanguine" (Tier: 11) -- Life }` headers) for a plain
 * Ctrl+C, so Scalpel no longer holds Alt -- PoE's "show advanced item
 * descriptions" modifier -- while copying (#560).
 *
 * Dropping Alt fails *silently* on a client that still needs it: the copy still
 * parses, it just loses tiers, roll ranges and the headers the map/timeless
 * producers and the magic-base fallback rely on. This tracker is the guard. It
 * assumes plain Ctrl+C, and the first time an item that clearly should carry
 * advanced mods comes back without them it re-copies with Alt held. If that
 * second copy has them, the client needs Alt and every later copy holds it.
 *
 * The latch only ever flips on *positive* evidence, so one oddball item can't
 * convince us a client is fine when it isn't. An inconclusive probe (neither
 * copy has advanced mods) leaves the tracker probing, with a small cap so a
 * pathological item class can't cost a double copy forever.
 */
export type AdvancedCopyState = 'probing' | 'plain' | 'alt'

/** Inconclusive probes tolerated before giving up and settling on plain Ctrl+C. */
const MAX_INCONCLUSIVE_PROBES = 3

/**
 * True when `item` carries mods but no advanced-mod headers -- the signature of
 * a basic copy of something that has an advanced form.
 *
 * Items with no mods at all (currency, divination cards, unidentified rares)
 * are excluded because a second copy would tell us nothing. Skill gems are
 * excluded for the opposite reason: their stat lines parse as explicits, but
 * they genuinely have no `{ ... Modifier }` headers in either format, so they
 * would probe inconclusively every single time.
 */
export function looksLikeBasicCopy(item: PoeItem): boolean {
  if (item.advancedMods?.length) return false
  if (SKILL_GEM_CLASSES.has(item.itemClass)) return false
  return item.explicits.length > 0 || item.implicits.length > 0
}

export interface AdvancedCopyTracker {
  /** Whether the next copy should hold Alt. */
  needsAlt(): boolean
  /** Whether `item` warrants a confirming re-copy with Alt held. */
  shouldProbe(item: PoeItem): boolean
  /**
   * Feed back the Alt re-copy triggered by `shouldProbe`. Returns `altItem` when
   * it won (it carries advanced mods the plain copy lacked) -- the caller should
   * use it, and every later copy will hold Alt -- or null when the probe settled
   * nothing. Pass null for an Alt copy that failed to parse at all.
   */
  recordProbe(altItem: PoeItem | null): PoeItem | null
  /** Current state, for diagnostics. */
  state(): AdvancedCopyState
  /** Forget everything -- used when the active game changes in-process. */
  reset(): void
}

export function createAdvancedCopyTracker(): AdvancedCopyTracker {
  let state: AdvancedCopyState = 'probing'
  let inconclusive = 0

  return {
    needsAlt: () => state === 'alt',
    shouldProbe: (item) => state === 'probing' && looksLikeBasicCopy(item),
    recordProbe(altItem) {
      if (altItem?.advancedMods?.length) {
        state = 'alt'
        return altItem
      }
      inconclusive++
      if (inconclusive >= MAX_INCONCLUSIVE_PROBES) state = 'plain'
      return null
    },
    state: () => state,
    reset() {
      state = 'probing'
      inconclusive = 0
    },
  }
}

/** Process-wide tracker. One active game per process outside the experimental
 *  in-process game switch, which calls `reset()` on it. */
export const advancedCopyTracker = createAdvancedCopyTracker()
