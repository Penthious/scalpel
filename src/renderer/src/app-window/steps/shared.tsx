import { Info } from '@icon-park/react'
import { useState } from 'react'

export function GameCard({
  alt,
  image,
  selected,
  onClick,
}: {
  alt: string
  image: string
  selected: boolean
  onClick: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  // selected = full color; hovered (but not selected) = 25% greyscale; otherwise = full greyscale
  const filter = selected ? 'none' : hovered ? 'grayscale(25%) brightness(0.85)' : 'grayscale(100%) brightness(0.65)'
  const opacity = selected ? 1 : hovered ? 0.95 : 0.85
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex-1 rounded-lg p-0 cursor-pointer transition-all duration-150 bg-transparent overflow-hidden"
      style={{
        border: selected ? '3px solid var(--accent)' : '3px solid transparent',
        maxWidth: 150,
      }}
    >
      <img
        src={image}
        alt={alt}
        className="block w-full h-auto rounded-md transition-all duration-150"
        style={{ filter, opacity }}
      />
    </button>
  )
}

/** Returns "PoE1" / "PoE2" when both games are being set up, or "" for
 *  single-game flow where the prefix would be redundant. */
export function gameLabel(game: 1 | 2 | null): string {
  return game === 1 ? 'PoE1' : game === 2 ? 'PoE2' : ''
}

/** PoE2 binds W/A/S/D to movement, so a hotkey sharing one of those letters makes
 *  the character lurch when fired. We can't fully suppress it (the game reads raw
 *  key state), so nudge WASD players toward a combo without those letters. */
export function WasdHotkeyTip({ show }: { show?: boolean }): JSX.Element | null {
  if (!show) return null
  return (
    <p className="text-[10px] text-text-dim flex items-center gap-1 m-0 ml-1 mt-1.5">
      <Info size={12} theme="two-tone" fill={['currentColor', 'rgba(255,255,255,0.2)']} className="flex shrink-0" />
      Tip: If you play WASD, it's best to choose a hotkey combo without those letters.
    </p>
  )
}
