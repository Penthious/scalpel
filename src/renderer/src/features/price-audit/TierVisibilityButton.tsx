import { useState } from 'react'
import { PreviewOpen, PreviewClose } from '@icon-park/react'
import type { FilterBlock, PoeItem } from '@shared/types'
import { m } from '@shared/paraglide/messages.js'

interface TierVisibilityButtonProps {
  block: FilterBlock
  blockIndex: number
  item?: PoeItem
}

/**
 * Flip the audited tier between Show and Hide without leaving the audit view --
 * previously the only route was opening an item inside the tier and using the
 * block editor's visibility toggle (#596). Minimal (PoE2) counts as visible,
 * same as that toggle's Show/Hide pair.
 */
export function TierVisibilityButton({ block, blockIndex, item }: TierVisibilityButtonProps): JSX.Element {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHidden = block.visibility === 'Hide'

  const toggle = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    setError(null)
    const result = await window.api.saveBlockEdit(
      blockIndex,
      { ...block, visibility: isHidden ? 'Show' : 'Hide' },
      item ? JSON.stringify(item) : undefined,
    )
    setSaving(false)
    if (!result.ok) setError(result.error ?? 'Failed to save')
  }

  return (
    <div className="flex flex-col items-stretch gap-[2px] shrink-0">
      <button
        type="button"
        onClick={toggle}
        className={`flex-1 flex items-center justify-center gap-1 whitespace-nowrap rounded text-[10px] font-bold tracking-[0.5px] uppercase select-none bg-black/25 border border-border hover:bg-white/5 transition-all duration-[120ms] ${isHidden ? 'text-show' : 'text-hide'}`}
        style={{ padding: '4px 8px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.5 : 1 }}
      >
        {isHidden ? (
          <PreviewOpen size={11} theme="outline" fill="currentColor" />
        ) : (
          <PreviewClose size={11} theme="outline" fill="currentColor" />
        )}
        {isHidden ? m.audit_show_tier() : m.audit_hide_tier()}
      </button>
      {error && <span className="text-[9px] text-danger">{error}</span>}
    </div>
  )
}
