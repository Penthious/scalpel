import { writeFileSync } from 'node:fs'
import type { FilterBlock, FilterFile } from '@shared/types'
import { checkRemovable } from '@shared/filter-removal'
import { NUMERIC_CONDITION_TYPES } from './condition-types'
import { validateBlock } from './validate'

/** Detect the indentation style used in a file (tab or spaces). */
export function detectIndent(rawLines: string[]): string {
  for (const line of rawLines) {
    if (line.startsWith('\t')) return '\t'
    const match = line.match(/^( {2,})/)
    if (match) return match[1]
  }
  return '\t'
}

/** Serialize a single FilterBlock back to .filter text lines. */
export function serializeBlock(block: FilterBlock, indent = '\t'): string[] {
  const lines: string[] = []

  if (block.leadingComment) {
    lines.push(...block.leadingComment.split('\n'))
  }

  const commentSuffix = block.inlineComment ? ` # ${block.inlineComment}` : ''
  lines.push(block.visibility + commentSuffix)

  for (const cond of block.conditions) {
    const emitOperator =
      cond.explicitOperator === true || (cond.explicitOperator === undefined && NUMERIC_CONDITION_TYPES.has(cond.type))
    const valStr = cond.values.map((v) => quoteIfNeeded(v)).join(' ')
    if (emitOperator) {
      lines.push(`${indent}${cond.type} ${cond.operator} ${valStr}`)
    } else {
      lines.push(`${indent}${cond.type} ${valStr}`)
    }
  }

  for (const action of block.actions) {
    if (action.values.length === 0) continue
    const isCustomSound = action.type === 'CustomAlertSound' || action.type === 'CustomAlertSoundOptional'
    const valStr = action.values.map((v, i) => (isCustomSound && i === 0 ? `"${v}"` : quoteIfNeeded(v))).join(' ')
    lines.push(`${indent}${action.type}${valStr ? ` ${valStr}` : ''}`)
  }

  if (block.continue) {
    lines.push(`${indent}Continue`)
  }

  return lines
}

function quoteIfNeeded(value: string): string {
  // Quote if it contains a space, is empty, or contains '#' (an unquoted '#' would
  // be parsed as the start of a comment on re-read, truncating the value and
  // breaking the round-trip; the parser respects quotes).
  if (value.includes(' ') || value === '' || value.includes('#')) {
    return `"${value}"`
  }
  return value
}

/**
 * Apply edits to a specific block in the filter file and write to disk.
 * Replaces only the lines belonging to that block, preserving everything else.
 */
export function writeBlockEdit(filterFile: FilterFile, blockIndex: number, updatedBlock: FilterBlock): void {
  const block = filterFile.blocks[blockIndex]
  const eol = filterFile.eol ?? '\n'
  const indent = detectIndent(filterFile.rawLines)
  const newBlockLines = serializeBlock(updatedBlock, indent)

  const newLines = [...filterFile.rawLines]
  const leadingLines = block.leadingComment ? block.leadingComment.split('\n').length : 0
  const headerStart = block.lineStart - 1 - leadingLines
  const bodyEnd = block.bodyEndLine ?? block.lineEnd

  newLines.splice(headerStart, bodyEnd - headerStart, ...newBlockLines)

  writeFileSync(filterFile.path, newLines.join(eol), 'utf-8')

  // Update in-memory state.
  filterFile.rawLines = newLines
  const newLeading = updatedBlock.leadingComment ? updatedBlock.leadingComment.split('\n').length : 0
  filterFile.blocks[blockIndex] = {
    ...updatedBlock,
    lineStart: headerStart + newLeading + 1,
    lineEnd: headerStart + newBlockLines.length,
    bodyEndLine: headerStart + newBlockLines.length,
  }
}

/** What a tier move actually did to the file. */
export interface TierMoveResult {
  /** The base now appears on the destination's BaseType line. */
  added: boolean
  /** The base no longer appears on the source's BaseType line. */
  stripped: boolean
}

/**
 * Move an item's BaseType from one tier block to another.
 * Edits the raw lines directly so formatting and comments are preserved.
 *
 * Both ends are guarded against changing what the tier catches beyond this one
 * base, and the guards are hard invariants rather than caller courtesies:
 *
 * - The source is left alone when the base is the last one it names. Deleting the
 *   emptied `BaseType` line would widen the block to everything its remaining
 *   conditions allow -- FilterBlade's `trialkeysanctumtop` is `ItemLevel >= 80`
 *   plus one base, and stripping the base turned it into "show every ilvl 80+
 *   item in the game" (see `checkRemovable`).
 * - The destination is left alone when it lists no bases at all. Creating a
 *   `BaseType` line on a class-rules tier narrows it from "everything of this
 *   class" to "only this base" -- the same damage in the other direction.
 *
 * Callers must check the result: a move that neither added nor stripped changed
 * nothing, and one that only did half the job may not take effect.
 */
