import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MOCK_USER_DATA = vi.hoisted(() =>
  require('node:path').join(require('node:os').tmpdir(), `scalpel-remove-${Date.now()}`),
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

type Handler = (event: unknown, ...args: unknown[]) => { ok: boolean; error?: string }

/**
 * Register the editing handlers and pull one back out of the ipcMain mock.
 *
 * Note: `getProfileBackedSetting(store, 'filterPath')` resolves through the active
 * profile, not `store.get`, and returns '' when no profile exists -- so the handler's
 * post-write `loadFilter` is skipped under test. That is fine: these tests assert on
 * the file the writer produced and on the recorded intent, not on reloaded state.
 * Only `store.get('reloadOnSave')` is read directly.
 */
function handlerFor(channel: string, filterPath: string): Handler {
  const store = {
    get: (key: string) => (key === 'filterPath' ? filterPath : key === 'reloadOnSave' ? false : undefined),
  } as unknown as Parameters<typeof register>[0]
  register(store)
  const call = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`handler ${channel} not registered`)
  return call[1] as Handler
}

/** Removal now plans against the item, so the handler needs a real one. */
function itemJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    itemClass: 'Rings',
    rarity: 'Rare',
    name: '',
    baseType: 'Sapphire Ring',
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
  })
}

function writeFilter(lines: string[]): string {
  const path = join(mkdtempSync(join(tmpdir(), 'scalpel-remove-')), 'test.filter')
  writeFileSync(path, lines.join('\n'), 'utf-8')
  return path
}

beforeEach(() => (ipcMain.handle as ReturnType<typeof vi.fn>).mockClear())

