// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ExchangePoint } from '@shared/contracts/exchange'
import { RateChart } from './RateChart'

const DAY = 86400000
const START = Date.parse('2026-07-24T00:00:00Z')

function series(rates: number[], volumes?: number[]): ExchangePoint[] {
  return rates.map((rate, i) => ({ t: START + i * DAY, rate, volume: volumes?.[i] ?? 0 }))
}

/** jsdom gives every element a zero-size layout box, so the hover handler's
 *  own getBoundingClientRect has to be stubbed for nearestIndex to resolve a
 *  real column. Returns the surface the handlers live on. */
function hoverAt(fraction: number, width = 300): HTMLElement {
  const surface = screen.getByTestId('rate-chart-surface')
  surface.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height: 120, right: width, bottom: 120, x: 0, y: 0 }) as DOMRect
  Object.defineProperty(surface, 'offsetWidth', { value: width, configurable: true })
  fireEvent.mouseMove(surface, { clientX: width * fraction, clientY: 60 })
  return surface
}

describe('RateChart hover', () => {
  it('renders no tooltip, marker or crosshair until hovered', () => {
    render(<RateChart points={series([1, 2, 3])} currency="chaos" />)
    expect(screen.queryByTestId('rate-chart-tooltip')).toBeNull()
    expect(screen.queryByTestId('rate-chart-marker')).toBeNull()
    expect(screen.queryByTestId('rate-chart-crosshair')).toBeNull()
  })

  it('shows the hovered day, rate and volume in the tooltip', () => {
    render(<RateChart points={series([9.1, 9.4, 9.69], [150000, 161000, 176079])} currency="chaos" />)
    hoverAt(0.5) // middle of three slots -> index 1
    const tip = screen.getByTestId('rate-chart-tooltip')
    expect(tip).toHaveTextContent('9.4')
    expect(tip).toHaveTextContent('161k')
  })

  it('portals the tooltip to document.body so a clipping ancestor cannot cut it off', () => {
    const { container } = render(<RateChart points={series([1, 2, 3])} currency="chaos" />)
    hoverAt(0.5)
    const tip = screen.getByTestId('rate-chart-tooltip')
    expect(tip.parentElement).toBe(document.body)
    expect(container.contains(tip)).toBe(false)
  })

  it('omits the volume line when the series has no volume', () => {
    render(<RateChart points={series([1, 2, 3])} currency="chaos" />)
    hoverAt(0.5)
    expect(screen.getByTestId('rate-chart-tooltip').textContent).not.toContain('vol')
  })

  it('gives the marker equal width and height so it is a circle, not an ellipse', () => {
    // The SVG uses preserveAspectRatio="none", so an SVG <circle> would render
    // as an ellipse. The marker is HTML for exactly this reason -- pin it.
    render(<RateChart points={series([1, 2, 3])} currency="chaos" />)
    hoverAt(0.5)
    const marker = screen.getByTestId('rate-chart-marker')
    expect(marker.style.width).toBe(marker.style.height)
    expect(marker.style.borderRadius).toBe('50%')
  })

  it('clears the tooltip, marker and crosshair on mouse leave', () => {
    render(<RateChart points={series([1, 2, 3])} currency="chaos" />)
    const surface = hoverAt(0.5)
    expect(screen.getByTestId('rate-chart-tooltip')).toBeInTheDocument()
    fireEvent.mouseLeave(surface)
    expect(screen.queryByTestId('rate-chart-tooltip')).toBeNull()
    expect(screen.queryByTestId('rate-chart-marker')).toBeNull()
    expect(screen.queryByTestId('rate-chart-crosshair')).toBeNull()
  })

  it('keeps the same line node across hovers so the entry animation cannot replay', () => {
    // The animated nodes are keyed on the series so a pair switch redraws them.
    // If hover state leaked into that key the chart would re-animate on every
    // mouse move, so assert node identity rather than the animation itself --
    // jsdom has no timeline to observe.
    render(<RateChart points={series([1, 2, 3, 4])} currency="chaos" />)
    const before = screen.getByTestId('rate-chart-line')
    hoverAt(0.3)
    hoverAt(0.8)
    expect(screen.getByTestId('rate-chart-line')).toBe(before)
  })

  it('remounts the line when the series changes so the entry animation replays', () => {
    const { rerender } = render(<RateChart points={series([1, 2, 3, 4])} currency="chaos" />)
    const before = screen.getByTestId('rate-chart-line')
    rerender(<RateChart points={series([5, 6, 7])} currency="divine" />)
    expect(screen.getByTestId('rate-chart-line')).not.toBe(before)
  })

  it('survives the series shrinking under a live hover index', () => {
    // ExchangePanel swaps pairs on the same mounted chart and real pairs differ
    // in history length (Astragali: 16 samples on chaos, 6 on divine).
    const { rerender } = render(<RateChart points={series([1, 2, 3, 4, 5, 6])} currency="chaos" />)
    hoverAt(0.95) // last slot of six
    expect(screen.getByTestId('rate-chart-tooltip')).toBeInTheDocument()
    rerender(<RateChart points={series([1, 2])} currency="divine" />)
    expect(screen.getByTestId('rate-chart-tooltip')).toBeInTheDocument()
  })
})
