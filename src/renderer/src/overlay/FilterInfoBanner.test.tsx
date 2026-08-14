// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { m } from '@shared/paraglide/messages.js'
import { FilterInfoBanner } from './FilterInfoBanner'

function installApi(hasOnlineSource: boolean): void {
  ;(window as unknown as { api: Partial<typeof window.api> }).api = {
    getOnlineSyncStatus: vi.fn(async () => ({ hasOnlineSource })),
  }
}

const baseProps = {
  updatedOnlineFilters: new Set<string>(),
  checkingUpdate: false,
  updatingFilter: false,
  mergeMessage: null,
  onQuickUpdate: vi.fn(),
  onCheckForUpdate: vi.fn(),
  onFilterUpdated: vi.fn(),
  onMergeMessage: vi.fn(),
  onSetUpdatingFilter: vi.fn(),
  onSetCheckingUpdate: vi.fn(),
}

describe('FilterInfoBanner online-source state', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the guidance message when the online source is missing', async () => {
    installApi(false)
    const { findByText, queryByText } = render(
      <FilterInfoBanner {...baseProps} filterPath={'C:/x/.5regular-local.filter'} />,
    )
    await findByText(m.filterbanner_load_online_to_sync({ name: '.5regular' }))
    expect(queryByText(m.filterbanner_check_for_updates())).toBeNull()
  })

  it('shows Check for Updates when the online source is present', async () => {
    installApi(true)
    const { findByText, queryByText } = render(
      <FilterInfoBanner {...baseProps} filterPath={'C:/x/.5regular-local.filter'} />,
    )
    await findByText(m.filterbanner_check_for_updates())
    expect(queryByText(m.filterbanner_load_online_to_sync({ name: '.5regular' }))).toBeNull()
  })

  it('shows neither for a non-local (hand-made) filter', () => {
    installApi(true)
    const { queryByText } = render(<FilterInfoBanner {...baseProps} filterPath={'C:/x/myfilter.filter'} />)
    expect(queryByText(m.filterbanner_check_for_updates())).toBeNull()
    expect(queryByText(m.filterbanner_load_online_to_sync({ name: 'myfilter' }))).toBeNull()
  })

  it('rechecks when the guidance message is clicked', async () => {
    installApi(false)
    const { findByText } = render(<FilterInfoBanner {...baseProps} filterPath={'C:/x/.5regular-local.filter'} />)
    const msg = await findByText(m.filterbanner_load_online_to_sync({ name: '.5regular' }))
    ;(window.api.getOnlineSyncStatus as ReturnType<typeof vi.fn>).mockClear()
    fireEvent.click(msg)
    await waitFor(() => expect(window.api.getOnlineSyncStatus).toHaveBeenCalled())
  })
})

describe('FilterInfoBanner sync result', () => {
  beforeEach(() => vi.restoreAllMocks())

  // hasUpdate matches by appending '-local' to the ONLINE filter name, so the set
  // holds '.5regular' while the active file is '.5regular-local'.
  const updateProps = {
    ...baseProps,
    filterPath: 'C:/x/.5regular-local.filter',
    updatedOnlineFilters: new Set(['.5regular']),
  }

  it('reports edits that could not be reapplied', async () => {
    installApi(true)
    const onMergeMessage = vi.fn()
    const onQuickUpdate = vi.fn(async () => ({
      ok: true,
      stats: { userOnly: 2, upstreamOnly: 0, bothChanged: 0, added: 0, removed: 0 },
      unresolved: ['Couldn\u2019t re-apply: "Sapphire Ring" is no longer in rings/t1.'],
    }))

    const { findByText } = render(
      <FilterInfoBanner {...updateProps} onQuickUpdate={onQuickUpdate} onMergeMessage={onMergeMessage} />,
    )
    fireEvent.click(await findByText(m.common_update()))

    await waitFor(() => expect(onMergeMessage).toHaveBeenCalledWith(m.filterbanner_edits_not_reapplied({ count: 1 })))
  })

  it('reports the plain reapplied message when nothing failed', async () => {
    installApi(true)
    const onMergeMessage = vi.fn()
    const onQuickUpdate = vi.fn(async () => ({
      ok: true,
      stats: { userOnly: 2, upstreamOnly: 0, bothChanged: 0, added: 0, removed: 0 },
      unresolved: [],
    }))

    const { findByText } = render(
      <FilterInfoBanner {...updateProps} onQuickUpdate={onQuickUpdate} onMergeMessage={onMergeMessage} />,
    )
    fireEvent.click(await findByText(m.common_update()))

    await waitFor(() => expect(onMergeMessage).toHaveBeenCalledWith(m.filterbanner_changes_reapplied({ changes: 2 })))
  })
})
