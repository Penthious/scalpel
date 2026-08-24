import { beforeEach, describe, expect, it, vi } from 'vitest'

const pinMap = new Map<string, boolean>()
vi.mock('./pin-store', () => ({
  readOverlayPinned: (id: string) => pinMap.get(id),
  writeOverlayPinned: vi.fn((id: string, pinned: boolean) => {
    pinMap.set(id, pinned)
  }),
}))

import { writeOverlayPinned } from './pin-store'
import { getOverlayPinnedForWebContents, seedUserPinned, setOverlayPinnedForWebContents } from './pin'
import { type OverlayState, overlays } from './state'

function fakeState(id: string, wcId: number, defaultUserPinned?: boolean): OverlayState {
  return {
    spec: { id, defaultUserPinned } as unknown as OverlayState['spec'],
    win: {
      isDestroyed: () => false,
      webContents: { id: wcId },
    } as unknown as OverlayState['win'],
    snapGhostActive: false,
    inProgrammaticMove: false,
    programmaticSettleTimer: null,
    isResizing: false,
    wasVisibleBeforeFocusLoss: false,
    persistOverOthers: false,
    userPinned: false,
  }
}

describe('overlay pin accessors', () => {
  beforeEach(() => {
    overlays.clear()
    pinMap.clear()
    vi.clearAllMocks()
  })

  it('seedUserPinned reads the persisted pin for the spec id', () => {
    pinMap.set('cheat-sheets', true)
    const state = fakeState('cheat-sheets', 5)
    seedUserPinned(state)
    expect(state.userPinned).toBe(true)

    const other = fakeState('regex-remote', 6)
    seedUserPinned(other)
    expect(other.userPinned).toBe(false)
  })

  it('seedUserPinned falls back to the spec default when the store has no entry', () => {
    const state = fakeState('plugin-overlay:now-playing', 5, true)
    seedUserPinned(state)
    expect(state.userPinned).toBe(true)
  })

  it('an explicit unpin beats a pinned-by-default spec', () => {
    pinMap.set('plugin-overlay:now-playing', false)
    const state = fakeState('plugin-overlay:now-playing', 5, true)
    seedUserPinned(state)
    expect(state.userPinned).toBe(false)
  })

  it('get resolves the overlay by webContents id', () => {
    const state = fakeState('cheat-sheets', 7)
    state.userPinned = true
    overlays.set('cheat-sheets', state)
    expect(getOverlayPinnedForWebContents(7)).toBe(true)
    expect(getOverlayPinnedForWebContents(99)).toBe(false)
  })

  it('set flips the flag and persists under the spec id', () => {
    const state = fakeState('plugin-overlay:demo', 8)
    overlays.set('plugin-overlay:demo', state)
    setOverlayPinnedForWebContents(8, true)
    expect(state.userPinned).toBe(true)
    expect(writeOverlayPinned).toHaveBeenCalledWith('plugin-overlay:demo', true)
  })

  it('set is a no-op for an unknown sender', () => {
    setOverlayPinnedForWebContents(42, true)
    expect(writeOverlayPinned).not.toHaveBeenCalled()
  })
})