export function moveBaseTypeBetweenTiers(
  filterFile: FilterFile,
  baseType: string,
  fromBlockIndex: number,
  toBlockIndex: number,
): TierMoveResult {
  if (fromBlockIndex === toBlockIndex) return { added: false, stripped: false }

  const fromBlock = filterFile.blocks[fromBlockIndex]
  const toBlock = filterFile.blocks[toBlockIndex]

  const canAdd = toBlock.conditions.some((c) => c.type === 'BaseType')
  const canStrip = checkRemovable(fromBlock, baseType).removable
  if (!canAdd && !canStrip) return { added: false, stripped: false }

  // Work on raw lines — process the later block first so line numbers stay valid
  const lines = [...filterFile.rawLines]
  let added = false

  if (fromBlock.lineStart < toBlock.lineStart) {
    // Source is before target: add first (to target), then remove (from source)
    if (canAdd) added = addBaseTypeToRawLines(lines, toBlock, baseType)
    if (canStrip) removeBaseTypeFromRawLines(lines, fromBlock, baseType)
  } else {
    // Target is before source: remove first, then add
    if (canStrip) removeBaseTypeFromRawLines(lines, fromBlock, baseType)
    if (canAdd) added = addBaseTypeToRawLines(lines, toBlock, baseType)
  }

  if (!added && !canStrip) return { added: false, stripped: false }

  writeFileSync(filterFile.path, lines.join(filterFile.eol ?? '\n'), 'utf-8')
  filterFile.rawLines = lines
  return { added, stripped: canStrip }
}

/**
 * Strip a BaseType value from one block, leaving every other block alone.
 * Edits raw lines directly so formatting and comments are preserved.
 * Callers must have already cleared the removal with `checkRemovable` -- this
 * function does not guard against emptying the block.
 */
export function removeBaseTypeFromTier(filterFile: FilterFile, baseType: string, blockIndex: number): void {
  removeBaseTypeFromTiers(filterFile, baseType, [blockIndex])
}

/**
 * Strip a BaseType value from several blocks in one pass.
 *
 * Blocks are edited in descending file order: deleting an emptied BaseType line
 * shifts every later block's recorded line numbers, so the later blocks must be
 * done first while their `lineStart`/`lineEnd` are still accurate. Same reasoning
 * as `moveBaseTypeBetweenTiers`. One write, so the file is never left partially
 * edited on disk.
 */
export function removeBaseTypeFromTiers(filterFile: FilterFile, baseType: string, blockIndexes: number[]): void {
  const ordered = [...new Set(blockIndexes)].sort((a, b) => b - a)
  const lines = [...filterFile.rawLines]
  let touched = false

  for (const idx of ordered) {
    const block = filterFile.blocks[idx]
    if (!block) continue
    removeBaseTypeFromRawLines(lines, block, baseType)
    touched = true
  }

  if (!touched) return
  writeFileSync(filterFile.path, lines.join(filterFile.eol ?? '\n'), 'utf-8')
  filterFile.rawLines = lines
}

