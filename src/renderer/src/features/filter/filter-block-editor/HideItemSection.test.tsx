// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import type { FilterBlock, MatchResult, PoeItem, RemovalPreview } from '@shared/types'
import { HideItemSection } from './HideItemSection'

const item = { baseType: 'Sapphire Ring' } as PoeItem

function landing(tier: string, visibility: 'Show' | 'Hide' = 'Show'): MatchResult {
  const block: FilterBlock = {
    id: tier,
    visibility,
    conditions: [],
    actions: [],
    continue: false,
    lineStart: 1,
    lineEnd: 2,
    tierTag: { typePath: 'rings', tier },
  }
  return { block, blockIndex: 4, isFirstMatch: true, evaluatedConditions: [], hasUnknowns: false }
}

function preview(over: Partial<RemovalPreview> = {}): RemovalPreview {
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

function installApi(): ReturnType<typeof vi.fn> {
  const hide = vi.fn(async () => ({ ok: true }))
  ;(window as unknown as { api: Partial<typeof window.api> }).api = { hideItem: hide }
  return hide
}

describe('HideItemSection', () => {
  it('hides via hideItem and names the destination tier', async () => {
    const hide = installApi()
    const onHidden = vi.fn()

    const { getByRole, getByText } = render(<HideItemSection item={item} preview={preview()} onHidden={onHidden} />)

    expect(getByText(/adding it to tier/i)).toBeTruthy()
    const button = getByRole('button')
    expect(button).not.toBeDisabled()
    fireEvent.click(button)

    await waitFor(() => expect(hide).toHaveBeenCalledWith('Sapphire Ring', JSON.stringify(item)))
    await waitFor(() => expect(onHidden).toHaveBeenCalled())
  })

  it('is actionable without a destination when stripping alone leaves it hidden', () => {
    installApi()
    const { getByRole, getByText } = render(
      <HideItemSection
        item={item}
        preview={preview({ landsOn: landing('raresendgame', 'Hide'), alreadyHidden: true, hideDestination: null })}
      />,
    )
    expect(getByRole('button')).not.toBeDisabled()
    expect(getByText(/removing it from 1 tier/i)).toBeTruthy()
  })

  it('is inert when the item is already hidden and no tier names it', () => {
    const hide = installApi()
    const { getByRole, getByText } = render(
      <HideItemSection
        item={item}
        preview={preview({
          landsOn: landing('raresendgame', 'Hide'),
          alreadyHidden: true,
          tierCount: 0,
          hideDestination: null,
        })}
      />,
    )
    expect(getByRole('button')).toBeDisabled()
    expect(getByText(/already hidden/i)).toBeTruthy()
    fireEvent.click(getByRole('button'))
    expect(hide).not.toHaveBeenCalled()
  })

  it('is inert and explains itself when no hidden tier can take the base', () => {
    const hide = installApi()
    const { getByRole, getByText } = render(
      <HideItemSection item={item} preview={preview({ hideDestination: null })} />,
    )
    expect(getByRole('button')).toBeDisabled()
    expect(getByText(/no hidden tier is available/i)).toBeTruthy()
    fireEvent.click(getByRole('button'))
    expect(hide).not.toHaveBeenCalled()
  })

  it('claims nothing while the plan is still resolving', () => {
    installApi()
    const { getByRole, queryByText } = render(<HideItemSection item={item} preview={undefined} />)
    expect(getByRole('button')).toBeDisabled()
    expect(queryByText(/adding it to tier/i)).toBeNull()
    expect(queryByText(/no hidden tier is available/i)).toBeNull()
  })
})
