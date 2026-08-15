import type { FilterFile, MatchResult, PoeItem, TierGroup, TierSibling } from '@shared/types'
import { destinationBlocked, sourceLockFor } from '@shared/filter-move'
import { evaluateBlock } from './matcher'

/**
 * Build the tier dropdown for the block an item landed on: the tiers sharing its
 * typePath that could actually receive it.
 *
 * "Could receive it" does a lot of work. A tier is only a destination if naming
 * the base there would change which block catches the item -- so a tier gated on
 * conditions the item fails is left out entirely. That is the common shape in
 * PoE2: FilterBlade's trial coins are four `ItemLevel` bands over one base, and
 * an ilvl 83 coin belongs to exactly one of them by definition. Offering the
 * other three as somewhere to "move" it is meaningless, because the tier is a
 * range, not a list you can be added to.
 *
 * Kept out of evaluation.ts so it can be tested without dragging in the overlay
 * window, the clipboard and the price pipeline.
 */
export function buildTierGroup(filter: FilterFile, activeMatch: MatchResult, item: PoeItem): TierGroup | undefined {
  const tag = activeMatch.block.tierTag
  if (!tag) return undefined

  // Can the current tier hand the base over? When it cannot, the item stays
  // matched there after the move, so only a destination that already sits
  // earlier in the file can take effect.
  const sourceLock = sourceLockFor(activeMatch.block, item.baseType)

  const siblings: TierSibling[] = []
  for (let i = 0; i < filter.blocks.length; i++) {
    const b = filter.blocks[i]
    if (b.tierTag && b.tierTag.typePath === tag.typePath) {
      const evaluation = evaluateBlock(b, item)
      const blocked =
        i === activeMatch.blockIndex
          ? undefined
          : (destinationBlocked(b, (conds) => evaluateBlock({ conditions: conds }, item).matches) ??
            (sourceLock && i > activeMatch.blockIndex ? 'outranked' : undefined))
      // A tier that cannot catch this item is not a destination, so it is not
      // offered. Listing it -- greyed out or not -- only invites the click that
      // used to write a change and snap straight back.
      if (blocked) continue
      siblings.push({
        tier: b.tierTag.tier,
        visibility: b.visibility,
        blockIndex: i,
        block: b,
        match: {
          block: b,
          blockIndex: i,
          isFirstMatch: i === activeMatch.blockIndex,
          evaluatedConditions: evaluation.evaluatedConditions,
          hasUnknowns: evaluation.hasUnknowns,
        },
      })
    }
  }

  // A lone tier still gets a group: the dropdown's Remove row is itself a choice,
  // so a one-entry list is not an empty one. Only a block with no tier tag at all
  // (handled above) has nothing to show.
  if (siblings.length === 0) return undefined

  // If siblings with this base type are differentiated only by threshold conditions
  // (StackSize, Quality, MemoryStrands), the slider handles navigation - hide the dropdown.
  // But if different tiers have different base type lists, that's normal tiering.
  const baseType = item.baseType
  const siblingsWithBaseType = siblings.filter((s) =>
    s.block.conditions.some((c) => c.type === 'BaseType' && c.values.includes(baseType)),
  )
  if (siblingsWithBaseType.length > 1) {
    // Check if these siblings have the same base type list (threshold-only differentiation)
    const thresholdTypes = new Set(['StackSize', 'Quality', 'MemoryStrands'])
    const allSameBaseTypes = siblingsWithBaseType.every((s) => {
      const btValues = s.block.conditions
        .filter((c) => c.type === 'BaseType')
        .flatMap((c) => c.values)
        .sort()
        .join(',')
      const firstBtValues = siblingsWithBaseType[0].block.conditions
        .filter((c) => c.type === 'BaseType')
        .flatMap((c) => c.values)
        .sort()
        .join(',')
      return btValues === firstBtValues
    })
    const differByThresholdOnly =
      allSameBaseTypes && siblingsWithBaseType.some((s) => s.block.conditions.some((c) => thresholdTypes.has(c.type)))
    if (differByThresholdOnly) return undefined
  }

  return { typePath: tag.typePath, siblings, currentTier: tag.tier }
}
