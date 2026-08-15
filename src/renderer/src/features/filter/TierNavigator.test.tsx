// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FilterBlock, MatchResult, PoeItem, RemovalPreview, TierGroup } from '@shared/types'
import { checkRemovable } from '@shared/filter-removal'
import { TierNavigator, switchableSiblings } from './TierNavigator'

const item = { baseType: 'Chaos Orb', itemClass: 'Stackable Currency' } as PoeItem

function block(tier: string, values: string[], operator: '==' | '=' = '=='): FilterBlock {
  return {
    id: tier,
    visibility: 'Show',
    conditions: values.length ? [{ type: 'BaseType', operator, values, explicitOperator: operator === '==' }] : [],
    actions: [],
    continue: false,
    lineStart: 1,
    lineEnd: 2,
    tierTag: { typePath: 'currency', tier },
  }
}

function group(tiers: { tier: string; values: string[]; operator?: '==' | '=' }[], current: string): TierGroup {
  return {
    typePath: 'currency',
    currentTier: current,
    siblings: tiers.map((t, i) => {
      const b = block(t.tier, t.values, t.operator)
      return {
        tier: t.tier,
        visibility: b.visibility,
        blockIndex: i + 10,
        block: b,
        match: {
          block: b,
          blockIndex: i + 10,
          isFirstMatch: t.tier === current,
          evaluatedConditions: [],
          hasUnknowns: false,
        },
      }
    }),
  }
}

function landing(tier: string, visibility: 'Show' | 'Hide' = 'Show'): MatchResult {
  const b = { ...block(tier, []), visibility }
  return { block: b, blockIndex: 99, isFirstMatch: true, evaluatedConditions: [], hasUnknowns: false }
}

/** A resolved hide plan. Defaults to the ordinary case: tiers to strip, and a
 *  destination to add the base to. */
function mkPreview(over: Partial<RemovalPreview> = {}): RemovalPreview {
  return {
    landsOn: landing('restex'),
    tierCount: 1,
    skipped: [],
    hideDestination: 'twisdom',
    alreadyHidden: false,
    flipTier: null,
    ...over,
  }
}

const TIERS = [
  { tier: 't1', values: ['Divine Orb'] },
  { tier: 't4chaos', values: ['Chaos Orb', 'Orb of Annulment'] },
]

function open(props: Partial<Parameters<typeof TierNavigator>[0]> = {}): void {
  const g = props.group ?? group(TIERS, 't4chaos')
  const current = g.siblings.find((s) => s.tier === g.currentTier)!
  render(
    <TierNavigator
      group={g}
      baseType={item.baseType}
      item={item}
      onMoved={() => {}}
      removal={checkRemovable(current.block, item.baseType)}
      preview={mkPreview()}
      {...props}
    />,
  )
  fireEvent.click(screen.getByText('Switch Tier'))
}

/** Rows inside the portalled dropdown. The current tier label also renders on the
 *  toggle, so unscoped text queries would double-count it. */
function dropdownRows(): Element[] {
  const hide = screen.getByText('Hide')
  const dropdown = hide.parentElement?.parentElement
  return dropdown ? [...dropdown.children] : []
}

describe('switchableSiblings', () => {
  it('drops exception tiers', () => {
    expect(switchableSiblings(group([...TIERS, { tier: 'ex1', values: ['x'] }], 't4chaos')).map((s) => s.tier)).toEqual(
      ['t1', 't4chaos'],
    )
  })

  it('offers an escape from an exception tier rather than stranding the item', () => {
    // The lock is one-way: an exception tier is never a destination, but sitting
    // on one must not remove every option.
    const tiers = switchableSiblings(group([...TIERS, { tier: 'ex1', values: ['Chaos Orb'] }], 'ex1')).map(
      (s) => s.tier,
    )
    expect(tiers).toContain('t1')
    expect(tiers).toContain('t4chaos')
    expect(tiers).toContain('ex1')
  })

  it('never offers a different exception tier as a destination', () => {
    const tiers = switchableSiblings(
      group([...TIERS, { tier: 'ex1', values: ['x'] }, { tier: 'ex2', values: ['y'] }], 'ex1'),
    ).map((s) => s.tier)
    expect(tiers).not.toContain('ex2')
  })
})

