import type { AffixesPrechecked } from '@shared/types'
import type { StatFilter } from './types'

/** Item classes that default to "Base" search mode on price check open.
 *  These items don't have useful mod filters for pricing (blueprints priced by rooms, etc). */
export const BASE_DEFAULT_ITEM_CLASSES = new Set(['Blueprints', 'Contracts'])

/** PoE2 equipment-category classes whose explicit "affixes" are not player-craftable gear
 *  prefixes/suffixes -- waystone/tablet map mods, sanctum relic mods, flask mods. Crafting
 *  Ready must skip these: force-enabling those explicits over-constrains the search to an
 *  unmatchable degree. Jewels are intentionally NOT excluded -- they craft like gear (open
 *  prefix/suffix on a magic base). */
export const CRAFTING_READY_EXCLUDED_CLASSES = new Set(['Waystones', 'Tablet', 'Relics', 'Flasks'])

const OPEN_PREFIX_ID = 'pseudo.pseudo_number_of_empty_prefix_mods'
const OPEN_SUFFIX_ID = 'pseudo.pseudo_number_of_empty_suffix_mods'

/** The open-affix chip (Open Prefix / Open Suffix) for the strictly-emptier side -- the slot a
 *  crafter will fill. Returns null on a tie (no clearly-open side) or when neither chip exists.
 *  The producer's counts are against the rare 3/3 max, so a one-mod magic item has a clear
 *  emptier side while a fully-rolled (prefix+suffix) magic item ties and gets nothing. */
function higherOpenAffixId(filters: StatFilter[]): string | null {
  const prefix = filters.find((f) => f.id === OPEN_PREFIX_ID)?.value ?? null
  const suffix = filters.find((f) => f.id === OPEN_SUFFIX_ID)?.value ?? null
  if (prefix !== null && (suffix === null || prefix > suffix)) return OPEN_PREFIX_ID
  if (suffix !== null && (prefix === null || suffix > prefix)) return OPEN_SUFFIX_ID
  return null
}

/** Returns true if implicit/enchant filters should stay enabled in Base mode.
 *  For uniques, implicits are only meaningful when the item is corrupted (variable roll)
 *  or vestigial (the implicit is the item's custom mod, not a fixed base implicit). */
export function shouldIncludeImplicitsInBase(rarity: string, corrupted: boolean, vestigial = false): boolean {
  return rarity !== 'Unique' || corrupted || vestigial
}

/** A unique explicit rolled at or above its best possible value -- perfect, or over-rolled
 *  (Vaal/corruption) above the listed max or single value. The producer flags these via
 *  `perfectRoll` (it owns the authoritative roll range). Base mode auto-enables them so the
 *  default search prices the best-roll copy (issue #378). Like foulborn, they count as part
 *  of the base signature, so the Base-state detector excludes them. */
export function isPerfectUniqueRoll(f: StatFilter, rarity: string): boolean {
  return rarity === 'Unique' && !!f.perfectRoll
}

/** Quality a buyer cannot add themselves: past the 20% cap it takes Perfect Fossils or a
 *  Hillock craft, so an over-qualitied item sells above an otherwise identical copy. The
 *  producer already ties this to the basetype chip on white/magic bases; on rares and
 *  uniques the chip ships off, so a Base search would price a 28% base against 0% ones.
 *  20% or under carries no such signal (any whetstone gets there), so those rows keep the
 *  producer's state. Gem quality (type 'gem') is the gem producer's row -- it decides its
 *  own default and Base mode passes it through untouched. */
export function isOverqualitiedRow(f: StatFilter): boolean {
  return f.id === 'misc.quality' && f.type === 'misc' && (f.value ?? 0) > 20
}

/**
 * Transforms a filter list to the "Base" search state:
 *   - basetype enabled
 *   - quality enabled when the item is over-qualitied (issue #586)
 *   - ilvl enabled for non-uniques (rare crafting bases key on ilvl); for
 *     uniques the roll pool is fixed per item regardless of drop level, so
 *     ilvl just over-constrains the search and filters out valid listings
 *   - implicits/enchants enabled only if useful (non-unique or corrupted unique)
 *   - foulborn mods enabled on uniques
 *   - perfect-or-over-rolled unique explicits enabled, pinned to their exact roll (issue #378)
 *   - socket/misc/timeless/fractured/currency/heist left unchanged
 *   - learned chips (set by the adaptive-defaults engine) preserved as-is
 *   - everything else disabled (explicit, pseudo, defence, weapon, etc)
 */
