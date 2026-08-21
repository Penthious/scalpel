import { useEffect, useState } from 'react'

interface Rect {
  x: number
  y: number
  width: number
  height: number
  /** Flush sides of the winning snap mount - those corners render square,
   *  matching the docked window's chrome. */
  edges?: { left: boolean; right: boolean }
}

/** Single transparent click-through canvas window shared by every secondary
 *  overlay for the snap-target ghost during drag. (The cheat-sheet hover
 *  preview used to render here too, but moved to its own dedicated window so
 *  it can pick up the correct per-monitor devicePixelRatio - this shared
 *  canvas spans every display and gets one dpr, which is fine for the snap
 *  ghost's coarse rectangle but breaks pixel-accurate fit-to-game-window
 *  rendering on mixed-DPI multi-monitor setups.) */
export function App(): JSX.Element {
  const [snapGhost, setSnapGhost] = useState<Rect | null>(null)
  useEffect(() => window.api.onSecondaryOverlaySnapGhost((rect) => setSnapGhost(rect)), [])
  return <>{snapGhost && <SnapGhost rect={snapGhost} />}</>
}

// Rects come from main in screen coords; the canvas window spans the
// virtual-screen union, so subtract its origin to land in the local viewport.
// window.screenX/Y track the window's current screen position automatically.
function SnapGhost({ rect }: { rect: Rect }): JSX.Element {
  return (
    <div
      className="fixed pointer-events-none border-2 border-dashed border-white/35 bg-white/20 transition-opacity duration-150 ease-linear"
      style={{
        left: rect.x - window.screenX,
        top: rect.y - window.screenY,
        width: rect.width,
        height: rect.height,
        borderTopLeftRadius: rect.edges?.left ? 0 : 6,
        borderBottomLeftRadius: rect.edges?.left ? 0 : 6,
        borderTopRightRadius: rect.edges?.right ? 0 : 6,
        borderBottomRightRadius: rect.edges?.right ? 0 : 6,
      }}
    />
  )
}
