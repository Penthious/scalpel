// @vitest-environment jsdom

import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Chrome } from './Chrome'

describe('Chrome pin toggle', () => {
  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api
  })

  it('loads pin state, renders the toggle, and persists a click', async () => {
    const setOverlayPinned = vi.fn()
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      getOverlayPinned: vi.fn(async () => false),
      setOverlayPinned,
    }
    const { getByTitle } = render(
      <Chrome onClose={() => {}}>
        <div />
      </Chrome>,
    )
    const button = await waitFor(() => getByTitle('Pin: keep open when pressing Esc'))
    fireEvent.click(button)
    expect(setOverlayPinned).toHaveBeenCalledWith(true)
    await waitFor(() => getByTitle('Unpin (Esc closes this window again)'))
  })

  it('renders without the toggle (and without crashing) when the bridge is absent', () => {
    const { container, queryByTitle } = render(
      <Chrome onClose={() => {}}>
        <div data-testid="body" />
      </Chrome>,
    )
    expect(container.querySelector('[data-testid="body"]')).not.toBeNull()
    expect(queryByTitle('Pin: keep open when pressing Esc')).toBeNull()
  })
})

describe('Chrome title drag handle', () => {
  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api
  })

  // jsdom drops -webkit-app-region from the CSSOM, so the drag topology is
  // pinned structurally: the logo img sits directly in the drag region, so
  // sharing its parent means draggable, and the headerContent wrapper (the
  // no-drag zone) means not.
  it('renders the title as a drag-region sibling of the logo, not in the no-drag wrapper', () => {
    const { getByText, container } = render(
      <Chrome onClose={() => {}} title="Now Playing" headerContent={<button type="button">Tab A</button>}>
        <div />
      </Chrome>,
    )
    const logoParent = container.querySelector('img')?.parentElement
    expect(getByText('Now Playing').parentElement).toBe(logoParent)
    expect(getByText('Tab A').parentElement).not.toBe(logoParent)
  })

  it('makes the header bar text-unselectable', () => {
    const { getByText } = render(
      <Chrome onClose={() => {}} title="Now Playing">
        <div />
      </Chrome>,
    )
    const header = getByText('Now Playing').closest('.select-none')
    expect(header).not.toBeNull()
  })
})
