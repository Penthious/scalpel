import { describe, expect, it } from 'vitest'
import type { FilterBlock } from './types'
import { checkRemovable } from './filter-removal'

function block(conditions: FilterBlock['conditions']): FilterBlock {
  return {
    id: 'b1',
    visibility: 'Show',
    conditions,
    actions: [],
    continue: false,
    lineStart: 1,
    lineEnd: 2,
  }
}

const baseTypeCond = (values: string[], operator: '==' | '=' = '=='): FilterBlock['conditions'][number] => ({
  type: 'BaseType',
  operator,
  values,
  explicitOperator: operator === '==',
})

describe('checkRemovable', () => {
  it('allows removing an exact base when others remain', () => {
    const result = checkRemovable(block([baseTypeCond(['Sapphire Ring', 'Ruby Ring'])]), 'Sapphire Ring')
    expect(result).toEqual({ removable: true, exact: ['Sapphire Ring'] })
  })

  it('matches the base case-insensitively', () => {
    const result = checkRemovable(block([baseTypeCond(['sapphire ring', 'Ruby Ring'])]), 'Sapphire Ring')
    expect(result).toEqual({ removable: true, exact: ['sapphire ring'] })
  })

  it('strips the base from every BaseType condition on the block', () => {
    const result = checkRemovable(
      block([baseTypeCond(['Sapphire Ring']), baseTypeCond(['Sapphire Ring', 'Ruby Ring'])]),
      'Sapphire Ring',
    )
    expect(result).toEqual({ removable: true, exact: ['Sapphire Ring', 'Sapphire Ring'] })
  })

  it('refuses when the block has no BaseType condition', () => {
    const result = checkRemovable(block([{ type: 'Class', operator: '==', values: ['Rings'] }]), 'Sapphire Ring')
    expect(result).toEqual({ removable: false, reason: 'not-by-name' })
  })

  it('refuses when a substring token also catches the item', () => {
    const result = checkRemovable(block([baseTypeCond(['Ring'], '=')]), 'Sapphire Ring')
    expect(result).toEqual({ removable: false, reason: 'token', token: 'Ring' })
  })

  it('refuses when an exact value and a catching token coexist', () => {
    const result = checkRemovable(block([baseTypeCond(['Sapphire Ring', 'Ring'], '=')]), 'Sapphire Ring')
    expect(result).toEqual({ removable: false, reason: 'token', token: 'Ring' })
  })

  it('does not treat a substring as a token when the operator is exact', () => {
    const result = checkRemovable(block([baseTypeCond(['Ring', 'Sapphire Ring'], '==')]), 'Sapphire Ring')
    expect(result).toEqual({ removable: true, exact: ['Sapphire Ring'] })
  })

  it('refuses when the base is the only value left', () => {
    const result = checkRemovable(block([baseTypeCond(['Sapphire Ring'])]), 'Sapphire Ring')
    expect(result).toEqual({ removable: false, reason: 'last-base' })
  })
})
