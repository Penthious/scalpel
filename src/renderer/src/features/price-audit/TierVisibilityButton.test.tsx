// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { FilterBlock, PoeItem } from '@shared/types'
import { TierVisibilityButton } from './TierVisibilityButton'

const item = { baseType: 'Chaos Orb', itemClass: 'Stackable Currency' } as PoeItem

function block(visibility: FilterBlock['visibility']): FilterBlock {
  return {
    id: 't4chaos',
    visibility,
    conditions: [{ type: 'BaseType', operator: '==', values: ['Chaos Orb'], explicitOperator: true }],
    actions: [],
    continue: false,
    lineStart: 1,
    lineEnd: 2,
    tierTag: { typePath: 'currency', tier: 't4chaos' },
  }
}

function mockApi(save = vi.fn(async () => ({ ok: true }))): typeof save {
  ;(window as unknown as { api: Partial<typeof window.api> }).api = { saveBlockEdit: save }
  return save
}

describe('TierVisibilityButton', () => {
  it('offers Hide on a shown tier and saves the block flipped to Hide', async () => {
    const save = mockApi()
    render(<TierVisibilityButton block={block('Show')} blockIndex={7} item={item} />)

    fireEvent.click(screen.getByText('Hide Tier'))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const [idx, saved, itemJson] = save.mock.calls[0] as unknown as [number, FilterBlock, string]
    expect(idx).toBe(7)
    expect(saved.visibility).toBe('Hide')
    expect(JSON.parse(itemJson).baseType).toBe('Chaos Orb')
  })

  it('offers Show on a hidden tier and saves the block flipped to Show', async () => {
    const save = mockApi()
    render(<TierVisibilityButton block={block('Hide')} blockIndex={3} item={item} />)

    fireEvent.click(screen.getByText('Show Tier'))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const [, saved] = save.mock.calls[0] as unknown as [number, FilterBlock]
    expect(saved.visibility).toBe('Show')
  })

  // PoE2 filters have a third state; the audit toggle treats it as visible,
  // same as the block editor's Show/Hide pair.
  it('treats Minimal as visible: offers Hide', async () => {
    const save = mockApi()
    render(<TierVisibilityButton block={block('Minimal')} blockIndex={0} item={item} />)

    fireEvent.click(screen.getByText('Hide Tier'))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    const [, saved] = save.mock.calls[0] as unknown as [number, FilterBlock]
    expect(saved.visibility).toBe('Hide')
  })

  it('ignores clicks while a save is in flight', async () => {
    let resolve!: (v: { ok: boolean }) => void
    const save = vi.fn(() => new Promise<{ ok: boolean }>((r) => (resolve = r)))
    mockApi(save as never)
    render(<TierVisibilityButton block={block('Show')} blockIndex={7} item={item} />)

    fireEvent.click(screen.getByText('Hide Tier'))
    fireEvent.click(screen.getByText('Hide Tier'))
    expect(save).toHaveBeenCalledTimes(1)

    resolve({ ok: true })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  })

  it('surfaces the error when the save fails', async () => {
    mockApi(vi.fn(async () => ({ ok: false, error: 'disk on fire' })))
    render(<TierVisibilityButton block={block('Show')} blockIndex={7} item={item} />)

    fireEvent.click(screen.getByText('Hide Tier'))

    await waitFor(() => expect(screen.getByText('disk on fire')).toBeTruthy())
  })
})
