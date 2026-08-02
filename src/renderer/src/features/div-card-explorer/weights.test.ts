import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DivCard } from './types'
import {
  BUNDLED_WEIGHTS,
  fetchRemoteWeights,
  parseWeightsPayload,
  pickCurrentLeagueUrl,
  resolveWeights,
  WEIGHT_OVERRIDES,
} from './weights'

function card(overrides: Partial<DivCard>): DivCard {
  return {
    art: 'SomeArt',
    name: 'Some Card',
    price: 1,
    stack: 1,
    reward: '',
    drop: { areas: [], min_level: 0, monsters: [], text: '' },
    ...overrides,
  }
}

function payload(cards: unknown[], schemaVersion = 6): unknown {
  return { schema_version: schemaVersion, generated_at: '2026-08-01T22:11:54.961Z', league: 'Allflame', cards }
}

describe('parseWeightsPayload', () => {
  it('prefers the community estimate over the datamined reference', () => {
    const out = parseWeightsPayload(
      payload([{ name: 'The Hoarder', community_estimated_weight: 24912, reference_weight: 25150 }]),
    )
    expect(out).toEqual({ 'The Hoarder': 24912 })
  })

  it('falls back to the reference weight when the community estimate rounds to zero', () => {
    const out = parseWeightsPayload(
      payload([{ name: 'The Demon', community_estimated_weight: 0, reference_weight: 1 }]),
    )
    expect(out).toEqual({ 'The Demon': 1 })
  })

  it('falls back to the reference weight when the community weight is negative', () => {
    const out = parseWeightsPayload(
      payload([{ name: 'The Demon', community_estimated_weight: -1, reference_weight: 1 }]),
    )
    expect(out).toEqual({ 'The Demon': 1 })
  })

  it('drops cards with no usable weight from either field', () => {
    const out = parseWeightsPayload(
      payload([
        { name: "Assassin's Gift", community_estimated_weight: 0, reference_weight: 0 },
        { name: 'The Hoarder', community_estimated_weight: 24912, reference_weight: 25150 },
      ]),
    )
    expect(out).toEqual({ 'The Hoarder': 24912 })
  })

  it('rejects a payload from an unsupported schema version', () => {
    expect(parseWeightsPayload(payload([{ name: 'The Hoarder', community_estimated_weight: 24912 }], 7))).toBeNull()
  })

  it('rejects a malformed payload', () => {
    expect(parseWeightsPayload({ schema_version: 6, cards: 'nope' })).toBeNull()
    expect(parseWeightsPayload(payload([]))).toBeNull()
    expect(parseWeightsPayload(null)).toBeNull()
  })
})

describe('pickCurrentLeagueUrl', () => {
  const index = (leagues: unknown[], schemaVersion = 6): unknown => ({
    schema_version: schemaVersion,
    games: { poe1: { leagues }, poe2: { leagues: [] } },
  })

  it('returns the live league url and ignores historical leagues', () => {
    const url = pickCurrentLeagueUrl(
      index([
        { name: 'Mirage', historical: true, url: '/data/drop-rates/poe1/mirage.json' },
        {
          name: 'Allflame',
          historical: false,
          url: '/data/drop-rates/poe1/allflame.json',
          observed_total: 1_060_150,
        },
      ]),
    )
    expect(url).toBe('/data/drop-rates/poe1/allflame.json')
  })

  it('returns null when every league is historical', () => {
    expect(pickCurrentLeagueUrl(index([{ name: 'Mirage', historical: true, url: '/x.json' }]))).toBeNull()
  })

  it('returns null on an unsupported schema version', () => {
    expect(
      pickCurrentLeagueUrl(
        index([{ name: 'Allflame', historical: false, url: '/x.json', observed_total: 1_060_150 }], 7),
      ),
    ).toBeNull()
  })

  it('returns null when the live league is below the observed-openings floor', () => {
    expect(
      pickCurrentLeagueUrl(index([{ name: 'Ancestors', historical: false, url: '/x.json', observed_total: 7_846 }])),
    ).toBeNull()
  })

  it('returns null when the live league has no observed_total at all', () => {
    expect(pickCurrentLeagueUrl(index([{ name: 'Ancestors', historical: false, url: '/x.json' }]))).toBeNull()
  })
})

