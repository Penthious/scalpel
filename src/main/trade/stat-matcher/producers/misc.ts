import { getPoeVersion } from '@main/game-state'
import { SKILL_GEM_CLASSES } from '@shared/poe-item'
import type { AdvancedMod } from '@shared/types'
import type { StatFilter } from '../../trade'
import { ITEM_CLASS_TO_CATEGORY } from '../item-classes'

type MiscItemInfo = {
  itemClass: string
  rarity: string
  quality: number
  itemLevel: number
  corrupted: boolean
  mirrored: boolean
  identified?: boolean
  influence?: string[]
  memoryStrands?: number
  intangibility?: number
  isSynthetic?: boolean
  unidentifiedTier?: number
  vestigial?: boolean
  foulborn?: boolean
  sanctified?: boolean
  zanaMemory?: boolean
  requiredLevel?: number
}

/** Level requirement at or below which a rare is leveling stock rather than
 *  endgame gear, per game. Hard-coded rather than a setting: this is a property
 *  of each game's leveling bracket, not a taste knob, and a wrong value silently
 *  narrows every search it touches (#570). */
const LEVELING_REQ_CAP: Record<number, number> = { 1: 48, 2: 36 }

/** Item kinds whose level requirement tracks a leveling curve worth searching on.
 *  Matched against the trade category, so it excludes jewels -- PoE1 rare jewels
 *  sit at Requires Level 20-40 from the base alone, and a default-on cap there
 *  would silently narrow every rare-jewel check -- along with flasks, tablets,
 *  waystones, relics and charts. A positive rule rather than a blocklist so newly
 *  added classes stay out until someone opts them in. */
const REQ_LEVEL_CATEGORIES = /^(weapon|armour|accessory)\./

/** Item level past which the number stops carrying price signal: no affix in either
 *  game requires higher, so pinning a search to an item's true ilvl only drops
 *  equivalent listings that happen to have dropped a level or two lower. Value, min
 *  and label all move together so the chip searches exactly what it says. */
const ILVL_SIGNAL_CAP = 86

