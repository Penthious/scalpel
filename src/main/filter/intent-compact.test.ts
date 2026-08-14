import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '') } }))

import { compactIntents } from './intent-recorder'
import type { Intent } from './intents'

const move = (value: string, fromTier: string, toTier: string, timestamp: number): Intent => ({
  type: 'move-basetype',
  target: { typePath: 'rings', tier: toTier },
  payload: { value, fromTier },
  timestamp,
})

const remove = (value: string, tier: string, timestamp: number): Intent => ({
  type: 'remove-basetype',
  target: { typePath: 'rings', tier },
  payload: { value },
  timestamp,
})

describe('compactIntents', () => {
  it('drops an earlier move when the same base is later removed', () => {
    const out = compactIntents([move('Sapphire Ring', 't1', 't2', 1), remove('Sapphire Ring', 't2', 2)])
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('remove-basetype')
  })

  it('drops an earlier removal when the same base is later moved', () => {
    const out = compactIntents([remove('Sapphire Ring', 't1', 1), move('Sapphire Ring', 't1', 't2', 2)])
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('move-basetype')
  })

  it('keeps removals of different bases', () => {
    const out = compactIntents([remove('Sapphire Ring', 't1', 1), remove('Ruby Ring', 't1', 2)])
    expect(out).toHaveLength(2)
  })

  it('dedupes repeated removals of the same base from the same tier', () => {
    const out = compactIntents([remove('Sapphire Ring', 't1', 1), remove('Sapphire Ring', 't1', 2)])
    expect(out).toHaveLength(1)
    expect(out[0].timestamp).toBe(2)
  })

  it('keeps removals of the same base from different tiers', () => {
    const out = compactIntents([remove('Sapphire Ring', 't1', 1), remove('Sapphire Ring', 't2', 2)])
    expect(out).toHaveLength(2)
  })

  it('leaves unrelated intents untouched', () => {
    const vis: Intent = {
      type: 'set-visibility',
      target: { typePath: 'rings', tier: 't1' },
      payload: { visibility: 'Hide' },
      timestamp: 1,
    }
    const out = compactIntents([vis, remove('Sapphire Ring', 't1', 2)])
    expect(out).toHaveLength(2)
  })
})

const add = (value: string, tier: string, timestamp: number): Intent => ({
  type: 'add-basetype',
  target: { typePath: 'currency', tier },
  payload: { value },
  timestamp,
})

describe('compactIntents add-basetype', () => {
  it('dedupes the same base into the same tier', () => {
    const out = compactIntents([add('Chaos Orb', 'twisdom', 1), add('Chaos Orb', 'twisdom', 2)])
    expect(out).toHaveLength(1)
    expect(out[0].timestamp).toBe(2)
  })

  it('keeps adds of the same base into different tiers', () => {
    const out = compactIntents([add('Chaos Orb', 'twisdom', 1), add('Chaos Orb', 'tportal', 2)])
    expect(out).toHaveLength(2)
  })

  it('keeps the strip and the add together -- hiding needs both', () => {
    const out = compactIntents([remove('Chaos Orb', 't1', 1), add('Chaos Orb', 'twisdom', 2)])
    expect(out.map((i) => i.type).sort()).toEqual(['add-basetype', 'remove-basetype'])
  })
})
