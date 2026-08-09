export interface PriceInfo {
  chaosValue: number
  divineValue?: number
  dustValue?: number
  graph?: (number | null)[]
  ninjaCategory?: string
}

export interface PriceEntry {
  name: string
  category: string
  chaosValue: number
  divineValue?: number
  graph?: (number | null)[]
  /** poe.ninja's raw overview type for this entry ('DivinationCard', 'Ritual').
   *  Distinct from `category`, which is the kebab URL segment -- the exchange
   *  details endpoint only accepts the raw form. Captured live on each refresh
   *  so a new GGG category needs no code change. */
  ninjaType?: string
}
