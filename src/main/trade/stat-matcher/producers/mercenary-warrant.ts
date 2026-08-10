import { MERCENARY_WARRANT_BASE_TYPE, MERCENARY_WARRANT_BUILDS } from '@shared/data/trade/mercenary-warrants'
import type { MercenarySkill } from '@shared/types'
import type { StatFilter } from '../../trade'
import { getStatEntries, type StatEntry } from '../stats-cache'

type MercenaryWarrantItemInfo = {
  baseType?: string
  mercenaryBuild?: string
  mercenaryLevel?: number
  mercenarySkills?: MercenarySkill[]
}

/** Trade text for a support line: the clipboard prints "Faster Casting
 *  (Tier: 2)", the stats catalog lists it as "Faster Casting (Tier 2)". */
function supportStatText(clipboardLine: string): string {
  return clipboardLine.replace(/\(Tier: (\d+)\)$/, '(Tier $1)')
}

// Skills and supports are the only `mercenary`-type stats, and both match by
// exact display text, so a text -> id map over that group is the whole lookup --
// no fuzzy matching, no pinned dataset. Rebuilt only when the cached entries
// array reference swaps (fetch / refresh / test seed), like statTextById.
let idByText: Map<string, string | null> | null = null
let builtFrom: StatEntry[] | null = null

function mercenaryStatId(text: string): string | null {
  const entries = getStatEntries()
  if (!idByText || builtFrom !== entries) {
    idByText = new Map()
    for (const e of entries) {
      if (e.type !== 'mercenary') continue
      // GGG ships one collision: two live "Gilded Extra Targets (Tier 3)" ids
      // (support_58471 and support_37259), both returning thousands of listings.
      // The clipboard prints the same text for both, so there is nothing to pick
      // on -- park the text as ambiguous and emit no chip rather than filter on
      // a coin flip. Fix by probing which skills each id appears with and pinning
      // per skill, the way grants-skill.ts pins its class collisions.
      idByText.set(e.text, idByText.has(e.text) ? null : e.id)
    }
    builtFrom = entries
  }
  return idByText.get(text) ?? null
}

/** Drop the lazy text -> id map. Tests that seed fresh entries swap the array
 *  reference (which invalidates it anyway); this is for explicit isolation. */
export function _resetMercenaryStatCacheForTests(): void {
  idByText = null
  builtFrom = null
}

// Mercenary Warrant chips: build (misc.mercenary_build), mercenary level
// (misc.ilvl), and one row per skill and support the mercenary carries.
// Returns an empty array for anything that is not a warrant.
export function buildMercenaryWarrantFilters(itemInfo: MercenaryWarrantItemInfo | undefined): StatFilter[] {
  if (!itemInfo || itemInfo.baseType !== MERCENARY_WARRANT_BASE_TYPE) return []

  const out: StatFilter[] = []

  // The trade API indexes each build as its own type + discriminator, so the
  // build -- not the base -- is the market segment, and the chip defaults on the
  // way the scrying-orb area one does. Switching it off widens the search to the
  // bare "Mercenary Warrant" type (all builds). A build missing from
  // MERCENARY_WARRANT_BUILDS emits nothing: trade.ts would have no entry to
  // resolve, and the all-builds search beats sending a type the API rejects.
  if (itemInfo.mercenaryBuild && MERCENARY_WARRANT_BUILDS[itemInfo.mercenaryBuild]) {
    out.push({
      id: 'misc.mercenary_build',
      text: itemInfo.mercenaryBuild,
      value: null,
      min: null,
      max: null,
      enabled: true,
      type: 'misc',
    })
  }

  // Mercenary level indexes as misc_filters.ilvl even though the listing JSON
  // reports ilvl 0 (probed 2026-08-02: ilvl>=83 returns most of the pool, >=84
  // returns nothing -- 83 is the cap). The warrant's own itemLevel is 0, so the
  // generic ilvl chip in ./misc never fires and this row owns the id. Type 'gem'
  // routes it through StatFilterRow for an editable min/max pair, the same trick
  // the synthetic ilvl row uses; trade.ts still lands it in misc_filters.
  if (itemInfo.mercenaryLevel != null) {
    out.push({
      id: 'misc.ilvl',
      text: 'Mercenary Level',
      value: itemInfo.mercenaryLevel,
      min: itemInfo.mercenaryLevel,
      max: null,
      enabled: true,
      type: 'gem',
    })
  }

  // The mercenary's kit is what sets the price, and trade indexes it as
  // presence-only stats -- `mercenary.skill_<hash>` per skill and
  // `mercenary.support_<hash>` per support-at-tier (the tier is baked into the
  // id, so these rows carry no value). Skills default on because they are the
  // comparable set: build + level alone returned 6119 listings on a probed
  // level-83 Bladecaster, the same search plus its six skills returned 103.
  //
  // Supports all arrive OFF, tier included. Tier 3 reads like the prize and is
  // not: a warrant carries about six of them, so requiring the lot describes one
  // item -- this one -- and the probed six-skills-plus-five-Tier-3s search
  // returned exactly 1 listing. Skills alone returned 103, which is a set worth
  // reading, and the tightening pass in the price-check panel narrows from there
  // using what the returned comps actually carry (pickMercenarySupportsToEnable).
  //
  // Rows follow the clipboard's reading order: each skill, then its own supports.
  // A support carries `mercenarySkillId` because it only means anything scoped to
  // the skill it sits on -- trade puts the pair in a `mercenary` stat group, and a
  // support hung off the wrong skill returns nothing (probed). That scoping is why
  // a support on two skills gets a row under each rather than being deduped: they
  // are two different filters that happen to share a stat id.
  for (const skill of itemInfo.mercenarySkills ?? []) {
    // An unmatched name means the live catalog has no id for it (a skill GGG
    // added since, or a collision) -- skip the row instead of emitting a chip
    // that would blank the search. Its supports go with it: without the skill id
    // there is no group to scope them to.
    const skillId = mercenaryStatId(skill.name)
    if (!skillId) continue
    out.push({ id: skillId, text: skill.name, value: null, min: null, max: null, enabled: true, type: 'mercenary' })
    const seen = new Set<string>()
    for (const support of skill.supports) {
      const supportId = mercenaryStatId(supportStatText(support))
      if (!supportId || seen.has(supportId)) continue
      seen.add(supportId)
      out.push({
        id: supportId,
        text: support,
        value: null,
        min: null,
        max: null,
        enabled: false,
        type: 'mercenary',
        mercenarySkillId: skillId,
      })
    }
  }

  return out
}
