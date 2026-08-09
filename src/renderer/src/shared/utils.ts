export { getItemIcon } from '../../../plugin-sdk/src/runtime-helpers/get-item-icon'

export function formatPrice(value: number): string {
  if (value >= 1000) return `${parseFloat((value / 1000).toFixed(1))}k`
  if (value >= 10) return String(Math.round(value))
  if (value >= 1) return String(parseFloat(value.toFixed(1)))
  return String(parseFloat(value.toFixed(2)))
}

/** Promote a chaos-denominated price to divine when it clears one divine,
 *  returning the formatted display text and the currency trade-API key. Single
 *  source of truth for PriceChip, the sparkline mini-chips, and the sparkline
 *  current-price footer so they all format identically. `divineValue` (when the
 *  caller already knows the exact divine price) takes precedence over deriving
 *  it from `chaosPerDivine`; `version` selects the low-tier currency (PoE1
 *  chaos, PoE2 exalted). `noPromote` pins the result to the baseline currency,
 *  used by the pair-currency display (Divine Orb priced in ex/chaos). */
export function promoteChaos(
  chaosValue: number,
  chaosPerDivine: number | undefined,
  version: number,
  divineValue?: number | null,
  noPromote?: boolean,
): { text: string; currencyKey: string } {
  const useDivine =
    !noPromote &&
    (divineValue != null
      ? divineValue >= 1
      : chaosPerDivine != null && chaosPerDivine > 0 && chaosValue >= chaosPerDivine)
  return {
    text: useDivine
      ? formatPrice(divineValue != null && divineValue >= 1 ? divineValue : chaosValue / chaosPerDivine!)
      : formatPrice(chaosValue),
    currencyKey: useDivine ? 'divine' : version === 2 ? 'exalted' : 'chaos',
  }
}

export function formatDust(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return String(value)
}

/** Compact hourly exchange volume. These run to hundreds of thousands and the
 *  exact figure carries no decision value -- only the order of magnitude, which
 *  is what tells you whether the exchange will actually fill your order. */
export function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return `${Math.round(value)}`
}

/** Rates at or above this format as decimals; below it they flip to 1/N.
 *  formatPrice's sub-1 branch keeps two decimal places, which still carries two
 *  significant figures down to 0.10 but degrades fast under it -- 0.036 becomes
 *  "0.04" and 0.004779 becomes "0". Above the threshold the decimal is both
 *  accurate and the more natural read ("0.98 divine" beats "1/1"). */
const RECIPROCAL_BELOW = 0.1

/** Format an exchange rate for display. At or above RECIPROCAL_BELOW this is
 *  formatPrice. Under it the decimal form collapses to useless, so we flip to
 *  the reciprocal the way poe.ninja itself presents it -- its Orb of Annulment
 *  page reads "1.0 Divine Orb / 20", not "0.049". Mirrors the 1/N idiom
 *  NinjaPriceChip already uses for the pair-currency chip, so the dashboard and
 *  the header chip never disagree. */
export function formatRate(rate: number): string {
  if (rate >= RECIPROCAL_BELOW || rate <= 0) return formatPrice(rate)
  return `1/${Math.round(1 / rate)}`
}

/** Alternating ("zebra") row background: even rows get a faint tint, odd rows
 *  are transparent. Default even tint is the common rgba(255,255,255,0.02); pass
 *  evenBg for rows that use a different tint (e.g. 0.03). */
export function zebraRowBg(index: number, evenBg = 'rgba(255,255,255,0.02)'): string {
  return index % 2 === 0 ? evenBg : 'transparent'
}

/** Strip Electron's IPC rejection wrapper ("Error invoking remote method
 *  'foo': Error: <our message>") so users see just the message we threw in
 *  the main process, not the plumbing. */
export function stripIpcErrorWrapper(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
