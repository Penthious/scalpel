import { describe, expect, it } from 'vitest'
import { MERCENARY_WARRANT_BUILDS, MERCENARY_WARRANT_DISCRIMINATOR } from './mercenary-warrants'

describe('MERCENARY_WARRANT_BUILDS', () => {
  it('maps a build to the opaque trade option id', () => {
    expect(MERCENARY_WARRANT_BUILDS['Mysterious Diver']).toBe('DivingDuelist')
    expect(MERCENARY_WARRANT_BUILDS.Warpriest).toBe('AurasMinionsTemplarSmite')
  })

  it('keys the Infamous variant off the clipboard text, prefix and all', () => {
    expect(MERCENARY_WARRANT_BUILDS['Infamous Mysterious Diver']).toBe('DivingDuelistNoble')
  })

  it('pins the single discriminator every build shares', () => {
    expect(MERCENARY_WARRANT_DISCRIMINATOR).toBe('mercenary_warrant')
  })

  it('carries every entry the catalog indexes, 35 builds and 28 Infamous twins', () => {
    const keys = Object.keys(MERCENARY_WARRANT_BUILDS)
    const infamous = keys.filter((k) => k.startsWith('Infamous '))
    expect(keys.length).toBe(63)
    expect(infamous.length).toBe(28)
  })

  it('suffixes every Infamous option with Noble on top of its plain twin', () => {
    for (const [build, option] of Object.entries(MERCENARY_WARRANT_BUILDS)) {
      if (!build.startsWith('Infamous ')) continue
      const plain = MERCENARY_WARRANT_BUILDS[build.slice('Infamous '.length)]
      expect(option).toBe(`${plain}Noble`)
    }
  })

  it('keeps GGG spelling verbatim, typo included', () => {
    // "Maraduer" is GGG's own typo in the option id. Correcting it breaks the search.
    expect(MERCENARY_WARRANT_BUILDS.Striker).toBe('MeleeStrikesMaraduerPhys')
  })
})
