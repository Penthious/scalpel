// src/main/filter/intent-replay.ts

import type { ActionType, ComparisonOperator, FilterBlock, FilterFile } from '@shared/types'
import { checkRemovable } from '@shared/filter-removal'
import type {
  Intent,
  IntentLog,
  MoveBaseTypePayload,
  RemoveBaseTypePayload,
  AddBaseTypePayload,
  SetActionPayload,
  SetThresholdPayload,
  SetVisibilityPayload,
} from './intents'
import { parseFilterFile } from './parser'

export interface ReplayConflict {
  intent: Intent
  description: string
  options: { label: string; action: 'keep-mine' | 'take-upstream' }[]
}

export interface ReplayResult {
  filter: FilterFile
  modifiedBlocks: Set<number>
  /** Blocks that should be dropped from the output entirely (e.g. a move emptied
   *  the block's only condition, which would otherwise become a catch-all). */
  removedBlocks: Set<number>
  conflicts: ReplayConflict[]
  stats: {
    applied: number
    skipped: number
    conflicts: number
  }
}

function findBlockByTierTag(
  filter: FilterFile,
  typePath: string,
  tier: string,
): { block: FilterBlock; index: number } | null {
  for (let i = 0; i < filter.blocks.length; i++) {
    const b = filter.blocks[i]
    if (b.tierTag && b.tierTag.typePath === typePath && b.tierTag.tier === tier) {
      return { block: b, index: i }
    }
  }
  return null
}

function findBaseTypeInFilter(filter: FilterFile, value: string): { block: FilterBlock; index: number } | null {
  for (let i = 0; i < filter.blocks.length; i++) {
    const b = filter.blocks[i]
    for (const cond of b.conditions) {
      if (cond.type === 'BaseType' && cond.values.includes(value)) {
        return { block: b, index: i }
      }
    }
  }
  return null
}

/** First block under `typePath` that names `value` exactly. Fallback for a renamed tier. */
function findBlockByTypePathListing(
  filter: FilterFile,
  typePath: string,
  value: string,
): { block: FilterBlock; index: number } | null {
  const target = value.toLowerCase()
  for (let i = 0; i < filter.blocks.length; i++) {
    const b = filter.blocks[i]
    if (b.tierTag?.typePath !== typePath) continue
    for (const cond of b.conditions) {
      if (cond.type === 'BaseType' && cond.values.some((v) => v.toLowerCase() === target)) {
        return { block: b, index: i }
      }
    }
  }
  return null
}

