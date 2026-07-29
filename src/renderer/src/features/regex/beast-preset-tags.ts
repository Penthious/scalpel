/** Auto-tags for the Beasts tab. These only drive the derived preset name in the
 *  save panel -- save-as-update dedup compares BeastState directly via
 *  beastStateEquals, so the "+N more" cap below cannot collapse two distinct
 *  presets into one. */

import type { BeastState } from '@shared/data/regex/beast-state'
import type { RegexPresetTag } from '@shared/types'
import { TAB_COLORS } from './mapmods-helpers'

/** How many individual beast names to name before collapsing to a count. */
const NAME_CAP = 3

function nameTags(names: string[], prefix: string, color: string, source: 'want' | 'avoid'): RegexPresetTag[] {
  const sorted = [...names].sort()
  const tags = sorted.slice(0, NAME_CAP).map((n) => ({ text: `${prefix}${n}`, color, source }))
  if (sorted.length > NAME_CAP) {
    tags.push({ text: `${prefix}${sorted.length - NAME_CAP} more`, color, source })
  }
  return tags
}

export function generateBeastPresetTags(state: BeastState): RegexPresetTag[] {
  const tags: RegexPresetTag[] = []
  const qualifier = (text: string): RegexPresetTag => ({
    text,
    color: TAB_COLORS.qualifiers,
    source: 'qualifier',
  })

  if (state.menagerieLimit) tags.push(qualifier('menagerie'))
  if (state.redOnly) tags.push(qualifier('red only'))
  if (state.includeHarvest) tags.push(qualifier('harvest'))
  if (state.minChaos != null) tags.push(qualifier(`min ${state.minChaos}c`))
  if (state.maxChaos != null) tags.push(qualifier(`max ${state.maxChaos}c`))

  tags.push(...nameTags(state.pinned, '+', TAB_COLORS.want, 'want'))
  tags.push(...nameTags(state.muted, '-', TAB_COLORS.avoid, 'avoid'))

  // Default state still needs a name, since the tab always produces a regex.
  if (tags.length === 0) tags.push(qualifier('beasts by value'))
  return tags
}
