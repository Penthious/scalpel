import type { Meta, StoryObj } from '@storybook/react-vite'
import type { FilterBlock, MatchResult, PoeItem, RemovalPreview, TierGroup } from '@shared/types'
import { checkRemovable } from '@shared/filter-removal'
import { TierNavigator } from './TierNavigator'

const item = { baseType: 'Chaos Orb', itemClass: 'Stackable Currency' } as PoeItem

function block(tier: string, values: string[], operator: '==' | '=' = '=='): FilterBlock {
  return {
    id: tier,
    visibility: 'Show',
    conditions: values.length ? [{ type: 'BaseType', operator, values, explicitOperator: operator === '==' }] : [],
    actions: [
      { type: 'SetTextColor', values: ['255', '255', '255', '255'] },
      { type: 'SetFontSize', values: ['40'] },
    ],
    continue: false,
    lineStart: 1,
    lineEnd: 2,
    tierTag: { typePath: 'currency', tier },
  }
}

function group(tiers: { tier: string; values: string[]; operator?: '==' | '=' }[], current: string): TierGroup {
  return {
    typePath: 'currency',
    currentTier: current,
    siblings: tiers.map((t, i) => {
      const b = block(t.tier, t.values, t.operator)
      return {
        tier: t.tier,
        visibility: b.visibility,
        blockIndex: i + 10,
        block: b,
        match: {
          block: b,
          blockIndex: i + 10,
          isFirstMatch: t.tier === current,
          evaluatedConditions: [],
          hasUnknowns: false,
        },
      }
    }),
  }
}

const restex: MatchResult = {
  block: block('restex', []),
  blockIndex: 99,
  isFirstMatch: true,
  evaluatedConditions: [],
  hasUnknowns: false,
}

const TIERS = [
  { tier: 't1', values: ['Divine Orb'] },
  { tier: 't2', values: ['Exalted Orb'] },
  { tier: 't4chaos', values: ['Chaos Orb', 'Orb of Annulment'] },
]

/**
 * Item-scoped tier switcher. The dropdown's last row is "Remove" -- it strips
 * the base from the current tier so the item falls through to whatever catches
 * it next. Click "Switch Tier" to open the list and see the row.
 */
const meta: Meta<typeof TierNavigator> = {
  title: 'Filter / TierNavigator',
  component: TierNavigator,
  args: { baseType: item.baseType, item, onMoved: () => {}, onRemoved: () => {} },
  decorators: [
    (Story) => (
      <div className="w-[380px]">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof TierNavigator>

const removalFor = (g: TierGroup) =>
  checkRemovable(g.siblings.find((s) => s.tier === g.currentTier)!.block, item.baseType)

const mkPreview = (
  landsOn: MatchResult | null,
  tierCount = 1,
  hideDestination: string | null = 'twisdom',
): RemovalPreview => ({
  landsOn,
  tierCount,
  skipped: [],
  hideDestination,
  alreadyHidden: false,
  flipTier: null,
})

const withRemoval = (g: TierGroup, preview: RemovalPreview | undefined = mkPreview(restex)) => ({
  group: g,
  removal: removalFor(g),
  preview,
})

export const Removable: Story = { args: withRemoval(group(TIERS, 't4chaos')) }

/** A tier with no siblings still gets the dropdown -- the Remove row is a choice,
 *  so a one-entry list is not an empty one. */
export const SingleTier: Story = {
  args: withRemoval(group([{ tier: 'ring_light', values: ['Chaos Orb', 'Cogwork Ring'] }], 'ring_light')),
}

/** A locked exception tier (, ) cannot be switched away from, but the
 *  current tier is still listed and removal stays offered -- removal is not retiering. */
export const ExceptionTier: Story = {
  args: withRemoval(group([{ tier: 'exoticheistbases', values: ['Chaos Orb', 'Cogwork Ring'] }], 'exoticheistbases')),
}

export const FallsNowhere: Story = { args: withRemoval(group(TIERS, 't4chaos'), mkPreview(null)) }

export const Resolving: Story = { args: withRemoval(group(TIERS, 't4chaos'), undefined) }

export const LastBaseInTier: Story = {
  args: withRemoval(
    group(
      [
        { tier: 't1', values: ['Divine Orb'] },
        { tier: 't4chaos', values: ['Chaos Orb'] },
      ],
      't4chaos',
    ),
    mkPreview(null, 0),
  ),
}

export const CaughtByPattern: Story = {
  args: withRemoval(
    group(
      [
        { tier: 't1', values: ['Divine Orb'] },
        { tier: 't4chaos', values: ['Orb', 'Scroll'], operator: '=' },
      ],
      't4chaos',
    ),
    mkPreview(null, 0),
  ),
}

/** Stacked currency: the base is named by several tiers that all catch a 20-stack,
 *  so one click strips all of them. */
export const SpansSeveralTiers: Story = {
  args: withRemoval(group(TIERS, 't4chaos'), mkPreview(restex, 3)),
}

/**
 * The tier lists only this item -- PoE2's trial coins are an ItemLevel band over
 * one base. Hiding it is a visibility flip on that block: no base moves, no Hide
 * tier is needed, and it works where stripping cannot (taking the last name off a
 * tier would widen it to everything its other conditions allow).
 */
export const HideByFlippingTier: Story = {
  args: withRemoval(group([{ tier: 'trialkeysanctumtop', values: ['Chaos Orb'] }], 'trialkeysanctumtop'), {
    ...mkPreview(null, 0, null),
    flipTier: 'trialkeysanctumtop',
  }),
}
