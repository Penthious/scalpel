import type { Meta, StoryObj } from '@storybook/react-vite'
import type { FilterBlock, MatchResult, PoeItem, RemovalPreview } from '@shared/types'
import { HideItemSection } from './HideItemSection'

function landing(tier: string, visibility: 'Show' | 'Hide' = 'Show'): MatchResult {
  const block: FilterBlock = {
    id: tier,
    visibility,
    conditions: [],
    actions: [],
    continue: false,
    lineStart: 1,
    lineEnd: 2,
    tierTag: { typePath: 'rings', tier },
  }
  return { block, blockIndex: 4, isFirstMatch: true, evaluatedConditions: [], hasUnknowns: false }
}

const preview = (over: Partial<RemovalPreview> = {}): RemovalPreview => ({
  landsOn: landing('restex'),
  tierCount: 1,
  skipped: [],
  hideDestination: 'twisdom',
  alreadyHidden: false,
  flipTier: null,
  ...over,
})

/** Fallback hide control, shown when the item's tier has no switchable group so
 *  the Switch Tier dropdown (which normally hosts Hide) does not render. */
const meta: Meta<typeof HideItemSection> = {
  title: 'Filter Block Editor / HideItemSection',
  component: HideItemSection,
  args: { item: { baseType: 'Sapphire Ring' } as PoeItem },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof HideItemSection>

export const Hideable: Story = { args: { preview: preview() } }

/** Stacked currency: several tiers name the base and all must be stripped. */
export const SpansSeveralTiers: Story = { args: { preview: preview({ tierCount: 3 }) } }

/** Stripping alone is enough -- the item then lands on a Hide block. */
export const AlreadyLandsHidden: Story = {
  args: { preview: preview({ landsOn: landing('raresendgame', 'Hide'), alreadyHidden: true, hideDestination: null }) },
}

/** Nothing to do: already hidden and no tier names it. */
export const NothingToDo: Story = {
  args: {
    preview: preview({
      landsOn: landing('raresendgame', 'Hide'),
      alreadyHidden: true,
      tierCount: 0,
      hideDestination: null,
    }),
  },
}

/** No Hide tier can take the base -- the residue that needs a created block. */
export const NoDestination: Story = { args: { preview: preview({ hideDestination: null }) } }

/** In flight: no claim about the outcome until the plan lands. */
export const Resolving: Story = { args: { preview: undefined } }
