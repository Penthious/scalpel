import { describe, expect, it } from 'vitest'
import { buildSocketFilters } from './sockets'

// Minimal itemInfo shape for socket tests
function makeInfo(overrides: { sockets?: string; linkedSockets?: number; itemClass?: string; runes?: string[] } = {}) {
  return {
    sockets: overrides.sockets ?? 'S S',
    linkedSockets: overrides.linkedSockets ?? 0,
    itemClass: overrides.itemClass ?? 'Boots',
    runes: overrides.runes,
  }
}

describe('buildSocketFilters - special rune deduction', () => {
  // The real bug report: a 2-socket boot carrying BOTH a warping rune AND a
  // modifier-grant rune indexes as rune_sockets 0 on trade (verified live), so the
  // chip must be dropped entirely - a min:1 chip still excludes the item's own listing.
  it('drops the chip for the real item: 2 sockets + warping + "+N Suffix Modifier allowed" -> no chip', () => {
    const filters = buildSocketFilters(
      makeInfo({ runes: ['+1 Suffix Modifier allowed', 'Can roll Chronomancy modifiers'] }),
    )
    expect(filters.find((f) => f.id === 'socket.rune_sockets')).toBeUndefined()
  })

  it('subtracts a modifier-grant rune: 2 sockets + "+1 Prefix Modifier allowed" -> chip min/value = 1', () => {
    const filters = buildSocketFilters(makeInfo({ runes: ['+1 Prefix Modifier allowed'] }))
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeDefined()
    expect(runeChip!.min).toBe(1)
    expect(runeChip!.text).toBe('1 Rune Socket')
  })

  it('handles the plural "Modifiers allowed" wording too', () => {
    const filters = buildSocketFilters(makeInfo({ runes: ['+2 Suffix Modifiers allowed', 'Can roll Decay modifiers'] }))
    expect(filters.find((f) => f.id === 'socket.rune_sockets')).toBeUndefined()
  })

  it('does NOT discount a normal stat rune: 2 sockets + a resistance rune -> chip min/value = 2', () => {
    const filters = buildSocketFilters(makeInfo({ runes: ['+12% to Fire Resistance'] }))
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeDefined()
    expect(runeChip!.min).toBe(2)
    expect(runeChip!.text).toBe('2 Rune Sockets')
  })

  it('subtracts one warping rune: 2 sockets + 1 warping rune -> chip min/value = 1', () => {
    const filters = buildSocketFilters(makeInfo({ runes: ['Can roll Chronomancy modifiers'] }))
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeDefined()
    expect(runeChip!.min).toBe(1)
    expect(runeChip!.value).toBe(1)
    expect(runeChip!.text).toBe('1 Rune Socket')
  })

  it('subtracts two warping runes: 2 sockets + 2 warping runes -> no rune-socket chip', () => {
    const filters = buildSocketFilters(
      makeInfo({ runes: ['Can roll Chronomancy modifiers', 'Can roll Decay modifiers'] }),
    )
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeUndefined()
  })

  it('does not discount non-warping runes (empty runes): 2 sockets + no runes -> chip min/value = 2', () => {
    const filters = buildSocketFilters(makeInfo({ runes: [] }))
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeDefined()
    expect(runeChip!.min).toBe(2)
    expect(runeChip!.value).toBe(2)
    expect(runeChip!.text).toBe('2 Rune Sockets')
  })

  // "Can roll Ring Modifiers" is an item implicit, not a rune, and uses a capital M.
  // Feeding it via runes[] documents that the no-i-flag regex correctly excludes it.
  it('does not discount capital-M "Can roll Ring Modifiers" - it is not a warping rune', () => {
    const filters = buildSocketFilters(makeInfo({ runes: ['Can roll Ring Modifiers'] }))
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeDefined()
    expect(runeChip!.min).toBe(2)
    expect(runeChip!.value).toBe(2)
    expect(runeChip!.text).toBe('2 Rune Sockets')
  })

  it('sanity: single socket with no runes -> chip min/value = 1', () => {
    const filters = buildSocketFilters(makeInfo({ sockets: 'S', runes: [] }))
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeDefined()
    expect(runeChip!.min).toBe(1)
    expect(runeChip!.value).toBe(1)
    expect(runeChip!.text).toBe('1 Rune Socket')
  })

  it('runes field absent (undefined) treated as empty: 2 sockets -> chip min/value = 2', () => {
    const filters = buildSocketFilters(makeInfo({ runes: undefined }))
    const runeChip = filters.find((f) => f.id === 'socket.rune_sockets')
    expect(runeChip).toBeDefined()
    expect(runeChip!.min).toBe(2)
    expect(runeChip!.value).toBe(2)
  })
})

