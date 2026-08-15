import { describe, expect, it } from 'vitest'
import { replayIntents } from './intent-replay'
import type { IntentLog } from './intents'
import { validateBlock } from './validate'
import { writeFilterSelective } from './writer'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFilterFile } from './parser'

function moveLog(value: string, fromTier: string, toTier: string): IntentLog {
  return {
    filterName: 't',
    intents: [
      {
        type: 'move-basetype',
        target: { typePath: 'currency', tier: toTier },
        payload: { value, fromTier },
        timestamp: 0,
      },
    ],
  }
}

describe('replayIntents move-basetype', () => {
  it('removes the whole block when the move empties its only condition', () => {
    const upstream = [
      'Show # $type->currency $tier->src',
      '\tBaseType == "Chaos Orb"',
      '\tSetFontSize 40',
      '',
      'Show # $type->currency $tier->dst',
      '\tBaseType == "Divine Orb"',
      '\tSetFontSize 45',
      '',
    ].join('\n')

    const res = replayIntents(upstream, 't.filter', moveLog('Chaos Orb', 'src', 'dst'), { forceApply: true })
    const srcIndex = res.filter.blocks.findIndex((b) => b.tierTag?.tier === 'src')
    // The emptied source block is marked for removal, not left as a catch-all.
    expect(res.removedBlocks.has(srcIndex)).toBe(true)
    expect(res.modifiedBlocks.has(srcIndex)).toBe(false)
    const dst = res.filter.blocks.find((b) => b.tierTag?.tier === 'dst')!
    expect(dst.conditions.find((c) => c.type === 'BaseType')!.values).toContain('Chaos Orb')

    // End-to-end: the src block (and its bare catch-all) is gone from the output.
    const dir = mkdtempSync(join(tmpdir(), 'replay-'))
    const p = join(dir, 'out.filter')
    writeFilterSelective({ ...res.filter, path: p }, res.modifiedBlocks, res.removedBlocks)
    const out = readFileSync(p, 'utf-8')
    expect(out).not.toContain('$tier->src')
    const reparsed = parseFilterFile(p, out)
    expect(reparsed.blocks).toHaveLength(1) // only dst remains
    for (const b of reparsed.blocks) expect(validateBlock(b)).toEqual([])
  })

  it('refuses the move when stripping the last base would widen the source tier', () => {
    // Dropping the emptied BaseType line here leaves `Rarity Normal` alone, and
    // that block then catches every normal-rarity item in the game. This is the
    // PoE2 trial-coin damage (`ItemLevel >= 80` with its only base stripped)
    // arriving through the replay path, which re-inflicts it on every sync --
    // even after the user repairs the file by hand.
    const upstream = [
      'Show # $type->currency $tier->src',
      '\tRarity Normal',
      '\tBaseType == "Chaos Orb"',
      '\tSetFontSize 40',
      '',
      'Show # $type->currency $tier->dst',
      '\tBaseType == "Divine Orb"',
      '\tSetFontSize 45',
      '',
    ].join('\n')

    const res = replayIntents(upstream, 't.filter', moveLog('Chaos Orb', 'src', 'dst'), { forceApply: true })

    const srcIndex = res.filter.blocks.findIndex((b) => b.tierTag?.tier === 'src')
    const src = res.filter.blocks[srcIndex]
    expect(src.conditions.find((c) => c.type === 'BaseType')?.values).toEqual(['Chaos Orb'])
    expect(res.removedBlocks.has(srcIndex)).toBe(false)
    expect(res.modifiedBlocks.has(srcIndex)).toBe(false)
    // Nothing lands on the destination either -- a half-applied move would leave
    // the base named in both tiers.
    const dst = res.filter.blocks.find((b) => b.tierTag?.tier === 'dst')!
    expect(dst.conditions.find((c) => c.type === 'BaseType')!.values).toEqual(['Divine Orb'])
    // Reported rather than swallowed, so the merge UI can surface it.
    expect(res.stats.conflicts).toBe(1)
    expect(res.conflicts[0].description).toContain('only base')
    expect(validateBlock(src)).toEqual([])
  })

  it('refuses to move into a tier that no longer lists bases by name', () => {
    // Creating a BaseType line on a class-rules tier narrows it from "everything
    // of this class" to this one base -- the same damage inverted.
    const upstream = [
      'Show # $type->currency $tier->src',
      '\tBaseType == "Chaos Orb" "Divine Orb"',
      '',
      'Show # $type->currency $tier->dst',
      '\tClass "Stackable Currency"',
      '',
    ].join('\n')

    const res = replayIntents(upstream, 't.filter', moveLog('Chaos Orb', 'src', 'dst'), { forceApply: true })

    const dst = res.filter.blocks.find((b) => b.tierTag?.tier === 'dst')!
    expect(dst.conditions.some((c) => c.type === 'BaseType')).toBe(false)
    const src = res.filter.blocks.find((b) => b.tierTag?.tier === 'src')!
    expect(src.conditions.find((c) => c.type === 'BaseType')!.values).toContain('Chaos Orb')
    expect(res.stats.conflicts).toBe(1)
  })
})

