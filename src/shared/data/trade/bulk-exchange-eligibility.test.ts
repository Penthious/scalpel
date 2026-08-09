import { describe, expect, it } from 'vitest'
import { isVendorExchangeItem } from './bulk-exchange-eligibility'

describe('isVendorExchangeItem (PoE2 / Ange)', () => {
  it('routes omens to the exchange (clipboard class is singular "Omen")', () => {
    // GGG's RotA filter info lists the class as "Omen", and the clipboard
    // Item Class line is matched verbatim -- a plural "Omens" rule never hits.
    expect(isVendorExchangeItem(2, 'Omen', 'Omen of Chaotic Effectiveness')).toBe(true)
  })

  it('routes stackable currency to the exchange', () => {
    expect(isVendorExchangeItem(2, 'Stackable Currency', 'Divine Orb')).toBe(true)
  })

  it('excludes rare/unique stackables (e.g. beasts)', () => {
    expect(isVendorExchangeItem(2, 'Stackable Currency', 'Some Beast', 'Rare')).toBe(false)
  })

  it('does not route equipment to the exchange', () => {
    expect(isVendorExchangeItem(2, 'Body Armours', 'Ornate Ringmail')).toBe(false)
  })
})

describe('isVendorExchangeItem (PoE1 / Faustus)', () => {
  it('routes stackable currency to the exchange', () => {
    expect(isVendorExchangeItem(1, 'Stackable Currency', 'Chaos Orb', 'Currency')).toBe(true)
  })

  it('excludes Scrying Orbs -- Faustus has no listing for a map-bound orb (#513)', () => {
    expect(isVendorExchangeItem(1, 'Stackable Currency', 'Scrying Orb', 'Currency')).toBe(false)
  })

  it('routes ordinary map fragments to the exchange', () => {
    expect(isVendorExchangeItem(1, 'Map Fragments', 'Sacrifice at Dusk', 'Normal')).toBe(true)
  })

  it('excludes Mercenary Warrants -- each sells one mercenary, nothing fungible to exchange', () => {
    expect(isVendorExchangeItem(1, 'Map Fragments', 'Mercenary Warrant', 'Normal')).toBe(false)
  })

  it('includes Reliquary Keys, whose class is Vault Keys rather than Map Fragments', () => {
    // Confirmed against poedb: Voidborn Reliquary Key is Class "Vault Keys". The
    // PoE2 rules already carried that class and PoE1's did not, so every key
    // failed this gate despite a liquid exchange market behind it.
    expect(isVendorExchangeItem(1, 'Vault Keys', 'Voidborn Reliquary Key', 'Normal')).toBe(true)
    expect(isVendorExchangeItem(1, 'Vault Keys', 'Ancient Reliquary Key', 'Normal')).toBe(true)
  })

  it('excludes every Incursion vial -- Faustus does not carry them, they sell on regular trade (#550)', () => {
    const VIALS = [
      'Vial of Awakening',
      'Vial of Consequence',
      'Vial of Dominance',
      'Vial of Fate',
      'Vial of Sacrifice',
      'Vial of Summoning',
      'Vial of Transcendence',
      'Vial of the Ghost',
      'Vial of the Ritual',
    ]
    for (const vial of VIALS) {
      expect(isVendorExchangeItem(1, 'Stackable Currency', vial, 'Currency')).toBe(false)
    }
  })
})
