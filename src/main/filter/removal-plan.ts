import type { FilterFile, MatchResult, PoeItem, TierTag } from '@shared/types'
import { checkRemovable } from '@shared/filter-removal'
import { evaluateBlock, findMatchingBlocks } from './matcher'

export interface RemovalTarget {
  blockIndex: number
  tierTag?: TierTag
}

export interface SkippedTarget extends RemovalTarget {
  /** Why this tier keeps the base: it names it in a way we cannot safely strip. */
  reason: 'token' | 'last-base'
}

/** Ancestor typePaths, nearest first: `currency->stackedsix` -> [`currency->stackedsix`, `currency`]. */
function ancestorTypePaths(typePath: string): string[] {
  const parts = typePath.split('->')
  const out: string[] = []
  for (let n = parts.length; n >= 1; n--) out.push(parts.slice(0, n).join('->'))
  return out
}

/**
 * The nearest Hide tier this item could be added to.
 *
 * Removal alone cannot hide anything: it drops the item to a catch-all, and those
 * are usually `Show`. To actually stop seeing an item you must add it to a block
 * that hides it -- and `.filter` has no "except" primitive, so that means an
 * existing Hide block.
 *
 * A destination must already list bases. Appending to a `BaseType` line is safe;
 * *creating* one on a class-rules block would narrow it from "everything of this
 * class" to "only this base" (see addBaseTypeToRawLines). Its other conditions
 * must also match the item, or adding the base would hide nothing.
 *
 * Candidates are searched by walking up the typePath hierarchy so the destination
 * stays topically related -- a 20-stack Chaos Orb sits under
 * `currency->stackedsix`, whose hidden tiers live one level up under `currency`.
 */
export function findHideDestination(
  filter: FilterFile,
  item: PoeItem,
  fromTypePath: string,
  /** The block the item would otherwise land on. A Hide tier only hides anything
   *  if it wins the first-match race, so anything at or after this is useless. */
  beforeIndex: number,
): RemovalTarget | null {
  const usable = (block: FilterFile['blocks'][number]): boolean => {
    if (block.visibility !== 'Hide' || block.continue) return false
    if (!block.conditions.some((c) => c.type === 'BaseType')) return false
    const withoutBaseType = { ...block, conditions: block.conditions.filter((c) => c.type !== 'BaseType') }
    return evaluateBlock(withoutBaseType, item).matches
  }

  // Prefer a topically related tier: walk up the typePath hierarchy first.
  for (const typePath of ancestorTypePaths(fromTypePath)) {
    for (let i = 0; i < Math.min(beforeIndex, filter.blocks.length); i++) {
      const block = filter.blocks[i]
      if (block.tierTag?.typePath !== typePath) continue
      if (!usable(block)) continue
      return { blockIndex: i, tierTag: block.tierTag }
    }
  }

  // Otherwise any Hide tier that will do the job. FilterBlade filters carry
  // general-purpose hide lists (a Hide block whose only condition is BaseType)
  // that accept anything -- without this fallback, rare equipment has nowhere to
  // go, because its own typePath is governed by class rules rather than names.
  for (let i = 0; i < Math.min(beforeIndex, filter.blocks.length); i++) {
    const block = filter.blocks[i]
    if (!usable(block)) continue
    return { blockIndex: i, tierTag: block.tierTag }
  }

  return null
}

export interface RemovalPlan {
  /** Tiers the base will be stripped from, in file order. */
  targets: RemovalTarget[]
  /** Tiers that catch the item by name but cannot be stripped. They will keep
   *  catching it, so the outcome is a partial removal. */
  skipped: SkippedTarget[]
  /** The block that still catches the item once every target is stripped, or null
   *  when nothing does (the game then renders it with default styling). */
  landsOn: MatchResult | null
}

/**
 * Work out everything a removal touches.
 *
 * A base is routinely named by several blocks at once -- FilterBlade tiers stacked
 * currency by StackSize, so a Chaos Orb is named by three separate tiers that all
 * match a 20-stack. Stripping only the active one demotes the item by one tier
 * rather than removing it, which is not what "remove from your filter" means.
 *
 * Scope is deliberately "every block that matches THIS item", not "every block
 * naming the base". `Sapphire Ring` appears in blocks gated on `Rarity Unique`;
 * a rare ring must not touch those.
 *
 * Blocks that catch the item without naming it (class rules) are left alone and
 * become the landing spot -- they are the reason removal works at all.
 */
