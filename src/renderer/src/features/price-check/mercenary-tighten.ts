import type { Listing } from '../../shared/trade-types'
import type { StatFilter } from './types'

/** Below this many comps a search stops being a price and starts being an
 *  anecdote, so tightening never trades a readable set for a lonely one. */
const FLOOR = 15

/** Each ticked support costs a `mercenary` stat group, and an anonymous query
 *  gets exactly one before trade drops the whole kit to unscoped filters. */
const MAX_PICKS = 3

/** "Greater Impale (Tier: 3)" -> name and tier. The clipboard prints the tier
 *  inline; a listing reports it as its own field. */
function parseSupport(text: string): { name: string; tier: number | null } {
  const m = text.match(/^(.*?)\s*\(Tier: (\d+)\)$/)
  return m ? { name: m[1], tier: Number(m[2]) } : { name: text, tier: null }
}

/**
 * Which of this warrant's supports to switch on after the opening search.
 *
 * The opening search is skills only, which lands on a set wide enough to price
 * the build but not this warrant. Narrowing it needs to know which supports are
 * unusual, and the comps we just fetched say so directly -- they are the ten
 * CHEAPEST listings that already match the skills, so a support of yours that
 * few of them carry is precisely what should lift your warrant off the floor of
 * the book. (Requiring the whole kit instead is what the producer used to do,
 * and it matched exactly one listing: this one.)
 *
 * Frequencies come from ten listings, so they are smoothed -- (carriers + 1) /
 * (sample + 2). Without that a support absent from every comp projects to zero
 * matches, when absence from the cheap end of the book is the strongest signal
 * on offer and no sample of ten can justify calling it zero.
 *
 * Returns indices into `filters`, not ids: a support carried on two skills gets
 * a row under each and the two rows share a stat id.
 */
export function pickMercenarySupportsToEnable(filters: StatFilter[], listings: Listing[], total: number): number[] {
  const supports = filters
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => f.type === 'mercenary' && f.mercenarySkillId)
  if (supports.length === 0) return []

  // Someone has already narrowed this search -- the user, or an earlier pass over
  // the same item. Re-picking would fight a decision that has already been made.
  if (supports.some(({ f }) => f.enabled)) return []
  if (total <= FLOOR) return []

  const skillNameById = new Map(
    filters.filter((f) => f.type === 'mercenary' && !f.mercenarySkillId && f.enabled).map((f) => [f.id, f.text]),
  )

  const candidates: Array<{ index: number; freq: number }> = []
  for (const { f, index } of supports) {
    // A support hangs off its skill; without the skill in the query there is no
    // group to scope it to, and trade would silently widen to "anywhere".
    const skillName = skillNameById.get(f.mercenarySkillId!)
    if (!skillName) continue

    const want = parseSupport(f.text)
    let sample = 0
    let carriers = 0
    for (const listing of listings) {
      const slot = listing.itemData?.mercenarySkills?.find((s) => s.name === skillName)
      if (!slot) continue
      sample++
      if (
        slot.supports.some((s) => s.name === want.name && (want.tier == null || s.tier == null || s.tier === want.tier))
      )
        carriers++
    }
    // No comp reported this skill, so there is nothing to rank on; and a support
    // every comp carries removes nothing while still costing a stat group.
    if (sample === 0 || carriers === sample) continue
    candidates.push({ index, freq: (carriers + 1) / (sample + 2) })
  }

  candidates.sort((a, b) => a.freq - b.freq)

  const picks: number[] = []
  let projected = total
  for (const c of candidates) {
    if (picks.length === MAX_PICKS) break
    if (projected * c.freq < FLOOR) break
    projected *= c.freq
    picks.push(c.index)
  }
  return picks
}
