import { describe, expect, it } from 'vitest'

import type { FilterFile, PoeItem } from '@shared/types'
import { parseFilterFile } from './parser'
import { findMatchingBlocks } from './matcher'
import { buildTierGroup } from './tier-group'

/** The ns-us PoE2 trial-coin section: one base, ItemLevel bands, hidden low tiers. */
const TRIAL_COINS = [
  'Show # %HS4 $type->miscmapitemsextra $tier->trialkeysanctumtop !fragments_c',
  '\tItemLevel >= 80',
  '\tBaseType == "Djinn Barya"',
  '\tSetFontSize 42',
  '',
  'Hide # %H4 $type->miscmapitemsextra $tier->trialkeysanctum3 !fragments_c',
  '\tItemLevel >= 60',
  '\tItemLevel <= 79',
  '\tBaseType == "Djinn Barya"',
  '\tSetFontSize 42',
  '',
  'Show # $type->miscmapitemsextra $tier->relickeyssafe !apex_stier',
  '\tClass == "Vault Keys"',
  '\tSetFontSize 45',
  '',
].join('\n')

function item(over: Partial<PoeItem> = {}): PoeItem {
  return {
    itemClass: 'Trial Coins',
    rarity: 'Currency',
    name: '',
    baseType: 'Djinn Barya',
    mapTier: 0,
    itemLevel: 83,
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
  } as PoeItem
}

function groupFor(content: string, it: PoeItem): ReturnType<typeof buildTierGroup> {
  const filter: FilterFile = parseFilterFile('t.filter', content)
  const active = findMatchingBlocks(filter, it).find((m) => m.isFirstMatch)
  if (!active) throw new Error('item matched no block')
  return buildTierGroup(filter, active, it)
}

describe('buildTierGroup destination gating', () => {
  it('leaves out a level band the item falls outside of', () => {
    // The whole complaint: an ilvl 83 Djinn Barya belongs to the 80+ band by
    // definition. The 60-79 band is not somewhere it can be "moved" to, so it is
    // not a choice -- offering it only invites a click that changes nothing.
    const group = groupFor(TRIAL_COINS, item())
    expect(group?.siblings.map((s) => s.tier)).toEqual(['trialkeysanctumtop'])
  })

  it('leaves out a class-rules tier that lists no bases', () => {
    // relickeyssafe catches by Class. Writing a BaseType line onto it would
    // narrow it to this one base, so it is never a destination.
    const group = groupFor(TRIAL_COINS, item())
    expect(group?.siblings.some((s) => s.tier === 'relickeyssafe')).toBe(false)
  })

  it('still gives the item its own tier, so Hide stays reachable', () => {
    // A one-entry list is not an empty one: the dropdown's Hide row is a choice
    // even when there is nowhere to switch to.
    const group = groupFor(TRIAL_COINS, item())
    expect(group?.currentTier).toBe('trialkeysanctumtop')
    expect(group?.siblings).toHaveLength(1)
  })

  it('keeps a sibling the item can actually reach', () => {
    const content = [
      'Show # $type->currency $tier->t1',
      '\tBaseType == "Divine Orb" "Chaos Orb"',
      '\tSetFontSize 45',
      '',
      'Show # $type->currency $tier->t2',
      '\tBaseType == "Orb of Alchemy"',
      '\tSetFontSize 40',
      '',
    ].join('\n')
    const group = groupFor(content, item({ itemClass: 'Stackable Currency', baseType: 'Chaos Orb' }))
    expect(group?.siblings.map((s) => s.tier)).toEqual(['t1', 't2'])
  })

  it('leaves out a later sibling when the current tier cannot give the base up', () => {
    // The source keeps matching (its last base cannot be stripped without widening
    // it), so anything after it never wins the first-match race.
    const content = [
      'Show # $type->currency $tier->t1',
      '\tBaseType == "Chaos Orb"',
      '\tSetFontSize 45',
      '',
      'Hide # $type->currency $tier->t2',
      '\tBaseType == "Orb of Alchemy"',
      '\tSetFontSize 40',
      '',
    ].join('\n')
    const group = groupFor(content, item({ itemClass: 'Stackable Currency', baseType: 'Chaos Orb' }))
    expect(group?.siblings.map((s) => s.tier)).toEqual(['t1'])
  })

  it('keeps an earlier sibling even when the current tier cannot give the base up', () => {
    // An earlier tier wins the race on its own -- the source never has to be
    // touched, so the lock does not rule it out.
    const content = [
      'Hide # $type->currency $tier->early',
      '\tBaseType == "Orb of Alchemy"',
      '\tSetFontSize 40',
      '',
      'Show # $type->currency $tier->late',
      '\tBaseType == "Chaos Orb"',
      '\tSetFontSize 45',
      '',
    ].join('\n')
    const group = groupFor(content, item({ itemClass: 'Stackable Currency', baseType: 'Chaos Orb' }))
    expect(group?.siblings.map((s) => s.tier)).toEqual(['early', 'late'])
  })
})
