import { ipcMain } from 'electron'
import type Store from 'electron-store'
import type {
  AppSettings,
  FilterAction,
  FilterBlock,
  FilterChange,
  FilterFile,
  PoeItem,
  RemovalPreview,
} from '@shared/types'
import { destinationBlocked, planBatchMove, sourceLockFor } from '@shared/filter-move'
import { evaluateAndSend } from '../evaluation'
import { planHide, planRemoval } from '../filter/removal-plan'
import { evaluateBlock, findMatchingBlocks } from '../filter/matcher'
import { describeIntent } from '../filter/intent-describe'
import { getIntents, record } from '../filter/intent-recorder'
import {
  moveBaseTypeBetweenTiers,
  addBaseTypeToTier,
  removeBaseTypeFromTiers,
  updateQualityThresholds,
  updateStackThresholds,
  updateStrandThresholds,
  writeBlockEdit,
} from '../filter/writer'
import { getCurrentFilter, loadFilter } from '../filter-state'
import { captureSnapshot } from '../history'
import { reloadFilterInGame } from '../overlay'
import { getProfileBackedSetting } from '../profiles/profile-settings'

// ---- History description helpers -------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  SetTextColor: 'text color',
  SetBorderColor: 'border color',
  SetBackgroundColor: 'background color',
  SetFontSize: 'font size',
  PlayAlertSound: 'alert sound',
  PlayAlertSoundPositional: 'alert sound',
  PlaySound: 'alert sound',
  PlayEffect: 'beam effect',
  MinimapIcon: 'minimap icon',
  CustomAlertSound: 'custom sound',
  CustomAlertSoundOptional: 'custom sound',
  DisableDropSound: 'drop sound',
  EnableDropSound: 'drop sound',
}

function describeBlockEdit(oldBlock: FilterBlock, newBlock: FilterBlock): string {
  const changes: string[] = []

  // Visibility change
  if (oldBlock.visibility !== newBlock.visibility) {
    changes.push(`${oldBlock.visibility} \u2192 ${newBlock.visibility}`)
  }

  // Build action maps for comparison
  const oldActions = new Map<string, FilterAction>()
  for (const a of oldBlock.actions) oldActions.set(a.type, a)
  const newActions = new Map<string, FilterAction>()
  for (const a of newBlock.actions) newActions.set(a.type, a)

  // Detect changed/added/removed actions
  for (const [type, newAction] of newActions) {
    const oldAction = oldActions.get(type)
    const label = ACTION_LABELS[type] ?? type
    if (!oldAction) {
      // Added
      if (newAction.values.length > 0) changes.push(`added ${label}`)
    } else if (JSON.stringify(oldAction.values) !== JSON.stringify(newAction.values)) {
      // Changed
      if (newAction.values.length === 0) {
        changes.push(`removed ${label}`)
      } else {
        changes.push(`changed ${label}`)
      }
    }
  }
  for (const [type] of oldActions) {
    if (!newActions.has(type)) {
      changes.push(`removed ${ACTION_LABELS[type] ?? type}`)
    }
  }

  if (changes.length === 0) return 'No visible changes'
  // Capitalize first change, join with commas
  const desc = changes.join(', ')
  return desc.charAt(0).toUpperCase() + desc.slice(1)
}

// ---- Tier move guard -------------------------------------------------------

/**
 * Why this tier move must not be written, or `null` when it is safe.
 *
 * A move only takes effect when the destination ends up winning the first-match
 * race, and it is only safe when neither end changes what it catches beyond this
 * one base. Three ways that fails, all of them silent before this guard existed:
 *
 * 1. The destination's other conditions rule the item out. FilterBlade's PoE2
 *    trial-coin tiers are `ItemLevel` bands over one base, so an ilvl 83 Djinn
 *    Barya cannot be caught by the 60-79 tier however it is named there.
 * 2. The destination lists no bases -- a class-rules tier. Writing a `BaseType`
 *    line onto it narrows it to this single base.
 * 3. The source cannot give the base up (it is the last one named, or a substring
 *    token catches the item) and sits earlier in the file, so it keeps winning.
 *    Stripping it anyway is what deleted the `BaseType` line from
 *    `trialkeysanctumtop` and turned it into "show every ilvl 80+ item".
 */
