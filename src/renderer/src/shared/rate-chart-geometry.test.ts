import { describe, expect, it } from 'vitest'
import { chartDirection, MAX_BAR_W, nearestIndex, projectChart, VIEW_H, VIEW_W } from './rate-chart-geometry'

const pts = (rates: number[], volumes?: number[]) =>
  rates.map((rate, i) => ({ t: i * 86400000, rate, volume: volumes?.[i] ?? 0 }))

describe('projectChart', () => {
  it('returns null for an empty series', () => {
    expect(projectChart([])).toBeNull()
  })

  it('anchors each point at the center of its equal slot', () => {
    const g = projectChart(pts([1, 2, 3]))!
    // Three 100-wide slots -> centers at 50 / 150 / 250.
    expect(g.line.map((p) => p.x)).toEqual([50, 150, 250])
  })

  it('places a single point at the center', () => {
    const g = projectChart(pts([5]))!
    expect(g.line).toHaveLength(1)
    expect(g.line[0].x).toBe(VIEW_W / 2)
  })

  // The bug this pins (#568): bars were anchored edge to edge and then clamped
  // back inside the viewBox, which shrank only the first and last gap. Every
  // interior gap was 18.75 and the two edge gaps were 13.125, which reads as
  // random spacing. Assert every gap is identical, not merely that bars are in
  // bounds -- the old code passed a bounds check.
  it('spaces every bar identically, including the first and last', () => {
    const g = projectChart(pts(Array.from({ length: 17 }, (_, i) => i + 1)))!
    const gaps = g.bars.slice(1).map((b, i) => b.x - g.bars[i].x)
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 10)
    expect(g.bars[0].x).toBeGreaterThanOrEqual(0)
    const last = g.bars[g.bars.length - 1]
    expect(last.x + last.w).toBeLessThanOrEqual(VIEW_W)
  })

  it('keeps the line, the bars and the hover index on one shared anchor per sample', () => {
    const pointCount = 12
    const g = projectChart(pts(Array.from({ length: pointCount }, (_, i) => i + 1)))!
    for (let i = 0; i < pointCount; i++) {
      expect(g.bars[i].x + g.bars[i].w / 2).toBeCloseTo(g.line[i].x, 10)
      // A cursor at the anchor must resolve to that same sample.
      expect(nearestIndex(pts(Array.from({ length: pointCount }, (_, j) => j + 1)), g.line[i].x, VIEW_W)).toBe(i)
    }
  })

  it('puts the max at the top of the band and the min at the bottom', () => {
    const g = projectChart(pts([10, 30, 20]))!
    const [lo, hi] = [Math.max(...g.line.map((p) => p.y)), Math.min(...g.line.map((p) => p.y))]
    expect(g.line[0].y).toBe(lo)
    expect(g.line[1].y).toBe(hi)
    expect(g.rateMin).toBe(10)
    expect(g.rateMax).toBe(30)
  })

  it('centers a flat line instead of dividing by a zero range', () => {
    const g = projectChart(pts([7, 7, 7]))!
    for (const p of g.line) expect(Number.isFinite(p.y)).toBe(true)
    expect(new Set(g.line.map((p) => p.y)).size).toBe(1)
  })

  it('scales volume bars against the series max', () => {
    const g = projectChart(pts([1, 1, 1], [0, 50, 100]))!
    expect(g.bars[0].h).toBe(0)
    expect(g.bars[2].h).toBeGreaterThan(g.bars[1].h)
  })

  it('renders zero-height bars when every volume is zero', () => {
    const g = projectChart(pts([1, 2], [0, 0]))!
    expect(g.bars.every((b) => b.h === 0)).toBe(true)
  })

  it('renders equal-height bars when every volume is the same non-zero value', () => {
    const g = projectChart(pts([1, 2, 3], [5, 5, 5]))!
    expect(g.bars.every((b) => b.h === g.bars[0].h)).toBe(true)
    expect(g.bars[0].h).toBeGreaterThan(0)
  })

  it('clamps bar width and position for a sparse series so bars stay in bounds', () => {
    const g = projectChart(pts([1, 2]))!
    // Slots are 150 wide for a 2-point series, so the uncapped bar would be 90 --
    // pin the actual capped value, not just an upper bound, so a regression that
    // drops the cap can't slip past a merely-under-VIEW_W check.
    expect(g.bars[0].w).toBe(MAX_BAR_W)
    expect(g.bars[0].x).toBeGreaterThanOrEqual(0)
    const last = g.bars[g.bars.length - 1]
    expect(last.x + last.w).toBeLessThanOrEqual(VIEW_W)
  })

  it('clamps bar width and position for a single point so the bar stays in bounds', () => {
    const g = projectChart(pts([5]))!
    expect(g.bars[0].x).toBeGreaterThanOrEqual(0)
    const last = g.bars[g.bars.length - 1]
    expect(last.x + last.w).toBeLessThanOrEqual(VIEW_W)
  })

  it('keeps the well-populated bar width unchanged by the cap', () => {
    const g = projectChart(pts(Array.from({ length: 16 }, (_, i) => i)))!
    // 16 slots of 18.75, filled to 60% -> 11.25, comfortably under the cap.
    expect(g.bars[0].w).toBe(11.25)
  })

  it('closes the area polygon along the baseline', () => {
    const g = projectChart(pts([1, 2]))!
    expect(g.area.startsWith(`0,${VIEW_H}`)).toBe(true)
    expect(g.area.endsWith(`${VIEW_W},${VIEW_H}`)).toBe(true)
  })
})

describe('nearestIndex', () => {
  it('maps a cursor position to the closest sample', () => {
    const p = pts([1, 2, 3, 4, 5])
    expect(nearestIndex(p, 0, 100)).toBe(0)
    expect(nearestIndex(p, 100, 100)).toBe(4)
    expect(nearestIndex(p, 51, 100)).toBe(2)
  })

  it('clamps out-of-range positions', () => {
    const p = pts([1, 2, 3])
    expect(nearestIndex(p, -20, 100)).toBe(0)
    expect(nearestIndex(p, 999, 100)).toBe(2)
  })

  it('returns 0 for an empty series', () => {
    expect(nearestIndex([], 50, 100)).toBe(0)
  })
})

describe('chartDirection', () => {
  it('reads up when the series gained more than the threshold', () => {
    expect(chartDirection(pts([100, 200]))).toBe('up')
  })

  it('reads down when the series lost more than the threshold', () => {
    expect(chartDirection(pts([200, 100]))).toBe('down')
  })

  it('reads flat inside the threshold', () => {
    expect(chartDirection(pts([100, 101]))).toBe('flat')
  })

  it('reads flat for fewer than two points', () => {
    expect(chartDirection(pts([100]))).toBe('flat')
    expect(chartDirection([])).toBe('flat')
  })
})
