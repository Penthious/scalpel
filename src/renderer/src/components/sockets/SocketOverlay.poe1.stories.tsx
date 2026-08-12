import type { Meta, StoryObj } from '@storybook/react'
import { SocketOverlayPoe1, type SocketSpec } from './SocketOverlay.poe1'
import { initItemClassMaps } from '../../shared/constants'

// The overlay lays sockets out from the item class -> slot size map, which the
// overlay app fills on launch. Storybook has no such bootstrap, so fill it here
// or every base falls back to the generic 2x2 footprint.
initItemClassMaps(1)

const meta: Meta = { title: 'TradeResults/SocketOverlayPoe1' }
export default meta

/** Clipboard-style socket spec: colours in one word are one link group,
 *  space-separated words are separate groups. "RGB WW" is a 3-link + a 2-link. */
function group(spec: string): SocketSpec[] {
  return spec.split(' ').flatMap((grp, gi) => [...grp].map((sColour) => ({ sColour, group: gi })))
}

const CASES: Array<{ label: string; itemClass: string; itemName: string; sockets: SocketSpec[] }> = [
  // The bug: a belt is 2x1, so both abyssal sockets belong on one row.
  { label: 'Belts 2x1 - A A', itemClass: 'Belts', itemName: 'Darkness Enthroned', sockets: group('A A') },
  { label: 'Belts 2x1 - A', itemClass: 'Belts', itemName: 'Stygian Vise', sockets: group('A') },
  { label: 'Wands 1x3 - R-G-B', itemClass: 'Wands', itemName: 'Wand', sockets: group('RGB') },
  { label: 'One Hand Swords 2x3 - R-G-B', itemClass: 'One Hand Swords', itemName: 'Sword', sockets: group('RGB') },
  { label: 'Boots 2x2 - W A', itemClass: 'Boots', itemName: 'Bubonic Trail', sockets: group('W A') },
  { label: 'Body Armours 2x3 - 6L', itemClass: 'Body Armours', itemName: 'Astral Plate', sockets: group('RGBRGB') },
]

/** Every socket layout the PoE1 overlay produces, on the item footprint that
 *  drives it. The belt cases are the regression guard: two abyssal sockets sit
 *  side by side in its 2x1 slot instead of stacking off the bottom of the art. */
export const Layouts: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-6 text-text">
      {CASES.map((c) => (
        <div key={c.label} className="flex flex-col items-center gap-2 w-[150px]">
          <div className="relative w-[100px] h-[110px] bg-black/30 rounded">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <SocketOverlayPoe1
                sockets={c.sockets}
                itemClass={c.itemClass}
                itemName={c.itemName}
                sz={20}
                gap={5}
                linkPx={5}
              />
            </div>
          </div>
          <div className="text-[10px] text-text-dim text-center">{c.label}</div>
        </div>
      ))}
    </div>
  ),
}
