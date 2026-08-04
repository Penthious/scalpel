// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { ScryingOrbButton } from './ScryingOrbButton'

function installApi(overrides: Record<string, unknown> = {}): void {
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    getSettings: vi.fn(async () => ({ activeProfile: { league: 'Settlers' }, poeVersion: 1 })),
    tradeSearch: vi.fn(async () => ({
      total: 3,
      listings: [{ price: { amount: 5, currency: 'chaos' } }],
      queryId: 'abc123',
      remainingIds: [],
    })),
    openExternal: vi.fn(),
    ...overrides,
  }
}

// Each test that clicks (issues a tradeSearch) uses its own map/area so the
// module-level session cache in ScryingOrbButton.tsx -- intentionally shared
// across mounts within a session -- doesn't leak a cached result between cases.
describe('ScryingOrbButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    installApi()
  })

  it('resolves "Dunes Map" to the Dunes area and renders the button', () => {
    const { getByRole } = render(<ScryingOrbButton mapName="Dunes Map" />)
    expect(getByRole('button').textContent).toBe('Check Scrying Orb Price')
  })

  it('renders nothing for a map with no SCRYING_ORB_AREAS entry', () => {
    const { container, queryByRole } = render(<ScryingOrbButton mapName="Not A Real Map" />)
    expect(queryByRole('button')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('prices the area on the first click without opening the trade site', async () => {
    const { getByRole, findByText } = render(<ScryingOrbButton mapName="Estuary Map" />)
    fireEvent.click(getByRole('button'))
    await findByText('3 listed')
    expect(window.api.tradeSearch).toHaveBeenCalledWith(
      { name: 'Scrying Orb', baseType: 'Scrying Orb', itemClass: 'Stackable Currency', rarity: 'Currency' },
      [{ id: 'misc.scrying_area', text: 'Estuary', value: null, min: null, max: null, enabled: true, type: 'misc' }],
    )
    expect(window.api.openExternal).not.toHaveBeenCalled()
  })

  it('opens the trade site on the second click without searching again', async () => {
    const { getByRole, findByText } = render(<ScryingOrbButton mapName="Fields Map" />)
    const button = getByRole('button')
    fireEvent.click(button)
    await findByText('3 listed')
    fireEvent.click(button)
    await waitFor(() => expect(window.api.openExternal).toHaveBeenCalledTimes(1))
    expect(window.api.openExternal).toHaveBeenCalledWith('https://www.pathofexile.com/trade/search/Settlers/abc123')
    expect(window.api.tradeSearch).toHaveBeenCalledTimes(1)
  })

  it('leaves the button in the error state and opens nothing when the search throws', async () => {
    installApi({
      tradeSearch: vi.fn(async () => {
        throw new Error('boom')
      }),
    })
    const { getByRole, findByText } = render(<ScryingOrbButton mapName="Grotto Map" />)
    fireEvent.click(getByRole('button'))
    await findByText('search failed')
    expect(window.api.openExternal).not.toHaveBeenCalled()
  })
})
