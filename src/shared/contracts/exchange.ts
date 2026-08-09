/** poe.ninja's in-game Currency Exchange data for a single item (Faustus on
 *  PoE1, Ange on PoE2). Distinct from the bulk-trade listings in
 *  contracts/trade -- this is the vendor's actual market: real exchange rates
 *  and traded volume, which web listings never expose. */

export interface ExchangePoint {
  /** Epoch ms, parsed from the response's ISO timestamp. */
  t: number
  rate: number
  /** Volume per hour, denominated in the pair currency. */
  volume: number
}

export interface ExchangePair {
  /** Currency key on the other side of the pair -- 'chaos' | 'divine' |
   *  'exalted'. Matches CurrencyIcon's naming, so it can be passed straight
   *  through. */
  currency: string
  /** 1 item = `rate` of `currency`. */
  rate: number
  volumePerHour: number
  /** Daily samples, oldest first, so array index order is time order. */
  history: ExchangePoint[]
}

export interface ExchangeDetails {
  name: string
  /** poe.ninja-relative CDN path for the item art, when the response carried one. */
  icon?: string
  /** Pairs with a usable rate, in the order poe.ninja returned them. Never empty
   *  -- a payload with no priced pair normalizes to null instead. */
  pairs: ExchangePair[]
}