function checkTierMove(
  filter: FilterFile,
  baseType: string,
  fromBlockIndex: number,
  toBlockIndex: number,
  itemJson: string,
  fromTier: string,
  toTier: string,
): string | null {
  const fromBlock = filter.blocks[fromBlockIndex]
  const toBlock = filter.blocks[toBlockIndex]
  if (!fromBlock || !toBlock) return 'That tier no longer exists - reload the filter and try again.'
  if (fromBlockIndex === toBlockIndex) return null

  if (itemJson) {
    const item = JSON.parse(itemJson) as PoeItem
    const blocked = destinationBlocked(toBlock, (conds) => evaluateBlock({ conditions: conds }, item).matches)
    if (blocked === 'conditions') {
      return `${toTier} would not catch this ${baseType} - its other conditions rule the item out.`
    }
    if (blocked === 'no-basetype') {
      return `${toTier} lists no base types - adding one would narrow it to just ${baseType}.`
    }
  }

  const lock = sourceLockFor(fromBlock, baseType)
  if (lock && toBlockIndex > fromBlockIndex) {
    return lock === 'last-base'
      ? `${baseType} is the only base ${fromTier} names, so it cannot be given up without widening that tier, and ${fromTier} is matched first.`
      : `${fromTier} catches ${baseType} by a partial name, so it keeps matching first.`
  }

  return null
}

// ---- IPC handlers ----------------------------------------------------------

