import { describe, expect, it } from 'vitest'
import type { OverlayAnchor } from '@shared/types'
import {
  type AnchorStore,
  clearPluginOverlayAnchor,
  getPluginOverlayAnchor,
  setPluginOverlayAnchor,
} from './overlay-anchors'

const ANCHOR: OverlayAnchor = { fracX: 0.5, fracY: 0.4, fracW: 0.16, fracH: 0.4 }
const OTHER: OverlayAnchor = { fracX: 0.1, fracY: 0.1, fracW: 0.2, fracH: 0.2 }

function fakeStore(
  initial?: Record<string, OverlayAnchor>,
): AnchorStore & { value: Record<string, OverlayAnchor> | undefined } {
  return {
    value: initial,
    get() {
      return this.value
    },
    set(_key, next) {
      this.value = next
    },
  }
}

describe('plugin overlay anchors', () => {
  it('returns undefined when nothing is stored', () => {
    expect(getPluginOverlayAnchor(fakeStore(), 'calculator')).toBeUndefined()
  })

  it('round-trips an anchor for a plugin id', () => {
    const store = fakeStore()
    setPluginOverlayAnchor(store, 'calculator', ANCHOR)
    expect(getPluginOverlayAnchor(store, 'calculator')).toEqual(ANCHOR)
  })

  it('does not disturb other plugins when writing', () => {
    const store = fakeStore({ other: OTHER })
    setPluginOverlayAnchor(store, 'calculator', ANCHOR)
    expect(getPluginOverlayAnchor(store, 'other')).toEqual(OTHER)
    expect(getPluginOverlayAnchor(store, 'calculator')).toEqual(ANCHOR)
  })

  it('overwrites an existing anchor for the same plugin', () => {
    const store = fakeStore({ calculator: OTHER })
    setPluginOverlayAnchor(store, 'calculator', ANCHOR)
    expect(getPluginOverlayAnchor(store, 'calculator')).toEqual(ANCHOR)
  })

  it('clears only the named plugin', () => {
    const store = fakeStore({ calculator: ANCHOR, other: OTHER })
    clearPluginOverlayAnchor(store, 'calculator')
    expect(getPluginOverlayAnchor(store, 'calculator')).toBeUndefined()
    expect(getPluginOverlayAnchor(store, 'other')).toEqual(OTHER)
  })

  it('clearing an unknown plugin is a no-op and does not write', () => {
    const store = fakeStore()
    clearPluginOverlayAnchor(store, 'never-stored')
    expect(store.value).toBeUndefined()
  })
})
