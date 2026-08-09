import type { Meta, StoryObj } from '@storybook/react'
import { StatFilterRow } from './StatFilterRow'
import type { StatFilter } from './types'

const ladder = [
  {
    tier: 6,
    name: 'Hale',
    ilvl: 1,
    stats: [{ id: 'base_maximum_life', min: 3, max: 9 }],
    range: { min: 3, max: 9 },
    text: '',
  },
  {
    tier: 5,
    name: 'Healthy',
    ilvl: 6,
    stats: [{ id: 'base_maximum_life', min: 10, max: 19 }],
    range: { min: 10, max: 19 },
    text: '',
  },
  {
    tier: 4,
    name: 'Stout',
    ilvl: 33,
    stats: [{ id: 'base_maximum_life', min: 60, max: 69 }],
    range: { min: 60, max: 69 },
    text: '',
  },
]

const filter: StatFilter = {
  id: 'explicit.stat_life',
  text: '+12 to maximum Life',
  value: 12,
  min: 12,
  max: null,
  enabled: true,
  type: 'explicit',
  modTier: 5,
  modRange: { min: 10, max: 19 },
  tierLadder: ladder,
}

const meta: Meta<typeof StatFilterRow> = {
  title: 'PriceCheck/TierScrubChip',
  component: StatFilterRow,
  args: {
    f: filter,
    i: 0,
    rowIdx: 0,
    itemRarity: 'Rare',
    toggleFilter: () => {},
    updateFilterMin: () => {},
    updateFilterMax: () => {},
  },
}
export default meta
export const Default: StoryObj<typeof StatFilterRow> = {}

const SOURCES = [
  ['shaper', 'of Shaping — +38% to Global Critical Strike Multiplier'],
  ['elder', "The Elder's — 35% increased Burning Damage"],
  ['crusader', "Crusader's — 30% increased Physical Damage"],
  ['hunter', 'of the Hunt — 11% chance to Intimidate Enemies'],
  ['redeemer', 'of Redemption — Auras grant 4% increased Damage'],
  ['warlord', "Warlord's — Gain 18% of Physical Damage as Extra Fire"],
  ['searing-exarch', 'Searing Exarch — +2% to maximum Fire Resistance'],
  ['eater-of-worlds', 'Eater of Worlds — +1% to all maximum Resistances'],
  ['delve', 'Subterranean — Curse Enemies with Despair on Hit'],
  ['temple', "Guatelitzi's — +75 to maximum Life"],
] as const

/** Every source symbol on the real zebra row background, to check they read at 12px
 *  and stay distinguishable from one another. */
export const ModSources: StoryObj<typeof StatFilterRow> = {
  render: () => (
    <div style={{ width: 460, background: '#171821' }}>
      {SOURCES.map(([source, text], i) => (
        <StatFilterRow
          key={source}
          f={{ ...filter, text, modSource: source, tierLadder: undefined, modTier: undefined, modRange: undefined }}
          i={i}
          rowIdx={i}
          itemRarity="Rare"
          toggleFilter={() => {}}
          updateFilterMin={() => {}}
          updateFilterMax={() => {}}
          onRowContextMenu={() => {}}
        />
      ))}
    </div>
  ),
}
