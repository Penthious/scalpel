import { describe, expect, it } from 'vitest'
import { pickMercenarySupportsToEnable } from './mercenary-tighten'
import type { Listing } from '../../shared/trade-types'
import type { StatFilter } from './types'

const BLADEFALL = 'mercenary.skill_37202'
const GRACE = 'mercenary.skill_2792'

const skill = (id: string, text: string, enabled = true): StatFilter => ({
  id,
  text,
  value: null,
  min: null,
  max: null,
  enabled,
  type: 'mercenary',
})

const support = (text: string, skillId: string): StatFilter => ({
  id: `mercenary.support_${text.replace(/\W/g, '')}`,
  text,
  value: null,
  min: null,
  max: null,
  enabled: false,
  type: 'mercenary',
  mercenarySkillId: skillId,
})

/** A comp carrying `kit`, e.g. { Bladefall: ['Greater Impale (Tier: 3)'] }. */
const comp = (kit: Record<string, string[]>): Listing => ({
  id: 'x',
  price: null,
  account: 'a',
  online: true,
  instantBuyout: false,
  itemData: {
    mercenarySkills: Object.entries(kit).map(([name, sups]) => ({
      name,
      supports: sups.map((s) => {
        const m = s.match(/^(.*?)\s*\(Tier: (\d+)\)$/)
        return { name: m![1], tier: Number(m![2]) }
      }),
    })),
  },
})

/** `n` comps all carrying Bladefall, the first `withImpale` of them with Impale. */
const comps = (n: number, withImpale: number): Listing[] =>
  Array.from({ length: n }, (_, i) => comp({ Bladefall: i < withImpale ? ['Greater Impale (Tier: 3)'] : [] }))

const BASE = [skill(BLADEFALL, 'Bladefall'), support('Greater Impale (Tier: 3)', BLADEFALL)]

describe('pickMercenarySupportsToEnable', () => {
  it('picks nothing when the item has no mercenary supports', () => {
    const filters = [skill(BLADEFALL, 'Bladefall')]

    expect(pickMercenarySupportsToEnable(filters, comps(10, 3), 103)).toEqual([])
  })

  it('picks the support the fewest comps carry', () => {
    const filters = [
      skill(BLADEFALL, 'Bladefall'),
      support('Greater Impale (Tier: 3)', BLADEFALL),
      support('Greater Fortify (Tier: 3)', BLADEFALL),
    ]
    // Impale on 8 of 10, Fortify on 2 of 10 -- Fortify is what separates this
    // warrant from the bottom of the book. Out of 70 listings only Fortify fits:
    // 70 * 3/12 = 17.5, and adding Impale on top of that lands at 13.
    const listings = Array.from({ length: 10 }, (_, i) =>
      comp({
        Bladefall: [...(i < 8 ? ['Greater Impale (Tier: 3)'] : []), ...(i < 2 ? ['Greater Fortify (Tier: 3)'] : [])],
      }),
    )

    expect(pickMercenarySupportsToEnable(filters, listings, 70)).toEqual([2])
  })

  it('never ticks more than three supports, however deep the pool', () => {
    // Each one costs a stat group, and anonymous searches get exactly one before
    // trade drops the whole kit to unscoped filters.
    const names = ['Impale', 'Fortify', 'Brutality', 'Melee Splash', 'Fist of War']
    const filters = [skill(BLADEFALL, 'Bladefall'), ...names.map((n) => support(`Greater ${n} (Tier: 3)`, BLADEFALL))]
    const listings = Array.from({ length: 10 }, (_, i) =>
      comp({ Bladefall: names.filter((_, k) => i < k + 1).map((n) => `Greater ${n} (Tier: 3)`) }),
    )

    expect(pickMercenarySupportsToEnable(filters, listings, 5_000_000)).toHaveLength(3)
  })

  it('leaves the search alone when it is already small enough to read', () => {
    expect(pickMercenarySupportsToEnable(BASE, comps(10, 3), 12)).toEqual([])
  })

  it('stops before the projected count falls through the floor', () => {
    // 40 total, Impale on 3 of 10 -> projected 40 * (3+1)/(10+2) = 13, under the
    // floor of 15. Tightening here would trade a readable set for a lonely one.
    expect(pickMercenarySupportsToEnable(BASE, comps(10, 3), 40)).toEqual([])
  })

  it('picks a support no cheap comp carries when the pool is deep enough', () => {
    // Absent from all ten cheapest comps is the strongest signal there is -- it is
    // what lifts this warrant off the floor of the book. Smoothed rather than
    // projected at zero, which no sample can justify.
    expect(pickMercenarySupportsToEnable(BASE, comps(10, 0), 600)).toEqual([1])
  })

  it('skips a support every comp already carries', () => {
    // No selectivity: it costs a stat group and removes nothing.
    expect(pickMercenarySupportsToEnable(BASE, comps(10, 10), 600)).toEqual([])
  })

  it('skips a support whose skill row is switched off', () => {
    const filters = [skill(BLADEFALL, 'Bladefall', false), support('Greater Impale (Tier: 3)', BLADEFALL)]

    expect(pickMercenarySupportsToEnable(filters, comps(10, 3), 600)).toEqual([])
  })

  it('counts carriers only on the skill the support sits on', () => {
    const filters = [
      skill(BLADEFALL, 'Bladefall'),
      skill(GRACE, 'Grace'),
      support('Greater Impale (Tier: 3)', BLADEFALL),
    ]
    // Every comp has Impale, but on Grace -- none of them match what was asked
    // for, which is Impale on Bladefall.
    const listings = Array.from({ length: 10 }, () => comp({ Bladefall: [], Grace: ['Greater Impale (Tier: 3)'] }))

    expect(pickMercenarySupportsToEnable(filters, listings, 600)).toEqual([2])
  })

  it('leaves an already-tightened search alone', () => {
    const filters = [
      skill(BLADEFALL, 'Bladefall'),
      { ...support('Greater Impale (Tier: 3)', BLADEFALL), enabled: true },
      support('Greater Fortify (Tier: 3)', BLADEFALL),
    ]

    expect(pickMercenarySupportsToEnable(filters, comps(10, 3), 600)).toEqual([])
  })

  it('picks nothing when no comp reports its kit', () => {
    const bare: Listing[] = [{ id: 'x', price: null, account: 'a', online: true, instantBuyout: false }]

    expect(pickMercenarySupportsToEnable(BASE, bare, 600)).toEqual([])
  })

  it('keeps tightening while the floor allows, rarest first', () => {
    const filters = [
      skill(BLADEFALL, 'Bladefall'),
      support('Greater Impale (Tier: 3)', BLADEFALL),
      support('Greater Fortify (Tier: 3)', BLADEFALL),
    ]
    // Impale on 5 of 10, Fortify on 2 of 10, out of a 5000-listing pool:
    // 5000 * 3/12 = 1250, * 6/12 = 625. Both clear the floor.
    const listings = Array.from({ length: 10 }, (_, i) =>
      comp({
        Bladefall: [...(i < 5 ? ['Greater Impale (Tier: 3)'] : []), ...(i < 2 ? ['Greater Fortify (Tier: 3)'] : [])],
      }),
    )

    expect(pickMercenarySupportsToEnable(filters, listings, 5000)).toEqual([2, 1])
  })
})