describe('resolveWeights', () => {
  it('overwrites the Maps of Exile weight for a card wraeclast covers', () => {
    const [out] = resolveWeights([card({ name: 'Matryoshka', weight: 1.5 })], { Matryoshka: 682 })
    expect(out.weight).toBe(682)
    expect(out.weightSource).toBe('wraeclast')
  })

  it('fills a card that had no Maps of Exile weight', () => {
    const [out] = resolveWeights([card({ name: 'The Slumbering Beast' })], { 'The Slumbering Beast': 2 })
    expect(out.weight).toBe(2)
    expect(out.weightSource).toBe('wraeclast')
  })

  it('keeps the Maps of Exile weight for a card outside the stacked deck pool', () => {
    const [out] = resolveWeights([card({ name: 'Council of Cats', weight: 320 })], { Matryoshka: 682 })
    expect(out.weight).toBe(320)
    expect(out.weightSource).toBe('mapsofexile')
  })

  it('leaves a card with no weight in either dataset unweighted', () => {
    const [out] = resolveWeights([card({ name: 'Apocalypse' })], {})
    expect(out.weight).toBeUndefined()
    expect(out.weightSource).toBeUndefined()
  })

  it('lets a curated override outrank both datasets', () => {
    const name = Object.keys(WEIGHT_OVERRIDES)[0]
    const [out] = resolveWeights([card({ name, weight: 999 })], { [name]: 888 })
    expect(out.weight).toBe(WEIGHT_OVERRIDES[name])
    expect(out.weightSource).toBe('override')
  })

  it('overrides Damnation, which neither dataset gets right', () => {
    const [out] = resolveWeights([card({ name: 'Damnation', weight: 5 })], {})
    expect(out.weight).toBe(4)
    expect(out.weightSource).toBe('override')
  })

  it('does not mutate the input cards', () => {
    const input = card({ name: 'Matryoshka', weight: 1.5 })
    resolveWeights([input], { Matryoshka: 682 })
    expect(input.weight).toBe(1.5)
    expect(input.weightSource).toBeUndefined()
  })
})

describe('BUNDLED_WEIGHTS', () => {
  it('parses the shipped snapshot', () => {
    expect(Object.keys(BUNDLED_WEIGHTS).length).toBeGreaterThan(300)
  })
})

describe('fetchRemoteWeights', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(responses: Record<string, { ok: boolean; body?: unknown }>) {
    const fetchMock = vi.fn(async (url: string) => {
      const hit = responses[url]
      if (!hit) throw new Error(`unexpected fetch: ${url}`)
      return { ok: hit.ok, json: async () => hit.body } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  const INDEX_URL = 'https://wraeclast.cards/data/drop-rates/index.json'
  const LEAGUE_URL = 'https://wraeclast.cards/data/drop-rates/poe1/allflame.json'
  const INDEX_BODY = {
    schema_version: 6,
    games: {
      poe1: {
        leagues: [
          {
            name: 'Allflame',
            historical: false,
            url: '/data/drop-rates/poe1/allflame.json',
            observed_total: 1_060_150,
          },
        ],
      },
    },
  }

  it('returns the live league weights', async () => {
    // The coverage floor in fetchRemoteWeights compares the remote card count
    // against BUNDLED_WEIGHTS, so a realistic-sized payload is needed here --
    // reuse the bundle's own names with a distinct value to prove pass-through.
    const names = Object.keys(BUNDLED_WEIGHTS)
    const cards = names.map((name) => ({ name, community_estimated_weight: 1 }))
    stubFetch({
      [INDEX_URL]: { ok: true, body: INDEX_BODY },
      [LEAGUE_URL]: { ok: true, body: { schema_version: 6, cards } },
    })
    const expected = Object.fromEntries(names.map((name) => [name, 1]))
    await expect(fetchRemoteWeights()).resolves.toEqual(expected)
  })

  it('returns null when the index request fails', async () => {
    const fetchMock = stubFetch({ [INDEX_URL]: { ok: false } })
    await expect(fetchRemoteWeights()).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null when the league payload is on an unsupported schema', async () => {
    stubFetch({
      [INDEX_URL]: { ok: true, body: INDEX_BODY },
      [LEAGUE_URL]: { ok: true, body: { schema_version: 7, cards: [{ name: 'Matryoshka', reference_weight: 626 }] } },
    })
    await expect(fetchRemoteWeights()).resolves.toBeNull()
  })

  it('returns null when the remote payload covers far fewer cards than the bundle', async () => {
    expect(Object.keys(BUNDLED_WEIGHTS).length).toBeGreaterThan(300)
    stubFetch({
      [INDEX_URL]: { ok: true, body: INDEX_BODY },
      [LEAGUE_URL]: {
        ok: true,
        body: { schema_version: 6, cards: [{ name: 'Matryoshka', community_estimated_weight: 682 }] },
      },
    })
    await expect(fetchRemoteWeights()).resolves.toBeNull()
  })

  it('swallows a thrown network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(fetchRemoteWeights()).resolves.toBeNull()
  })
})
