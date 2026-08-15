import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { FilterBlock, PoeItem, RemovalPreview, TierGroup, TierSibling } from '@shared/types'
import type { RemovalCheck } from '@shared/filter-removal'
import { m } from '@shared/paraglide/messages.js'
import { Down, Up, SortThree } from '@icon-park/react'
import { IP } from '../../shared/constants'
import { LootLabel, HiddenLootLabel, extractLabelStyle } from '../../shared/LootLabel'
import { formatTierLabel } from '../price-audit/constants'

/** Ex/exotic (exception) tiers are locked - no tier switching allowed. */
const isExTier = (t: string): boolean => /^(ex\d*|exhide|exshow|2x\d*)$/.test(t) || t.startsWith('exotic')

/**
 * Siblings to show in the list: every non-exception tier, plus the current one
 * even when it is an exception tier.
 *
 * The lock is one-way. Exception tiers are not valid *destinations* -- they are
 * special-purpose and FilterBlade owns what lands in them -- but sitting on one
 * must not strand the item, so moving OUT of one is allowed. Rare bases often sit
 * on an exception tier whose only escape is a hidden sibling.
 *
 * Exported so the panel can tell whether this control will render at all -- when
 * it won't, the removal control needs its own home.
 */
export function switchableSiblings(group: TierGroup): TierSibling[] {
  return group.siblings.filter((s) => !isExTier(s.tier) || s.tier === group.currentTier)
}

interface Props {
  group: TierGroup
  baseType: string
  item: PoeItem
  onMoved: (newTier: string) => void
  /** What a removal would do: how many tiers it strips, where the item lands,
   *  and any tier that keeps it anyway. `undefined` while still resolving. */
  preview?: RemovalPreview
  /** Whether the base may be stripped from the current tier, and why not if not. */
  removal?: RemovalCheck
  onRemoved?: () => void
  /** Continue blocks that match this item earlier in the filter, in file order.
   *  Passed to the label preview so sibling tiers show the same decorator overlays
   *  the game would actually paint. Siblings between Continue blocks are an edge
   *  case we approximate: the preamble from the current primary match is reused
   *  for every sibling in the dropdown. */
  continuePreamble?: FilterBlock[]
}