function removeBaseTypeFromRawLines(lines: string[], block: FilterBlock, baseType: string): void {
  const escaped = escapeRegex(baseType)
  for (let i = block.lineStart - 1; i < block.lineEnd; i++) {
    const stripped = lines[i].replace(/#.*/, '').trim()
    if (!stripped.startsWith('BaseType')) continue

    // Remove all occurrences of the quoted value (with surrounding whitespace cleanup)
    let line = lines[i]
    // Remove the quoted value wherever it appears — all instances
    line = line.replace(new RegExp(`\\s*"${escaped}"`, 'g'), '')

    // Check if the BaseType line has no values left
    const afterKeyword = line
      .replace(/#.*/, '')
      .trim()
      .replace(/^BaseType\s*(==\s*)?/, '')
      .trim()
    if (afterKeyword === '') {
      lines.splice(i, 1)
      block.lineEnd--
      i--
    } else {
      // Clean up any double spaces left behind
      lines[i] = line.replace(/ {2,}/g, ' ')
    }
  }
}

/**
 * Append a BaseType value to one block.
 *
 * Refuses a block with no BaseType line: creating one would narrow a class-rules
 * block from "everything of this class" to "only this base". Callers pick
 * destinations with `findHideDestination`, which already enforces that.
 */
export function addBaseTypeToTier(filterFile: FilterFile, baseType: string, blockIndex: number): boolean {
  const block = filterFile.blocks[blockIndex]
  if (!block) return false
  if (!block.conditions.some((c) => c.type === 'BaseType')) return false

  const lines = [...filterFile.rawLines]
  addBaseTypeToRawLines(lines, block, baseType)
  writeFileSync(filterFile.path, lines.join(filterFile.eol ?? '\n'), 'utf-8')
  filterFile.rawLines = lines
  return true
}

/** True when the value was appended; false when it was already there or the
 *  block has no BaseType line to append to. */
function addBaseTypeToRawLines(lines: string[], block: FilterBlock, baseType: string): boolean {
  const quoted = `"${baseType}"`
  for (let i = block.lineStart - 1; i < block.lineEnd; i++) {
    const stripped = lines[i].replace(/#.*/, '').trim()
    if (!stripped.startsWith('BaseType')) continue

    // Check if already present — don't duplicate
    if (stripped.includes(`"${baseType}"`)) return false

    // Append the new value
    const commentIdx = lines[i].indexOf('#')
    if (commentIdx !== -1) {
      lines[i] = `${lines[i].slice(0, commentIdx).trimEnd()} ${quoted} ${lines[i].slice(commentIdx)}`
    } else {
      lines[i] = `${lines[i].trimEnd()} ${quoted}`
    }
    return true
  }

  // No BaseType line: nothing to append to, and creating one would narrow a
  // class-rules tier to this single base. Both callers already refuse such a
  // destination; this is the backstop.
  return false
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replace a boundary value in the filter for a given condition type.
 * If the new value collides with the next boundary, push that boundary by 1 too.
 */
function updateThresholds(
  filterFile: FilterFile,
  condType: 'StackSize' | 'Quality' | 'MemoryStrands',
  oldBoundary: number,
  newBoundary: number,
  minValue: number,
): void {
  if (oldBoundary === newBoundary || newBoundary < minValue) return

  // Collect all distinct threshold values for this condition type
  const allValues = new Set<number>()
  const lines = filterFile.rawLines
  const re = new RegExp(`^${condType}\\s*(>=|>|<=|<|==|=)?\\s*(\\d+)`)

  for (const block of filterFile.blocks) {
    for (let lineIdx = block.lineStart - 1; lineIdx < block.lineEnd && lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]
      if (!line) continue
      const stripped = line.replace(/#.*/, '').trim()
      if (!stripped.startsWith(condType)) continue
      const match = stripped.match(re)
      if (match) allValues.add(parseInt(match[2], 10))
    }
  }

  // Build replacement map: old → new, pushing adjacent if collision
  const replacements = new Map<number, number>()
  replacements.set(oldBoundary, newBoundary)

  // Sort thresholds in the direction we're moving to detect collisions
  const sorted = Array.from(allValues).sort((a, b) => a - b)
  const movingUp = newBoundary > oldBoundary

  if (movingUp) {
    // Check thresholds above oldBoundary in ascending order
    for (const val of sorted) {
      if (val <= oldBoundary) continue
      const prevNewVal = replacements.get(val - 1) ?? val - 1
      // If the previous value was pushed to meet or exceed this one, push this one too
      if (prevNewVal >= val) {
        replacements.set(val, prevNewVal + 1)
      } else {
        // Check if newBoundary itself collides
        const replacedOld = replacements.get(oldBoundary)!
        if (replacedOld >= val && !replacements.has(val)) {
          replacements.set(val, replacedOld + 1)
        }
        break
      }
    }
  } else {
    // Check thresholds below oldBoundary in descending order
    for (let i = sorted.length - 1; i >= 0; i--) {
      const val = sorted[i]
      if (val >= oldBoundary) continue
      const nextNewVal = replacements.get(val + 1) ?? val + 1
      if (nextNewVal <= val) {
        replacements.set(val, Math.max(minValue, nextNewVal - 1))
      } else {
        const replacedOld = replacements.get(oldBoundary)!
        if (replacedOld <= val && !replacements.has(val)) {
          replacements.set(val, Math.max(minValue, replacedOld - 1))
        }
        break
      }
    }
  }

  // Apply replacements
  for (const block of filterFile.blocks) {
    for (let lineIdx = block.lineStart - 1; lineIdx < block.lineEnd && lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]
      if (!line) continue
      const stripped = line.replace(/#.*/, '').trim()
      if (!stripped.startsWith(condType)) continue
      const match = stripped.match(re)
      if (!match) continue

      const val = parseInt(match[2], 10)
      const newVal = replacements.get(val)
      if (newVal !== undefined && newVal !== val) {
        lines[lineIdx] = line.replace(new RegExp(`(${condType}\\s*(?:>=|>|<=|<|==|=)?\\s*)${val}\\b`), `$1${newVal}`)
      }
    }
  }

  writeFileSync(filterFile.path, lines.join(filterFile.eol ?? '\n'), 'utf-8')
}

export function updateStackThresholds(filterFile: FilterFile, oldBoundary: number, newBoundary: number): void {
  updateThresholds(filterFile, 'StackSize', oldBoundary, newBoundary, 1)
}

export function updateQualityThresholds(filterFile: FilterFile, oldBoundary: number, newBoundary: number): void {
  updateThresholds(filterFile, 'Quality', oldBoundary, newBoundary, 0)
}

export function updateStrandThresholds(filterFile: FilterFile, oldBoundary: number, newBoundary: number): void {
  updateThresholds(filterFile, 'MemoryStrands', oldBoundary, newBoundary, 0)
}

/**
 * Render a filter, re-serializing only the blocks in `modifiedBlocks` and passing
 * everything else through as raw lines. Pure (no I/O).
 *
 * Ownership model: each block owns its header + body only
 * (`rawLines[headerStart .. bodyEnd)`). Content between one block's body and the
 * next block's header is a gap, always emitted raw - this preserves blank lines
 * and section comments. Line endings and indent follow the source file.
 *
 * Each modified block is validated after serialization; if it would be invalid,
 * its raw upstream lines are used instead (dropping that one edit) and its index
 * is reported in `fallbackBlocks`.
 */
export function renderFilterSelective(
  filterFile: FilterFile,
  modifiedBlocks: Set<number>,
  removedBlocks: Set<number> = new Set(),
): { content: string; fallbackBlocks: number[] } {
  const eol = filterFile.eol ?? '\n'
  const indent = detectIndent(filterFile.rawLines)
  const out: string[] = []
  const fallbackBlocks: number[] = []
  let prevBodyEnd = 0

  for (let i = 0; i < filterFile.blocks.length; i++) {
    const block = filterFile.blocks[i]
    const blockStart = block.lineStart - 1
    const leadingLines = block.leadingComment ? block.leadingComment.split('\n').length : 0
    const headerStart = blockStart - leadingLines
    // bodyEndLine is 1-based and inclusive, which equals the 0-based exclusive
    // slice end of the body. The lineEnd fallback is only hit for hand-built
    // blocks (parseFilterFile always sets bodyEndLine); it over-extends into the
    // gap, so it is a degraded path, not the intended one.
    const bodyEnd = block.bodyEndLine ?? block.lineEnd

    // Gap before the block (blank lines, standalone comments, section headers).
    // Emitted even for a removed block so file-level preamble / separators are
    // preserved; only the block's own header + body is dropped on removal.
    if (headerStart > prevBodyEnd) {
      out.push(...filterFile.rawLines.slice(prevBodyEnd, headerStart))
    }

    if (removedBlocks.has(i)) {
      // Drop the block entirely (its header + body). Used when an edit/repair
      // leaves a block with no conditions, which would otherwise serialize to a
      // condition-less catch-all that matches every item.
      prevBodyEnd = bodyEnd
      continue
    }

    if (modifiedBlocks.has(i) && validateBlock(block).length === 0) {
      out.push(...serializeBlock(block, indent))
    } else {
      if (modifiedBlocks.has(i)) fallbackBlocks.push(i)
      out.push(...filterFile.rawLines.slice(headerStart, bodyEnd))
    }

    prevBodyEnd = bodyEnd
  }

  // Trailing content after the last block.
  if (prevBodyEnd < filterFile.rawLines.length) {
    out.push(...filterFile.rawLines.slice(prevBodyEnd))
  }

  return { content: out.join(eol), fallbackBlocks }
}

/** Write the entire filter file (re-serializing every block). */
export function writeFullFilter(filterFile: FilterFile): void {
  const all = new Set(filterFile.blocks.map((_, i) => i))
  const { content, fallbackBlocks } = renderFilterSelective(filterFile, all)
  if (fallbackBlocks.length > 0 && process.env.SCALPEL_DEBUG_LOG) {
    console.warn('[writer] writeFullFilter kept raw lines for invalid blocks:', fallbackBlocks)
  }
  writeFileSync(filterFile.path, content, 'utf-8')
}

/**
 * Write a filter file, re-serializing only `modifiedBlocks` (validated, with
 * per-block raw fallback). Returns the indices that fell back to raw.
 */
export function writeFilterSelective(
  filterFile: FilterFile,
  modifiedBlocks: Set<number>,
  removedBlocks: Set<number> = new Set(),
): { fallbackBlocks: number[] } {
  const { content, fallbackBlocks } = renderFilterSelective(filterFile, modifiedBlocks, removedBlocks)
  writeFileSync(filterFile.path, content, 'utf-8')
  return { fallbackBlocks }
}