// Trade indexes every abyssal-socket grant separately at the value printed on its
// own line -- probe-verified against live listings. The chips must mirror
// that split, never the item's total socket count.
describe('buildSocketFilters - abyssal sockets', () => {
  const abyss = (filters: ReturnType<typeof buildSocketFilters>) =>
    filters.filter((f) => f.id.endsWith('.stat_3527617737'))

  // The reported bug: Darkness Enthroned takes one socket from the Stygian Vise
  // implicit and one from its own unique mod. Trade holds implicit=1 AND
  // explicit=1; a single chip at 2 sockets matched nothing.
  it('Darkness Enthroned (implicit 1 + explicit 1) -> two chips, each min 1', () => {
    const filters = buildSocketFilters(
      makeInfo({ sockets: 'A A', itemClass: 'Belts' }),
      ['Has 1 Abyssal Socket', '97% increased Effect of Socketed Abyss Jewels'],
      ['Has 1 Abyssal Socket'],
    )
    const rows = abyss(filters)
    expect(rows).toHaveLength(2)
    expect(rows.map((f) => [f.id, f.min, f.value, f.type, f.text])).toEqual([
      ['implicit.stat_3527617737', 1, 1, 'implicit', 'Abyssal Sockets (implicit)'],
      ['explicit.stat_3527617737', 1, 1, 'explicit', 'Abyssal Sockets (explicit)'],
    ])
    expect(rows.every((f) => f.enabled)).toBe(true)
  })

  it('plain Stygian Vise (implicit only) -> one implicit chip, min 1, unlabelled', () => {
    const filters = buildSocketFilters(makeInfo({ sockets: 'A', itemClass: 'Belts' }), [], ['Has 1 Abyssal Socket'])
    expect(abyss(filters).map((f) => [f.id, f.min, f.text])).toEqual([
      ['implicit.stat_3527617737', 1, 'Abyssal Sockets'],
    ])
  })

  it('suffix-granted socket on a rare (explicit only) -> one explicit chip, min 1', () => {
    const filters = buildSocketFilters(
      makeInfo({ sockets: 'A', itemClass: 'Gloves' }),
      ['+40 to maximum Life', 'Has 1 Abyssal Socket'],
      [],
    )
    expect(abyss(filters).map((f) => [f.id, f.min, f.text])).toEqual([
      ['explicit.stat_3527617737', 1, 'Abyssal Sockets'],
    ])
  })

  // A grant covering several sockets prints one line and indexes as that value, so
  // the min comes off the line rather than from counting sockets.
  it('two-socket Bubonic Trail ("Has 2 Abyssal Sockets") -> one explicit chip, min 2', () => {
    const filters = buildSocketFilters(
      makeInfo({ sockets: 'W-A A', itemClass: 'Boots' }),
      ['Has 2 Abyssal Sockets', 'Triggers Level 20 Death Walk when Equipped'],
      [],
    )
    expect(abyss(filters).map((f) => [f.id, f.min])).toEqual([['explicit.stat_3527617737', 2]])
  })

  it('reads the count through a (crafted) / (implicit) tag', () => {
    const filters = buildSocketFilters(
      makeInfo({ sockets: 'A A', itemClass: 'Belts' }),
      ['Has 1 Abyssal Socket (crafted)'],
      ['Has 1 Abyssal Socket (implicit)'],
    )
    expect(abyss(filters).map((f) => [f.id, f.min])).toEqual([
      ['implicit.stat_3527617737', 1],
      ['explicit.stat_3527617737', 1],
    ])
  })

  // Unidentified item: no mod lines to attribute the sockets to, so the pre-existing
  // implicit default at the socket count stands.
  it('no abyss line at all -> one implicit chip at the socket count', () => {
    const filters = buildSocketFilters(makeInfo({ sockets: 'A', itemClass: 'Belts' }), [], [])
    expect(abyss(filters).map((f) => [f.id, f.min])).toEqual([['implicit.stat_3527617737', 1]])
  })

  it('no abyssal sockets -> no abyss chip', () => {
    expect(abyss(buildSocketFilters(makeInfo({ sockets: 'R-G-B', itemClass: 'Gloves' }), [], []))).toHaveLength(0)
  })
})
