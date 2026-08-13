import { useLayoutEffect, useRef, useState } from 'react'
import type { ExchangeDetails } from '@shared/contracts/exchange'
import { CurrencyIcon } from '../../shared/CurrencyIcon'
import { ExternalLinkButton } from '../../shared/ExternalLinkButton'
import { RateChart } from '../../shared/RateChart'
import { angePortrait, faustusPortrait } from '../../shared/icons'
import { formatRate } from '../../shared/utils'

interface Props {
  details: ExchangeDetails
  /** Which in-game vendor runs this exchange -- picks the portrait and the copy. */
  vendor: 'Faustus' | 'Ange'
  /** Clipboard stack size, so we can show what the whole stack is worth. */
  stackSize?: number
  onOpenNinja?: () => void
}

/** The Currency Exchange dashboard: what the item actually trades for at
 *  Faustus/Ange, how liquid that market is, and where the rate has been all
 *  league. Replaces the bulk trade listings, which are near-useless for items
 *  you'd never whisper a stranger about. */
export function ExchangePanel({ details, vendor, stackSize, onOpenNinja }: Props): JSX.Element {
  const [pairIdx, setPairIdx] = useState(0)
  // Normalization guarantees at least one pair, and a stale index can only
  // survive a details swap, which remounts via the key in PriceCheck.
  const pair = details.pairs[pairIdx] ?? details.pairs[0]
  const portrait = vendor === 'Ange' ? angePortrait : faustusPortrait

  // The switch highlight is a single sliding thumb, positioned from the active
  // segment's measured box rather than from an equal-width assumption: with the
  // "show currency names" setting on, CurrencyIcon renders text labels, so
  // "chaos" and "divine" produce segments of different widths.
  const segRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const seg = segRefs.current[pairIdx]
    if (seg) setThumb({ left: seg.offsetLeft, width: seg.offsetWidth })
  }, [pairIdx, details.pairs.length])

  return (
    // shrink-0 is load-bearing: the panel sits in the same flex column as
    // BulkListings, which carries flex-1. Without it the listings claim space by
    // squeezing the panel below its content height, and the panel's own
    // overflow-hidden then clips the chart off (#568).
    <div className="relative flex flex-col my-2 rounded-lg bg-bg-card overflow-hidden shrink-0">
      {/* Hero strip: the vendor and the numbers that matter, on a darker band so
       *  it reads as the header of the card. items-end mounts the portrait flush
       *  to the strip's bottom edge -- the art is cropped at the bottom for
       *  exactly that, so any gap under it would look like a mistake. */}
      {/* pt-2 with no pb is what lets the portrait breathe at the top while still
       *  mounting flush at the bottom: the strip's height is driven by the
       *  portrait, so without the padding it would touch both edges. */}
      <div className="flex items-end gap-3 bg-black/20 px-3 pt-2">
        {/* Sized by HEIGHT, not width: Faustus is 198x180 and Ange 179x180, so
         *  matching widths would give the two vendors different strip heights. */}
        <img src={portrait} alt="" className="h-[70px] w-auto shrink-0 block pointer-events-none select-none" />

        {/* Two side-by-side columns, not two stacked rows: title and prices on
         *  the left, controls on the right. Sharing rows put the controls'
         *  height into the text's flow -- the pair switch carries the poe.ninja
         *  link stacked beneath it, and those two rows pushed the title and the
         *  chips down on every currency that has a switch, while Chaos and
         *  Divine (single pair, no switch) stayed put. As its own column the
         *  cluster can grow without moving anything on the left.
         *  pb-2 sits on this row rather than the strip because the strip can
         *  carry no bottom padding -- the portrait has to mount flush -- and
         *  without it a hero taller than the portrait leaves the price chip
         *  resting on the chart's top edge. */}
        <div className="flex-1 min-w-0 self-stretch flex gap-2 pb-2">
          <div className="flex-1 min-w-0 flex flex-col">
            {/* truncate + min-w-0: the strip's height is meant to be governed by
             *  the portrait, so the title must never wrap. On a narrow overlay it
             *  ellipsises instead of pushing the chart down -- at 16px an
             *  unwrapped title grew the strip from 78px to 126px at 260px wide. */}
            <div className="min-w-0 truncate text-[16px] font-semibold text-[#ffc83c] leading-tight">
              {vendor} Exchange Pricing
            </div>

            {/* Prices sit in chips a step darker than the strip (bg-black/30 over
             *  the strip's /20), matching InfoChip's shape so they read as part of
             *  the same system. Volume lives in the chart's hover tooltip now --
             *  it is context for a point in time, not a headline number. */}
            <div className="flex-1 flex items-center">
              <div className="flex items-center gap-[6px] flex-wrap">
                <div className="inline-flex items-center gap-[5px] bg-black/30 rounded-full px-[10px] py-[3px]">
                  <span data-testid="exchange-hero-rate" className="text-xl font-bold leading-none">
                    {formatRate(pair.rate)}
                  </span>
                  <CurrencyIcon name={pair.currency} className="w-4 h-4" />
                </div>

                {stackSize != null && stackSize > 1 && (
                  // Same chip metrics as the unit price -- padding, value size and
                  // icon -- so the stack total reads as its equal. The "Nx" prefix
                  // is a label, not a number, so it stays small and unweighted.
                  <div className="inline-flex items-center gap-[5px] bg-black/30 rounded-full px-[10px] py-[3px]">
                    <span className="text-[11px] font-normal leading-none text-text-dim">{stackSize}x</span>
                    <span data-testid="exchange-stack" className="text-xl font-bold leading-none">
                      {formatRate(pair.rate * stackSize)}
                    </span>
                    <CurrencyIcon name={pair.currency} className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Control column, top-right of the hero: the pair switch with the
           *  poe.ninja link stacked under it. The link lives here rather than
           *  under the chart so the card ends on the graph, and stacked rather
           *  than beside the switch because side by side the two ate the whole
           *  title row at a 260px overlay. */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {details.pairs.length > 1 && (
              // Segmented switch rather than separate pills: one recessed track
              // with a single thumb that slides between positions, so the two
              // read as one control rather than two buttons.
              <div className="relative flex items-center shrink-0 rounded-full bg-black/40 p-[2px]">
                <div
                  data-testid="exchange-pair-thumb"
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    left: thumb?.left ?? 0,
                    width: thumb?.width ?? 0,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.16)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
                    transition: 'left 180ms cubic-bezier(0.4, 0, 0.2, 1), width 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                    // Hidden until measured so it can't flash at the origin.
                    opacity: thumb ? 1 : 0,
                    pointerEvents: 'none',
                  }}
                />
                {details.pairs.map((p, i) => (
                  <button
                    key={p.currency}
                    ref={(el) => {
                      segRefs.current[i] = el
                    }}
                    type="button"
                    data-testid="exchange-pair-pill"
                    aria-label={`Show rate in ${p.currency}`}
                    aria-pressed={i === pairIdx}
                    onClick={() => setPairIdx(i)}
                    className="relative z-[1] flex items-center justify-center px-[7px] py-[2px] rounded-full border-none cursor-pointer"
                    style={{
                      background: 'transparent',
                      opacity: i === pairIdx ? 1 : 0.45,
                      transition: 'opacity 180ms ease',
                    }}
                  >
                    <CurrencyIcon name={p.currency} className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
            {onOpenNinja && (
              <ExternalLinkButton
                label="View on Ninja"
                title="Open the poe.ninja page for this item in your browser"
                onClick={onOpenNinja}
              />
            )}
          </div>
        </div>
      </div>

      {/* Chart runs the full card width -- it is the thing the issue asked for,
       *  and the hero strip above already carries the framing. */}
      {pair.history.length === 0 ? (
        // RateChart returns null on an empty series (no line to project), which
        // would leave a blank gap where the graph belongs -- and no date/rate
        // readout either, since that lives inside RateChart itself. Live data
        // always carries history, so this is a low-probability fallback, not
        // the common case.
        <div className="h-[110px] flex items-center justify-center text-[11px] text-text-dim">No price history yet</div>
      ) : (
        <RateChart points={pair.history} currency={pair.currency} height={110} />
      )}
    </div>
  )
}