export interface HidePlan extends RemovalPlan {
  /** True when stripping alone leaves the item on a Hide block, so no destination
   *  is needed. Note that landing on *nothing* is not hidden -- the game then
   *  draws the item with default styling. */
  alreadyHidden: boolean
  /** Hide tier to add the base to, or null when none is needed or available. */
  destination: RemovalTarget | null
  /** The tier to flip to `Hide` outright, when it names this base and nothing
   *  else. Takes precedence over `destination`: see `findFlipTarget`. */
  flip: RemovalTarget | null
}

/**
 * The tier the item is on, when that tier names this base and nothing else.
 *
 * Such a tier is not a list the item happens to be in -- it *is* the item, so
 * hiding the item and hiding the tier are the same act. Flipping its visibility
 * beats every other route: no base moves, no other tier is touched, and the
 * change is undone by flipping it back.
 *
 * It also rescues the one case the strip-and-add route cannot handle at all. A
 * tier naming a single base is exactly `checkRemovable`'s `last-base` refusal --
 * the base cannot be stripped without widening the tier to everything its
 * remaining conditions allow. FilterBlade's PoE2 trial coins are this shape:
 * `ItemLevel >= 80` over one base, four bands deep.
 *
 * Note the blast radius is the tier's own definition, not this single item: the
 * 80+ band hides for every Djinn Barya at that level. That is inherent -- the
 * format has no per-item exception -- and it is what makes the tier the right
 * thing to flip.
 */
function findFlipTarget(filter: FilterFile, item: PoeItem, baseType: string): RemovalTarget | null {
  const active = findMatchingBlocks(filter, item).find((m) => m.isFirstMatch)
  if (!active || active.block.visibility === 'Hide') return null
  const named = active.block.conditions.filter((c) => c.type === 'BaseType').flatMap((c) => c.values)
  if (named.length === 0) return null
  const target = baseType.toLowerCase()
  if (!named.every((v) => v.toLowerCase() === target)) return null
  return { blockIndex: active.blockIndex, tierTag: active.block.tierTag }
}

/**
 * Everything required to stop an item being drawn.
 *
 * Two steps, and both are needed in the general case: strip every tier that names
 * the item (otherwise an earlier tier keeps showing it), then add it to a Hide
 * tier that wins the first-match race (otherwise it falls to a catch-all, and
 * those are usually `Show`).
 */
export function planHide(filter: FilterFile, item: PoeItem, baseType: string, fromTypePath: string): HidePlan {
  const plan = planRemoval(filter, item, baseType)
  const alreadyHidden = plan.landsOn?.block.visibility === 'Hide'
  const beforeIndex = plan.landsOn?.blockIndex ?? filter.blocks.length

  // A tier that names only this base is the item, so flipping it is the whole
  // job -- and it is checked first because it needs neither a strip nor a
  // destination, and works on tiers the strip route has to refuse.
  const flip = findFlipTarget(filter, item, baseType)
  if (flip) return { ...plan, alreadyHidden: false, destination: null, flip }

  return {
    ...plan,
    alreadyHidden,
    destination: alreadyHidden ? null : findHideDestination(filter, item, fromTypePath, beforeIndex),
    flip: null,
  }
}

export function planRemoval(filter: FilterFile, item: PoeItem, baseType: string): RemovalPlan {
  const targets: RemovalTarget[] = []
  const skipped: SkippedTarget[] = []
  const stripped = new Set<number>()

  for (let i = 0; i < filter.blocks.length; i++) {
    const block = filter.blocks[i]
    if (!evaluateBlock(block, item).matches) continue

    const check = checkRemovable(block, baseType)
    if (check.removable) {
      targets.push({ blockIndex: i, tierTag: block.tierTag })
      stripped.add(i)
    } else if (check.reason !== 'not-by-name') {
      skipped.push({ blockIndex: i, tierTag: block.tierTag, reason: check.reason })
    }
    // 'not-by-name' blocks catch it by class rules -- nothing to strip, and they
    // are exactly what the item falls through to.
  }

  let landsOn: MatchResult | null = null
  for (let i = 0; i < filter.blocks.length; i++) {
    const block = filter.blocks[i]
    if (stripped.has(i) || block.continue) continue
    const evaluation = evaluateBlock(block, item)
    if (!evaluation.matches) continue
    landsOn = {
      block,
      blockIndex: i,
      isFirstMatch: true,
      evaluatedConditions: evaluation.evaluatedConditions,
      hasUnknowns: evaluation.hasUnknowns,
    }
    break
  }

  return { targets, skipped, landsOn }
}