export function applyBaseModeToFilters(
  filters: StatFilter[],
  rarity: string,
  corrupted: boolean,
  opts: { keepExplicits?: boolean; vestigial?: boolean } = {},
): StatFilter[] {
  const includeImplicits = shouldIncludeImplicitsInBase(rarity, corrupted, opts.vestigial)
  const isUnique = rarity === 'Unique'
  return filters.map((f) => {
    // Chips the adaptive-defaults engine deliberately set (learned) win over base mode;
    // otherwise base mode would clobber the user's learned default (e.g. dex on a unique).
    if (f.learned) return f
    if (f.id === 'misc.basetype') return { ...f, enabled: true }
    // Over-20% quality goes with the basetype chip: a base search is a search for this
    // exact base, and quality above the cap is part of what that base is worth (#586).
    // The producer already shipped min = the item's quality, so only `enabled` flips.
    if (isOverqualitiedRow(f)) return { ...f, enabled: true }
    if (f.id === 'misc.ilvl') return { ...f, enabled: !isUnique, chipState: isUnique ? undefined : ('min' as const) }
    // Memory strands are an intrinsic property of the item base (like ilvl), so
    // preserve them in Base mode -- otherwise a base-search on a 40-strand chest
    // returns every Astral Plate regardless of strand count.
    if (f.id === 'misc.memory_level') return { ...f, enabled: true }
    if (f.type === 'implicit' || f.type === 'enchant') return { ...f, enabled: includeImplicits }
    // Forbidden Shako-style randomized supports: which supports the item rolled, and at
    // what level, IS what the item sells for -- a Base search that drops them prices a
    // GG Shako like a vendor one. The producer already decided their state (the higher
    // of two same-support rolls on, its twin off, since the trade index matches nothing
    // when both are searched), so keep it rather than force-enabling (#564). Runs ahead
    // of keepExplicits: "All" is the first keepExplicits caller that sees uniques, and a
    // blanket force-enable would tick both twins.
    if (isUnique && f.randomSupport) return f
    // Uniques: a mod at or above its best possible roll (perfect, or over-rolled by
    // Vaal/corruption) is what makes this copy worth more, so enable it by default pinned
    // to that exact roll -- the search then finds equally-good-or-better copies. A learned
    // chip already returned above, so this defers to the user's own decision (issue #378).
    // Ahead of keepExplicits so "All" keeps the pin instead of just ticking the row.
    if (isPerfectUniqueRoll(f, rarity)) return { ...f, enabled: true, min: f.value, max: null }
    // Crafting Ready / All: keep the item's real explicit affixes ticked. Their value/min/max
    // (incl. beneficial-negative max) are already set by the producer, so only flip enabled.
    if (opts.keepExplicits && f.type === 'explicit') return { ...f, enabled: true }
    if (isUnique && f.foulborn) return { ...f, enabled: true }
    // Premium mods (curated per-unique chase mods) are part of the base signature -- keep
    // them ticked through Base mode, otherwise the override computed in main is clobbered.
    if (f.premium) return { ...f, enabled: true }
    if (
      f.type === 'socket' ||
      f.type === 'misc' ||
      f.type === 'timeless' ||
      f.type === 'fractured' ||
      f.type === 'currency' ||
      f.type === 'heist' ||
      // Gem chips (level/quality/transfigured/vaal) identify *which* gem the user owns --
      // disabling Transfigured on a transfigured gem turns the base search into a
      // non-transfigured search and returns nothing.
      f.type === 'gem'
    )
      return f
    return { ...f, enabled: false }
  })
}

/** Rows Base mode owns outright. "All" must not hand these back to the producer's state --
 *  a unique whose producer shipped ilvl enabled would get it back, and a unique's roll pool
 *  is fixed regardless of drop level, so an ilvl filter only drops valid listings. */
const BASE_OWNED_IDS = new Set(['misc.basetype', 'misc.ilvl', 'misc.memory_level'])

/** "All" preset: Base mode with every affix row ticked instead of unticked, so the user
 *  unticks down to what they care about. Pseudo aggregates and every other non-affix row
 *  family (weapon DPS, map yield chips, mercenary, defence) keep the producer's state --
 *  "All" is about ticking affixes, not about unticking chips the producer already decided
 *  price this item. The unique carve-outs Base owns (ilvl off, Shako twin split, perfect-roll
 *  pins) still apply, and learned chips still win. */
export function applyAllModsToFilters(
  filters: StatFilter[],
  rarity: string,
  corrupted: boolean,
  opts: { vestigial?: boolean } = {},
): StatFilter[] {
  return applyBaseModeToFilters(filters, rarity, corrupted, { ...opts, keepExplicits: true }).map((f, i) => {
    if (f.learned) return f
    // Affix rows: "All" ticks them whatever Base decided.
    if (f.type === 'implicit' || f.type === 'enchant' || f.type === 'fractured') return { ...f, enabled: true }
    // Rows Base already resolved the way "All" wants them: explicits (via keepExplicits,
    // including the Shako twin split and perfect-roll pins), foulborn/premium, and the
    // structural rows above.
    // ...plus the over-quality pin: "All" is Base with every affix ticked, so the basetype
    // chip is still on and the quality floor belongs with it (#586).
    if (f.type === 'explicit' || f.foulborn || f.premium || BASE_OWNED_IDS.has(f.id) || isOverqualitiedRow(f)) return f
    // Everything else -- pseudo aggregates, weapon DPS, map yield chips, mercenary rows,
    // defence percentiles -- hits Base's blanket disable. "All" is about ticking affixes,
    // not about unticking the chips the producer already decided price this item, so hand
    // those back at the producer's state. Base's map is 1:1 and order-preserving, so the
    // index lines up.
    return { ...f, enabled: filters[i]?.enabled ?? f.enabled }
  })
}

