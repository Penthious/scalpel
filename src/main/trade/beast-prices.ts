/** poe.ninja beast prices for the PoE1 Beasts regex tab.
 *
 *  Deliberately NOT served off the dense feed in prices.ts, even though that is
 *  already fetched and cached: the dense payload carries no `listingCount`, and
 *  that filter is load-bearing. The dense feed's most expensive beast lines are
 *  routinely six figures on a handful of listings, and one of those would
 *  consume the whole 100-character menagerie budget.
 *
 *  Lazy on purpose. Nothing calls this until the Beasts tab mounts or the user
 *  hits Refresh, so a session that never opens the tab never pays the request.
 *
 *  `fetchJson` is injected rather than imported so this module stays free of
 *  electron and unit-testable without a mock (same shape as prices.poe2.ts). */

import { POE_NINJA_STASH_OVERVIEW } from '@shared/endpoints'

export interface BeastPriceLine {
  name: string
  chaosValue: number
  divineValue?: number
  listingCount: number
  /** 7-day percent-change series, shaped for the renderer's PriceChip sparkline. */
  graph?: (number | null)[]
}

export interface BeastPricesResult {
  lines: BeastPriceLine[]
  /** Epoch ms of the last successful fetch, or null if there has never been one. */
  updatedAt: number | null
  /** Set when the most recent attempt failed. `lines` may still hold stale data. */
  error?: string
}

/** Matches the 10-minute TTL the dense PoE1 price feed uses. */
const TTL = 10 * 60 * 1000

let cachedLeague = ''
let cachedLines: BeastPriceLine[] = []
let lastFetchTime = 0

interface NinjaBeastLine {
  name?: unknown
  chaosValue?: unknown
  divineValue?: unknown
  listingCount?: unknown
  sparkLine?: { data?: unknown }
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function parseBeastLines(resp: unknown): BeastPriceLine[] {
  const lines = (resp as { lines?: unknown })?.lines
  if (!Array.isArray(lines)) return []
  const out: BeastPriceLine[] = []
  for (const entry of lines as NinjaBeastLine[]) {
    if (typeof entry !== 'object' || entry === null) continue
    if (typeof entry.name !== 'string' || entry.name.length === 0) continue
    const data = entry.sparkLine?.data
    out.push({
      name: entry.name,
      chaosValue: num(entry.chaosValue),
      divineValue: typeof entry.divineValue === 'number' ? entry.divineValue : undefined,
      listingCount: num(entry.listingCount),
      // An empty sparkline is dropped so PriceChip skips the trend arrow rather
      // than rendering an arrow with nothing behind it.
      graph: Array.isArray(data) && data.length > 0 ? (data as (number | null)[]) : undefined,
    })
  }
  return out
}

export async function getBeastPrices(
  league: string,
  fetchJson: (url: string) => Promise<unknown>,
  force = false,
): Promise<BeastPricesResult> {
  if (!league) return { lines: [], updatedAt: null, error: 'No league selected.' }

  const now = Date.now()
  const fresh = cachedLeague === league && lastFetchTime > 0 && now - lastFetchTime < TTL
  if (fresh && !force) return { lines: cachedLines, updatedAt: lastFetchTime }

  try {
    const url = `${POE_NINJA_STASH_OVERVIEW}?league=${encodeURIComponent(league)}&type=Beast`
    const lines = parseBeastLines(await fetchJson(url))
    cachedLines = lines
    cachedLeague = league
    lastFetchTime = now
    return { lines, updatedAt: now }
  } catch {
    // Hold the stale cache and leave lastFetchTime alone so the next call
    // retries instead of being short-circuited by the TTL. Same failure posture
    // as refreshPrices in prices.ts.
    const haveStale = cachedLeague === league && lastFetchTime > 0
    return {
      lines: haveStale ? cachedLines : [],
      updatedAt: haveStale ? lastFetchTime : null,
      error: 'Could not reach poe.ninja.',
    }
  }
}

/** Test hook: clear the module-level cache so cases assert miss-vs-hit in isolation. */
export function _resetBeastPricesForTests(): void {
  cachedLeague = ''
  cachedLines = []
  lastFetchTime = 0
}
