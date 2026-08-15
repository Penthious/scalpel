import { useState } from 'react'
import type { PoeItem, RemovalPreview } from '@shared/types'
import { m } from '@shared/paraglide/messages.js'
import { formatTierLabel } from '../../price-audit/constants'

interface HideItemSectionProps {
  item: PoeItem
  /** What hiding this item would take: how many tiers must be stripped, whether
   *  stripping alone suffices, and the Hide tier to add it to. `undefined` while
   *  the main process is still resolving it. */
  preview?: RemovalPreview
  /** Optional hook fired after a successful hide. The main process already reloads
   *  the filter and re-evaluates the item, so the panel refreshes on its own. */
  onHidden?: () => void
}

/**
 * Stop an item being drawn, for items whose tier has no switchable group -- the
 * dropdown's Hide row covers every other case.
 *
 * Usually two steps under the hood: strip every tier that names the item, then
 * add it to a Hide tier that wins the first-match race. A bare removal is not
 * offered, because it only drops the item to a catch-all and those are usually
 * `Show`. When the tier names this base and nothing else it is one step instead
 * -- the tier is the item, so it is simply flipped to `Hide`.
 */
export function HideItemSection({ item, preview, onHidden }: HideItemSectionProps): JSX.Element {
  const [hiding, setHiding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canHide =
    preview !== undefined &&
    (preview.flipTier !== null || (preview.alreadyHidden ? preview.tierCount > 0 : preview.hideDestination !== null))

  const detail =
    preview === undefined
      ? null
      : preview.flipTier
        ? m.removeitem_hide_flip({ tier: formatTierLabel(preview.flipTier) })
        : preview.alreadyHidden
          ? preview.tierCount > 0
            ? m.removeitem_hide_plain({ count: preview.tierCount })
            : m.removeitem_hide_already()
          : preview.hideDestination
            ? m.removeitem_hide_in({ tier: formatTierLabel(preview.hideDestination) })
            : m.removeitem_hide_none()

  const hide = async (): Promise<void> => {
    setHiding(true)
    setError(null)
    const result = await window.api.hideItem(item.baseType, JSON.stringify(item))
    setHiding(false)
    if (result.ok) onHidden?.()
    else setError(result.error ?? 'Failed to hide')
  }

  return (
    <div className="bg-black/20 rounded p-[6px_8px] mb-3 flex flex-col gap-[8px]">
      <div className="text-[10px] font-bold text-text-dim uppercase tracking-[0.5px]">{m.hideitem_title()}</div>
      <button
        type="button"
        onClick={hide}
        disabled={!canHide || hiding}
        className="w-full py-[6px] rounded text-[11px] font-bold tracking-[0.5px] uppercase text-center select-none transition-all duration-[120ms]"
        style={{
          color: canHide ? '#fff' : 'var(--text-dim)',
          background: canHide ? 'var(--hide-color)' : 'rgba(0,0,0,0.25)',
          cursor: canHide && !hiding ? 'pointer' : 'default',
          opacity: hiding ? 0.5 : 1,
        }}
      >
        {m.hideitem_button({ item: item.baseType })}
      </button>
      {/* Blank while resolving -- claiming an outcome before the plan lands would
       *  be a guess. */}
      <div className="text-[10px] text-text-dim leading-[1.3]">{detail ?? ' '}</div>
      {error && <div className="text-[11px] text-danger">{error}</div>}
    </div>
  )
}
