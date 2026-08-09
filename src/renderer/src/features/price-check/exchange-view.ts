/** Whether the Currency Exchange dashboard takes over the results area, and
 *  whether the bulk trade search should still fire automatically.
 *
 *  Three-state `details` is load-bearing: `undefined` means the request is still
 *  in flight, `null` means it resolved with nothing. Auto-searching on
 *  `undefined` would race -- we'd burn a trade request and then hide its results
 *  a moment later when the panel took over. */
import type { ExchangeDetails } from '@shared/contracts/exchange'

export interface ExchangeViewState {
  /** null while the bulk-routing check is still running. */
  isBulk: boolean | null
  /** undefined while in flight, null when there's no exchange data. */
  details: ExchangeDetails | null | undefined
}

export function shouldShowExchangePanel({ isBulk, details }: ExchangeViewState): boolean {
  return isBulk === true && details != null
}

/** Only bulk items that resolved to no exchange data auto-search. Everything
 *  else either has the panel, is still deciding, or is on the regular search
 *  path. */
export function shouldAutoBulkSearch({ isBulk, details }: ExchangeViewState): boolean {
  return isBulk === true && details === null
}
