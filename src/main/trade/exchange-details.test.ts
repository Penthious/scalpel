import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetExchangeCacheForTests,
  exchangeDetailsUrl,
  fetchExchangeDetails,
  normalizeExchangeDetails,
} from './exchange-details'

/** Trimmed to the fields we consume, shaped exactly like the live response:
 *  history arrives newest-first with ISO timestamps. */
const RAW = {
  item: { id: 'orb-of-annulment', name: 'Orb of Annulment', image: '/gen/image/abc/Annul.png' },
  pairs: [
    {
      id: 'chaos',
      rate: 9.69,
      volumePrimaryValue: 176079,
      history: [
        { timestamp: '2026-08-09T00:00:00Z', rate: 9.69, volumePrimaryValue: 176079 },
        { timestamp: '2026-08-08T00:00:00Z', rate: 9.1, volumePrimaryValue: 150000 },
      ],
    },
    {
      id: 'divine',
      rate: 0.04895,
      volumePrimaryValue: 106620,
      history: [{ timestamp: '2026-08-09T00:00:00Z', rate: 0.04895, volumePrimaryValue: 106620 }],
    },
  ],
}

beforeEach(() => {
  _resetExchangeCacheForTests()
})

describe('exchangeDetailsUrl', () => {
  it('builds the poe1 url with encoded league and slug', () => {
    expect(exchangeDetailsUrl(1, 'Hardcore Allflame', 'Omen', 'omen-of-deaths-door')).toBe(
      'https://poe.ninja/poe1/api/economy/exchange/current/details?league=Hardcore%20Allflame&type=Omen&id=omen-of-deaths-door',
    )
  })

  it('switches host for poe2', () => {
    expect(exchangeDetailsUrl(2, 'Runes of Aldur', 'Ritual', 'omen-of-whittling')).toBe(
      'https://poe.ninja/poe2/api/economy/exchange/current/details?league=Runes%20of%20Aldur&type=Ritual&id=omen-of-whittling',
    )
  })
})

describe('normalizeExchangeDetails', () => {
  it('reverses history to oldest-first and parses timestamps to epoch ms', () => {
    const d = normalizeExchangeDetails(RAW)!
    expect(d.pairs[0].history.map((p) => p.rate)).toEqual([9.1, 9.69])
    expect(d.pairs[0].history[0].t).toBe(Date.parse('2026-08-08T00:00:00Z'))
  })

  it('maps volumePrimaryValue onto volume', () => {
    const d = normalizeExchangeDetails(RAW)!
    expect(d.pairs[0].volumePerHour).toBe(176079)
    expect(d.pairs[0].history[1].volume).toBe(176079)
  })

  it('keeps the item name and icon', () => {
    const d = normalizeExchangeDetails(RAW)!
    expect(d.name).toBe('Orb of Annulment')
    expect(d.icon).toBe('/gen/image/abc/Annul.png')
  })

  it('drops pairs with no usable rate', () => {
    // Illiquid items ship a pair with an absent rate and a stub history.
    const d = normalizeExchangeDetails({
      item: { name: 'Astragali' },
      pairs: [
        { id: 'chaos', rate: 0.036, volumePrimaryValue: 13.83, history: [] },
        { id: 'divine', volumePrimaryValue: 0, history: [] },
      ],
    })!
    expect(d.pairs.map((p) => p.currency)).toEqual(['chaos'])
  })

  it('defaults a missing volume to zero rather than dropping the pair', () => {
    const d = normalizeExchangeDetails({
      item: { name: 'Astragali' },
      pairs: [{ id: 'chaos', rate: 0.036, history: [] }],
    })!
    expect(d.pairs[0].volumePerHour).toBe(0)
  })

  it('drops history points with an unparseable timestamp', () => {
    const d = normalizeExchangeDetails({
      item: { name: 'X' },
      pairs: [
        {
          id: 'chaos',
          rate: 1,
          history: [
            { timestamp: 'not-a-date', rate: 5 },
            { timestamp: '2026-08-08T00:00:00Z', rate: 6 },
          ],
        },
      ],
    })!
    expect(d.pairs[0].history).toHaveLength(1)
  })

  it('returns null when no pair has a rate', () => {
    expect(normalizeExchangeDetails({ item: { name: 'X' }, pairs: [{ id: 'chaos', history: [] }] })).toBeNull()
  })

  it('returns null when the payload has no item name', () => {
    expect(normalizeExchangeDetails({ pairs: [] })).toBeNull()
    expect(normalizeExchangeDetails(null)).toBeNull()
  })
})

describe('fetchExchangeDetails', () => {
  it('requests the details url for the given item', async () => {
    const fetchJson = vi.fn().mockResolvedValue(RAW)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'orb-of-annulment', fetchJson)
    expect(fetchJson).toHaveBeenCalledWith(exchangeDetailsUrl(1, 'Allflame', 'Currency', 'orb-of-annulment'))
  })

  it('returns null and does not throw when the fetch rejects', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchJson = vi.fn().mockRejectedValue(new Error('404'))
    await expect(fetchExchangeDetails(1, 'Allflame', 'Currency', 'nope', fetchJson)).resolves.toBeNull()
    consoleErrorSpy.mockRestore()
  })

  it('serves a second call for the same key from cache', async () => {
    const fetchJson = vi.fn().mockResolvedValue(RAW)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'orb-of-annulment', fetchJson)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'orb-of-annulment', fetchJson)
    expect(fetchJson).toHaveBeenCalledTimes(1)
  })

  it('caches the null result so a 404 is not refetched', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchJson = vi.fn().mockRejectedValue(new Error('404'))
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'nope', fetchJson)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'nope', fetchJson)
    expect(fetchJson).toHaveBeenCalledTimes(1)
    consoleErrorSpy.mockRestore()
  })

  it('keys the cache per version, league, type and slug', async () => {
    const fetchJson = vi.fn().mockResolvedValue(RAW)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'orb-of-annulment', fetchJson)
    await fetchExchangeDetails(2, 'Allflame', 'Currency', 'orb-of-annulment', fetchJson)
    await fetchExchangeDetails(1, 'Standard', 'Currency', 'orb-of-annulment', fetchJson)
    await fetchExchangeDetails(1, 'Allflame', 'Fragment', 'orb-of-annulment', fetchJson)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'chaos-orb', fetchJson)
    expect(fetchJson).toHaveBeenCalledTimes(5)
  })

  it('refetches once the ttl has elapsed', async () => {
    vi.useFakeTimers()
    const fetchJson = vi.fn().mockResolvedValue(RAW)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'orb-of-annulment', fetchJson)
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    await fetchExchangeDetails(1, 'Allflame', 'Currency', 'orb-of-annulment', fetchJson)
    expect(fetchJson).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