describe('TierNavigator hide row', () => {
  it('names the destination tier it will hide the item in', () => {
    open()
    expect(screen.getByText('Hide')).toBeTruthy()
    expect(screen.getByText(/adding it to tier/i)).toBeTruthy()
  })

  it('calls hideItem and never moveItemTier', async () => {
    const hide = vi.fn(async () => ({ ok: true }))
    const move = vi.fn(async () => ({ ok: true }))
    ;(window as unknown as { api: Partial<typeof window.api> }).api = { hideItem: hide, moveItemTier: move }

    open()
    fireEvent.click(screen.getByText('Hide'))

    await waitFor(() => expect(hide).toHaveBeenCalledWith('Chaos Orb', JSON.stringify(item)))
    expect(move).not.toHaveBeenCalled()
  })

  it('stays inert and explains itself when no hidden tier exists', () => {
    const hide = vi.fn(async () => ({ ok: true }))
    ;(window as unknown as { api: Partial<typeof window.api> }).api = { hideItem: hide }

    open({ preview: mkPreview({ hideDestination: null }) })

    expect(screen.getByText(/no hidden tier is available/i)).toBeTruthy()
    fireEvent.click(screen.getByText('Hide'))
    expect(hide).not.toHaveBeenCalled()
  })

  it('needs no destination when stripping alone leaves the item on a Hide block', () => {
    open({
      preview: mkPreview({ landsOn: landing('raresendgame', 'Hide'), alreadyHidden: true, hideDestination: null }),
    })
    // Still actionable: the naming tiers are what make it visible today.
    expect(screen.getByText(/removing it from 1 tier/i)).toBeTruthy()
  })

  it('is inert when the item is already hidden and nothing names it', () => {
    const hide = vi.fn(async () => ({ ok: true }))
    ;(window as unknown as { api: Partial<typeof window.api> }).api = { hideItem: hide }

    open({
      preview: mkPreview({
        landsOn: landing('raresendgame', 'Hide'),
        alreadyHidden: true,
        tierCount: 0,
        hideDestination: null,
      }),
    })

    expect(screen.getByText(/already hidden/i)).toBeTruthy()
    fireEvent.click(screen.getByText('Hide'))
    expect(hide).not.toHaveBeenCalled()
  })

  it('offers the flip when the tier lists only this item', () => {
    // The tier is the item, so hiding it is a visibility change on that block --
    // no base moves and no Hide tier is needed anywhere else.
    open({ preview: mkPreview({ flipTier: 'trialkeysanctumtop', hideDestination: null }) })
    expect(screen.getByText(/lists only this item/i)).toBeTruthy()
  })

  it('stays actionable on the flip route even with no hide destination', async () => {
    const hide = vi.fn(async () => ({ ok: true }))
    ;(window as unknown as { api: Partial<typeof window.api> }).api = { hideItem: hide }

    open({ preview: mkPreview({ flipTier: 'trialkeysanctumtop', hideDestination: null, tierCount: 0 }) })
    fireEvent.click(screen.getByText('Hide'))

    await waitFor(() => expect(hide).toHaveBeenCalledWith('Chaos Orb', JSON.stringify(item)))
  })

  it('claims nothing while the plan is still resolving', () => {
    open({ preview: undefined })
    expect(screen.queryByText(/adding it to tier/i)).toBeNull()
    expect(screen.queryByText(/no hidden tier is available/i)).toBeNull()
  })
})

describe('TierNavigator renders for a lone tier', () => {
  const SOLO = [{ tier: 'ring_light', values: ['Chaos Orb', 'Cogwork Ring'] }]

  it('shows the dropdown when the item has only one tier, because Hide is a choice', () => {
    open({ group: group(SOLO, 'ring_light') })
    // The lone tier plus Hide: two rows. The label also appears on the closed
    // toggle, hence getAllByText.
    expect(dropdownRows()).toHaveLength(2)
    expect(screen.getAllByText('Ring Light').length).toBeGreaterThanOrEqual(2)
  })

  it('offers Hide on a locked exception tier, which cannot be switched away from', async () => {
    const hide = vi.fn(async () => ({ ok: true }))
    ;(window as unknown as { api: Partial<typeof window.api> }).api = { hideItem: hide }

    // `exoticheistbases` trips the ex-tier lock (startsWith 'exotic'), so there is
    // nothing to switch to -- but hiding is not retiering and stays available.
    open({ group: group([{ tier: 'exoticheistbases', values: ['Chaos Orb', 'Cogwork Ring'] }], 'exoticheistbases') })

    const rows = dropdownRows()
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Exoticheistbases')
    expect(rows[0].textContent).toContain('current')
    fireEvent.click(screen.getByText('Hide'))
    await waitFor(() => expect(hide).toHaveBeenCalledWith('Chaos Orb', JSON.stringify(item)))
  })

  it('still lists escapes from an exception tier even with no plan available', () => {
    const g = group([...TIERS, { tier: 'ex1', values: ['Chaos Orb'] }], 'ex1')
    render(<TierNavigator group={g} baseType={item.baseType} item={item} onMoved={() => {}} removal={undefined} />)
    fireEvent.click(screen.getByText('Switch Tier'))
    expect(screen.getByText('T1')).toBeTruthy()
    expect(screen.queryByText('Hide')).toBeNull()
  })
})
