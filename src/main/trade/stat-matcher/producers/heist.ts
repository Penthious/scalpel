import { getPoeVersion } from '@main/game-state'
import type { StatFilter } from '../../trade'

type HeistItemInfo = {
  heistJobs?: Array<{ skill: string; level: number }>
  heistTarget?: string
  monsterLevel?: number
  wingsRevealed?: number
  wingsTotal?: number
  itemClass?: string
  baseType?: string
  enchants?: string[]
  implicits?: string[]
}

const ENCHANTED_ARMAMENTS = /Enchanted Armaments/i
const HEIST_TARGETS_ALWAYS = /Heist Targets are always Enchanted Armaments/i

/** True when a Blueprint looks enchanted (has enchant mods or Enchanted Armaments target). */
export function isEnchantedBlueprint(itemInfo: HeistItemInfo | undefined): boolean {
  if (!itemInfo || itemInfo.itemClass !== 'Blueprints') return false
  if ((itemInfo.enchants?.length ?? 0) > 0) return true
  if (itemInfo.heistTarget && ENCHANTED_ARMAMENTS.test(itemInfo.heistTarget)) return true
  const lines = [...(itemInfo.implicits ?? []), ...(itemInfo.enchants ?? [])]
  return lines.some((l) => HEIST_TARGETS_ALWAYS.test(l))
}

/** Trade `heist_filters` key per job name. Lowercasing and swapping spaces for
 *  underscores gets eight of the nine right, but Counter-Thaumaturgy's hyphen
 *  survives that rule and yields a key the API doesn't have, so the mapping is
 *  spelled out rather than derived. */
const HEIST_JOB_KEYS: Record<string, string> = {
  Lockpicking: 'heist_lockpicking',
  'Brute Force': 'heist_brute_force',
  Perception: 'heist_perception',
  Demolition: 'heist_demolition',
  'Counter-Thaumaturgy': 'heist_counter_thaumaturgy',
  'Trap Disarmament': 'heist_trap_disarmament',
  Agility: 'heist_agility',
  Deception: 'heist_deception',
  Engineering: 'heist_engineering',
}

// Heist job skill requirements (contracts and blueprints)
// Area level chip (for heist contracts/blueprints)
// Heist blueprint wings revealed
// Exclude Enchanted chip (blueprints only)
export function buildHeistFilters(itemInfo: HeistItemInfo | undefined): StatFilter[] {
  const out: StatFilter[] = []

  // A contract is defined by its single job, so that row searches for the job at
  // any level (min 1) and rides along by default. A blueprint carries one job per
  // revealed wing and is not priced on them, so those rows default off and pin the
  // item's own level as the min for when the user does want them (#591).
  if (itemInfo?.itemClass === 'Contracts' || itemInfo?.itemClass === 'Blueprints') {
    const isContract = itemInfo.itemClass === 'Contracts'
    for (const job of itemInfo.heistJobs ?? []) {
      const key = HEIST_JOB_KEYS[job.skill]
      if (!key) continue
      out.push({
        id: `heist.${key}`,
        text: `Requires ${job.skill} (Level ${job.level})`,
        value: job.level,
        min: isContract ? 1 : job.level,
        max: null,
        enabled: isContract,
        type: 'heist',
      })
    }
  }

  // Area level chip (for heist contracts/blueprints)
  if (itemInfo?.monsterLevel && itemInfo.itemClass !== 'Maps' && itemInfo.itemClass !== 'Sanctum Research') {
    // Both PoE2 trial keys (Djinn Barya and Inscribed Ultimatum) render as an
    // editable row with both ends pinned - within an ascendancy bracket a LOWER
    // area level is worth more, so an open-ended min lumps the item in with
    // cheaper higher-level listings (#433). PoE1 ultimatums scale the other way
    // and keep the min-only misc chip. All other items use min-only chip.
    const isPoe2TrialKey =
      getPoeVersion() === 2 && (itemInfo.baseType === 'Djinn Barya' || itemInfo.baseType === 'Inscribed Ultimatum')
    out.push({
      id: 'misc.area_level',
      text: `Area Level: ${itemInfo.monsterLevel}`,
      value: itemInfo.monsterLevel,
      min: itemInfo.monsterLevel,
      max: isPoe2TrialKey ? itemInfo.monsterLevel : null,
      enabled: true,
      type: isPoe2TrialKey ? 'pseudo' : 'misc',
    })
  }

  // Heist blueprint wings revealed
  if (itemInfo?.wingsRevealed != null) {
    out.push({
      id: 'heist.heist_wings',
      text: `Wings Revealed: ${itemInfo.wingsRevealed}`,
      value: itemInfo.wingsRevealed,
      min: itemInfo.wingsRevealed,
      max: null,
      enabled: true,
      type: 'heist',
    })
    if (itemInfo.wingsTotal) {
      out.push({
        id: 'heist.heist_max_wings',
        text: `Total Wings: ${itemInfo.wingsTotal}`,
        value: itemInfo.wingsTotal,
        min: itemInfo.wingsTotal,
        max: null,
        enabled: true,
        type: 'heist',
      })
    }
  }

  // Unenchanted blueprints: exclude listings that have enchant modifiers (e.g.
  // Enchanted Armaments). Emitted as a misc chip (above the filter rows) so it
  // toggles like Unidentified / influence — not a heist numeric row.
  // Defaults off when the clipboard BP itself is enchanted.
  if (itemInfo?.itemClass === 'Blueprints') {
    const enchanted = isEnchantedBlueprint(itemInfo)
    out.push({
      id: 'misc.exclude_enchanted',
      text: 'Exclude Enchanted',
      value: null,
      min: null,
      max: null,
      enabled: !enchanted,
      type: 'misc',
    })
  }

  return out
}
