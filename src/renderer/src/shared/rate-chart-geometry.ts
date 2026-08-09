/** Projection math for RateChart, kept separate from the component so it can be
 *  tested without a DOM. Deliberately NOT shared with SparklineOverlay: that one
 *  charts percent-change into a fixed 120x40 hover popover with per-side dot
 *  insets, this one charts absolute rates plus a volume axis into a responsive
 *  card-width viewBox. Only the trend-direction bucketing is common, and that
 *  already lives in price-trend.ts. */
import type { ExchangePoint } from '@shared/contracts/exchange'
import { type TrendDirection, TREND_THRESHOLD_PCT } from './price-trend'

/** Chart-space dimensions. The rendered size comes from the container via
 *  viewBox scaling; these only fix the internal coordinate system. */
export const VIEW_W = 300
export const VIEW_H = 120
/** Share of the height the volume bars occupy, measured up from the baseline.
 *  The rate line is inset above them so a tall bar never swallows the line. */
const VOLUME_BAND = 0.35
/** Ceiling on bar width, as a share of the chart. Bar width derives from the
 *  slot width, which explodes at low point counts -- a 2-point series would
 *  otherwise put a 90-unit bar on a 300-unit chart. */
export const MAX_BAR_W = VIEW_W / 8
/** Share of its slot a volume bar fills; the remainder is the gutter between
 *  bars. */
const BAR_FILL = 0.6
/** Vertical breathing room so the peak and valley aren't flush to the edges. */
const PAD_T = 8
const PAD_B = 6

export interface ProjectedPoint {
  x: number
  y: number
}

export interface VolumeBar {
  x: number
  y: number
  w: number
  h: number
}

export interface ChartGeometry {
  line: ProjectedPoint[]
  /** Polygon points for the gradient fill under the line, closed on the baseline. */
  area: string
  bars: VolumeBar[]
  rateMin: number
  rateMax: number
  volumeMax: number
}

export function projectChart(points: ExchangePoint[]): ChartGeometry | null {
  if (points.length === 0) return null

  const rates = points.map((p) => p.rate)
  const rateMin = Math.min(...rates)
  const rateMax = Math.max(...rates)
  // A flat series has zero range; fall back to 1 so the division is defined and
  // every point lands on the same mid-band y instead of NaN.
  const range = rateMax - rateMin || 1
  const band = VIEW_H - PAD_T - PAD_B

  // Every sample owns an equal slot and is anchored at its center. Anchoring on
  // slot centers rather than spreading edge to edge is what keeps the volume bars
  // evenly spaced: a bar centered on an edge-to-edge anchor would hang off the
  // viewBox at both ends, and clamping it back in shrinks only the first and last
  // gap, which reads as mis-spacing. Slots cost a half-slot inset at each end and
  // guarantee the line, the bars and the crosshair all share one x per sample.
  const slotW = VIEW_W / points.length
  const centerX = (i: number): number => (i + 0.5) * slotW

  const line = points.map((p, i) => ({
    x: centerX(i),
    y: rateMax === rateMin ? PAD_T + band / 2 : VIEW_H - PAD_B - ((p.rate - rateMin) / range) * band,
  }))

  // The fill runs the full width rather than stopping at the first/last anchor,
  // so the half-slot insets don't read as gaps in the gradient.
  const area = [
    `0,${VIEW_H}`,
    `0,${line[0].y}`,
    ...line.map((p) => `${p.x},${p.y}`),
    `${VIEW_W},${line[line.length - 1].y}`,
    `${VIEW_W},${VIEW_H}`,
  ].join(' ')

  const volumeMax = Math.max(...points.map((p) => p.volume), 0)
  const barW = Math.min(Math.max(slotW * BAR_FILL, 1), MAX_BAR_W)
  const bars = points.map((p, i) => {
    const h = volumeMax > 0 ? (p.volume / volumeMax) * (VIEW_H * VOLUME_BAND) : 0
    return { x: centerX(i) - barW / 2, y: VIEW_H - h, w: barW, h }
  })

  return { line, area, bars, rateMin, rateMax, volumeMax }
}

/** Index of the sample whose slot contains a cursor x, given the element's
 *  rendered width. Mirrors projectChart's slot model -- floor into the slot
 *  rather than rounding to the nearest anchor, so the crosshair always lands on
 *  the bar the cursor is actually over. Positions outside the range clamp to the
 *  first / last sample. */
export function nearestIndex(points: ExchangePoint[], x: number, width: number): number {
  if (points.length === 0) return 0
  const ratio = width > 0 ? x / width : 0
  const idx = Math.floor(ratio * points.length)
  return Math.max(0, Math.min(points.length - 1, idx))
}

/** Overall direction across the whole series, reusing the sparkline's percent
 *  threshold so a chart and a chip never disagree about which way a price went. */
export function chartDirection(points: ExchangePoint[]): TrendDirection {
  if (points.length < 2) return 'flat'
  const first = points[0].rate
  const last = points[points.length - 1].rate
  if (first <= 0) return 'flat'
  const pct = ((last - first) / first) * 100
  if (pct > TREND_THRESHOLD_PCT) return 'up'
  if (pct < -TREND_THRESHOLD_PCT) return 'down'
  return 'flat'
}
