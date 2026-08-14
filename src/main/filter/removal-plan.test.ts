import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FilterFile, PoeItem } from '@shared/types'
import { parseFilterFile } from './parser'
import { findMatchingBlocks } from './matcher'
import { planHide, planRemoval } from './removal-plan'

let real: FilterFile

beforeAll(() => {
  const raw = readFileSync(join(__dirname, '__fixtures__', 'test-filter.filter'), 'utf-8')
  real = parseFilterFile('f.filter', raw)
})

function item(over: Partial<PoeItem>): PoeItem {
  return {
    itemClass: 'Stackable Currency',
    rarity: 'Normal',
    name: '',
    baseType: 'Chaos Orb',
    mapTier: 0,
    itemLevel: 84,
    quality: 0,
    sockets: '',
    linkedSockets: 0,
    armour: 0,
    evasion: 0,
    energyShield: 0,
    ward: 0,
    block: 0,
    reqStr: 0,
    reqDex: 0,
    reqInt: 0,
    corrupted: false,
    identified: true,
    mirrored: false,
    synthesised: false,
    fractured: false,
    transfigured: false,
    blighted: false,
    scourged: false,
    zanaMemory: false,
    implicitCount: 0,
    gemLevel: 0,
    influence: [],
    explicits: [],
    implicits: [],
    enchants: [],
    ...over,
  } as unknown as PoeItem
}

function parse(lines: string[]): FilterFile {
  return parseFilterFile('t.filter', lines.join('\n'))
}

describe('planRemoval on the real filter', () => {
  it('spans every stack-size tier that catches a big stack of Chaos Orbs', () => {
    // The bug this fixes: Chaos Orb is named by three tiers that all match a
    // 20-stack, so stripping only the active one demoted it by one tier instead
    // of removing it.
    const plan = planRemoval(real, item({ stackSize: 20 } as Partial<PoeItem>), 'Chaos Orb')
    const tiers = plan.targets.map((t) => t.tierTag?.tier)
    expect(tiers).toEqual(['t2', 't3', 't4chaos'])
  })

  it('lands on a block that catches by class rules, not one that names the base', () => {
    const plan = planRemoval(real, item({ stackSize: 20 } as Partial<PoeItem>), 'Chaos Orb')
    expect(plan.landsOn).not.toBeNull()
    const landing = plan.landsOn!.block
    // The landing spot must not be one of the tiers we just stripped.
    expect(plan.targets.map((t) => t.blockIndex)).not.toContain(plan.landsOn!.blockIndex)
    // And it catches the item without naming it -- that is why removal works.
    expect(landing.conditions.some((c) => c.type === 'BaseType' && c.values.includes('Chaos Orb'))).toBe(false)
  })

  it('leaves unique-gated tiers alone for a rare item of the same base', () => {
    // Sapphire Ring is named by blocks gated on Rarity Unique. A rare ring must
    // not touch those, which is why scope is "blocks matching THIS item" rather
    // than "blocks naming the base".
    const rare = item({ baseType: 'Sapphire Ring', itemClass: 'Rings', rarity: 'Rare' })
    const plan = planRemoval(real, rare, 'Sapphire Ring')
    for (const t of plan.targets) {
      const block = real.blocks[t.blockIndex]
      const rarity = block.conditions.find((c) => c.type === 'Rarity')
      expect(rarity?.values).not.toContain('Unique')
    }
  })
})

describe('planHide', () => {
  it('finds a destination for rare equipment, which its own typePath cannot offer', () => {
    // The case that motivated widening the search: rare gear is governed by class
    // rules, so there is no hidden tier under its own typePath. A general-purpose
    // hide list elsewhere in the file is a perfectly good destination.
    const rare = item({ baseType: 'Sapphire Ring', itemClass: 'Rings', rarity: 'Rare' })
    const active = findMatchingBlocks(real, rare).find((m) => m.isFirstMatch)!
    const plan = planHide(real, rare, 'Sapphire Ring', active.block.tierTag!.typePath)
    // Either it already lands hidden, or a destination was found -- never neither.
    expect(plan.alreadyHidden || plan.destination !== null).toBe(true)
  })

  it('never picks a destination at or after the landing block', () => {
    // A Hide tier only hides anything if it wins the first-match race.
    const chaos = item({ baseType: 'Chaos Orb', stackSize: 20 } as Partial<PoeItem>)
    const active = findMatchingBlocks(real, chaos).find((m) => m.isFirstMatch)!
    const plan = planHide(real, chaos, 'Chaos Orb', active.block.tierTag!.typePath)
    if (plan.destination && plan.landsOn) {
      expect(plan.destination.blockIndex).toBeLessThan(plan.landsOn.blockIndex)
    }
  })

  it('needs no destination when stripping alone lands the item on a Hide block', () => {
    const filter = parse([
      'Show # $type->rings $tier->t1',
      '\tBaseType == "Sapphire Ring" "Ruby Ring"',
      '',
      'Hide # $type->rings $tier->hidelayer',
      '\tClass "Rings"',
      '',
    ])
    const rare = item({ baseType: 'Sapphire Ring', itemClass: 'Rings', rarity: 'Rare' })
    const plan = planHide(filter, rare, 'Sapphire Ring', 'rings')
    expect(plan.alreadyHidden).toBe(true)
    expect(plan.destination).toBeNull()
    expect(plan.targets.map((t) => t.tierTag?.tier)).toEqual(['t1'])
  })
})

describe('planRemoval guards', () => {
  const stacked = [
    'Show # $type->currency $tier->t1',
    '\tBaseType == "Chaos Orb" "Divine Orb"',
    '\tStackSize >= 6',
    '',
    'Show # $type->currency $tier->t2',
    '\tBaseType == "Chaos Orb"',
    '',
    'Show # $type->currency $tier->rest',
    '\tClass "Stackable Currency"',
    '',
  ]

  it('skips a tier whose last named base is the target, and reports it', () => {
    const plan = planRemoval(parse(stacked), item({ stackSize: 20 } as Partial<PoeItem>), 'Chaos Orb')
    expect(plan.targets.map((t) => t.tierTag?.tier)).toEqual(['t1'])
    expect(plan.skipped).toHaveLength(1)
    expect(plan.skipped[0].tierTag?.tier).toBe('t2')
    expect(plan.skipped[0].reason).toBe('last-base')
  })

  it('lands on the skipped tier, because it still catches the item', () => {
    const plan = planRemoval(parse(stacked), item({ stackSize: 20 } as Partial<PoeItem>), 'Chaos Orb')
    expect(plan.landsOn?.block.tierTag?.tier).toBe('t2')
  })

  it('ignores tiers the item does not match', () => {
    const plan = planRemoval(parse(stacked), item({ stackSize: 1 } as Partial<PoeItem>), 'Chaos Orb')
    // StackSize >= 6 excludes t1 for a single orb.
    expect(plan.targets.map((t) => t.tierTag?.tier)).toEqual([])
    expect(plan.skipped.map((s) => s.tierTag?.tier)).toEqual(['t2'])
  })

  it('returns no targets when nothing names the item', () => {
    const plan = planRemoval(parse(stacked), item({ baseType: 'Orb of Alchemy' } as Partial<PoeItem>), 'Orb of Alchemy')
    expect(plan.targets).toEqual([])
    expect(plan.skipped).toEqual([])
    expect(plan.landsOn?.block.tierTag?.tier).toBe('rest')
  })
})
