import { describe, expect, it } from 'vitest'
import vestigial from './vestigial-poe1.json'

type Candidate = { from: string; to: string }
const data = vestigial as Record<string, Candidate[]>

describe('vestigial-poe1.json', () => {
  it('covers the donor pool at full size', () => {
    expect(Object.keys(data).length).toBeGreaterThanOrEqual(418)
  })

  it('keeps keys sorted and every candidate complete', () => {
    const keys = Object.keys(data)
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)))

    for (const [name, list] of Object.entries(data)) {
      expect(list.length, `${name} should have candidates`).toBeGreaterThan(0)
      for (const candidate of list) {
        expect(candidate.from.length, `${name} candidate needs a source mod`).toBeGreaterThan(0)
        expect(candidate.to.length, `${name} candidate needs a vestigial mod`).toBeGreaterThan(0)
      }
    }
  })

  it('carries no en or em dashes', () => {
    // Code points, not a literal character class -- the repo bans those characters
    // in source, and this assertion is exactly what keeps them out of the data.
    const DASHES = new Set([0x2012, 0x2013, 0x2014, 0x2015])
    const hasDash = (text: string): boolean => [...text].some((ch) => DASHES.has(ch.codePointAt(0) ?? 0))
    const offenders = Object.entries(data).filter(([, list]) => list.some((c) => hasDash(c.from + c.to)))
    expect(offenders.map(([name]) => name)).toEqual([])
  })

  it('spot-checks known donors', () => {
    expect(data.Abyssus).toEqual([
      { from: '+(100-125)% to Melee Critical Strike Multiplier', to: '+50% to Melee Critical Strike Multiplier' },
    ])
    expect(data.Loreweave?.length).toBe(2)
    expect(data['The Three Dragons']?.length).toBe(3)
  })

  it('omits uniques that donate nothing (issue #566 hides the card for these)', () => {
    expect(data.Frostferno).toBeUndefined()
  })
})
