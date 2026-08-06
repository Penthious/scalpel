import { describe, expect, it } from 'vitest'
import { defaultPoeItem } from '@shared/poe-item'
import type { AdvancedMod, PoeItem } from '@shared/types'
import { createAdvancedCopyTracker, looksLikeBasicCopy } from './advanced-copy'

const ADVANCED_MOD: AdvancedMod = {
  type: 'prefix',
  name: 'Sanguine',
  tier: 11,
  tags: ['Life'],
  lines: ['+42 to maximum Life'],
  ranges: [{ value: 42, min: 40, max: 45 }],
  fractured: false,
  crafted: false,
  eldritch: false,
  foulborn: false,
}

/** An identified rare copied WITHOUT the advanced description. */
function basicRare(overrides: Partial<PoeItem> = {}): PoeItem {
  return defaultPoeItem({
    itemClass: 'Body Armours',
    rarity: 'Rare',
    name: 'Dread Shell',
    baseType: 'Astral Plate',
    explicits: ['+42 to maximum Life'],
    ...overrides,
  })
}

/** The same item copied WITH it. */
function advancedRare(): PoeItem {
  return basicRare({ advancedMods: [ADVANCED_MOD] })
}

describe('looksLikeBasicCopy', () => {
  it('flags a modded item with no advanced-mod headers', () => {
    expect(looksLikeBasicCopy(basicRare())).toBe(true)
  })

  it('flags an item whose only mods are implicits', () => {
    expect(looksLikeBasicCopy(basicRare({ explicits: [], implicits: ['+20% to Fire Resistance'] }))).toBe(true)
  })

  it('clears an item that already carries advanced mods', () => {
    expect(looksLikeBasicCopy(advancedRare())).toBe(false)
  })

  it('clears items with no mods at all - a second copy would learn nothing', () => {
    const currency = defaultPoeItem({ itemClass: 'Stackable Currency', rarity: 'Currency', name: 'Chaos Orb' })
    expect(looksLikeBasicCopy(currency)).toBe(false)

    const unidRare = basicRare({ explicits: [], identified: false })
    expect(looksLikeBasicCopy(unidRare)).toBe(false)
  })

  it('clears skill gems - their stat lines parse as explicits but never have headers', () => {
    for (const itemClass of ['Gems', 'Skill Gems', 'Active Skill Gems', 'Support Gems', 'Support Skill Gems']) {
      const gem = defaultPoeItem({
        itemClass,
        rarity: 'Gem',
        name: 'Spark',
        explicits: ['Deals 5 to 15 Lightning Damage'],
      })
      expect(looksLikeBasicCopy(gem), itemClass).toBe(false)
    }
  })
})

describe('createAdvancedCopyTracker', () => {
  it('starts out probing and sending a plain Ctrl+C', () => {
    const tracker = createAdvancedCopyTracker()
    expect(tracker.state()).toBe('probing')
    expect(tracker.needsAlt()).toBe(false)
  })

  it('does not probe an item that already has advanced mods', () => {
    const tracker = createAdvancedCopyTracker()
    expect(tracker.shouldProbe(advancedRare())).toBe(false)
  })

  it('latches to Alt when the probe copy proves Alt is required', () => {
    const tracker = createAdvancedCopyTracker()
    const altCopy = advancedRare()
    expect(tracker.shouldProbe(basicRare())).toBe(true)
    // Hands back the Alt copy so the caller uses it instead of the plain one.
    expect(tracker.recordProbe(altCopy)).toBe(altCopy)
    expect(tracker.state()).toBe('alt')
    expect(tracker.needsAlt()).toBe(true)
    // Latched: no further probing, every copy holds Alt from here.
    expect(tracker.shouldProbe(basicRare())).toBe(false)
  })

  it('keeps probing after an inconclusive result rather than wrongly settling', () => {
    const tracker = createAdvancedCopyTracker()
    tracker.shouldProbe(basicRare())
    expect(tracker.recordProbe(basicRare())).toBeNull()
    expect(tracker.state()).toBe('probing')
    expect(tracker.shouldProbe(basicRare())).toBe(true)
  })

  it('treats an unparseable Alt copy as inconclusive', () => {
    const tracker = createAdvancedCopyTracker()
    expect(tracker.recordProbe(null)).toBeNull()
    expect(tracker.state()).toBe('probing')
  })

  it('gives up on probing after three inconclusive rounds', () => {
    const tracker = createAdvancedCopyTracker()
    tracker.recordProbe(basicRare())
    tracker.recordProbe(basicRare())
    expect(tracker.state()).toBe('probing')
    tracker.recordProbe(basicRare())
    expect(tracker.state()).toBe('plain')
    expect(tracker.needsAlt()).toBe(false)
    expect(tracker.shouldProbe(basicRare())).toBe(false)
  })

  it('a late positive still wins over accumulated inconclusive probes', () => {
    const tracker = createAdvancedCopyTracker()
    const altCopy = advancedRare()
    tracker.recordProbe(basicRare())
    tracker.recordProbe(null)
    expect(tracker.recordProbe(altCopy)).toBe(altCopy)
    expect(tracker.state()).toBe('alt')
  })

  it('reset returns a latched tracker to probing', () => {
    const tracker = createAdvancedCopyTracker()
    tracker.recordProbe(advancedRare())
    expect(tracker.needsAlt()).toBe(true)
    tracker.reset()
    expect(tracker.state()).toBe('probing')
    expect(tracker.needsAlt()).toBe(false)
    expect(tracker.shouldProbe(basicRare())).toBe(true)
  })

  it('reset also clears the inconclusive count', () => {
    const tracker = createAdvancedCopyTracker()
    tracker.recordProbe(basicRare())
    tracker.recordProbe(basicRare())
    tracker.reset()
    tracker.recordProbe(basicRare())
    tracker.recordProbe(basicRare())
    expect(tracker.state()).toBe('probing')
  })
})
