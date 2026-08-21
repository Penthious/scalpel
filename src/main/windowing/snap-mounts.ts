import type { OverlayAnchor } from '@shared/types'
import type { Rect } from './snap-canvas'

/** An anchor within this much of an edge (in fractions of the game window)
 *  counts as mounted flush against it. Wide enough to absorb the 1px rounding
 *  that Math.round introduces when real bounds are converted back to
 *  fractions, narrow enough that a deliberately near-edge window doesn't
 *  count. */
export const FLUSH_FRAC_EPS = 0.003

export interface FlushEdges {
  left: boolean
  right: boolean
}

/** Which vertical edges of the game window an anchor sits flush against. */
export function flushEdges(anchor: OverlayAnchor): FlushEdges {
  return {
    left: anchor.fracX <= FLUSH_FRAC_EPS,
    right: anchor.fracX + anchor.fracW >= 1 - FLUSH_FRAC_EPS,
  }
}

/** A snap-home rect adapted to the dragged window's current size. Classic
 *  behavior is the anchor's top-left with the current size; an anchor mounted
 *  flush against the right (or bottom) edge instead keeps the window flush to
 *  that edge, so a user-resized window still mounts cleanly rather than
 *  snapping to a stale offset computed for the anchor's own size. */
export function mountAwareTarget(anchor: OverlayAnchor, rect: Rect, cur: Rect): Rect {
  const edges = flushEdges(anchor)
  const bottom = anchor.fracY + anchor.fracH >= 1 - FLUSH_FRAC_EPS && anchor.fracY > FLUSH_FRAC_EPS
  return {
    x: edges.right && !edges.left ? rect.x + rect.width - cur.width : rect.x,
    y: bottom ? rect.y + rect.height - cur.height : rect.y,
    width: cur.width,
    height: cur.height,
  }
}

/** The candidate snap target nearest to the dragged window: the spec's default
 *  anchor plus any extra snap anchors, each derived mount-aware. Reports the
 *  winning mount's flush edges so the ghost can mirror the mounted look.
 *  `rectFor` resolves an anchor to real bounds (null when PoE isn't attached). */
export function nearestMountTarget(
  anchors: OverlayAnchor[],
  rectFor: (anchor: OverlayAnchor) => Rect | null,
  cur: Rect,
): { rect: Rect; edges: FlushEdges } | null {
  let best: { rect: Rect; edges: FlushEdges } | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const anchor of anchors) {
    const rect = rectFor(anchor)
    if (!rect) continue
    const target = mountAwareTarget(anchor, rect, cur)
    const dist = Math.hypot(cur.x - target.x, cur.y - target.y)
    if (dist < bestDist) {
      bestDist = dist
      best = { rect: target, edges: flushEdges(anchor) }
    }
  }
  return best
}
