import { Down, Up } from '@icon-park/react'
import type { Listing } from '../trade-types'
import { ExpandedListing } from './ExpandedListing'
import { formatTimeAgo } from './constants'
import { RuneSocketOverlayPoe2 } from '../../components/sockets/RuneSocketOverlay.poe2'
import { SocketOverlayPoe1 } from '../../components/sockets/SocketOverlay.poe1'
import { usePoeVersion } from '../poe-version-context'
import type { ResultsView } from '../trade-settings'
import { zebraRowBg } from '../utils'
import { CurrencyIcon } from '../CurrencyIcon'
import { formatPriceTooltip } from '../currency-short-labels'
import { HoverTooltip } from '../HoverTooltip'

export function TradeListings({
  listings,
  total,
  itemClass,
  itemName,
  itemRarity,
  expandedListing,
  setExpandedListing,
  priceChipMinWidth,
  loggedIn = false,
  actionStatus = {},
  setActionStatus = () => {},
  queryId,
  league,
  onLoadMore,
  loadingMore,
  resultsView = 'default',
}: {
  listings: Listing[]
  total: number | null
  itemClass: string
  itemName: string
  itemRarity: string
  expandedListing: string | null
  setExpandedListing: (id: string | null) => void
  priceChipMinWidth: number
  /** Trade actions (Travel to Hideout / Whisper) render only when the caller wires
   *  these up. The regex tool deliberately omits them, so all three are optional. */
  loggedIn?: boolean
  actionStatus?: Record<string, 'pending' | 'success' | 'failed'>
  setActionStatus?: React.Dispatch<React.SetStateAction<Record<string, 'pending' | 'success' | 'failed'>>>
  queryId: string | null
  league: string
  onLoadMore?: () => void
  loadingMore?: boolean
  resultsView?: ResultsView
}): JSX.Element {
  const poeVersion = usePoeVersion()
  const openAll = resultsView === 'open-all'
  const compact = resultsView === 'shrinkydink'
  const matchCount = total ?? listings.length
  return (
    <div className="relative flex-1 min-h-0 flex flex-col mx-[-14px] mt-0 -mb-[10px]">
      {matchCount > 0 && (
        // Anchored to this non-scrolling wrapper (not sticky inside the scroll
        // area), so it stays put on scroll. `-top` lifts it above the list top.
        <div className="absolute right-3 -top-[3px] z-10 pointer-events-none">
          <span className="rounded-full bg-black/50 px-[8px] py-[2px] text-[9px] font-semibold text-text-dim">
            {matchCount} {matchCount === 1 ? 'Match' : 'Matches'}
          </span>
        </div>
      )}
      <div className="bg-black/20 overflow-hidden flex-1 min-h-0 overflow-y-auto rounded-none">
        {listings.map((l, i) => {
          const isExpanded = openAll || expandedListing === l.id
          return (
            <div key={l.id}>
              <div
                onClick={() => {
                  if (openAll) return
                  setExpandedListing(isExpanded ? null : l.id)
                }}
                className="flex items-center gap-2 px-[10px] py-[6px] text-xs relative transition-[background] duration-100"
                style={{
                  background: zebraRowBg(i),
                  borderLeft: isExpanded ? '3px solid var(--accent)' : '3px solid transparent',
                  cursor: openAll ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  const chev = e.currentTarget.querySelector('.row-chevron') as HTMLElement
                  if (chev) chev.style.opacity = '0.5'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = zebraRowBg(i)
                  const chev = e.currentTarget.querySelector('.row-chevron') as HTMLElement
                  if (chev) chev.style.opacity = isExpanded ? '0.5' : '0'
                }}
              >
                {/* Item icon with sockets overlay (hidden in Shrinkydink mode) */}
                {!compact && l.icon && (
                  <div className="relative w-[42px] h-[44px] shrink-0">
                    <img
                      src={l.icon}
                      alt=""
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
                      style={{
                        width: 72,
                        height: 72,
                        filter: 'blur(10px) saturate(2)',
                        opacity: 0.3,
                      }}
                    />
                    <img src={l.icon} alt="" className="relative w-[42px] h-[44px] object-contain" />
                    {/* Sockets overlay */}
                    {l.itemData?.sockets && l.itemData.sockets.length > 0 && (
                      <div
                        className="absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center pointer-events-none"
                        style={{
                          top: l.itemData?.sockets && l.itemData.sockets.length >= 5 ? -5 : 0,
                        }}
                      >
                        {(() => {
                          const sockets = l.itemData!.sockets!
                          const sz = 12,
                            gap = 3

                          if (poeVersion === 2) {
                            return (
                              <RuneSocketOverlayPoe2
                                count={sockets.length}
                                itemClass={itemClass}
                                itemName={itemName}
                                sz={sz}
                                gap={gap}
                              />
                            )
                          }

                          return (
                            <SocketOverlayPoe1
                              sockets={sockets}
                              itemClass={itemClass}
                              itemName={itemName}
                              sz={sz}
                              gap={gap}
                              linkPx={4}
                            />
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Price */}
                {l.price ? (
                  <HoverTooltip text={formatPriceTooltip(l.price.amount, l.price.currency)} className="shrink-0">
                    <span
                      className="flex items-center justify-center gap-1 font-bold text-sm font-[inherit] bg-black/30 rounded-full px-[10px] py-[3px]"
                      style={{ minWidth: priceChipMinWidth }}
                    >
                      {l.price.amount}
                      <CurrencyIcon name={l.price.currency} className="w-[18px] h-[18px]" />
                    </span>
                  </HoverTooltip>
                ) : (
                  <span
                    className="flex items-center justify-center shrink-0 text-text-dim text-[11px] bg-black/30 rounded-full px-[10px] py-[3px]"
                    style={{ minWidth: priceChipMinWidth }}
                  >
                    No price
                  </span>
                )}

                {l.itemData?.memoryStrands != null && (
                  <span className="shrink-0 rounded-full bg-black/30 px-[8px] py-[2px] text-[10px] font-semibold text-[#00e0be]">
                    {l.itemData.memoryStrands}
                    {compact ? '' : ' Strands'}
                  </span>
                )}

                {/* Seller + time: stacked by default, inline in Shrinkydink to save
                    vertical space. On a warrant the kit takes the flexible slot, so
                    this one shrinks to fit and truncates. */}
                {(() => {
                  const kit = l.itemData?.mercenarySkills
                  const hasKit = !!kit && kit.length > 0
                  return (
                    <>
                      <div
                        className={`min-w-0 flex ${hasKit ? 'shrink-0 max-w-[96px]' : 'flex-1'} ${
                          compact ? 'items-center gap-2' : 'flex-col'
                        }`}
                      >
                        <span
                          className="text-[10px] truncate"
                          style={{ color: l.online ? 'var(--accent)' : 'var(--text-dim)' }}
                        >
                          {l.account}
                        </span>
                        {l.indexed && (
                          <span className="text-[9px] text-text-dim whitespace-nowrap">{formatTimeAgo(l.indexed)}</span>
                        )}
                      </div>

                      {/* Mercenary Warrant kit at a glance: the skill icons are what
                          you scan a warrant list by, so they get the row's flexible
                          space. Supports live in the tooltip (and in full under the
                          expanded row). */}
                      {hasKit && (
                        <div className="flex-1 min-w-0 flex items-center gap-[2px] overflow-hidden">
                          {kit.map((skill, si) => (
                            <HoverTooltip
                              key={si}
                              className="shrink-0"
                              text={[
                                skill.name,
                                ...skill.supports.map((s) => `  ${s.name}${s.tier != null ? ` (T${s.tier})` : ''}`),
                              ].join('\n')}
                            >
                              {skill.icon ? (
                                <img
                                  src={skill.icon}
                                  alt={skill.name}
                                  loading="lazy"
                                  className="w-[18px] h-[18px] object-contain"
                                />
                              ) : (
                                <span className="text-[10px] text-text-dim">{skill.name}</span>
                              )}
                            </HoverTooltip>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Trade actions - only show when logged in */}
                {loggedIn &&
                  (() => {
                    const status = actionStatus[l.id]
                    const isActing = status === 'pending'
                    const isDone = status === 'success' || status === 'failed'
                    const label = l.instantBuyout
                      ? isActing
                        ? 'Traveling...'
                        : isDone
                          ? status === 'success'
                            ? 'Success'
                            : 'Failed'
                          : 'Travel to Hideout'
                      : isActing
                        ? 'Whispering...'
                        : isDone
                          ? status === 'success'
                            ? 'Whisper Sent'
                            : 'Failed'
                          : 'Whisper'
                    return (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (isActing || !queryId) return
                          setActionStatus((prev) => ({ ...prev, [l.id]: 'pending' }))
                          try {
                            if (l.instantBuyout) {
                              await window.api.visitHideout(queryId, l.id, league)
                            } else {
                              await window.api.whisperSeller(queryId, l.id, league)
                            }
                            setActionStatus((prev) => ({ ...prev, [l.id]: 'success' }))
                          } catch {
                            setActionStatus((prev) => ({ ...prev, [l.id]: 'failed' }))
                          }
                        }}
                        disabled={isActing}
                        title={l.instantBuyout ? 'Visit hideout via trade site' : 'Send whisper via trade site'}
                        className="px-2 py-[3px] text-[9px] font-semibold border-none rounded-[3px] shrink-0 whitespace-nowrap"
                        style={{
                          background:
                            status === 'success'
                              ? 'rgba(40,80,40,0.4)'
                              : status === 'failed'
                                ? 'rgba(100,35,35,0.4)'
                                : 'rgba(255,255,255,0.06)',
                          color: status === 'success' ? '#fff' : status === 'failed' ? '#fff' : 'var(--text-dim)',
                          cursor: isActing ? 'default' : 'pointer',
                          opacity: isActing ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isActing && !isDone) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                            e.currentTarget.style.color = 'var(--text)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActing && !isDone) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.color = 'var(--text-dim)'
                          }
                        }}
                      >
                        {label}
                      </button>
                    )
                  })()}

                {/* Expand/collapse chevron (hidden when Open All forces everything expanded) */}
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 text-text-dim pointer-events-none flex transition-opacity duration-150 row-chevron"
                  style={{
                    opacity: openAll ? 0 : isExpanded ? 0.5 : 0,
                  }}
                >
                  {isExpanded ? (
                    <Up size={12} theme="two-tone" fill={['currentColor', 'rgba(255,255,255,0.2)']} />
                  ) : (
                    <Down size={12} theme="two-tone" fill={['currentColor', 'rgba(255,255,255,0.2)']} />
                  )}
                </span>
              </div>

              {/* Expanded item details (also shown for every row in Open All mode) */}
              {isExpanded && l.itemData && (
                <ExpandedListing listing={l} itemClass={itemClass} itemName={itemName} itemRarity={itemRarity} />
              )}
            </div>
          )
        })}
        {total != null && total > listings.length && (
          <div className="px-[10px] py-1 text-[9px] text-text-dim text-center">
            Showing {listings.length} of {total} results
            {onLoadMore && (
              <button
                style={{ marginLeft: 6 }}
                onClick={onLoadMore}
                disabled={loadingMore}
                className="text-[9px] px-[6px] py-[1px] border-none cursor-pointer font-semibold bg-white/[0.06] text-text-dim rounded-[2px] disabled:opacity-40"
                onMouseEnter={(e) => {
                  if (!loadingMore) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                }}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
