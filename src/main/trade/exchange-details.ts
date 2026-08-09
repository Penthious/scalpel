/** poe.ninja Currency Exchange details for a single item. Everything here runs
 *  in main: a renderer fetch to poe.ninja is CORS-blocked.
 *
 *  The endpoint is undocumented and can move without notice, so every failure
 *  path resolves to null rather than throwing -- callers treat null as "no
 *  exchange data" and fall back to the old banner + trade listings. */
import type { ExchangeDetails, ExchangePair, ExchangePoint } from '@shared/contracts/exchange'
import { POE_NINJA_EXCHANGE_DETAILS } from '@shared/endpoints'

/** Matches the price cache's TTL in prices.ts -- exchange rates move on the
 *  same timescale as the dense overview they sit beside. */
const CACHE_TTL = 10 * 60 * 1000

interface RawPoint {
  timestamp?: string
  rate?: number
  volumePrimaryValue?: number
}

interface RawPair {
  id?: string
  rate?: number
  volumePrimaryValue?: number
  history?: RawPoint[]
}

interface RawDetails {
  item?: { name?: string; image?: string }
  pairs?: RawPair[]
}

export function exchangeDetailsUrl(version: 1 | 2, league: string, ninjaType: string, slug: string): string {
  const q = `league=${encodeURIComponent(league)}&type=${encodeURIComponent(ninjaType)}&id=${encodeURIComponent(slug)}`
  return `${POE_NINJA_EXCHANGE_DETAILS[version]}?${q}`
}

/** History arrives newest-first with ISO timestamps; we hand the renderer
 *  oldest-first epoch ms so chart index order is time order and no component
 *  has to re-sort. Points with an unparseable timestamp or no numeric rate are
 *  dropped rather than projected as NaN. */
function normalizePoints(raw: RawPoint[] | undefined): ExchangePoint[] {
  const points: ExchangePoint[] = []
  for (const p of raw ?? []) {
    if (typeof p.rate !== 'number' || !Number.isFinite(p.rate)) continue
    const t = p.timestamp ? Date.parse(p.timestamp) : Number.NaN
    if (!Number.isFinite(t)) continue
    points.push({ t, rate: p.rate, volume: p.volumePrimaryValue ?? 0 })
  }
  return points.sort((a, b) => a.t - b.t)
}

/** Shape the raw payload into ExchangeDetails, or null when there's nothing
 *  worth rendering. Illiquid items ship pairs with an absent rate and a stub
 *  history (e.g. Astragali's divine pair) -- those are dropped, and an item
 *  whose every pair is rate-less normalizes to null. */
export function normalizeExchangeDetails(raw: unknown): ExchangeDetails | null {
  const d = raw as RawDetails | null | undefined
  const name = d?.item?.name
  if (!name) return null

  const pairs: ExchangePair[] = []
  for (const p of d?.pairs ?? []) {
    if (!p.id) continue
    if (typeof p.rate !== 'number' || !Number.isFinite(p.rate) || p.rate <= 0) continue
    pairs.push({
      currency: p.id,
      rate: p.rate,
      volumePerHour: p.volumePrimaryValue ?? 0,
      history: normalizePoints(p.history),
    })
  }
  if (pairs.length === 0) return null

  return { name, icon: d?.item?.image, pairs }
}

interface CacheEntry {
  at: number
  value: ExchangeDetails | null
}

const cache = new Map<string, CacheEntry>()

/** Fetch (or serve from cache) one item's exchange details. Negative results are
 *  cached too, so an item poe.ninja doesn't track costs one request per TTL
 *  instead of one per price check. */
export async function fetchExchangeDetails(
  version: 1 | 2,
  league: string,
  ninjaType: string,
  slug: string,
  fetchJson: (url: string) => Promise<unknown>,
): Promise<ExchangeDetails | null> {
  const key = `${version}|${league}|${ninjaType}|${slug}`
  const hit = cache.get(key)
  const now = Date.now()
  if (hit && now - hit.at < CACHE_TTL) return hit.value

  let value: ExchangeDetails | null = null
  try {
    value = normalizeExchangeDetails(await fetchJson(exchangeDetailsUrl(version, league, ninjaType, slug)))
  } catch (e) {
    console.error('[FilterScalpel] Exchange details fetch failed:', e)
    value = null
  }
  cache.set(key, { at: now, value })
  return value
}

export function _resetExchangeCacheForTests(): void {
  cache.clear()
}