function removeLog(value: string, typePath: string, tier: string): IntentLog {
  return {
    filterName: 't',
    intents: [{ type: 'remove-basetype', target: { typePath, tier }, payload: { value }, timestamp: 0 }],
  }
}

describe('replayIntents remove-basetype', () => {
  const upstream = [
    'Show # $type->rings $tier->t1',
    '\tBaseType == "Sapphire Ring" "Ruby Ring"',
    '\tSetFontSize 40',
    '',
  ].join('\n')

  it('strips the value from the tagged block', () => {
    const res = replayIntents(upstream, 't.filter', removeLog('Sapphire Ring', 'rings', 't1'), { forceApply: true })
    const block = res.filter.blocks[0]
    expect(block.conditions.find((c) => c.type === 'BaseType')!.values).toEqual(['Ruby Ring'])
    expect(res.modifiedBlocks.has(0)).toBe(true)
    expect(res.stats.conflicts).toBe(0)
  })

  it('falls back to the same typePath when the tier tag is gone', () => {
    const renamed = upstream.replace('$tier->t1', '$tier->t1b')
    const res = replayIntents(renamed, 't.filter', removeLog('Sapphire Ring', 'rings', 't1'), { forceApply: true })
    expect(res.filter.blocks[0].conditions.find((c) => c.type === 'BaseType')!.values).toEqual(['Ruby Ring'])
    expect(res.stats.conflicts).toBe(0)
  })

  it('reports a conflict when neither the tag nor the typePath resolves', () => {
    const moved = upstream.replace('$type->rings $tier->t1', '$type->amulets $tier->a1')
    const res = replayIntents(moved, 't.filter', removeLog('Sapphire Ring', 'rings', 't1'), { forceApply: true })
    expect(res.stats.conflicts).toBe(1)
    expect(res.conflicts[0].description).toContain('Sapphire Ring')
    expect(res.conflicts[0].options).toEqual([])
  })

  it('counts an already-absent value as applied, not a conflict', () => {
    const without = upstream.replace(' "Sapphire Ring"', '')
    const res = replayIntents(without, 't.filter', removeLog('Sapphire Ring', 'rings', 't1'), { forceApply: true })
    expect(res.stats.conflicts).toBe(0)
    expect(res.stats.applied).toBe(1)
  })

  it('refuses and reports when removal would leave the tier with no named base', () => {
    const shrunk = upstream.replace('"Sapphire Ring" "Ruby Ring"', '"Sapphire Ring"')
    const res = replayIntents(shrunk, 't.filter', removeLog('Sapphire Ring', 'rings', 't1'), { forceApply: true })
    expect(res.stats.conflicts).toBe(1)
    expect(res.filter.blocks[0].conditions.find((c) => c.type === 'BaseType')!.values).toEqual(['Sapphire Ring'])
  })

  it('refuses when upstream now catches the item via a substring token', () => {
    const tokenised = upstream.replace('BaseType == "Sapphire Ring" "Ruby Ring"', 'BaseType "Ring"')
    const res = replayIntents(tokenised, 't.filter', removeLog('Sapphire Ring', 'rings', 't1'), { forceApply: true })
    expect(res.stats.conflicts).toBe(1)
  })
})

function addLog(value: string, typePath: string, tier: string): IntentLog {
  return {
    filterName: 't',
    intents: [{ type: 'add-basetype', target: { typePath, tier }, payload: { value }, timestamp: 0 }],
  }
}

