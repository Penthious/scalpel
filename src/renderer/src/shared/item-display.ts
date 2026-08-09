import { baseToClass, classSizes } from './constants'
import baseToUniques from '@shared/data/items/unique-info.json'
import type { ModSource } from '@shared/data/tiers/mod-sources'
import elderIcon from '../assets/mod-sources/Elder-item-symbol.png'
import shaperIcon from '../assets/mod-sources/Shaper-item-symbol.png'
import crusaderIcon from '../assets/mod-sources/Crusader-item-symbol.png'
import redeemerIcon from '../assets/mod-sources/Redeemer-item-symbol.png'
import hunterIcon from '../assets/mod-sources/Hunter-item-symbol.png'
import warlordIcon from '../assets/mod-sources/Warlord-item-symbol.png'
import searingExarchIcon from '../assets/mod-sources/SearingExarch-item-symbol.png'
import eaterOfWorldsIcon from '../assets/mod-sources/EaterOfWorlds-item-symbol.png'
import delveIcon from '../assets/mod-sources/Delve-item-symbol.png'
import templeIcon from '../assets/mod-sources/Temple-item-symbol.png'

export const INFLUENCE_ICONS_BY_NAME: Record<string, string> = {
  Elder: elderIcon,
  Shaper: shaperIcon,
  Crusader: crusaderIcon,
  Redeemer: redeemerIcon,
  Hunter: hunterIcon,
  Warlord: warlordIcon,
  'Searing Exarch': searingExarchIcon,
  'Eater of Worlds': eaterOfWorldsIcon,
}

/** Symbol shown beside a price-check mod row that didn't come from ordinary crafting.
 *  The six influences reuse the item-header symbols; delve and temple have no in-game
 *  item symbol, so they borrow the art of the thing that makes them (a fossil, the
 *  Chronicle of Atzoatl). */
export const MOD_SOURCE_ICONS: Record<ModSource, string> = {
  shaper: shaperIcon,
  elder: elderIcon,
  crusader: crusaderIcon,
  hunter: hunterIcon,
  redeemer: redeemerIcon,
  warlord: warlordIcon,
  'searing-exarch': searingExarchIcon,
  'eater-of-worlds': eaterOfWorldsIcon,
  delve: delveIcon,
  temple: templeIcon,
}

export const MOD_SOURCE_LABELS: Record<ModSource, string> = {
  shaper: 'Shaper mod',
  elder: 'Elder mod',
  crusader: 'Crusader mod',
  hunter: 'Hunter mod',
  redeemer: 'Redeemer mod',
  warlord: 'Warlord mod',
  'searing-exarch': 'Searing Exarch implicit',
  'eater-of-worlds': 'Eater of Worlds implicit',
  delve: 'Delve-only mod',
  temple: 'Temple mod',
}

const _baseToUniques = baseToUniques as Record<string, string[]>
export const uniqueToBase: Record<string, string> = {}
for (const [base, uniques] of Object.entries(_baseToUniques)) {
  for (const name of uniques) uniqueToBase[name] = base
}

export function getItemSize(itemClass: string, name?: string): [number, number] {
  if (name) {
    const base = uniqueToBase[name]
    if (base) {
      const cls = baseToClass[base]
      if (cls && classSizes[cls]) return classSizes[cls]
    }
  }
  return classSizes[itemClass] ?? [2, 2]
}
