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

describe('statTextToPattern number-governed plurals (#577)', () => {
  it('matches the plural clipboard form of a singular stat text', () => {
    const pattern = statTextToPattern('Gain Adrenaline for # second on Kill')
    expect('Gain Adrenaline for 2 seconds on Kill'.match(pattern)?.[1]).toBe('2')
    expect('Gain Adrenaline for 1 second on Kill'.match(pattern)?.[1]).toBe('1')
  })

  it('matches the singular clipboard form of a plural stat text', () => {
    const pattern = statTextToPattern('Gain Adrenaline for # seconds when you reach Low Life')
    expect('Gain Adrenaline for 1 second when you reach Low Life'.match(pattern)?.[1]).toBe('1')
    expect('Gain Adrenaline for 4 seconds when you reach Low Life'.match(pattern)?.[1]).toBe('4')
  })

  it('leaves a noun that is not followed by a space alone', () => {
    // The trade catalog carries a typo twin of Warlord's Mark ("Warlords's Mark").
    // Relaxing the "s" there would make each pattern match the other stat's text
    // and the longest-text tiebreak would hand every item the typo id.
    const typo = statTextToPattern("Trigger Level # Warlords's Mark when you Hit")
    expect("Trigger Level 20 Warlord's Mark when you Hit".match(typo)).toBeNull()
    const real = statTextToPattern("Trigger Level # Warlord's Mark when you Hit")
    expect("Trigger Level 20 Warlords's Mark when you Hit".match(real)).toBeNull()
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