export function register(store: Store<AppSettings>): void {
  ipcMain.handle('save-block-edit', (_event, blockIndex: number, updatedBlock: FilterBlock, itemJson?: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const oldBlock = currentFilter.blocks[blockIndex]
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      const _tier = oldBlock?.tierTag?.tier ?? `block #${blockIndex + 1}`
      const changedActions: string[] = []
      if (oldBlock.visibility !== updatedBlock.visibility) changedActions.push('visibility')
      const oldActionsStr = new Map(oldBlock.actions.map((a) => [a.type, JSON.stringify(a.values)]))
      const newActionsStr = new Map(updatedBlock.actions.map((a) => [a.type, JSON.stringify(a.values)]))
      for (const [type, val] of newActionsStr) {
        if (oldActionsStr.get(type) !== val) changedActions.push(type)
      }
      for (const type of oldActionsStr.keys()) {
        if (!newActionsStr.has(type)) changedActions.push(type)
      }
      const itemName = item?.baseType
      const desc = describeBlockEdit(oldBlock, updatedBlock)
      captureSnapshot(currentFilter.path, 'block-edit', desc, itemName)
      // Record intents for the edit
      const tierTag = oldBlock.tierTag
      if (tierTag) {
        const target = { typePath: tierTag.typePath, tier: tierTag.tier }
        const now = Date.now()

        // Visibility change
        if (oldBlock.visibility !== updatedBlock.visibility) {
          record({
            type: 'set-visibility',
            target,
            payload: { visibility: updatedBlock.visibility },
            timestamp: now,
          })
        }

        // Action changes - compare old vs new
        const oldActionsMap = new Map(oldBlock.actions.map((a) => [a.type, a.values]))
        const newActionsMap = new Map(updatedBlock.actions.map((a) => [a.type, a.values]))
        for (const [actionType, newValues] of newActionsMap) {
          const oldValues = oldActionsMap.get(actionType)
          if (!oldValues || JSON.stringify(oldValues) !== JSON.stringify(newValues)) {
            record({
              type: 'set-action',
              target,
              payload: { action: actionType, values: newValues },
              timestamp: now,
            })
          }
        }
        // Actions removed
        for (const [actionType] of oldActionsMap) {
          if (!newActionsMap.has(actionType)) {
            record({
              type: 'set-action',
              target,
              payload: { action: actionType, values: [] },
              timestamp: now,
            })
          }
        }
      }
      writeBlockEdit(currentFilter, blockIndex, updatedBlock)
      // Reload to get fresh parsed state
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)

      // Re-evaluate and send fresh overlay data
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) {
        evaluateAndSend(item)
      }
      reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'move-item-tier',
    (_event, baseType: string, fromBlockIndex: number, toBlockIndex: number, itemJson: string) => {
      const currentFilter = getCurrentFilter()
      if (!currentFilter) return { ok: false, error: 'No filter loaded' }
      try {
        const fromTier = currentFilter.blocks[fromBlockIndex]?.tierTag?.tier ?? `block #${fromBlockIndex + 1}`
        const toTier = currentFilter.blocks[toBlockIndex]?.tierTag?.tier ?? `block #${toBlockIndex + 1}`

        // Re-checked main-side rather than trusted from the dropdown's disabled
        // state: the renderer's copy of the filter goes stale on any out-of-band
        // reload, and a refused move must fail loudly instead of writing a change
        // that silently reverts (or, worse, widens the tier it came from).
        const refusal = checkTierMove(currentFilter, baseType, fromBlockIndex, toBlockIndex, itemJson, fromTier, toTier)
        if (refusal) return { ok: false, error: refusal }

        captureSnapshot(currentFilter.path, 'tier-move', `Moved "${baseType}" from ${fromTier} to ${toTier}`, baseType)
        // Record intent
        const fromBlock = currentFilter.blocks[fromBlockIndex]
        const toBlock = currentFilter.blocks[toBlockIndex]
        if (toBlock.tierTag && fromBlock.tierTag) {
          record({
            type: 'move-basetype',
            target: { typePath: toBlock.tierTag.typePath, tier: toBlock.tierTag.tier },
            payload: { value: baseType, fromTier: fromBlock.tierTag.tier },
            timestamp: Date.now(),
          })
        }
        moveBaseTypeBetweenTiers(currentFilter, baseType, fromBlockIndex, toBlockIndex)
        // Reload to get fresh parsed state
        const path = getProfileBackedSetting(store, 'filterPath')
        if (path) loadFilter(path)

        // Re-evaluate the item against the updated filter and send fresh data
        const freshFilter = getCurrentFilter()
        if (freshFilter && itemJson) {
          const item: PoeItem = JSON.parse(itemJson)
          evaluateAndSend(item)
        }

        if (store.get('reloadOnSave') !== false) reloadFilterInGame()

        return { ok: true }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  // What a removal would do: which tiers it strips, which it cannot, and where the
  // item ends up. The renderer cannot work any of this out -- its match list stops
  // at the active block and it has no view of the rest of the filter.
  ipcMain.handle('preview-fall-through', (_event, _blockIndex: number, itemJson: string): RemovalPreview => {
    const empty: RemovalPreview = {
      landsOn: null,
      tierCount: 0,
      skipped: [],
      hideDestination: null,
      alreadyHidden: false,
      flipTier: null,
    }
    const currentFilter = getCurrentFilter()
    if (!currentFilter || !itemJson) return empty
    try {
      const item = JSON.parse(itemJson) as PoeItem
      const active = findMatchingBlocks(currentFilter, item).find((m) => m.isFirstMatch)
      const typePath = active?.block.tierTag?.typePath
      const plan = typePath
        ? planHide(currentFilter, item, item.baseType, typePath)
        : { ...planRemoval(currentFilter, item, item.baseType), alreadyHidden: false, destination: null, flip: null }
      return {
        landsOn: plan.landsOn,
        tierCount: plan.targets.length,
        skipped: plan.skipped.map((s) => ({ tier: s.tierTag?.tier ?? `block #${s.blockIndex + 1}`, reason: s.reason })),
        hideDestination: plan.destination?.tierTag?.tier ?? null,
        alreadyHidden: plan.alreadyHidden,
        flipTier: plan.flip?.tierTag?.tier ?? (plan.flip ? `block #${plan.flip.blockIndex + 1}` : null),
      }
    } catch {
      return empty
    }
  })

  /**
   * Hide an item outright.
   *
   * Two routes. When the tier the item is on names this base and nothing else,
   * the tier *is* the item and hiding it is a visibility flip -- no base moves,
   * nothing else is touched. Otherwise the base is stripped from every tier that
   * names it and added to the nearest Hide tier; the strip is required, because
   * appending alone would not work while an earlier tier still names the base.
   */
  ipcMain.handle('hide-item', (_event, baseType: string, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    if (!itemJson) return { ok: false, error: 'No item supplied' }
    try {
      const item: PoeItem = JSON.parse(itemJson)
      const active = findMatchingBlocks(currentFilter, item).find((m) => m.isFirstMatch)
      const typePath = active?.block.tierTag?.typePath
      if (!typePath) return { ok: false, error: 'Active tier has no type path' }

      const plan = planHide(currentFilter, item, baseType, typePath)

      if (plan.flip) {
        const block = currentFilter.blocks[plan.flip.blockIndex]
        const tier = plan.flip.tierTag?.tier ?? `block #${plan.flip.blockIndex + 1}`
        captureSnapshot(currentFilter.path, 'block-edit', `Hid the ${tier} tier`, baseType)
        if (plan.flip.tierTag) {
          record({
            type: 'set-visibility',
            target: { typePath: plan.flip.tierTag.typePath, tier: plan.flip.tierTag.tier },
            payload: { visibility: 'Hide' },
            timestamp: Date.now(),
          })
        }
        writeBlockEdit(currentFilter, plan.flip.blockIndex, { ...block, visibility: 'Hide' })

        const path = getProfileBackedSetting(store, 'filterPath')
        if (path) loadFilter(path)
        if (getCurrentFilter()) evaluateAndSend(item)
        if (store.get('reloadOnSave') !== false) reloadFilterInGame()

        return { ok: true, hiddenIn: tier, removedFrom: [] }
      }

      const destination = plan.destination
      if (!plan.alreadyHidden && !destination?.tierTag) {
        return { ok: false, error: `No hidden tier available for "${baseType}"` }
      }
      if (plan.targets.length === 0 && plan.alreadyHidden) {
        return { ok: false, error: `"${baseType}" is already hidden` }
      }

      // Never strip the destination itself, in case it already names the base.
      const targets = plan.targets.filter((t) => t.blockIndex !== destination?.blockIndex)

      const tiers = targets.map((t) => t.tierTag?.tier ?? `block #${t.blockIndex + 1}`)
      const where = destination?.tierTag ? ` in ${destination.tierTag.tier}` : ''
      captureSnapshot(currentFilter.path, 'basetype-remove', `Hid "${baseType}"${where}`, baseType)

      const now = Date.now()
      for (const target of targets) {
        if (!target.tierTag) continue
        record({
          type: 'remove-basetype',
          target: { typePath: target.tierTag.typePath, tier: target.tierTag.tier },
          payload: { value: baseType },
          timestamp: now,
        })
      }
      // No destination when the strip alone leaves the item on a Hide block.
      if (destination?.tierTag) {
        record({
          type: 'add-basetype',
          target: { typePath: destination.tierTag.typePath, tier: destination.tierTag.tier },
          payload: { value: baseType },
          timestamp: now + 1,
        })
      }

      // Add first, then strip: removing an emptied BaseType line shifts later line
      // numbers, and removeBaseTypeFromTiers already orders its own writes.
      if (destination) addBaseTypeToTier(currentFilter, baseType, destination.blockIndex)
      removeBaseTypeFromTiers(
        currentFilter,
        baseType,
        targets.map((t) => t.blockIndex),
      )

      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      if (getCurrentFilter()) evaluateAndSend(item)
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()

      return { ok: true, hiddenIn: destination?.tierTag?.tier ?? null, removedFrom: tiers }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('remove-item-from-tier', (_event, baseType: string, _blockIndex: number, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    if (!itemJson) return { ok: false, error: 'No item supplied' }
    try {
      const item: PoeItem = JSON.parse(itemJson)
      // Re-planned main-side: the renderer's copy can be stale after an out-of-band
      // reload, and the guard must not live only in the button's disabled state.
      const plan = planRemoval(currentFilter, item, baseType)
      if (plan.targets.length === 0) {
        // Name why, so the failure is diagnosable from a log or a bug report.
        const why = plan.skipped.length
          ? plan.skipped.map((s) => `${s.tierTag?.tier ?? `block #${s.blockIndex + 1}`} (${s.reason})`).join(', ')
          : 'no tier names it'
        return { ok: false, error: `Cannot remove "${baseType}" from any tier that catches it: ${why}` }
      }

      const tiers = plan.targets.map((t) => t.tierTag?.tier ?? `block #${t.blockIndex + 1}`)
      captureSnapshot(currentFilter.path, 'basetype-remove', `Removed "${baseType}" from ${tiers.join(', ')}`, baseType)

      // One intent per tier, so each replays independently through the existing
      // tier -> typePath -> conflict ladder on the next sync.
      const now = Date.now()
      for (const target of plan.targets) {
        if (!target.tierTag) continue
        record({
          type: 'remove-basetype',
          target: { typePath: target.tierTag.typePath, tier: target.tierTag.tier },
          payload: { value: baseType },
          timestamp: now,
        })
      }

      removeBaseTypeFromTiers(
        currentFilter,
        baseType,
        plan.targets.map((t) => t.blockIndex),
      )

      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)

      const freshFilter = getCurrentFilter()
      if (freshFilter) evaluateAndSend(item)

      if (store.get('reloadOnSave') !== false) reloadFilterInGame()

      return {
        ok: true,
        removedFrom: tiers,
        skipped: plan.skipped.map((s) => ({ tier: s.tierTag?.tier ?? `block #${s.blockIndex + 1}`, reason: s.reason })),
      }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    'batch-move-item-tier',
    (_event, baseTypes: string[], fromBlockIndex: number, toBlockIndex: number, itemJson: string) => {
      const currentFilter = getCurrentFilter()
      if (!currentFilter) return { ok: false, error: 'No filter loaded' }
      try {
        const fromTier = currentFilter.blocks[fromBlockIndex]?.tierTag?.tier ?? `block #${fromBlockIndex + 1}`
        const toTier = currentFilter.blocks[toBlockIndex]?.tierTag?.tier ?? `block #${toBlockIndex + 1}`
        if (!currentFilter.blocks[toBlockIndex]?.conditions.some((c) => c.type === 'BaseType')) {
          return { ok: false, error: `${toTier} lists no base types - adding one would narrow it.` }
        }

        const { movable, stranded } = planBatchMove(currentFilter.blocks[fromBlockIndex], baseTypes)
        if (movable.length === 0) {
          return { ok: false, error: `${fromTier} cannot give up its last base type.` }
        }

        captureSnapshot(currentFilter.path, 'tier-move', `Moved ${movable.length} items from ${fromTier} to ${toTier}`)
        // A base the source cannot give up is left behind rather than stripped:
        // deleting the last name off a tier widens it to everything its remaining
        // conditions allow. Emptying a tier by moving every base out therefore
        // strands the last one, and the caller is told which.
        for (const bt of movable) {
          // Record intent
          const fromBlock = currentFilter.blocks[fromBlockIndex]
          const toBlock = currentFilter.blocks[toBlockIndex]
          if (toBlock.tierTag && fromBlock.tierTag) {
            record({
              type: 'move-basetype',
              target: { typePath: toBlock.tierTag.typePath, tier: toBlock.tierTag.tier },
              payload: { value: bt, fromTier: fromBlock.tierTag.tier },
              timestamp: Date.now(),
            })
          }
          moveBaseTypeBetweenTiers(currentFilter, bt, fromBlockIndex, toBlockIndex)
        }
        const path = getProfileBackedSetting(store, 'filterPath')
        if (path) loadFilter(path)

        const freshFilter = getCurrentFilter()
        if (freshFilter && itemJson) {
          try {
            const item: PoeItem = JSON.parse(itemJson)
            evaluateAndSend(item)
          } catch {
            /* item may no longer match any block after batch move - that's ok */
          }
        }

        if (store.get('reloadOnSave') !== false) reloadFilterInGame()

        return { ok: true, moved: movable.length, stranded }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    },
  )

  ipcMain.handle('update-stack-thresholds', (_event, oldBoundary: number, newBoundary: number, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      captureSnapshot(
        currentFilter.path,
        'stack-threshold',
        `Changed stack boundary ${oldBoundary} \u2192 ${newBoundary}`,
        item?.baseType,
      )
      // Record threshold intent - find the block that owns this threshold
      for (const block of currentFilter.blocks) {
        if (!block.tierTag) continue
        const hasThreshold = block.conditions.some(
          (c) => c.type === 'StackSize' && parseInt(c.values[0], 10) === oldBoundary,
        )
        if (hasThreshold) {
          record({
            type: 'set-threshold',
            target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
            payload: {
              condition: 'StackSize',
              operator: block.conditions.find((c) => c.type === 'StackSize')?.operator ?? '>=',
              value: newBoundary,
            },
            timestamp: Date.now(),
          })
        }
      }
      updateStackThresholds(currentFilter, oldBoundary, newBoundary)
      // Reload to get fresh parsed state
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)

      // Re-evaluate and send fresh data
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) {
        evaluateAndSend(item)
      }

      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('update-quality-thresholds', (_event, oldBoundary: number, newBoundary: number, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      captureSnapshot(
        currentFilter.path,
        'stack-threshold',
        `Changed quality boundary ${oldBoundary} \u2192 ${newBoundary}`,
        item?.baseType,
      )
      // Record threshold intent
      for (const block of currentFilter.blocks) {
        if (!block.tierTag) continue
        const hasThreshold = block.conditions.some(
          (c) => c.type === 'Quality' && parseInt(c.values[0], 10) === oldBoundary,
        )
        if (hasThreshold) {
          record({
            type: 'set-threshold',
            target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
            payload: {
              condition: 'Quality',
              operator: block.conditions.find((c) => c.type === 'Quality')?.operator ?? '>=',
              value: newBoundary,
            },
            timestamp: Date.now(),
          })
        }
      }
      updateQualityThresholds(currentFilter, oldBoundary, newBoundary)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) {
        evaluateAndSend(item)
      }
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('update-strand-thresholds', (_event, oldBoundary: number, newBoundary: number, itemJson: string) => {
    const currentFilter = getCurrentFilter()
    if (!currentFilter) return { ok: false, error: 'No filter loaded' }
    try {
      const item: PoeItem | undefined = itemJson ? JSON.parse(itemJson) : undefined
      captureSnapshot(
        currentFilter.path,
        'strand-threshold',
        `Changed strand boundary ${oldBoundary} \u2192 ${newBoundary}`,
        item?.baseType,
      )
      for (const block of currentFilter.blocks) {
        if (!block.tierTag) continue
        const hasThreshold = block.conditions.some(
          (c) => c.type === 'MemoryStrands' && parseInt(c.values[0], 10) === oldBoundary,
        )
        if (hasThreshold) {
          record({
            type: 'set-threshold',
            target: { typePath: block.tierTag.typePath, tier: block.tierTag.tier },
            payload: {
              condition: 'MemoryStrands',
              operator: block.conditions.find((c) => c.type === 'MemoryStrands')?.operator ?? '>=',
              value: newBoundary,
            },
            timestamp: Date.now(),
          })
        }
      }
      updateStrandThresholds(currentFilter, oldBoundary, newBoundary)
      const path = getProfileBackedSetting(store, 'filterPath')
      if (path) loadFilter(path)
      const freshFilter = getCurrentFilter()
      if (freshFilter && item) evaluateAndSend(item)
      if (store.get('reloadOnSave') !== false) reloadFilterInGame()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle('reload-filter', () => {
    const path = getProfileBackedSetting(store, 'filterPath')
    if (!path) return { ok: false, error: 'No filter path set' }
    return { ok: !!loadFilter(path) }
  })

  ipcMain.handle('get-filter-changes', (): FilterChange[] => {
    const { intents } = getIntents()
    return intents
      .map((intent) => {
        const { description, itemName } = describeIntent(intent)
        // Content-derived key so it stays stable as the compacted log reorders.
        const id = `${intent.type}-${intent.target.typePath}-${intent.target.tier}-${intent.timestamp}`
        return { id, description, itemName, timestamp: intent.timestamp }
      })
      .sort((a, b) => b.timestamp - a.timestamp) // newest first, matching Session Edits
  })
}