describe('replayIntents add-basetype', () => {
  const upstream = [
    'Show # $type->currency $tier->t1',
    '\tBaseType == "Divine Orb"',
    '',
    'Hide # $type->currency $tier->twisdom',
    '\tBaseType == "Scroll of Wisdom"',
    '',
  ].join('\n')

  it('re-adds the base to the hidden tier so the item stays hidden', () => {
    const res = replayIntents(upstream, 't.filter', addLog('Chaos Orb', 'currency', 'twisdom'), { forceApply: true })
    const hidden = res.filter.blocks.find((b) => b.tierTag?.tier === 'twisdom')!
    expect(hidden.conditions.find((c) => c.type === 'BaseType')!.values).toEqual(['Scroll of Wisdom', 'Chaos Orb'])
    expect(res.stats.conflicts).toBe(0)
  })

  it('is idempotent when upstream already lists the base', () => {
    const already = upstream.replace('"Scroll of Wisdom"', '"Scroll of Wisdom" "Chaos Orb"')
    const res = replayIntents(already, 't.filter', addLog('Chaos Orb', 'currency', 'twisdom'), { forceApply: true })
    const hidden = res.filter.blocks.find((b) => b.tierTag?.tier === 'twisdom')!
    expect(hidden.conditions.find((c) => c.type === 'BaseType')!.values).toEqual(['Scroll of Wisdom', 'Chaos Orb'])
    expect(res.stats.conflicts).toBe(0)
  })

  it('refuses when the destination no longer lists bases by name', () => {
    // Creating a BaseType line on a class-rules block would narrow it from
    // "everything of this class" to "only this base".
    const classOnly = upstream.replace('\tBaseType == "Scroll of Wisdom"', '\tClass "Stackable Currency"')
    const res = replayIntents(classOnly, 't.filter', addLog('Chaos Orb', 'currency', 'twisdom'), { forceApply: true })
    expect(res.stats.conflicts).toBe(1)
    expect(res.conflicts[0].description).toContain('no longer lists bases by name')
    const hidden = res.filter.blocks.find((b) => b.tierTag?.tier === 'twisdom')!
    expect(hidden.conditions.some((c) => c.type === 'BaseType')).toBe(false)
  })

  it('reports a conflict when the destination tier is gone', () => {
    const gone = upstream.replace('$tier->twisdom', '$tier->somethingelse')
    const res = replayIntents(gone, 't.filter', addLog('Chaos Orb', 'currency', 'twisdom'), { forceApply: true })
    expect(res.stats.conflicts).toBe(1)
    expect(res.conflicts[0].description).toContain('Chaos Orb')
  })
})

describe('hiding survives a sync', () => {
  it('keeps the item hidden after upstream restructures the file', () => {
    // What the whole feature rests on: strip + add, replayed onto fresh upstream.
    const local = [
      'Show # $type->currency $tier->t1',
      '\tBaseType == "Chaos Orb" "Divine Orb"',
      '',
      'Hide # $type->currency $tier->twisdom',
      '\tBaseType == "Scroll of Wisdom"',
      '',
    ].join('\n')

    const log: IntentLog = {
      filterName: 'f',
      intents: [
        {
          type: 'remove-basetype',
          target: { typePath: 'currency', tier: 't1' },
          payload: { value: 'Chaos Orb' },
          timestamp: 1,
        },
        {
          type: 'add-basetype',
          target: { typePath: 'currency', tier: 'twisdom' },
          payload: { value: 'Chaos Orb' },
          timestamp: 2,
        },
      ],
    }

    // Upstream re-added Chaos Orb to t1 and added a base to the hidden tier.
    const upstream = local
      .replace('"Chaos Orb" "Divine Orb"', '"Chaos Orb" "Divine Orb" "Exalted Orb"')
      .replace('"Scroll of Wisdom"', '"Scroll of Wisdom" "Portal Scroll"')

    const res = replayIntents(upstream, 'f.filter', log, { forceApply: true })
    const t1 = res.filter.blocks.find((b) => b.tierTag?.tier === 't1')!
    const hidden = res.filter.blocks.find((b) => b.tierTag?.tier === 'twisdom')!

    // Stripped from the visible tier, still present in the hidden one.
    expect(t1.conditions.find((c) => c.type === 'BaseType')!.values).toEqual(['Divine Orb', 'Exalted Orb'])
    expect(hidden.conditions.find((c) => c.type === 'BaseType')!.values).toContain('Chaos Orb')
    // Upstream's own additions survive both operations.
    expect(hidden.conditions.find((c) => c.type === 'BaseType')!.values).toContain('Portal Scroll')
    expect(res.stats.conflicts).toBe(0)
  })
})
