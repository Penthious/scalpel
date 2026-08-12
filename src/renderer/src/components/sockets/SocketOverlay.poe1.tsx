import socketRed from '../../assets/sockets/socket-red.png'
import socketGreen from '../../assets/sockets/socket-green.png'
import socketBlue from '../../assets/sockets/socket-blue.png'
import socketColorless from '../../assets/sockets/socket-colorless.png'
import socketAbyss from '../../assets/sockets/socket-abyss.png'
import socketLink from '../../assets/sockets/socket-link.png'
import { getItemSize } from '../../shared/item-display'

export type SocketSpec = { group: number; sColour: string }

const SOCKET_IMGS: Record<string, string> = {
  R: socketRed,
  G: socketGreen,
  B: socketBlue,
  W: socketColorless,
  A: socketAbyss,
  Ab: socketAbyss,
}

/**
 * PoE1 socket grid rendered on top of an item art tile. Consumers in
 * TradeListings (sz=12, gap=3, linkPx=4) and ExpandedListing (sz=20, gap=5,
 * linkPx=5) pass the size they want; the layout, link drawing and colours are
 * shared so the two views can't drift.
 *
 * Sockets fill the item's inventory footprint the way the game draws them: a
 * 1-wide base (wand, dagger, rapier) stacks them in a column, anything 2 wide
 * fills L-R / R-L rows. Driving that off the real slot width -- rather than a
 * hardcoded armour-class list -- is what puts a belt's two abyssal sockets side
 * by side in its 2x1 slot instead of stacking them past its bottom edge.
 */
export function SocketOverlayPoe1({
  sockets,
  itemClass,
  itemName,
  sz,
  gap,
  linkPx,
}: {
  sockets: SocketSpec[]
  itemClass: string
  itemName: string
  sz: number
  gap: number
  linkPx: number
}): JSX.Element | null {
  const n = sockets.length
  if (n <= 0) return null

  const is1Wide = getItemSize(itemClass, itemName)[0] <= 1

  if (is1Wide || n <= 1) {
    return (
      <>
        {sockets.map((s, si) => {
          const linked = si > 0 && sockets[si - 1].group === s.group
          return (
            <div key={si} className="flex flex-col items-center">
              {linked && (
                <img
                  src={socketLink}
                  alt=""
                  style={{
                    width: linkPx,
                    height: gap,
                    objectFit: 'fill',
                    transform: 'rotate(90deg)',
                    filter: 'brightness(2)',
                  }}
                />
              )}
              {!linked && si > 0 && <div style={{ height: gap }} />}
              <img src={SOCKET_IMGS[s.sColour] ?? socketColorless} alt="" style={{ width: sz, height: sz }} />
            </div>
          )
        })}
      </>
    )
  }

  // Zigzag positions: L-R on even rows, R-L on odd, so links read as one chain.
  const positions: Array<[number, number]> = []
  for (let row = 0; row < Math.ceil(n / 2); row++) {
    if (row % 2 === 0) {
      positions.push([0, row])
      if (positions.length < n) positions.push([1, row])
    } else {
      positions.push([1, row])
      if (positions.length < n) positions.push([0, row])
    }
  }

  const cellW = sz + gap * 2
  const cellH = sz + gap * 2
  const totalW = cellW * 2
  const totalH = cellH * Math.ceil(n / 2)

  return (
    <div className="relative overflow-visible" style={{ width: totalW, height: totalH }}>
      {sockets.map((s, si) => {
        const [col, row] = positions[si]
        const x = col * cellW + gap
        const y = row * cellH + gap

        let linkEl = null
        if (si > 0 && sockets[si - 1].group === s.group) {
          const [pc, pr] = positions[si - 1]
          if (pr === row) {
            linkEl = (
              <img
                key={`l${si}`}
                src={socketLink}
                alt=""
                style={{
                  position: 'absolute',
                  left: Math.min(col, pc) * cellW + gap + sz,
                  top: y + (sz - linkPx) / 2,
                  width: gap * 2,
                  height: linkPx,
                  objectFit: 'fill',
                  filter: 'brightness(2)',
                }}
              />
            )
          } else {
            linkEl = (
              <img
                key={`l${si}`}
                src={socketLink}
                alt=""
                style={{
                  position: 'absolute',
                  left: col * cellW + gap + (sz - gap * 2) / 2,
                  top: Math.min(row, pr) * cellH + gap + sz + (gap * 2 - linkPx) / 2,
                  width: gap * 2,
                  height: linkPx,
                  objectFit: 'fill',
                  transform: 'rotate(90deg)',
                  filter: 'brightness(2)',
                }}
              />
            )
          }
        }

        return [
          linkEl,
          <img
            key={si}
            src={SOCKET_IMGS[s.sColour] ?? socketColorless}
            alt=""
            style={{ position: 'absolute', left: x, top: y, width: sz, height: sz }}
          />,
        ]
      })}
    </div>
  )
}
