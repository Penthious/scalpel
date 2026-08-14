import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FilterFile, PoeItem } from '@shared/types'
import { checkRemovable } from '@shared/filter-removal'
import { findMatchingBlocks, findNextMatchAfter } from './matcher'
import { replayIntents } from './intent-replay'
import type { IntentLog } from './intents'
import { parseFilterFile } from './parser'
import { validateBlock } from './validate'
import { removeBaseTypeFromTier } from './writer'

const FIXTURE = join(__dirname, '__fixtures__', 'test-filter.filter')
let raw: string

beforeAll(() => {
  raw = readFileSync(FIXTURE, 'utf-8')
})

/** Parse a throwaway copy of the real filter, backed by a temp path so writes land safely. */
function freshFilter(): FilterFile {
  const path = join(mkdtempSync(join(tmpdir(), 'journey-')), 'f.filter')
  writeFileSync(path, raw, 'utf-8')
  return parseFilterFile(path, raw)
}

function item(over: Partial<PoeItem>): PoeItem {
  return {
    itemClass: 'Rings',
    rarity: 'Rare',
    name: 'Test Item',
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
    // The matcher dereferences these unguarded (influence/explicits/implicits).
    influence: [],
    explicits: [],
    implicits: [],
    enchants: [],
    ...over,
  } as unknown as PoeItem
}

/**
 * The UI promises "Falls through to: X" before the user commits. This is the test
 * that the promise is true: predict, actually remove, re-evaluate, compare.
 *
 * This is the check that would otherwise have to happen in-game, one item at a time.
 */
describe('fall-through prediction is what actually happens', () => {
  // Cases chosen because the active block actually NAMES the base, so the button
  // is enabled and there is a prediction to check. A plain rare ring is not such
  // a case -- it lands on a class-rules hide layer where removal is disabled.
  const CASES: { label: string; item: PoeItem }[] = [
    { label: 'Chaos Orb', item: item({ baseType: 'Chaos Orb', itemClass: 'Stackable Currency', rarity: 'Normal' }) },
    {
      label: 'Chaos Orb at low ilvl',
      item: item({ baseType: 'Chaos Orb', itemClass: 'Stackable Currency', rarity: 'Normal', itemLevel: 1 }),
    },
  ]

  for (const { label, item: subject } of CASES) {
    it(`predicts the next matching block for ${label}`, () => {
      const filter = freshFilter()
      const matches = findMatchingBlocks(filter, subject)
      const active = matches.find((m) => m.isFirstMatch)
      // Fail loudly rather than passing vacuously if the fixture ever changes.
      expect(active, `${label} should be caught by some block`).toBeDefined()
      if (!active) return

      const check = checkRemovable(active.block, subject.baseType)
      expect(check.removable, `${label} should be removable from ${JSON.stringify(active.block.tierTag)}`).toBe(true)

      const predicted = findNextMatchAfter(filter, subject, active.blockIndex)

      // Actually perform the removal, then re-evaluate from a clean parse.
      removeBaseTypeFromTier(filter, subject.baseType, active.blockIndex)
      const after = parseFilterFile(filter.path, readFileSync(filter.path, 'utf-8'))
      const newActive = findMatchingBlocks(after, subject).find((m) => m.isFirstMatch)

      if (predicted === null) {
        expect(newActive).toBeUndefined()
      } else {
        expect(newActive).toBeDefined()
        // Compare by tier tag: the prediction is only useful if it names the tier
        // the user will actually land on.
        expect(newActive?.block.tierTag).toEqual(predicted.block.tierTag)
        expect(newActive?.blockIndex).toBe(predicted.blockIndex)
      }
    })
  }
})

/**
 * Sweep the real filter: no legal removal may ever produce an unparseable file,
 * an invalid block, or a block that lost its last named base (which would widen
 * the tier to its whole item class).
 */
