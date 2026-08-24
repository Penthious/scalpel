import { useEffect, useRef, useState } from 'react'
import { Chrome } from '../secondary-overlay/Chrome'
import { useActivatePlugin } from '../plugins/use-activate-plugin'

export function App({ pluginId }: { pluginId: string }): JSX.Element {
  const { captured, error } = useActivatePlugin(pluginId)
  const bodyRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | void>(undefined)

  // Squares the chrome's corners against whichever game-window edge the
  // overlay currently abuts. Pushed by main on first show and after drags.
  // Optional call for bridge-less contexts (Storybook), like PinToggle.
  const [edgeFlush, setEdgeFlush] = useState({ left: false, right: false })
  useEffect(() => window.api.onPluginOverlayEdgeFlush?.(setEdgeFlush), [])

  // Mount the captured render into the body once both exist.
  useEffect(() => {
    if (!captured || !bodyRef.current) return
    cleanupRef.current = captured.render(bodyRef.current)
    return () => {
      if (typeof cleanupRef.current === 'function') cleanupRef.current()
      cleanupRef.current = undefined
    }
  }, [captured])

  return (
    <Chrome
      title={captured?.opts.title}
      flushLeft={edgeFlush.left}
      flushRight={edgeFlush.right}
      onClose={() => {
        void window.api.pluginCloseOverlay(pluginId)
      }}
    >
      {error ? (
        <div className="p-3 text-[12px] text-text-dim">Plugin error: {error}</div>
      ) : (
        <div ref={bodyRef} className="flex-1 overflow-auto" />
      )}
    </Chrome>
  )
}
