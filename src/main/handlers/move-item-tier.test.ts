import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MOCK_USER_DATA = vi.hoisted(() =>
  require('node:path').join(require('node:os').tmpdir(), `scalpel-move-${Date.now()}`),
)

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => MOCK_USER_DATA) },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}))
vi.mock('../evaluation', () => ({ evaluateAndSend: vi.fn() }))
vi.mock('../overlay', () => ({ reloadFilterInGame: vi.fn() }))

import { ipcMain } from 'electron'
import { getIntents, loadIntents } from '../filter/intent-recorder'
import { loadFilter } from '../filter-state'
import { register } from './editing'

type Handler = (
  event: unknown,
  ...args: unknown[]
) => { ok: boolean; error?: string; moved?: number; stranded?: string[] }

function handlerFor(channel: string, filterPath: string): Handler {
  const store = {
    get: (key: string) => (key === 'filterPath' ? filterPath : key === 'reloadOnSave' ? false : undefined),
  } as unknown as Parameters<typeof register>[0]
  register(store)
  const call = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`handler ${channel} not registered`)
  return call[1] as Handler
}

/** The Trial Coin from the report: PoE2 tiers these by ItemLevel band. */
function itemJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    itemClass: 'Trial Coins',
    rarity: 'Currency',
    name: '',
    baseType: 'Djinn Barya',
    mapTier: 0,
    itemLevel: 83,
    areaLevel: 80,
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
  })
}

function writeFilter(lines: string[]): string {
  const path = join(mkdtempSync(join(tmpdir(), 'scalpel-move-')), 'test.filter')
  writeFileSync(path, lines.join('\n'), 'utf-8')
  return path
}

/** The real ns-us layout: one base, four ItemLevel bands, hidden lower tiers. */
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
]

beforeEach(() => (ipcMain.handle as ReturnType<typeof vi.fn>).mockClear())

describe('move-item-tier', () => {
  it('refuses a destination whose other conditions rule the item out', () => {
    // The reported bug: an ilvl 83 Djinn Barya cannot be caught by the 60-79
    // tier however it is named there, so the move wrote a change that did
    // nothing and the panel snapped back to trialkeysanctumtop.
    const path = writeFilter(TRIAL_COINS)
    loadFilter(path)
    loadIntents(path, 'test')
    const before = readFileSync(path, 'utf-8')

    const result = handlerFor('move-item-tier', path)(null, 'Djinn Barya', 0, 1, itemJson())

    expect(result.ok).toBe(false)
    expect(result.error).toContain('trialkeysanctum3')
    expect(readFileSync(path, 'utf-8')).toBe(before)
    expect(getIntents().intents).toHaveLength(0)
  })

  it('never strips the source down to a bare condition list', () => {
    // Even when the guard above is bypassed, the write itself must not delete the
    // BaseType line: `ItemLevel >= 80` alone shows every high-level drop in the
    // game with the trial-coin styling.
    const path = writeFilter(TRIAL_COINS)
    loadFilter(path)
    loadIntents(path, 'test')

    // Destination that the item *can* reach, so only the source guard is in play.
    handlerFor('move-item-tier', path)(null, 'Djinn Barya', 0, 1, '')

    const out = readFileSync(path, 'utf-8')
    const top = out.slice(0, out.indexOf('Hide #'))
    expect(top).toContain('BaseType == "Djinn Barya"')
  })

  it('refuses a class-rules destination that lists no bases', () => {
    const path = writeFilter(TRIAL_COINS)
    loadFilter(path)
    loadIntents(path, 'test')
    const before = readFileSync(path, 'utf-8')

    const result = handlerFor('move-item-tier', path)(null, 'Djinn Barya', 0, 2, itemJson())

    expect(result.ok).toBe(false)
    expect(result.error).toContain('no base types')
    expect(readFileSync(path, 'utf-8')).toBe(before)
  })

  it('still moves a base its tier can spare', () => {
    const path = writeFilter([
      'Show # $type->currency $tier->t1',
      '\tBaseType == "Divine Orb" "Chaos Orb"',
      '\tSetFontSize 45',
      '',
      'Show # $type->currency $tier->t2',
      '\tBaseType == "Orb of Alchemy"',
      '\tSetFontSize 40',
      '',
    ])
    loadFilter(path)
    loadIntents(path, 'test')

    const result = handlerFor('move-item-tier', path)(
      null,
      'Chaos Orb',
      0,
      1,
      itemJson({ itemClass: 'Stackable Currency', baseType: 'Chaos Orb' }),
    )

    expect(result.ok).toBe(true)
    const out = readFileSync(path, 'utf-8')
    expect(out).toContain('BaseType == "Divine Orb"')
    expect(out).toContain('BaseType == "Orb of Alchemy" "Chaos Orb"')
    expect(getIntents().intents.map((i) => i.type)).toEqual(['move-basetype'])
  })
})

describe('batch-move-item-tier', () => {
  it('leaves behind the base its source tier cannot give up, and says so', () => {
    const path = writeFilter([
      'Show # $type->currency $tier->t1',
      '\tBaseType == "Divine Orb" "Chaos Orb"',
      '\tSetFontSize 45',
      '',
      'Show # $type->currency $tier->t2',
      '\tBaseType == "Orb of Alchemy"',
      '\tSetFontSize 40',
      '',
    ])
    loadFilter(path)
    loadIntents(path, 'test')

    const result = handlerFor('batch-move-item-tier', path)(
      null,
      ['Divine Orb', 'Chaos Orb'],
      0,
      1,
      itemJson({ itemClass: 'Stackable Currency', baseType: 'Divine Orb' }),
    )

    expect(result.ok).toBe(true)
    expect(result.moved).toBe(1)
    expect(result.stranded).toEqual(['Chaos Orb'])
    // The source keeps a name, so it never widens to "every stackable currency".
    expect(readFileSync(path, 'utf-8')).toContain('BaseType == "Chaos Orb"')
  })
})