// Non-gem quality, item level, open prefix/suffix, memory strands, corrupted,
// rarity, mirrored, unidentified, fractured, and influence chips.
// `filters` is passed explicitly because the fractured chip reads it to determine
// whether a fractured mod is already enabled (sequencing dependency).
export function buildMiscFilters(
  itemInfo: MiscItemInfo | undefined,
  advancedMods: AdvancedMod[] | undefined,
  filters: StatFilter[],
): StatFilter[] {
  if (!itemInfo) return []

  const out: StatFilter[] = []
  const isGem = SKILL_GEM_CLASSES.has(itemInfo.itemClass)
  const isEquipment = !!ITEM_CLASS_TO_CATEGORY[itemInfo.itemClass]
  const isMap = itemInfo.itemClass === 'Maps'
  const isBaseItem = itemInfo.rarity === 'Normal' || itemInfo.rarity === 'Magic'
  const isOverqualitied = itemInfo.quality > 20

  // Non-gem quality chip (gem quality is handled by buildGemFilters)
  if (itemInfo.quality > 0 && !isGem) {
    const qualityEnabled = isBaseItem && isOverqualitied
    out.push({
      id: 'misc.quality',
      text: `Quality: ${itemInfo.quality}%`,
      value: itemInfo.quality,
      min: itemInfo.quality,
      max: null,
      enabled: qualityEnabled,
      type: 'misc',
    })
  }

  // Item level chip
  if (itemInfo.itemLevel > 0 && !itemInfo.isSynthetic) {
    const isForbiddenTome = itemInfo.itemClass === 'Sanctum Research'
    // Forbidden Tomes search downward (max), where clamping would exclude the item
    // itself, so only the min direction takes the cap.
    const ilvl = isForbiddenTome ? itemInfo.itemLevel : Math.min(itemInfo.itemLevel, ILVL_SIGNAL_CAP)
    out.push({
      id: 'misc.ilvl',
      text: `ilvl: ${ilvl}`,
      value: ilvl,
      min: isForbiddenTome ? null : ilvl,
      max: isForbiddenTome ? ilvl : null,
      enabled: isForbiddenTome,
      type: 'misc',
      ...(isForbiddenTome ? { chipState: 'max' as const } : {}),
    })
  } else if (itemInfo.isSynthetic && itemInfo.rarity !== 'Currency') {
    // Synthetic items have a placeholder ilvl that's meaningless. Render as an
    // editable row pre-set to 83 (typical T16 map level) so users price-checking
    // for dust can lift the ilvl floor without first having to enable a chip.
    // Currency-rarity synthetics (sister-overlay currency/fragments/etc.) are
    // skipped: an ilvl filter matches no currency listing, so it broke their
    // trade search outright (#418).
    // Type 'gem' (instead of 'misc') routes the filter through StatFilterRow
    // rendering -- 'misc' goes through FilterChip. trade.ts dispatches by id to
    // the right API group per game: misc_filters on PoE1, type_filters on PoE2
    // (PoE2 indexes ilvl under type_filters; see the #436 routing in trade.ts).
    out.push({
      id: 'misc.ilvl',
      text: 'Item Level',
      value: 83,
      min: 83,
      max: null,
      enabled: true,
      type: 'gem',
    })
  }

  // Level Requirement row for leveling gear. A low-req rare sells on how early you
  // can equip it, so searching it without a cap prices a twink piece against the
  // same base at req 68. Only emitted below the cap -- above it the requirement
  // carries no signal, so there is nothing to show.
  // type 'gem' (instead of 'misc') routes through StatFilterRow for an editable
  // min/max pair, and lets Base mode pass the row through untouched so a base
  // search on a twink rare stays a low-req search. trade.ts routes the id to
  // req_filters.filters.lvl -- the same group in both games, unlike ilvl.
  const reqLevelCap = LEVELING_REQ_CAP[getPoeVersion()]
  if (
    itemInfo.rarity === 'Rare' &&
    itemInfo.requiredLevel != null &&
    itemInfo.requiredLevel > 0 &&
    reqLevelCap != null &&
    itemInfo.requiredLevel <= reqLevelCap &&
    REQ_LEVEL_CATEGORIES.test(ITEM_CLASS_TO_CATEGORY[itemInfo.itemClass] ?? '')
  ) {
    out.push({
      id: 'misc.req_level',
      text: 'Level Requirement',
      value: itemInfo.requiredLevel,
      min: null,
      max: itemInfo.requiredLevel,
      enabled: true,
      type: 'gem',
    })
  }

  // PoE2 unidentified-item tier. type 'gem' routes through StatFilterRow for an
  // editable min/max pair (same trick as the synthetic ilvl row) while still
  // landing in the misc_filters group server-side (trade.ts dispatches by id).
  // Only PoE2 unid drops carry a tier, so presence of the field is the gate.
  if (itemInfo.unidentifiedTier != null) {
    out.push({
      id: 'misc.unidentified_tier',
      text: 'Unid Tier',
      value: itemInfo.unidentifiedTier,
      min: itemInfo.unidentifiedTier,
      max: itemInfo.unidentifiedTier,
      enabled: true,
      type: 'gem',
    })
  }

  // Open prefix/suffix chips (from advanced mod data, non-uniques only).
  // PoE1: crafted affixes count as "empty" since a bench craft is scour-able -- a
  // crafted suffix plus a literally-empty suffix is counted as 2 open suffixes.
  // PoE2: crafted affixes aren't trivially replaced, so they occupy their slot like
  // any other affix and are not counted as open.
  // Normal (white) items are skipped: every affix is open by definition, so the
  // chips just restate what the rarity already implies.
  if (advancedMods && advancedMods.length > 0 && itemInfo.rarity !== 'Unique' && itemInfo.rarity !== 'Normal') {
    const craftedOccupies = getPoeVersion() === 2
    const occupies = (m: AdvancedMod): boolean => craftedOccupies || !m.crafted
    const prefixCount = advancedMods.filter((m) => m.type === 'prefix' && occupies(m)).length
    const suffixCount = advancedMods.filter((m) => m.type === 'suffix' && occupies(m)).length
    // Max affixes per slot: Magic items cap at 1 prefix + 1 suffix regardless of
    // base; rare gear is 3, rare jewels 2.
    const isJewel = itemInfo.itemClass === 'Jewels' || itemInfo.itemClass === 'Abyss Jewels'
    const maxAffix = itemInfo.rarity === 'Magic' ? 1 : isJewel ? 2 : 3
    let maxPrefixes = maxAffix
    let maxSuffixes = maxAffix
    // PoE2 items can carry implicits that grant or remove allowed affix slots,
    // e.g. "-1 Prefix Modifier allowed" / "+1 Suffix Modifier allowed".
    for (const m of advancedMods) {
      for (const line of m.lines) {
        const allow = line.match(/([+-]\d+)\s+(Prefix|Suffix)\s+Modifiers?\s+allowed/i)
        if (!allow) continue
        const delta = parseInt(allow[1], 10)
        if (allow[2].toLowerCase() === 'prefix') maxPrefixes += delta
        else maxSuffixes += delta
      }
    }
    const openPrefixes = maxPrefixes - prefixCount
    const openSuffixes = maxSuffixes - suffixCount
    if (openPrefixes > 0) {
      out.push({
        id: 'pseudo.pseudo_number_of_empty_prefix_mods',
        text: `Open Prefix (${openPrefixes})`,
        value: openPrefixes,
        min: openPrefixes,
        max: null,
        enabled: false,
        type: 'misc',
      })
    }
    if (openSuffixes > 0) {
      out.push({
        id: 'pseudo.pseudo_number_of_empty_suffix_mods',
        text: `Open Suffix (${openSuffixes})`,
        value: openSuffixes,
        min: openSuffixes,
        max: null,
        enabled: false,
        type: 'misc',
      })
    }
  }

  // Memory Strands
  if (itemInfo.memoryStrands != null) {
    out.push({
      id: 'misc.memory_level',
      text: `Memory Strands: ${itemInfo.memoryStrands}`,
      value: itemInfo.memoryStrands,
      min: itemInfo.memoryStrands,
      max: null,
      enabled: true,
      type: 'pseudo',
    })
  }

  // Intangibility (3.29 Allflame). Every Allflame craft raises it, and it is the chance
  // the next craft on that item collapses to a single outcome -- so unlike every other
  // numeric row here, LOW is what sells. The row ships as a cap at the item's own value:
  // enabling it prices against copies that are at least as unspoilt. A `max` is also the
  // only safe direction on the trade index -- listings with no Intangibility property at
  // all (never Allflame-crafted, i.e. the best copies) pass a max filter and would be
  // excluded by a min. Off by default: most buyers don't care, only crafters do (#588).
  if (itemInfo.intangibility != null) {
    out.push({
      id: 'misc.intangibility',
      text: 'Intangibility',
      value: itemInfo.intangibility,
      min: null,
      max: itemInfo.intangibility,
      enabled: false,
      type: 'gem',
    })
  }

  // Corrupted chip
  if (isGem || isEquipment || isMap) {
    out.push({
      id: 'misc.corrupted',
      text: 'Corrupted',
      value: null,
      min: null,
      max: null,
      enabled: false,
      chipState: itemInfo.corrupted ? 'yes' : 'no',
      type: 'misc',
    })
  } else if (itemInfo.corrupted && itemInfo.itemClass !== 'Divination Cards') {
    out.push({
      id: 'misc.corrupted',
      text: 'Corrupted',
      value: null,
      min: null,
      max: null,
      enabled: false,
      chipState: 'yes',
      type: 'misc',
    })
  }

  // Sanctified (PoE2 Well of Souls): mod values boosted past their normal caps, so
  // sanctified copies price on their own market. Ternary like Corrupted (#597).
  // A sanctified item defaults to 'yes' (its own market); a plain rare ships the
  // chip at Any rather than 'no' -- sanctified copies list higher, so they don't
  // pollute the cheap end of an ascending search, and an inert chip keeps the
  // default query one filter lighter. Only rares can be sanctified, but the spread
  // is wider than gear: probed 2026-08-19, live listings exist under
  // weapon/armour/accessory/jewel and the map family (waystones, tablets), so the
  // whole equipment map is in scope. The marker fallback trusts the item over the
  // gate if GGG widens it again.
  if ((getPoeVersion() === 2 && isEquipment && itemInfo.rarity === 'Rare') || itemInfo.sanctified) {
    out.push({
      id: 'misc.sanctified',
      text: 'Sanctified',
      value: null,
      min: null,
      max: null,
      enabled: false,
      ...(itemInfo.sanctified ? { chipState: 'yes' as const } : {}),
      type: 'misc',
    })
  }

  // Vestigial (3.27 Legion). Ternary like Corrupted so the user can flip to 'no' and
  // price the plain version for comparison. Only emitted for vestigial items - the
  // mechanic is rare enough that a chip on every item would be noise.
  if (itemInfo.vestigial) {
    out.push({
      id: 'misc.vestigial',
      text: 'Vestigial',
      value: null,
      min: null,
      max: null,
      enabled: false,
      chipState: 'yes',
      type: 'misc',
    })
  }

  // Foulborn (3.27) is unique-only, and the trade API's name match is prefix-insensitive:
  // searching "Headhunter" also returns "Foulborn Headhunter" at wildly different prices.
  // Default the chip to the item's own state so a plain unique never shows foulborn copies
  // (#532). An UNIDENTIFIED unique is the one case we cannot call - an unid foulborn listing
  // has an empty name field, so the clipboard has no prefix to read. Leave that as Any
  // rather than wrongly excluding foulborn copies from an unid search.
  if (itemInfo.rarity === 'Unique') {
    out.push({
      id: 'misc.foulborn',
      text: 'Foulborn',
      value: null,
      min: null,
      max: null,
      enabled: false,
      ...(itemInfo.identified === false ? {} : { chipState: itemInfo.foulborn ? ('yes' as const) : ('no' as const) }),
      type: 'misc',
    })
  }

  // Rarity filter for equipment (off by default - search includes all non-unique by default).
  // Originator (Zana memory) maps are priced separately from the plain map market at every
  // rarity, and the Maps branch in trade.ts otherwise searches `rarity: nonunique`, mixing
  // magic/rare copies into a white search and vice versa. Pin rarity for them at whatever
  // rarity the item actually rolled (#541, #545). Regular maps still get no rarity chip -
  // the mechanic only matters for originator.
  const isOriginatorMap = itemInfo.itemClass === 'Maps' && !!itemInfo.zanaMemory
  if ((isEquipment && itemInfo.rarity !== 'Unique') || isOriginatorMap) {
    out.push({
      id: 'misc.rarity',
      text: itemInfo.rarity,
      value: null,
      min: null,
      max: null,
      enabled: isOriginatorMap,
      type: 'misc',
    })
  }

  // An Elder-influenced originator map is a different item from a plain one: it carries an
  // Elder Guardian and prices on its own market (probed 2026-08-06, Allflame T16 rare: elder
  // median ~1 divine against ~15c for plain, and 2 of the 20 cheapest plain-search comps were
  // underpriced elder copies). When the item IS elder the implicit chip already pins it, so
  // this chip only exists on maps that are not (#556).
  if (isOriginatorMap && !(itemInfo.influence ?? []).includes('Elder')) {
    out.push({
      id: 'misc.exclude_elder',
      text: 'Exclude Elder',
      value: null,
      min: null,
      max: null,
      enabled: true,
      type: 'misc',
    })
  }

  if (itemInfo.mirrored || (isEquipment && itemInfo.rarity !== 'Unique')) {
    out.push({
      id: 'misc.mirrored',
      text: 'Mirrored',
      value: null,
      min: null,
      max: null,
      enabled: false,
      chipState: itemInfo.mirrored ? 'yes' : 'no',
      type: 'misc',
    })
  }

  // Show the chip on uniques regardless of identified state so users can flip
  // between identified and unid searches; default `enabled` matches the item.
  if (itemInfo.identified === false || itemInfo.rarity === 'Unique') {
    out.push({
      id: 'misc.identified',
      text: 'Unidentified',
      value: null,
      min: null,
      max: null,
      enabled: itemInfo.identified === false,
      type: 'misc',
    })
  }

  // Fractured chip -- depends on the explicit loop having already populated `filters`
  // with fractured-typed chips. The `filters` arg carries that sequencing dependency.
  if (isEquipment && itemInfo.rarity !== 'Unique') {
    const hasFracturedMod = filters.some((f) => f.type === 'fractured' && f.enabled)
    out.push({
      id: 'misc.fractured',
      text: 'Fractured',
      value: null,
      min: null,
      max: null,
      enabled: false,
      chipState: hasFracturedMod ? 'yes' : undefined,
      type: 'misc',
    })
  }

  // Influence chips (skip for maps -- map influences use implicit stats, not misc_filters)
  if (itemInfo.influence && itemInfo.influence.length > 0 && itemInfo.itemClass !== 'Maps') {
    const defaultOn = new Set(['Elder', 'Shaper', 'Crusader', 'Redeemer', 'Hunter', 'Warlord'])
    for (const inf of itemInfo.influence) {
      out.push({
        id: `misc.influence_${inf.toLowerCase().replace(/\s+/g, '_')}`,
        text: inf,
        value: null,
        min: null,
        max: null,
        enabled: defaultOn.has(inf),
        type: 'misc',
      })
    }
  }

  return out
}
