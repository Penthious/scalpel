import { describe, expect, it } from 'vitest'
import { getVestigialMods } from './vestigial'

describe('getVestigialMods', () => {
  it('returns the candidates for a donor unique', () => {
    const mods = getVestigialMods('Abyssus')
    expect(mods).toHaveLength(1)
    expect(mods?.[0].to).toContain('Melee Critical Strike Multiplier')
  })

  it('returns every candidate when a unique donates several', () => {
    expect(getVestigialMods('The Three Dragons')).toHaveLength(3)
  })

  it('returns undefined for a unique that donates nothing', () => {
    expect(getVestigialMods('Frostferno')).toBeUndefined()
  })

  it('returns undefined for an unknown name', () => {
    expect(getVestigialMods('Not A Real Item')).toBeUndefined()
    expect(getVestigialMods('')).toBeUndefined()
  })
})