export function replayIntents(
  upstreamContent: string,
  upstreamPath: string,
  intentLog: IntentLog,
  options?: { resolutions?: Map<number, 'keep-mine' | 'take-upstream'>; forceApply?: boolean },
): ReplayResult {
  // Parse a working copy of the upstream filter
  const filter = parseFilterFile(upstreamPath, upstreamContent)
  const conflicts: ReplayConflict[] = []
  const modifiedBlocks = new Set<number>()
  const removedBlocks = new Set<number>()
  let applied = 0
  let skipped = 0

  for (let i = 0; i < intentLog.intents.length; i++) {
    const intent = intentLog.intents[i]
    const { typePath, tier } = intent.target

    if (intent.type === 'add-basetype') {
      const p = intent.payload as AddBaseTypePayload
      const resolved = findBlockByTierTag(filter, typePath, tier)
      if (!resolved) {
        conflicts.push({
          intent,
          description: `Couldn't re-hide "${p.value}": ${typePath}/${tier} no longer exists.`,
          options: [],
        })
        skipped++
        continue
      }

      const targetBaseType = resolved.block.conditions.find((c) => c.type === 'BaseType')
      if (!targetBaseType) {
        // Creating a BaseType line here would narrow a class-rules block to this
        // one base. Refuse rather than silently break the tier.
        conflicts.push({
          intent,
          description: `Couldn't re-hide "${p.value}": ${typePath}/${tier} no longer lists bases by name.`,
          options: [],
        })
        skipped++
        continue
      }

      if (!targetBaseType.values.includes(p.value)) {
        targetBaseType.values.push(p.value)
        modifiedBlocks.add(resolved.index)
      }
      applied++
      continue
    }

    if (intent.type === 'remove-basetype') {
      const p = intent.payload as RemoveBaseTypePayload
      // Ladder: exact tag, then same typePath, then give up loudly. A resolved tag
      // that no longer lists the value means the removal is already satisfied -- we
      // deliberately do NOT then hunt the base down in a sibling tier, because the
      // user scoped this removal to one tier.
      const resolved =
        findBlockByTierTag(filter, typePath, tier) ?? findBlockByTypePathListing(filter, typePath, p.value)

      if (!resolved) {
        conflicts.push({
          intent,
          description: `Couldn't re-apply: "${p.value}" is no longer in ${typePath}/${tier}.`,
          options: [],
        })
        skipped++
        continue
      }

      const check = checkRemovable(resolved.block, p.value)

      if (!check.removable && check.reason === 'not-by-name') {
        // Upstream already dropped it. Nothing to do.
        applied++
        continue
      }

      if (!check.removable) {
        const why =
          check.reason === 'last-base'
            ? `removing it would leave ${typePath}/${tier} matching its whole item class`
            : `${typePath}/${tier} now catches it via the pattern "${check.token}"`
        conflicts.push({
          intent,
          description: `Couldn't re-apply the removal of "${p.value}": ${why}.`,
          options: [],
        })
        skipped++
        continue
      }

      for (const cond of resolved.block.conditions) {
        if (cond.type === 'BaseType') {
          cond.values = cond.values.filter((v) => !check.exact.includes(v))
        }
      }
      resolved.block.conditions = resolved.block.conditions.filter(
        (c) => !(c.type === 'BaseType' && c.values.length === 0),
      )
      modifiedBlocks.add(resolved.index)
      applied++
      continue
    }

    const match = findBlockByTierTag(filter, typePath, tier)

    if (!match) {
      conflicts.push({
        intent,
        description: `Target tier ${typePath}/${tier} no longer exists in the updated filter.`,
        options: [],
      })
      skipped++
      continue
    }

    // Check if user provided a resolution for this intent
    const resolution = options?.resolutions?.get(i)
    const forceApply = options?.forceApply ?? false

    if (intent.type === 'move-basetype') {
      const p = intent.payload as MoveBaseTypePayload
      const current = findBaseTypeInFilter(filter, p.value)

      if (!current) {
        conflicts.push({
          intent,
          description: `"${p.value}" no longer exists in the filter.`,
          options: [],
        })
        skipped++
        continue
      }

      // Check if upstream also moved it (it's not in fromTier anymore)
      const isInOriginalTier = current.block.tierTag?.tier === p.fromTier
      const isAlreadyInTarget = current.block.tierTag?.tier === tier && current.block.tierTag?.typePath === typePath

      if (isAlreadyInTarget) {
        // Already where we want it
        applied++
        continue
      }

      if (!isInOriginalTier && !resolution && !forceApply) {
        // Upstream moved it somewhere else - conflict
        const upstreamTier = current.block.tierTag?.tier ?? 'unknown'
        conflicts.push({
          intent,
          description: `"${p.value}" was moved to ${upstreamTier} by the filter update, but you had it in ${tier}.`,
          options: [
            { label: `Keep mine (${tier})`, action: 'keep-mine' },
            { label: `Take update (${upstreamTier})`, action: 'take-upstream' },
          ],
        })
        skipped++
        continue
      }

      if (resolution === 'take-upstream') {
        skipped++
        continue
      }

      // Both ends get the same guards the live writer applies, because a replayed
      // move rewrites the file exactly as the original one did -- an unguarded
      // replay re-inflicts the damage on every sync, even after the user repairs
      // the file by hand.
      const moveCheck = checkRemovable(current.block, p.value)
      // Taking the last name off a tier is only safe when nothing is left to
      // match on: that tier stops existing, which is honest. When the tier has
      // OTHER conditions, the same strip silently widens it to everything those
      // allow -- `ItemLevel >= 80` on its own lights up every high-level drop in
      // the game. That is the one case this must refuse.
      const emptiesBlock =
        !moveCheck.removable &&
        moveCheck.reason === 'last-base' &&
        current.block.conditions.every((c) => c.type === 'BaseType')

      if (!moveCheck.removable && !emptiesBlock) {
        const fromTier = current.block.tierTag?.tier ?? `block #${current.index + 1}`
        const why =
          moveCheck.reason === 'last-base'
            ? `it is the only base ${fromTier} names, so removing it would leave that tier matching everything its other conditions allow`
            : moveCheck.reason === 'token'
              ? `${fromTier} now catches it via the pattern "${moveCheck.token}"`
              : `${fromTier} no longer names it`
        conflicts.push({
          intent,
          description: `Couldn't re-apply the move of "${p.value}": ${why}.`,
          options: [],
        })
        skipped++
        continue
      }

      // Creating a BaseType line on a class-rules tier would narrow it from
      // "everything of this class" to this one base -- the same damage inverted.
      const targetBaseType = match.block.conditions.find((c) => c.type === 'BaseType')
      if (!targetBaseType) {
        conflicts.push({
          intent,
          description: `Couldn't move "${p.value}" to ${typePath}/${tier}: it no longer lists bases by name.`,
          options: [],
        })
        skipped++
        continue
      }

      // Apply the move: remove from current location, add to target
      const strip = moveCheck.removable ? moveCheck.exact : [p.value]
      for (const cond of current.block.conditions) {
        if (cond.type === 'BaseType') {
          cond.values = cond.values.filter((v) => !strip.includes(v))
        }
      }
      // Drop any BaseType condition that is now empty so we never serialize a
      // dangling "BaseType ==" line (PoE parse error). The guard above has
      // already ruled out the case where that would widen the block.
      current.block.conditions = current.block.conditions.filter(
        (c) => !(c.type === 'BaseType' && c.values.length === 0),
      )
      if (current.block.conditions.length === 0) {
        // Nothing left to match on. A condition-less block is a catch-all that
        // matches every item, so the block goes rather than the tier becoming one.
        removedBlocks.add(current.index)
        modifiedBlocks.delete(current.index)
      } else {
        modifiedBlocks.add(current.index)
      }

      if (!targetBaseType.values.includes(p.value)) {
        targetBaseType.values.push(p.value)
      }
      modifiedBlocks.add(match.index)
      applied++
    } else if (intent.type === 'set-visibility') {
      const p = intent.payload as SetVisibilityPayload
      match.block.visibility = p.visibility
      modifiedBlocks.add(match.index)
      applied++
    } else if (intent.type === 'set-threshold') {
      const p = intent.payload as SetThresholdPayload
      const cond = match.block.conditions.find((c) => c.type === p.condition)
      if (cond) {
        cond.operator = p.operator as ComparisonOperator
        cond.values = [String(p.value)]
      }
      modifiedBlocks.add(match.index)
      applied++
    } else if (intent.type === 'set-action') {
      const p = intent.payload as SetActionPayload
      if (p.values.length === 0) {
        // Remove the action
        match.block.actions = match.block.actions.filter((a) => a.type !== p.action)
      } else {
        const existing = match.block.actions.find((a) => a.type === p.action)
        if (existing) {
          existing.values = p.values
        } else {
          match.block.actions.push({ type: p.action as ActionType, values: p.values })
        }
      }
      modifiedBlocks.add(match.index)
      applied++
    }
  }

  // Return the modified filter object - caller handles serialization and I/O
  return {
    filter,
    modifiedBlocks,
    removedBlocks,
    conflicts,
    stats: { applied, skipped: skipped - conflicts.length, conflicts: conflicts.length },
  }
}
