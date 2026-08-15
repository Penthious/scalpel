import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { RemovalPreview } from '@shared/types'
import { checkRemovable } from '@shared/filter-removal'
import { getActiveMatch } from '../../shared/activeMatch'
import { ItemSummary } from '../../components/ItemSummary'
import { FilterBlockEditor, type SaveState } from './filter-block-editor'
import { HideItemSection } from './filter-block-editor/HideItemSection'
import { TierNavigator, switchableSiblings } from './TierNavigator'
import { getItemIconUrl, RARITY_COLORS } from './filter-panel/constants'
import { CollapsedHeader } from './filter-panel/CollapsedHeader'
import { SaveButton } from './filter-panel/SaveButton'
import { BreakpointEditor } from './filter-panel/BreakpointEditor'
import { UniquesForBase } from './filter-panel/UniquesForBase'
import { ZoneToggle } from './filter-panel/ZoneToggle'
import type { FilterPanelProps, PendingThreshold } from './filter-panel/types'
import { useBreakpointHoming } from './filter-panel/useBreakpointHoming'

export function FilterPanel({
  data,
  selectedBpIndex,
  onSelectBp,
  selectedQualityBpIndex,
  onSelectQualityBp,
  selectedStrandBpIndex,
  onSelectStrandBp,
  onClose,
  onOpenAudit,
  onOpenTools,
  onOpenDustExplore,
  onOpenDivExplore,
  onOpenWiki,
  onOpenPoeDb,
  onOpenNinja,
  tierSisterOpen,
  onToggleTierSister,
  tierSisterSide,
  currentZone,
  useCurrentZoneAreaLevel,
  onToggleZoneAreaLevel,
}: FilterPanelProps): JSX.Element {
  const { item, stackBreakpoints, qualityBreakpoints, strandBreakpoints } = data
  const hasBreakpoints = stackBreakpoints && stackBreakpoints.length > 1
  const hasQualityBreakpoints = qualityBreakpoints && qualityBreakpoints.length > 1
  const hasStrandBreakpoints = strandBreakpoints && strandBreakpoints.length > 1
  const [blockSaveState, setBlockSaveState] = useState<SaveState | null>(null)
  const handleSaveStateChange = useCallback((s: SaveState) => setBlockSaveState(s), [])
  const [pendingThreshold, setPendingThreshold] = useState<PendingThreshold | null>(null)
  const [thresholdSaving, setThresholdSaving] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [thresholdError, setThresholdError] = useState<string | null>(null)

  const hasPendingThreshold = pendingThreshold !== null
  const isDirty = (blockSaveState?.isDirty ?? false) || hasPendingThreshold
  const isSaving = (blockSaveState?.saving ?? false) || thresholdSaving
  const isSaved = !isDirty && !isSaving && ((blockSaveState?.saved ?? false) || false)

  const handleSave = async (): Promise<void> => {
    if (blockSaveState?.isDirty) blockSaveState.save()
    if (pendingThreshold) {
      setThresholdSaving(true)
      setThresholdError(null)
      const api =
        pendingThreshold.type === 'stack'
          ? window.api.updateStackThresholds
          : pendingThreshold.type === 'strand'
            ? window.api.updateStrandThresholds
            : window.api.updateQualityThresholds
      const result = await api(pendingThreshold.oldValue, pendingThreshold.newValue, JSON.stringify(item))
      setThresholdSaving(false)
      if (result.ok) {
        setPendingThreshold(null)
      } else {
        setThresholdError(result.error ?? 'Failed to update threshold')
      }
    }
  }

  useBreakpointHoming(hasBreakpoints, stackBreakpoints, item.stackSize, onSelectBp)
  useBreakpointHoming(hasQualityBreakpoints, qualityBreakpoints, item.quality, onSelectQualityBp)
  useBreakpointHoming(hasStrandBreakpoints, strandBreakpoints, item.memoryStrands ?? 0, onSelectStrandBp)

  const { match: displayMatch, tierGroup: activeTierGroup } = getActiveMatch(
    data,
    selectedBpIndex,
    selectedQualityBpIndex,
    selectedStrandBpIndex,
  )

  // Continue chain for the active primary: every matching block up to and
  // including the primary, in file order. `undefined` when the primary isn't
  // in `data.matches` (e.g. a breakpoint override picked a match out of band)
  // -- downstream callers fall back to single-block behavior in that case.
  const activeChain = ((): typeof data.matches | undefined => {
    if (!displayMatch) return undefined
    const idx = data.matches.findIndex((m) => m.blockIndex === displayMatch.blockIndex)
    if (idx < 0) return undefined
    return data.matches.slice(0, idx + 1)
  })()
  const continuePreamble = activeChain?.slice(0, -1).map((m) => m.block) ?? []

  // Where this item lands once the active tier stops naming it. Resolved in the
  // main process: the renderer's match list stops at the active block, so it has
  // no view of what follows. `undefined` while in flight, `null` when nothing
  // else catches the item.
  const [preview, setPreview] = useState<RemovalPreview | undefined>(undefined)
  // Keyed by value, not object identity, so a fresh `item` reference per render
  // cannot fire an IPC round trip per render.
  const itemJson = useMemo(() => JSON.stringify(item), [item])
  const activeBlockIndex = displayMatch?.blockIndex
  useEffect(() => {
    if (activeBlockIndex === undefined) return
    let cancelled = false
    setPreview(undefined)
    window.api
      .previewFallThrough(activeBlockIndex, itemJson)
      .then((r) => {
        if (!cancelled) setPreview(r)
      })
      .catch(() => {
        if (!cancelled)
          setPreview({
            landsOn: null,
            tierCount: 0,
            skipped: [],
            hideDestination: null,
            alreadyHidden: false,
            flipTier: null,
          })
      })
    return () => {
      cancelled = true
    }
  }, [activeBlockIndex, itemJson])

  const removalCheck = displayMatch ? checkRemovable(displayMatch.block, item.baseType) : undefined
  // The navigator hosts the removal row. It renders whenever it has something to
  // offer -- which now includes a lone tier, since the Remove row is itself a
  // choice. It still bails when there is no tier group at all (no tier tag, or
  // siblings differing only by threshold so the slider owns navigation), and for
  // a locked exception tier with no removal available. Those cases fall back to
  // the standalone card so the capability never silently vanishes.
  const navigatorWillRender = !!activeTierGroup && (switchableSiblings(activeTierGroup).length > 0 || !!removalCheck)

  const iconUrl = getItemIconUrl(item)
  const rarityColor = RARITY_COLORS[item.rarity] ?? '#c8c8c8'

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      <CollapsedHeader
        collapsed={collapsed}
        iconUrl={iconUrl}
        itemName={item.name}
        baseType={item.baseType}
        rarityColor={rarityColor}
        isDirty={isDirty}
        isSaving={isSaving}
        isSaved={isSaved}
        onSave={handleSave}
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        onScroll={() => {
          if (scrollRef.current) setCollapsed(scrollRef.current.scrollTop > 60)
        }}
        className="flex-1 overflow-y-auto"
      >
        <ItemSummary
          item={item}
          priceInfo={data.priceInfo}
          chaosPerDivine={data.chaosPerDivine}
          divineGraph={data.divineGraph}
          onRecolor={onOpenTools}
          onDustExplore={onOpenDustExplore}
          onDivExplore={onOpenDivExplore}
          onOpenWiki={onOpenWiki}
          onOpenPoeDb={onOpenPoeDb}
          onOpenNinja={onOpenNinja}
          rightSlot={<SaveButton isDirty={isDirty} isSaving={isSaving} isSaved={isSaved} onSave={handleSave} />}
          extraRow={
            <ZoneToggle currentZone={currentZone} enabled={useCurrentZoneAreaLevel} onChange={onToggleZoneAreaLevel} />
          }
          flush
        />
        <div className="p-3 flex flex-col gap-3">
          {activeTierGroup && (
            <TierNavigator
              key={activeTierGroup.currentTier}
              group={activeTierGroup}
              baseType={item.baseType}
              item={item}
              onMoved={() => {}}
              preview={preview}
              removal={removalCheck}
              onRemoved={() => {}}
              continuePreamble={continuePreamble}
            />
          )}
          {!activeTierGroup && (
            <div
              className="flex items-center gap-2 px-[10px] py-2 rounded text-[11px] text-text-dim"
              style={{ background: 'rgba(0,0,0,0.25)' }}
            >
              <span className="font-semibold text-accent">
                {displayMatch?.block.tierTag
                  ? (() => {
                      const t = displayMatch.block.tierTag!.tier
                      const m = t.match(/^t(\d+)(.*)/)
                      return m
                        ? `T${m[1]}${m[2] ? ` ${m[2]}` : ''}`
                        : t === 'exhide'
                          ? 'Hidden'
                          : t === 'restex'
                            ? 'Rest'
                            : t
                    })()
                  : `Block #${displayMatch?.blockIndex ?? '?'}`}
              </span>
              {displayMatch?.block.tierTag?.typePath && (
                <span className="text-[10px]">{displayMatch.block.tierTag.typePath.replace(/->/g, ' > ')}</span>
              )}
            </div>
          )}

          {/* Removal lives in the tier dropdown when there is one. Without a
           *  switchable sibling set the dropdown never renders, so it falls back
           *  to its own card here rather than disappearing. */}
          {!navigatorWillRender && displayMatch && <HideItemSection item={item} preview={preview} />}

          {displayMatch?.block.conditions.some((c) => c.type === 'Rarity' && c.values.some((v) => v === 'Unique')) && (
            <UniquesForBase baseType={item.baseType} itemClass={item.itemClass} />
          )}

          {hasBreakpoints && (
            <BreakpointEditor
              label="Stack Size Thresholds"
              thresholdType="stack"
              startValue={1}
              minBoundary={2}
              breakpoints={stackBreakpoints}
              selectedBpIndex={selectedBpIndex}
              onSelectBp={onSelectBp}
              onPendingChange={setPendingThreshold}
            />
          )}

          {hasQualityBreakpoints && (
            <BreakpointEditor
              label="Quality Thresholds"
              thresholdType="quality"
              suffix="%"
              startValue={0}
              minBoundary={1}
              breakpoints={qualityBreakpoints}
              selectedBpIndex={selectedQualityBpIndex}
              onSelectBp={onSelectQualityBp}
              onPendingChange={setPendingThreshold}
            />
          )}

          {hasStrandBreakpoints && (
            <BreakpointEditor
              label="Strand Thresholds"
              thresholdType="strand"
              startValue={0}
              minBoundary={1}
              breakpoints={strandBreakpoints}
              selectedBpIndex={selectedStrandBpIndex}
              onSelectBp={onSelectStrandBp}
              onPendingChange={setPendingThreshold}
            />
          )}

          {thresholdError && <div className="text-[10px] text-danger px-1 py-0">{thresholdError}</div>}

          {displayMatch ? (
            <div className="bg-bg-card rounded">
              <FilterBlockEditor
                key={`${item.name}-${item.baseType}-${displayMatch.blockIndex}-${selectedBpIndex}`}
                match={displayMatch}
                chain={activeChain && activeChain.length > 1 ? activeChain : undefined}
                itemClass={item.itemClass}
                item={item}
                onClose={onClose}
                onSaveStateChange={handleSaveStateChange}
                tierGroup={activeTierGroup}
                onOpenAudit={onOpenAudit}
                tierSisterOpen={tierSisterOpen}
                onToggleTierSister={onToggleTierSister}
                tierSisterSide={tierSisterSide}
              />
            </div>
          ) : (
            <div className="p-3 bg-bg-card rounded text-text-dim text-center text-[12px]">
              No filter blocks match this item - it uses default visibility.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
