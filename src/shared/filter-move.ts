import type { FilterBlock, FilterCondition, MoveBlockedReason, SourceLockReason } from './contracts/items'
import { checkRemovable } from './filter-removal'

/**
 * Whether the tier an item sits on can hand the base over, and why not if it
 * cannot. `null` means a clean strip.
 *
 * `not-by-name` is folded into `token`: both mean the block keeps matching the
 * item after the move, and neither can be narrowed by deleting a string. The
 * distinction only matters to the removal flow, which reports it separately.
 */
export function sourceLockFor(block: FilterBlock, baseType: string): SourceLockReason | null {
  const check = checkRemovable(block, baseType)
  if (check.removable) return null
  return check.reason === 'last-base' ? 'last-base' : 'token'
}

/**
 * Split a batch of bases into the ones a tier can hand over and the ones it must
 * keep, so at least one name always survives on the source.
 *
 * Planned in one pass up front rather than per-write: the writer re-checks the
 * parsed block, and that model is not refreshed between raw-line edits, so a
 * base-by-base check inside the loop reads stale conditions and lets the tier be
 * emptied. `moveBaseTypeBetweenTiers` keeps its own guard as a backstop for
 * single moves; this is what makes "move all of these" honest.
 */
export function planBatchMove(block: FilterBlock, baseTypes: string[]): { movable: string[]; stranded: string[] } {
  const values = block.conditions.filter((c) => c.type === 'BaseType').flatMap((c) => c.values)
  const movable: string[] = []
  const stranded: string[] = []
  let remaining = values.length

  for (const baseType of baseTypes) {
    const check = checkRemovable(block, baseType)
    // A substring token cannot be narrowed by deleting a string, and a block that
    // never names the base has nothing to give. 'last-base' is not a refusal in a
    // batch -- it only says every name is this one -- so the count below decides.
    const takes =
      check.removable || check.reason === 'last-base'
        ? values.filter((v) => v.toLowerCase() === baseType.toLowerCase()).length
        : 0
    if (takes === 0 || remaining - takes < 1) {
      stranded.push(baseType)
      continue
    }
    movable.push(baseType)
    remaining -= takes
  }

  return { movable, stranded }
}

/**
 * Whether `block` would actually catch the item once it names the base, judged on
 * everything except its `BaseType` line. Same predicate `findHideDestination`
 * uses to pick a hide target -- a destination whose other conditions fail is a
 * write that changes nothing, which is exactly how this bug presented: the panel
 * snapped back to the tier the item never left.
 *
 * `matchesWithout` is injected because the matcher lives in the main process and
 * this module is shared with the renderer.
 */
export function destinationBlocked(
  block: FilterBlock,
  matchesWithout: (conditions: FilterCondition[]) => boolean,
): Extract<MoveBlockedReason, 'conditions' | 'no-basetype'> | null {
  if (!block.conditions.some((c) => c.type === 'BaseType')) return 'no-basetype'
  return matchesWithout(block.conditions.filter((c) => c.type !== 'BaseType')) ? null : 'conditions'
}
