import { describe, expect, it } from 'vitest'
import type { ExchangeDetails } from '@shared/contracts/exchange'
import { shouldAutoBulkSearch, shouldShowExchangePanel } from './exchange-view'

const DETAILS: ExchangeDetails = {
  name: 'Chaos Orb',
  pairs: [{ currency: 'divine', rate: 0.0048, volumePerHour: 500000, history: [] }],
}

describe('shouldShowExchangePanel', () => {
  it('shows the panel for a bulk item with resolved details', () => {
    expect(shouldShowExchangePanel({ isBulk: true, details: DETAILS })).toBe(true)
  })

  it('hides it when details did not resolve', () => {
    expect(shouldShowExchangePanel({ isBulk: true, details: null })).toBe(false)
  })

  it('hides it while the details request is still in flight', () => {
    expect(shouldShowExchangePanel({ isBulk: true, details: undefined })).toBe(false)
  })

  it('hides it for a non-bulk item even with details', () => {
    expect(shouldShowExchangePanel({ isBulk: false, details: DETAILS })).toBe(false)
  })

  it('hides it while the bulk check is still pending', () => {
    expect(shouldShowExchangePanel({ isBulk: null, details: DETAILS })).toBe(false)
  })
})

describe('shouldAutoBulkSearch', () => {
  it('skips the auto search when the panel will take over', () => {
    expect(shouldAutoBulkSearch({ isBulk: true, details: DETAILS })).toBe(false)
  })

  it('still auto-searches a bulk item whose details did not resolve', () => {
    expect(shouldAutoBulkSearch({ isBulk: true, details: null })).toBe(true)
  })

  it('waits rather than searching while details are in flight', () => {
    expect(shouldAutoBulkSearch({ isBulk: true, details: undefined })).toBe(false)
  })

  it('is irrelevant for non-bulk items', () => {
    expect(shouldAutoBulkSearch({ isBulk: false, details: null })).toBe(false)
  })
})
