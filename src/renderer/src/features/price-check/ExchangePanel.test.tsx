// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ExchangeDetails } from '@shared/contracts/exchange'
import { ExchangePanel } from './ExchangePanel'

const TWO_PAIRS: ExchangeDetails = {
  name: 'Orb of Annulment',
  pairs: [
    { currency: 'chaos', rate: 9.69, volumePerHour: 176079, history: [{ t: 1, rate: 9.69, volume: 176079 }] },
    { currency: 'divine', rate: 0.049, volumePerHour: 106620, history: [{ t: 1, rate: 0.049, volume: 106620 }] },
  ],
}

const ONE_PAIR: ExchangeDetails = {
  name: 'Astragali',
  pairs: [{ currency: 'chaos', rate: 0.036, volumePerHour: 0, history: [{ t: 1, rate: 0.036, volume: 0 }] }],
}

describe('ExchangePanel', () => {
  it('shows the leading pair rate as the hero', () => {
    render(<ExchangePanel details={TWO_PAIRS} vendor="Faustus" />)
    expect(screen.getByTestId('exchange-hero-rate')).toHaveTextContent('9.7')
  })

  it('renders one pill per pair and switches the selected pair on click', () => {
    render(<ExchangePanel details={TWO_PAIRS} vendor="Faustus" />)
    const pills = screen.getAllByTestId('exchange-pair-pill')
    expect(pills).toHaveLength(2)
    fireEvent.click(pills[1])
    expect(screen.getByTestId('exchange-hero-rate')).toHaveTextContent('1/20')
  })

  it('hides the pills when only one pair is priced', () => {
    render(<ExchangePanel details={ONE_PAIR} vendor="Faustus" />)
    expect(screen.queryByTestId('exchange-pair-pill')).toBeNull()
  })

  it('moves the switch selection to whichever pair is clicked', () => {
    // The highlight is one sliding thumb, so selection state lives on
    // aria-pressed and the segments' own opacity -- not on a per-segment
    // background. Segment backgrounds stay transparent at all times, which is
    // also what keeps the global `button[aria-pressed='true']` rule in
    // styles.css from repainting the active one.
    render(<ExchangePanel details={TWO_PAIRS} vendor="Faustus" />)
    const pills = screen.getAllByTestId('exchange-pair-pill')
    expect(pills.map((p) => p.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
    expect(pills[0].style.opacity).toBe('1')
    expect(pills[1].style.opacity).not.toBe('1')

    fireEvent.click(pills[1])
    expect(pills.map((p) => p.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    expect(pills[0].style.opacity).not.toBe('1')
    expect(pills[1].style.opacity).toBe('1')
    expect(pills.every((p) => p.style.background === 'transparent')).toBe(true)
  })

  it('gives the sliding thumb a transition so the switch animates', () => {
    render(<ExchangePanel details={TWO_PAIRS} vendor="Faustus" />)
    const thumb = screen.getByTestId('exchange-pair-thumb')
    expect(thumb.style.transition).toContain('left')
    expect(thumb.style.transition).toContain('width')
  })

  it('keeps volume out of the hero entirely -- it belongs to the chart tooltip', () => {
    // Asserted against the liquid fixture, whose pairs both carry six-figure
    // volume: a zero-volume fixture would pass this vacuously.
    render(<ExchangePanel details={TWO_PAIRS} vendor="Faustus" />)
    expect(screen.queryByTestId('exchange-volume')).toBeNull()
    expect(screen.getByTestId('exchange-hero-rate').closest('div')?.textContent).not.toMatch(/vol|hr/)
  })

  it('shows the stack total only when the stack is bigger than one', () => {
    const { rerender } = render(<ExchangePanel details={TWO_PAIRS} vendor="Faustus" stackSize={1} />)
    expect(screen.queryByTestId('exchange-stack')).toBeNull()
    rerender(<ExchangePanel details={TWO_PAIRS} vendor="Faustus" stackSize={20} />)
    expect(screen.getByTestId('exchange-stack')).toHaveTextContent('194')
  })
})