export function TierNavigator({
  group,
  baseType,
  item,
  onMoved,
  preview,
  removal,
  onRemoved,
  continuePreamble = [],
}: Props): JSX.Element {
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const currentSib = group.siblings.find((s) => s.tier === group.currentTier)
  const hasStackSize = group.siblings.some((s) => s.block.conditions.some((c) => c.type === 'StackSize'))

  const filteredSiblings = switchableSiblings(group)
  // A locked exception tier has nothing to switch to, but the list should still
  // show where the item currently sits, in the same row shape as any other tier.
  // Selecting it is already a no-op in handleSelect.
  const displayedSiblings = filteredSiblings.length > 0 ? filteredSiblings : currentSib ? [currentSib] : []

  // Compute the max label height so the toggle doesn't resize when switching tiers
  const maxScaledSize = Math.max(
    ...group.siblings.map((s) => {
      if (s.visibility === 'Hide') return 11
      const fs = s.block.actions.find((a) => a.type === 'SetFontSize')
      return Math.round((fs ? Number(fs.values[0]) || 32 : 32) * 0.48)
    }),
  )
  const minLabelHeight = Math.round(maxScaledSize * 1.2 + 6) // lineHeight 1.2 + padding + border

  // Close dropdown on outside click. Declared before the early return below so the
  // hook runs on every render -- gating it on render conditions would reorder hooks
  // when `removal` flips.
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Nothing to offer: a locked tier the user cannot switch away from, with no
  // removal available either.
  if (filteredSiblings.length === 0 && !removal) return <></>

  const handleSelect = async (sib: TierSibling): Promise<void> => {
    if (sib.tier === group.currentTier || moving) {
      setOpen(false)
      return
    }

    const fromSib = currentSib
    if (!fromSib) return

    setMoving(true)
    setError(null)
    setOpen(false)

    const result = await window.api.moveItemTier(baseType, fromSib.blockIndex, sib.blockIndex, JSON.stringify(item))
    setMoving(false)

    if (result.ok) {
      onMoved(sib.tier)
    } else {
      setError(result.error ?? 'Failed to move')
    }
  }

  /**
   * Actually stop seeing the item: strip every tier that names it, then add it to
   * the nearest Hide tier that wins the first-match race.
   *
   * A bare removal is not offered as a separate action -- it only drops the item
   * to a catch-all, and in FilterBlade those are usually `Show`, so it de-tiers
   * without hiding and reads as doing nothing.
   */
  const handleHide = async (): Promise<void> => {
    if (moving || !canHide) return
    setMoving(true)
    setError(null)
    setOpen(false)

    const result = await window.api.hideItem(baseType, JSON.stringify(item))
    setMoving(false)

    if (!result.ok) setError(result.error ?? 'Failed to hide')
    else onRemoved?.()
  }

  /**
   * Hiding is possible when there is something to change and the end state is
   * hidden. `flipTier` is the simplest route and always works. `alreadyHidden`
   * means stripping alone lands the item on a Hide block, so no destination is
   * needed -- but with nothing to strip either, there is nothing to do at all.
   */
  const canHide =
    preview !== undefined &&
    (preview.flipTier !== null || (preview.alreadyHidden ? preview.tierCount > 0 : preview.hideDestination !== null))

  const hideDetail =
    preview === undefined
      ? ''
      : preview.flipTier
        ? m.removeitem_hide_flip({ tier: formatTierLabel(preview.flipTier) })
        : preview.alreadyHidden
          ? preview.tierCount > 0
            ? m.removeitem_hide_plain({ count: preview.tierCount })
            : m.removeitem_hide_already()
          : preview.hideDestination
            ? m.removeitem_hide_in({ tier: formatTierLabel(preview.hideDestination) })
            : m.removeitem_hide_none()

  return (
    <div className="bg-bg-card rounded">
      {/* Header -- mirrors the Edit Tier card so the two tier controls read as a pair.
       *  This one is item-scoped: it retiers THIS item, not the tier's settings. */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 flex-wrap">
        <SortThree size={14} {...IP} className="text-accent" />
        <span className="section-title">Retier {item.baseType}</span>
      </div>
      <div ref={ref} className="relative px-3 pb-3 pt-1">
        {/* Toggle button */}
        <div
          ref={toggleRef}
          onClick={() => {
            if (moving) return
            if (!open && toggleRef.current) {
              const rect = toggleRef.current.getBoundingClientRect()
              setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
            }
            setOpen((o) => !o)
          }}
          className="flex items-center gap-2 bg-black/25 border border-border rounded select-none px-[10px] py-1.5"
          style={{
            cursor: moving ? 'wait' : 'pointer',
          }}
        >
          <span className="text-[11px] text-text-dim shrink-0 self-stretch flex items-center border-r border-border bg-black/25 px-2 -my-1.5 -ml-[10px] mr-1 rounded-l">
            Switch Tier
          </span>
          <div className="flex items-center" style={{ minHeight: minLabelHeight }}>
            {currentSib &&
              (currentSib.visibility === 'Hide' ? (
                <HiddenLootLabel label={item.baseType} />
              ) : (
                <LootLabel
                  blocks={[...continuePreamble, currentSib.block]}
                  label={item.baseType}
                  showStack={hasStackSize ? { min: getStackMin(currentSib.block) ?? 1 } : undefined}
                />
              ))}
          </div>
          {currentSib?.visibility === 'Hide' && (
            <span className="text-[9px] font-bold text-hide shrink-0">[HIDDEN]</span>
          )}
          <span className="text-[10px] text-text-dim ml-auto shrink-0">{formatTierLabel(group.currentTier)}</span>
          {moving ? (
            <span className="text-[10px] text-accent">saving...</span>
          ) : open ? (
            <Up size={12} {...IP} />
          ) : (
            <Down size={12} {...IP} />
          )}
        </div>

        {error && <div className="text-[10px] text-danger px-[10px] py-1">{error}</div>}

        {/* Dropdown list - rendered as portal to avoid transform containment */}
        {open &&
          dropdownPos &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed bg-bg border border-border rounded overflow-hidden overflow-y-auto z-[9999]"
              style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                maxHeight: 400,
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}
            >
              {displayedSiblings.map((sib) => {
                const isCurrent = sib.tier === group.currentTier
                const isHidden = sib.visibility === 'Hide'

                return (
                  <div
                    key={sib.tier}
                    onClick={() => handleSelect(sib)}
                    className="flex items-center gap-2 cursor-pointer"
                    style={{
                      padding: '8px 10px',
                      background: isCurrent ? 'rgba(200,169,110,0.1)' : 'transparent',
                      borderLeft: isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isCurrent ? 'rgba(200,169,110,0.1)' : 'transparent'
                    }}
                  >
                    {/* Tier label */}
                    <span
                      className="text-[11px] font-bold w-[60px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{
                        color: isCurrent ? 'var(--accent)' : 'var(--text-dim)',
                      }}
                    >
                      {formatTierLabel(sib.tier)}
                    </span>

                    {/* Loot label preview */}
                    <div className="flex-1 min-w-0 flex items-center gap-[6px]">
                      {isHidden ? (
                        <HiddenLootLabel label={item.baseType} />
                      ) : (
                        <LootLabel
                          blocks={[...continuePreamble, sib.block]}
                          label={item.baseType}
                          showStack={hasStackSize ? { min: getStackMin(sib.block) ?? 1 } : undefined}
                        />
                      )}
                      {isHidden && <span className="text-[9px] font-bold text-hide shrink-0">[HIDDEN]</span>}
                    </div>

                    {/* Current indicator */}
                    {isCurrent && <span className="text-[9px] text-accent italic shrink-0">current</span>}
                  </div>
                )
              })}

              {/* Remove -- the item stops being named by this tier and falls through
               *  to whatever catches it next. Separated from the tiers above because
               *  it is a removal, not a destination. Height tracks the sibling rows
               *  (which are sized by their loot-label preview) so it reads as part of
               *  the same list. */}
              {/* Hide -- the only action that reliably stops the item being drawn.
               *  A plain removal only drops it to a catch-all, and those are usually
               *  Show, so it is not offered as a separate choice. */}
              {removal && (
                <div
                  onClick={() => {
                    if (canHide) void handleHide()
                  }}
                  className="flex items-center gap-2 border-t border-border"
                  style={{
                    padding: '8px 10px',
                    minHeight: minLabelHeight + 12,
                    borderLeft: '3px solid transparent',
                    cursor: canHide ? 'pointer' : 'default',
                    opacity: canHide ? 1 : 0.55,
                  }}
                  onMouseEnter={(e) => {
                    if (canHide) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span
                    className="text-[11px] font-bold w-[60px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap"
                    // Same red the app uses for hidden tiers and the [HIDDEN] badge,
                    // so "hidden" reads consistently across the panel.
                    style={{ color: canHide ? 'var(--hide-color)' : 'var(--text-dim)' }}
                  >
                    {m.removeitem_hide()}
                  </span>
                  <span className="text-[10px] text-text-dim flex-1 min-w-0 leading-[1.3]">{hideDetail}</span>
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>
    </div>
  )
}

/** Extract PoE loot label styling from a filter block's actions */
function getStackMin(block: FilterBlock): number | null {
  const cond = block.conditions.find((c) => c.type === 'StackSize')
  if (!cond) return null
  const val = Number(cond.values[0])
  if (!val || val <= 1) return null
  return val
}

/** Used by the shared LootLabel to compute minLabelHeight */
function _getLabelHeight(block: FilterBlock): number {
  const { fontSize } = extractLabelStyle(block)
  return Math.round(fontSize * 0.48 * 1.2) + 4
}
