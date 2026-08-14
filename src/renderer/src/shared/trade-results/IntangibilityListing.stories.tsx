import type { Meta, StoryObj } from '@storybook/react'
import { ExpandedListing } from './ExpandedListing'
import { StatFilterRow } from '../../features/price-check/StatFilterRow'
import type { Listing } from '../trade-types'
import type { StatFilter } from '../../features/price-check/types'

// Shapes taken from /api/trade/fetch on Allflame: an Allflame-crafted ring carries
// an Intangibility property (raw tag form upstream, "67%" as its value), and a ring
// that was never crafted carries none at all (#588).
const listing: Listing = {
  id: 'story-intangible',
  price: { amount: 3, currency: 'divine' },
  account: 'Vesper_Seller',
  online: true,
  instantBuyout: true,
  itemData: {
    name: 'Oblivion Grip',
    baseType: 'Manifold Ring',
    rarity: 'Rare',
    ilvl: 84,
    intangibility: 67,
    explicitMods: ['+42 to maximum Life', '+35% to Fire Resistance'],
  },
}

const meta: Meta<typeof ExpandedListing> = {
  title: 'TradeResults/Intangibility',
  component: ExpandedListing,
  args: { listing, itemClass: 'Rings', itemName: 'Manifold Ring', itemRarity: 'Rare' },
}
export default meta

/** Expanded: the value sits with the item's own properties, not its mods, in the same
 *  green the price-check row uses for it. Listings that were never Allflame-crafted
 *  carry no property and show no line at all. */
export const Expanded: StoryObj<typeof ExpandedListing> = {}

const intangibilityRow: StatFilter = {
  id: 'misc.intangibility',
  text: 'Intangibility',
  value: 67,
  min: null,
  max: 67,
  enabled: false,
  type: 'gem',
}

/** The price-check row: a cap, off by default. Low is good here, so the value
 *  lands in the max box and the min stays open. */
export const FilterRow: StoryObj = {
  render: () => (
    <div className="bg-black/20">
      <StatFilterRow
        f={intangibilityRow}
        i={0}
        rowIdx={0}
        itemRarity="Rare"
        toggleFilter={() => {}}
        updateFilterMin={() => {}}
        updateFilterMax={() => {}}
        onRowContextMenu={() => {}}
      />
    </div>
  ),
}
