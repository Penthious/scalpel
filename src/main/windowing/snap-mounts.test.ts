import { describe, expect, it } from 'vitest'
import { flushEdges, mountAwareTarget, nearestMountTarget } from './snap-mounts'

const GAME = { x: 0, y: 0, width: 1920, height: 1080 }
const CUR = { x: 900, y: 300, width: 362, height: 139 }

const rightMount = { fracX: 0.8115, fracY: 0.0104, fracW: 0.1885, fracH: 0.1283 }
const leftMount = { fracX: 0, fracY: 0.0928, fracW: 0.1885, fracH: 0.1283 }
const floating = { fracX: 0.505, fracY: 0.4, fracW: 0.16, fracH: 0.4 }

const rectFor = (a: typeof rightMount) => ({
  x: Math.round(GAME.x + a.fracX * GAME.width),
  y: Math.round(GAME.y + a.fracY * GAME.height),
  width: Math.round(a.fracW * GAME.width),
  height: Math.round(a.fracH * GAME.height),
})

describe('flushEdges', () => {
  it('detects a right-flush anchor within the rounding epsilon', () => {
    expect(flushEdges({ ...rightMount, fracX: 0.8109 })).toEqual({ left: false, right: true })
  })

  it('detects a left-flush anchor', () => {
    expect(flushEdges(leftMount)).toEqual({ left: true, right: false })
  })

  it('reports a floating anchor flush to neither edge', () => {
    expect(flushEdges(floating)).toEqual({ left: false, right: false })
  })
})

describe('mountAwareTarget', () => {
  it('keeps a right-flush mount flush at the current window size', () => {
    const target = mountAwareTarget(rightMount, rectFor(rightMount), { ...CUR, width: 500 })
    expect(target.x + 500).toBe(GAME.width)
    expect(target.y).toBe(rectFor(rightMount).y)
  })

  it('anchors a left-flush mount at the left edge regardless of size', () => {
    const target = mountAwareTarget(leftMount, rectFor(leftMount), { ...CUR, width: 500 })
    expect(target.x).toBe(0)
  })

  it('uses classic top-left + current size for floating anchors', () => {
    const rect = rectFor(floating)
    expect(mountAwareTarget(floating, rect, CUR)).toEqual({
      x: rect.x,
      y: rect.y,
      width: CUR.width,
      height: CUR.height,
    })
  })
})

describe('nearestMountTarget', () => {
  const anchors = [rightMount, leftMount]

  it('picks the right mount when dragging near the right edge, edges included', () => {
    const cur = { ...CUR, x: 1500, y: 40 }
    const target = nearestMountTarget(anchors, rectFor, cur)
    expect(target && target.rect.x + cur.width).toBe(GAME.width)
    expect(target?.edges).toEqual({ left: false, right: true })
  })

  it('picks the left mount when dragging near the left edge, edges included', () => {
    const target = nearestMountTarget(anchors, rectFor, { ...CUR, x: 60, y: 140 })
    expect(target?.rect.x).toBe(0)
    expect(target?.edges).toEqual({ left: true, right: false })
  })

  it('returns null when no anchor resolves to bounds', () => {
    expect(nearestMountTarget(anchors, () => null, CUR)).toBeNull()
  })
})
