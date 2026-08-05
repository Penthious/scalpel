import { describe, expect, it } from 'vitest'
import { statTextToPattern, statTextToRelaxedPattern } from './pattern'

describe('statTextToPattern', () => {
  it('returns the same RegExp instance for repeated calls with the same text', () => {
    const a = statTextToPattern('+# to maximum Life')
    const b = statTextToPattern('+# to maximum Life')
    expect(a).toBe(b)
  })

  it('returns different instances for different texts', () => {
    const a = statTextToPattern('+# to maximum Life')
    const b = statTextToPattern('+# to maximum Mana')
    expect(a).not.toBe(b)
  })

  it('still matches and captures the numeric value', () => {
    const pattern = statTextToPattern('+# to maximum Life')
    const match = '+50 to maximum Life'.match(pattern)
    expect(match?.[1]).toBe('50')
  })
})

describe('statTextToRelaxedPattern', () => {
  it('treats hardcoded numbers as wildcards and matches a different number', () => {
    const pattern = statTextToRelaxedPattern('Has 1 Socket')
    const match = 'Has 3 Socket'.match(pattern)
    expect(match?.[1]).toBe('3')
  })

  it('returns the same instance on repeat calls', () => {
    const a = statTextToRelaxedPattern('Has 1 Socket')
    const b = statTextToRelaxedPattern('Has 1 Socket')
    expect(a).toBe(b)
  })
})
