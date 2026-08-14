import { describe, expect, it } from 'vitest'
import { describeIntent } from './intent-describe'
import type { Intent } from './intents'

describe('describeIntent', () => {
  it('describes a move-basetype with the item name', () => {
    const intent: Intent = {
      type: 'move-basetype',
      target: { typePath: 'currency', tier: 't1' },
      payload: { value: 'Chaos Orb', fromTier: 't2' },
      timestamp: 1,
    }
    expect(describeIntent(intent)).toEqual({ description: 'Moved to t1', itemName: 'Chaos Orb' })
  })

  it('describes a remove-basetype intent', () => {
    const intent: Intent = {
      type: 'remove-basetype',
      target: { typePath: 'rings', tier: 't1' },
      payload: { value: 'Sapphire Ring' },
      timestamp: 0,
    }
    expect(describeIntent(intent)).toEqual({ description: 'Removed from t1', itemName: 'Sapphire Ring' })
  })

  it('describes a set-visibility', () => {
    const intent: Intent = {
      type: 'set-visibility',
      target: { typePath: 'currency', tier: 't1' },
      payload: { visibility: 'Hide' },
      timestamp: 1,
    }
    expect(describeIntent(intent)).toEqual({ description: 'Set currency/t1 to Hide' })
  })

  it('describes a set-threshold', () => {
    const intent: Intent = {
      type: 'set-threshold',
      target: { typePath: 'currency', tier: 't1' },
      payload: { condition: 'StackSize', operator: '>=', value: 100 },
      timestamp: 1,
    }
    expect(describeIntent(intent)).toEqual({ description: 'Set StackSize >= 100 on currency/t1' })
  })

  it('describes a set-action', () => {
    const intent: Intent = {
      type: 'set-action',
      target: { typePath: 'weapon', tier: '6l' },
      payload: { action: 'SetTextColor', values: ['255', '0', '0', '255'] },
      timestamp: 1,
    }
    expect(describeIntent(intent)).toEqual({ description: 'Changed SetTextColor on weapon/6l' })
  })

  it('falls back to a safe description for an unknown intent type', () => {
    const intent = {
      type: 'future-thing',
      target: { typePath: 'x', tier: 'y' },
      payload: {},
      timestamp: 1,
    } as unknown as Intent
    expect(describeIntent(intent)).toEqual({ description: 'Changed x/y' })
  })
})

describe('describeIntent add-basetype', () => {
  it('reads as hiding, not as an edit to the destination tier', () => {
    const intent: Intent = {
      type: 'add-basetype',
      target: { typePath: 'currency', tier: 'twisdom' },
      payload: { value: 'Chaos Orb' },
      timestamp: 0,
    }
    expect(describeIntent(intent)).toEqual({ description: 'Hidden in twisdom', itemName: 'Chaos Orb' })
  })
})
