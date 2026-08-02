import { MERCENARY_WARRANT_BASE_TYPE, MERCENARY_WARRANT_BUILDS } from '@shared/data/trade/mercenary-warrants'
import type { StatFilter } from '../../trade'

type MercenaryWarrantItemInfo = {
  baseType?: string
  mercenaryBuild?: string
  mercenaryLevel?: number
}

// Mercenary Warrant chips: build (misc.mercenary_build) and mercenary level
// (misc.ilvl). Returns an empty array for anything that is not a warrant.
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

  return out
}