describe('removal never invalidates or widens a block', () => {
  it('holds across a spread of real blocks', () => {
    const probe = freshFilter()
    const candidates: { index: number; value: string }[] = []

    for (let i = 0; i < probe.blocks.length; i++) {
      const b = probe.blocks[i]
      const baseTypes = b.conditions.filter((c) => c.type === 'BaseType')
      const first = baseTypes[0]?.values[0]
      if (!first) continue
      if (!checkRemovable(b, first).removable) continue
      candidates.push({ index: i, value: first })
    }

    expect(candidates.length).toBeGreaterThan(20)

    // Evenly spaced sample so we cover the whole file without reparsing 800 times.
    const step = Math.max(1, Math.floor(candidates.length / 40))
    const sample = candidates.filter((_, n) => n % step === 0)

    for (const { index, value } of sample) {
      const filter = freshFilter()
      const before = filter.blocks[index].conditions
        .filter((c) => c.type === 'BaseType')
        .reduce((n, c) => n + c.values.length, 0)

      removeBaseTypeFromTier(filter, value, index)

      const out = readFileSync(filter.path, 'utf-8')
      const reparsed = parseFilterFile(filter.path, out)

      // Same number of blocks -- a removal must never delete or merge blocks.
      expect(reparsed.blocks.length).toBe(filter.blocks.length)

      const target = reparsed.blocks[index]
      const after = target.conditions.filter((c) => c.type === 'BaseType').reduce((n, c) => n + c.values.length, 0)

      expect(after).toBe(before - 1)
      // The block still names at least one base: it was not widened to its class.
      expect(after).toBeGreaterThan(0)
      expect(validateBlock(target)).toEqual([])
    }
  })
})

/**
 * The whole point of the intent: a removal has to survive upstream rewriting the
 * file, and must not clobber what upstream added in the meantime.
 */
describe('removal survives a restructured upstream', () => {
  const localTier = [
    'Show # $type->rings $tier->t1',
    '\tBaseType == "Sapphire Ring" "Ruby Ring"',
    '\tSetFontSize 40',
    '',
  ].join('\n')

  const log: IntentLog = {
    filterName: 'f',
    intents: [
      {
        type: 'remove-basetype',
        target: { typePath: 'rings', tier: 't1' },
        payload: { value: 'Sapphire Ring' },
        timestamp: 1,
      },
    ],
  }

  it('keeps the base removed after upstream renames the tier and adds new bases', () => {
    // Upstream: renamed the tier AND added two bases to it.
    const upstream = localTier
      .replace('$tier->t1', '$tier->t1a')
      .replace('"Sapphire Ring" "Ruby Ring"', '"Sapphire Ring" "Ruby Ring" "Topaz Ring" "Opal Ring"')

    const res = replayIntents(upstream, 'f.filter', log, { forceApply: true })
    const values = res.filter.blocks[0].conditions.find((c) => c.type === 'BaseType')!.values

    expect(values).not.toContain('Sapphire Ring')
    // Upstream's additions survive -- this is why the intent is a delta, not a
    // stored snapshot of the desired list.
    expect(values).toEqual(['Ruby Ring', 'Topaz Ring', 'Opal Ring'])
    expect(res.stats.conflicts).toBe(0)
  })

  it('is idempotent across repeated syncs', () => {
    const once = replayIntents(localTier, 'f.filter', log, { forceApply: true })
    const onceValues = once.filter.blocks[0].conditions.find((c) => c.type === 'BaseType')!.values

    // Second sync against upstream that still lists the base: same outcome.
    const twice = replayIntents(localTier, 'f.filter', log, { forceApply: true })
    const twiceValues = twice.filter.blocks[0].conditions.find((c) => c.type === 'BaseType')!.values

    expect(onceValues).toEqual(twiceValues)
    expect(twiceValues).toEqual(['Ruby Ring'])
  })

  it('reports rather than silently dropping when the tier is gone entirely', () => {
    const gone = localTier.replace('$type->rings $tier->t1', '$type->amulets $tier->a9')
    const res = replayIntents(gone, 'f.filter', log, { forceApply: true })

    expect(res.stats.conflicts).toBe(1)
    expect(res.conflicts[0].description).toContain('Sapphire Ring')
  })
})
