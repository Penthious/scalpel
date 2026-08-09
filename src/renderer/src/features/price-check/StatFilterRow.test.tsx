// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { getSearchTint, StatFilterRow } from './StatFilterRow'
import type { StatFilter } from './types'

const ORANGE = '#ff9800'
const RED = '#ef5350'

describe('getSearchTint', () => {
  it('returns null (white) for a search value inside the base roll range', () => {
    expect(getSearchTint(50, null, { min: 40, max: 60 }, 'Unique', 'explicit')).toBeNull()
    expect(getSearchTint(null, 60, { min: 40, max: 60 }, 'Unique', 'explicit')).toBeNull()
  })

  it('oranges a positive over-roll within ~22% of the max', () => {
    // 60 max -> vaal max round(60*1.22)=73. 70 is outside [40,60] but within the vaal band.
    expect(getSearchTint(null, 70, { min: 40, max: 60 }, 'Unique', 'explicit')).toBe(ORANGE)
  })

  it('reds a positive value beyond the vaal band', () => {
    expect(getSearchTint(null, 100, { min: 40, max: 60 }, 'Unique', 'explicit')).toBe(RED)
  })

  // ─── Negative (inverted) ranges: "fewer enemies to be Surrounded" -4..-2 ────
  // PoE2 (like PoE1) can over-roll a unique affix ~22% past its base range, so a
  // -4 base perfect roll over-rolls to -5. The band must widen outward, not shrink.

  it('returns null (white) for the negative base perfect roll -4 in range -4..-2', () => {
    expect(getSearchTint(null, -4, { min: -4, max: -2 }, 'Unique', 'explicit')).toBeNull()
  })

  it('oranges a -5 over-roll of a -4..-2 range (vaal-reachable, not impossible)', () => {
    // -4 min -> vaal min round(-4 - 0.22*4) = round(-4.88) = -5, so -5 is the edge of the band.
    expect(getSearchTint(null, -5, { min: -4, max: -2 }, 'Unique', 'explicit')).toBe(ORANGE)
  })

  it('reds a -6 search on a -4..-2 range (beyond what corruption can reach)', () => {
    expect(getSearchTint(null, -6, { min: -4, max: -2 }, 'Unique', 'explicit')).toBe(RED)
  })

  it('does not tint non-unique items or non-affix rows', () => {
    expect(getSearchTint(null, -6, { min: -4, max: -2 }, 'Rare', 'explicit')).toBeNull()
    expect(getSearchTint(null, -6, { min: -4, max: -2 }, 'Unique', 'pseudo')).toBeNull()
    expect(getSearchTint(null, -6, undefined, 'Unique', 'explicit')).toBeNull()
  })
})

describe('mod source badge (#565)', () => {
  const baseFilter: StatFilter = {
    id: 'explicit.stat_crit_multi',
    text: '+38% to Global Critical Strike Multiplier',
    value: 38,
    min: 35,
    max: null,
    enabled: true,
    type: 'explicit',
  }

  function renderRow(overrides: Partial<StatFilter> = {}) {
    return render(
      <StatFilterRow
        f={{ ...baseFilter, ...overrides }}
        i={0}
        rowIdx={0}
        toggleFilter={() => {}}
        updateFilterMin={() => {}}
        updateFilterMax={() => {}}
        itemRarity="Rare"
        onRowContextMenu={() => {}}
      />,
    )
  }

  it('shows the symbol without hovering the row', () => {
    // The tier chip is hover-gated; the source badge must not be.
    const { container } = renderRow({ modSource: 'shaper' })
    expect(container.querySelector('img[title="Shaper mod"]')).not.toBeNull()
  })

  it('labels delve and temple with their own source', () => {
    expect(renderRow({ modSource: 'delve' }).container.querySelector('img[title="Delve-only mod"]')).not.toBeNull()
    expect(renderRow({ modSource: 'temple' }).container.querySelector('img[title="Temple mod"]')).not.toBeNull()
  })

  it('renders no symbol for an ordinary affix', () => {
    expect(renderRow().container.querySelector('img')).toBeNull()
  })
})
