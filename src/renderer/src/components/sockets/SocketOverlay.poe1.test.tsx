// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SocketOverlayPoe1, type SocketSpec } from './SocketOverlay.poe1'
import { initItemClassMaps } from '../../shared/constants'

// getItemSize reads the class->size map the overlay lays sockets out from.
beforeAll(() => initItemClassMaps(1))

/** Sockets in one group (all linked) unless `groups` says otherwise. */
function sockets(colours: string, groups?: number[]): SocketSpec[] {
  return [...colours].map((sColour, i) => ({ sColour, group: groups?.[i] ?? 0 }))
}

/** Grid-placed socket orbs, in socket order. Link images (the only ones drawn
 *  with objectFit: fill) are absolutely positioned too, so they're filtered out. */
function positioned(container: HTMLElement): Array<{ left: string; top: string }> {
  return [...container.querySelectorAll('img')]
    .filter((img) => img.style.position === 'absolute' && img.style.objectFit !== 'fill')
    .map((img) => ({ left: img.style.left, top: img.style.top }))
}

const props = { sz: 20, gap: 5, linkPx: 5 }

describe('SocketOverlayPoe1', () => {
  // The reported bug: a belt is 2x1, so its abyssal sockets sit side by side in
  // the game. Stacking them in a column ran them off the bottom of the art.
  it('lays a belt (2x1) out side by side, not stacked', () => {
    const { container } = render(
      <SocketOverlayPoe1 sockets={sockets('AA', [0, 1])} itemClass="Belts" itemName="Darkness Enthroned" {...props} />,
    )
    const pos = positioned(container)
    expect(pos).toHaveLength(2)
    expect(pos[0].top).toBe(pos[1].top)
    expect(pos[0].left).not.toBe(pos[1].left)
  })

  // 1-wide bases are the only ones the game stacks vertically.
  it('stacks a wand (1x3) in a column', () => {
    const { container } = render(
      <SocketOverlayPoe1 sockets={sockets('RGB')} itemClass="Wands" itemName="Wand" {...props} />,
    )
    expect(positioned(container)).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(5) // 3 sockets + 2 links
  })

  // A one-hand sword is 2 wide, so 3 sockets zigzag - the old n<=3 rule columned them.
  it('zigzags 3 sockets on a 2-wide one-hand sword', () => {
    const { container } = render(
      <SocketOverlayPoe1 sockets={sockets('RGB')} itemClass="One Hand Swords" itemName="Sword" {...props} />,
    )
    const pos = positioned(container)
    expect(pos).toHaveLength(3)
    expect(pos[0].top).toBe(pos[1].top) // row 0: left, right
    expect(pos[2].top).not.toBe(pos[0].top) // row 1
  })

  it('keeps the 2-wide grid for armour', () => {
    const { container } = render(
      <SocketOverlayPoe1 sockets={sockets('RGBW')} itemClass="Body Armours" itemName="Astral Plate" {...props} />,
    )
    expect(positioned(container)).toHaveLength(4)
  })

  it('renders a single socket without a grid wrapper', () => {
    const { container } = render(
      <SocketOverlayPoe1 sockets={sockets('A')} itemClass="Belts" itemName="Stygian Vise" {...props} />,
    )
    expect(positioned(container)).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('renders nothing when there are no sockets', () => {
    const { container } = render(
      <SocketOverlayPoe1 sockets={[]} itemClass="Belts" itemName="Stygian Vise" {...props} />,
    )
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })
})
