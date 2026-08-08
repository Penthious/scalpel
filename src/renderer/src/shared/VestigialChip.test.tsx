// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VestigialChip } from './VestigialChip'
import { PoeVersionProvider } from './poe-version-context'
import { defaultPoeItem } from '@shared/poe-item'
import type { GameVariant, PoeItem } from '@shared/types'

afterEach(() => {
  vi.useRealTimers()
})

function renderChip(overrides: Partial<PoeItem>, version: GameVariant = 1): ReturnType<typeof render> {
  return render(
    <PoeVersionProvider version={version}>
      <VestigialChip item={defaultPoeItem(overrides)} />
    </PoeVersionProvider>,
  )
}

describe('VestigialChip', () => {
  it('marks a donor unique with a chip', () => {
    renderChip({ name: 'Abyssus', rarity: 'Unique', itemClass: 'Helmets' })
    expect(screen.getByText('Vestigial Mod')).toBeTruthy()
  })

  it('shows only the resulting mod on hover', () => {
    vi.useFakeTimers()
    renderChip({ name: 'Abyssus', rarity: 'Unique', itemClass: 'Helmets' })
    fireEvent.mouseEnter(screen.getByText('Vestigial Mod'))
    act(() => {
      vi.advanceTimersByTime(120)
    })
    const tip = screen.getByTestId('hover-tooltip')
    expect(tip).toHaveTextContent('+50% to Melee Critical Strike Multiplier')
    // The donor's own rolled range must not leak into the tooltip.
    expect(tip.textContent).not.toContain('100-125')
  })

  it('counts and lists every candidate when a unique donates several', () => {
    vi.useFakeTimers()
    renderChip({ name: 'The Three Dragons', rarity: 'Unique', itemClass: 'Helmets' })
    expect(screen.getByText('3')).toBeTruthy()
    fireEvent.mouseEnter(screen.getByText('Vestigial Mod'))
    act(() => {
      vi.advanceTimersByTime(120)
    })
    expect(screen.getByTestId('hover-tooltip').textContent?.split('\n')).toHaveLength(3)
  })

  it('omits the count for a single candidate', () => {
    renderChip({ name: 'Abyssus', rarity: 'Unique', itemClass: 'Helmets' })
    expect(screen.queryByText('1')).toBeNull()
  })

  it('renders nothing for a unique that donates no vestigial mod', () => {
    const { container } = renderChip({ name: 'Frostferno', rarity: 'Unique', itemClass: 'Helmets' })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a non-unique item', () => {
    const { container } = renderChip({ name: 'Abyssus', rarity: 'Rare', itemClass: 'Helmets' })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing in PoE2, where the mechanic does not exist', () => {
    const { container } = renderChip({ name: 'Abyssus', rarity: 'Unique', itemClass: 'Helmets' }, 2)
    expect(container.firstChild).toBeNull()
  })
})
