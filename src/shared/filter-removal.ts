import type { FilterBlock } from './types'

/** Why a base cannot be stripped from a block, or the exact values to strip. */
export type RemovalCheck =
  | { removable: true; exact: string[] }
  /** The tier doesn't name this item at all -- it catches it by class rules. */
  | { removable: false; reason: 'not-by-name' }
  /** A substring token (e.g. "Ring") catches the item; removing it would evict others. */
  | { removable: false; reason: 'token'; token: string }
  /** The item is the only named base left; removal would widen the tier to its class. */
  | { removable: false; reason: 'last-base' }

/**
 * Decide whether `baseType` can be stripped from `block` without changing what
 * else the block catches.
 *
 * PoE matches BaseType by substring unless the condition uses `==` (see
 * matcher.ts), so a block can catch an item without naming it. Those blocks
 * cannot be narrowed by deleting a string, and neither can a block whose last
 * named base is the one being removed -- deleting that leaves a bare `Class`
 * line that catches the entire class, or no conditions at all.
 */
export function checkRemovable(block: FilterBlock, baseType: string): RemovalCheck {
  const conditions = block.conditions.filter((c) => c.type === 'BaseType')
  const target = baseType.toLowerCase()
  const exact: string[] = []
  let token: string | null = null
  let total = 0

  for (const cond of conditions) {
    const exactOperator = cond.operator === '=='
    for (const value of cond.values) {
      total++
      const lower = value.toLowerCase()
      if (lower === target) {
        exact.push(value)
      } else if (!exactOperator && target.includes(lower)) {
        token ??= value
      }
    }
  }

  if (token) return { removable: false, reason: 'token', token }
  if (exact.length === 0) return { removable: false, reason: 'not-by-name' }
  if (exact.length === total) return { removable: false, reason: 'last-base' }
  return { removable: true, exact }
}