/** Crafting Ready = Base mode plus the item's real explicit affixes left enabled, the rarity
 *  chip constrained to the item's own rarity, and the open-affix chip for the emptier side
 *  (the slot a crafter will fill -- see higherOpenAffixId). For PoE2 white/magic crafting
 *  bases, the existing prefix/suffix are what a buyer shops for, and they want a base of the
 *  same rarity with room to craft -- not a finished rare/unique. Implicits are turned off
 *  (they are inherent to the base type, so redundant for a crafting-base search; enchants
 *  stay on -- they are not base-derived). Pseudo aggregates stay off (type 'pseudo'). */
export function applyCraftingReadyToFilters(filters: StatFilter[], rarity: string, corrupted: boolean): StatFilter[] {
  const openAffixId = higherOpenAffixId(filters)
  return applyBaseModeToFilters(filters, rarity, corrupted, { keepExplicits: true }).map((f) => {
    if (f.learned) return f
    if (f.type === 'implicit') return { ...f, enabled: false }
    if (f.id === 'misc.rarity' || f.id === openAffixId) return { ...f, enabled: true }
    return f
  })
}

/** True when the filter set matches the Crafting Ready preset: basetype + ilvl + rarity on,
 *  every explicit affix on, implicits handled per `includeImplicits`, and no other
 *  mod-style filter (pseudo, weapon, defence...) enabled. Drives the chip highlight.
 *  Learned chips are carved out of every structural check because the preset preserves
 *  the adaptive engine's decisions (it defers to `learned`), so they must not flip the match. */
export function isCraftingReadyState(filters: StatFilter[], includeImplicits: boolean): boolean {
  const rarityChip = filters.find((f) => f.id === 'misc.rarity')
  const basetypeOn = filters.some((f) => f.id === 'misc.basetype' && f.enabled)
  const ilvlOn = filters.some((f) => f.id === 'misc.ilvl' && f.enabled)
  const rarityOk = !rarityChip || rarityChip.enabled || !!rarityChip.learned
  const explicitsAllOn = filters.filter((f) => f.type === 'explicit' && !f.learned).every((f) => f.enabled)
  const implicitsOk =
    includeImplicits || !filters.some((f) => !f.learned && (f.type === 'implicit' || f.type === 'enchant') && f.enabled)
  const noOtherModsOn =
    filters.filter(
      (f) =>
        !f.learned &&
        f.type !== 'socket' &&
        f.type !== 'misc' &&
        f.type !== 'timeless' &&
        f.type !== 'fractured' &&
        f.type !== 'currency' &&
        f.type !== 'heist' &&
        f.type !== 'implicit' &&
        f.type !== 'enchant' &&
        f.type !== 'explicit' &&
        f.type !== 'gem' &&
        !f.foulborn &&
        f.enabled,
    ).length === 0
  return basetypeOn && ilvlOn && rarityOk && explicitsAllOn && implicitsOk && noOtherModsOn
}

/** Which preset a freshly-opened price check starts from. */
export type DefaultPreset = 'crafting-ready' | 'base' | 'all' | 'none'

/** Resolves the opening preset and whether disabled rows stay visible above the fold.
 *  Precedence: PoE2 Crafting Ready wins (it has its own opt-out toggle and is a superset
 *  of Base), then the always-Base item classes (Blueprints/Contracts have no priceable
 *  affixes, so "All" would be useless there), then the user's Affixes prechecked setting.
 *  'default' is the historical smart behaviour: Base for uniques, producer state otherwise. */
export function resolveDefaultPreset(opts: {
  mode: AffixesPrechecked
  craftingReadyDefault: boolean
  isClassDefault: boolean
  isUnique: boolean
}): { preset: DefaultPreset; keepRowsVisible: boolean } {
  const { mode, craftingReadyDefault, isClassDefault, isUnique } = opts
  // Under mode 'default', Blueprints/Contracts are force-Based without expanding the rows --
  // that was never a user choice, so it shouldn't drag the whole disabled list above the fold.
  // Under mode 'base'/'all', the user did explicitly choose, so the rows expand even for
  // those always-Base classes.
  const keepRowsVisible = isUnique || mode !== 'default' || craftingReadyDefault
  if (craftingReadyDefault) return { preset: 'crafting-ready', keepRowsVisible }
  if (isClassDefault) return { preset: 'base', keepRowsVisible }
  if (mode === 'base') return { preset: 'base', keepRowsVisible }
  if (mode === 'all') return { preset: 'all', keepRowsVisible }
  return { preset: isUnique ? 'base' : 'none', keepRowsVisible }
}
