import type { Meta, StoryObj } from '@storybook/react'
import { ExpandedListing } from './ExpandedListing'
import { TradeListings } from './TradeListings'
import { StatFilterRow } from '../../features/price-check/StatFilterRow'
import type { Listing } from '../trade-types'
import type { StatFilter } from '../../features/price-check/types'

// Verbatim from /api/trade/fetch: an Infamous Storming Zealot warrant (Marrik,
// the Keitan Heretic), icons included. A warrant has no mods at all -- the
// mercenary's kit is the whole item, which is why it gets its own block.
const ICON = 'https://web.poecdn.com/gen/image'
const listing: Listing = {
  id: 'story-warrant',
  price: { amount: 12, currency: 'divine' },
  account: 'Marrik_Seller',
  online: true,
  instantBuyout: true,
  itemData: {
    baseType: 'Mercenary Warrant',
    rarity: 'Normal',
    mercenarySkills: [
      {
        name: 'Unnerving Blast',
        icon: `${ICON}/WzIxLDE0LHsiayI6IjJEQXJ0L1NraWxsSWNvbnMvSG91c2VBemFkaVNraWxsIn1d/739f1259a8/HouseAzadiSkill.png`,
        supports: [
          { name: 'Lightning Penetration', tier: 2 },
          { name: 'Faster Casting', tier: 2 },
          { name: 'Increased Area of Effect', tier: 2 },
          { name: 'Greater Critical Chance', tier: 3 },
          { name: 'Shock Chance', tier: 2 },
        ],
      },
      {
        name: 'Wave of Conviction',
        icon: `${ICON}/WzIxLDE0LHsiayI6IjJEQXJ0L1NraWxsSWNvbnMvUHVyZ2UifV0/3a6173fa01/Purge.png`,
        supports: [
          { name: 'Second Wind', tier: 3 },
          { name: 'Physical as Extra', tier: 2 },
        ],
      },
      {
        name: 'Divine Ire',
        icon: `${ICON}/WzIxLDE0LHsiayI6IjJEQXJ0L1NraWxsSWNvbnMvRGl2aW5lVGVtcGVzdCJ9XQ/0754c58c7d/DivineTempest.png`,
        supports: [
          { name: 'Faster Casting', tier: 2 },
          { name: 'Infused Channelling', tier: 2 },
        ],
      },
      {
        name: 'Lightning Warp',
        icon: `${ICON}/WzIxLDE0LHsiayI6IjJEQXJ0L1NraWxsSWNvbnMvdGVsZXBvcnRiYWxsIn1d/dc0ce3b2a2/teleportball.png`,
        supports: [
          { name: 'Less Duration', tier: 2 },
          { name: 'Greater Area of Effect', tier: 3 },
        ],
      },
      {
        name: 'Wrath',
        icon: `${ICON}/WzIxLDE0LHsiayI6IjJEQXJ0L1NraWxsSWNvbnMvYXVyYWxpZ2h0bmluZyJ9XQ/bf24ac8da8/auralightning.png`,
        supports: [],
      },
    ],
  },
}

const meta: Meta<typeof ExpandedListing> = {
  title: 'TradeResults/MercenaryWarrant',
  component: ExpandedListing,
  args: {
    listing,
    itemClass: 'Map Fragments',
    itemName: 'Mercenary Warrant',
    itemRarity: 'Normal',
  },
}
export default meta

/** The kit as it renders under an expanded listing: skill, then its supports. */
export const ExpandedKit: StoryObj<typeof ExpandedListing> = {}

/** The collapsed row: skill icons only, since that is what you scan a warrant
 *  list by. Each icon's tooltip carries the supports. */
export const CollapsedRow: StoryObj = {
  render: () => (
    <div className="w-[440px]">
      <TradeListings
        listings={[listing, { ...listing, id: 'story-warrant-2', price: { amount: 20, currency: 'divine' } }]}
        total={131}
        itemClass="Map Fragments"
        itemName="Mercenary Warrant"
        itemRarity="Normal"
        expandedListing={null}
        setExpandedListing={() => {}}
        priceChipMinWidth={64}
        queryId={null}
        league="Allflame"
        // The price-check panel is normally logged in, and the trade actions are
        // what the kit strip has to share the row with.
        loggedIn
      />
    </div>
  ),
}

const row = (over: Partial<StatFilter>): StatFilter => ({
  id: 'mercenary.skill_37202',
  text: 'Bladefall',
  value: null,
  min: null,
  max: null,
  enabled: true,
  type: 'mercenary',
  ...over,
})

const CHIP_ROWS: StatFilter[] = [
  row({ id: 'mercenary.skill_22724', text: 'Bloody Warp' }),
  row({
    id: 'mercenary.support_61471',
    text: 'Critical Chance (Tier: 2)',
    enabled: false,
    mercenarySkillId: 'mercenary.skill_22724',
  }),
  row({ id: 'mercenary.skill_37202', text: 'Bladefall' }),
  row({
    id: 'mercenary.support_8607',
    text: 'Greater Faster Casting (Tier: 3)',
    enabled: true,
    mercenarySkillId: 'mercenary.skill_37202',
  }),
  row({
    id: 'mercenary.support_53342',
    text: 'Increased Area of Effect (Tier: 2)',
    enabled: false,
    mercenarySkillId: 'mercenary.skill_37202',
  }),
]

/** The price-check rows: skills head their block, supports indent under them and
 *  carry no min/max boxes (presence-only on trade). */
export const FilterRows: StoryObj = {
  render: () => (
    <div className="bg-black/20">
      {CHIP_ROWS.map((f, i) => (
        <StatFilterRow
          key={i}
          f={f}
          i={i}
          rowIdx={i}
          itemRarity="Normal"
          toggleFilter={() => {}}
          updateFilterMin={() => {}}
          updateFilterMax={() => {}}
          onRowContextMenu={() => {}}
        />
      ))}
    </div>
  ),
}