describe('remove-item-from-tier', () => {
  it('strips the base, writes the file and records the intent', () => {
    const path = writeFilter([
      'Show # $type->rings $tier->t1',
      '\tBaseType == "Sapphire Ring" "Ruby Ring"',
      '\tSetFontSize 40',
      '',
    ])
    loadFilter(path)
    loadIntents(path, 'test')

    const result = handlerFor('remove-item-from-tier', path)(null, 'Sapphire Ring', 0, itemJson())

    expect(result.ok).toBe(true)
    expect(readFileSync(path, 'utf-8')).toContain('BaseType == "Ruby Ring"')
    const intents = getIntents().intents
    expect(intents).toHaveLength(1)
    expect(intents[0].type).toBe('remove-basetype')
    expect(intents[0].target).toEqual({ typePath: 'rings', tier: 't1' })
  })

  it('strips every tier that catches the item, not just the active one', () => {
    // Stacked currency is tiered by StackSize, so several tiers name the same base
    // and all match one stack. Removing only the active tier demoted the item by
    // one tier instead of removing it.
    const path = writeFilter([
      'Show # $type->currency $tier->t1',
      '\tBaseType == "Chaos Orb" "Divine Orb"',
      '\tStackSize >= 6',
      '',
      'Show # $type->currency $tier->t2',
      '\tBaseType == "Chaos Orb" "Orb of Alchemy"',
      '\tStackSize >= 3',
      '',
      'Show # $type->currency $tier->rest',
      '\tClass "Stackable Currency"',
      '',
    ])
    loadFilter(path)
    loadIntents(path, 'test')

    const chaos = itemJson({ baseType: 'Chaos Orb', itemClass: 'Stackable Currency', rarity: 'Normal', stackSize: 20 })
    const result = handlerFor('remove-item-from-tier', path)(null, 'Chaos Orb', 0, chaos)

    expect(result.ok).toBe(true)
    const out = readFileSync(path, 'utf-8')
    expect(out).not.toContain('Chaos Orb')
    // Every other base in those tiers survives.
    expect(out).toContain('"Divine Orb"')
    expect(out).toContain('"Orb of Alchemy"')
    // One intent per tier, so each replays independently on the next sync.
    const intents = getIntents().intents
    expect(intents).toHaveLength(2)
    expect(intents.map((i) => i.target.tier).sort()).toEqual(['t1', 't2'])
  })

  it('hides an item by stripping every naming tier and adding it to a Hide tier', () => {
    const path = writeFilter([
      'Show # $type->currency->stackedsix $tier->t2',
      '\tBaseType == "Chaos Orb" "Divine Orb"',
      '\tStackSize >= 6',
      '',
      'Show # $type->currency $tier->t4chaos',
      '\tBaseType == "Chaos Orb" "Orb of Alchemy"',
      '',
      'Hide # $type->currency $tier->twisdom',
      '\tBaseType == "Scroll of Wisdom"',
      '',
      'Show # $type->currency $tier->restex',
      '\tClass "Stackable Currency"',
      '',
    ])
    loadFilter(path)
    loadIntents(path, 'test')

    const chaos = itemJson({ baseType: 'Chaos Orb', itemClass: 'Stackable Currency', rarity: 'Normal', stackSize: 20 })
    const result = handlerFor('hide-item', path)(null, 'Chaos Orb', chaos) as {
      ok: boolean
      hiddenIn?: string
      error?: string
    }

    expect(result.ok).toBe(true)
    expect(result.hiddenIn).toBe('twisdom')

    const out = readFileSync(path, 'utf-8')
    // Gone from both Show tiers that named it...
    expect(out).toContain('BaseType == "Divine Orb"')
    expect(out).toContain('BaseType == "Orb of Alchemy"')
    // ...and present in the Hide tier, which is what actually stops it drawing.
    expect(out).toContain('BaseType == "Scroll of Wisdom" "Chaos Orb"')

    // Two removals plus one add, so the whole thing replays on the next sync.
    const intents = getIntents().intents
    expect(intents.filter((i) => i.type === 'remove-basetype')).toHaveLength(2)
    const add = intents.find((i) => i.type === 'add-basetype')
    expect(add?.target).toEqual({ typePath: 'currency', tier: 'twisdom' })
  })

  it('refuses to hide when no Hide tier can take the base', () => {
    const path = writeFilter([
      'Show # $type->currency $tier->t1',
      '\tBaseType == "Chaos Orb" "Divine Orb"',
      '',
      'Show # $type->currency $tier->restex',
      '\tClass "Stackable Currency"',
      '',
    ])
    loadFilter(path)
    loadIntents(path, 'test')

    const before = readFileSync(path, 'utf-8')
    const chaos = itemJson({ baseType: 'Chaos Orb', itemClass: 'Stackable Currency', rarity: 'Normal', stackSize: 1 })
    const result = handlerFor('hide-item', path)(null, 'Chaos Orb', chaos)

    expect(result.ok).toBe(false)
    expect(readFileSync(path, 'utf-8')).toBe(before)
    expect(getIntents().intents).toHaveLength(0)
  })

  it('refuses when the base is the last one named, leaving the file untouched', () => {
    const before = ['Show # $type->rings $tier->t1', '\tClass "Rings"', '\tBaseType == "Sapphire Ring"', '']
    const path = writeFilter(before)
    loadFilter(path)
    loadIntents(path, 'test')

    const result = handlerFor('remove-item-from-tier', path)(null, 'Sapphire Ring', 0, itemJson())

    expect(result.ok).toBe(false)
    expect(result.error).toContain('last-base')
    expect(readFileSync(path, 'utf-8')).toBe(before.join('\n'))
    expect(getIntents().intents).toHaveLength(0)
  })

  it('refuses when the tier catches the item by a substring token', () => {
    const path = writeFilter(['Show # $type->rings $tier->t1', '\tBaseType "Ring"', ''])
    loadFilter(path)
    loadIntents(path, 'test')

    const result = handlerFor('remove-item-from-tier', path)(null, 'Sapphire Ring', 0, itemJson())

    expect(result.ok).toBe(false)
    expect(getIntents().intents).toHaveLength(0)
  })
})
