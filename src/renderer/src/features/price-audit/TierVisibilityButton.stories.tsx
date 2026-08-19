import type { Meta, StoryObj } from '@storybook/react-vite'
import type { FilterBlock, PoeItem } from '@shared/types'
import { TierVisibilityButton } from './TierVisibilityButton'

function block(visibility: FilterBlock['visibility']): FilterBlock {
  return {
    id: 't4chaos',
    visibility,
    conditions: [{ type: 'BaseType', operator: '==', values: ['Chaos Orb'], explicitOperator: true }],
    actions: [],
    continue: false,
    lineStart: 1,
    lineEnd: 2,
    tierTag: { typePath: 'currency', tier: 't4chaos' },
  }
}

/** Audit-hero visibility toggle: flips the audited tier between Show and Hide
 *  without opening an item's block editor (#596). Sized to sit under the hero's
 *  tier select. */
const meta: Meta<typeof TierVisibilityButton> = {
  title: 'Price Audit / TierVisibilityButton',
  component: TierVisibilityButton,
  args: { blockIndex: 4, item: { baseType: 'Chaos Orb' } as PoeItem },
  decorators: [
    (Story) => (
      <div className="w-[140px] flex flex-col gap-1">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof TierVisibilityButton>

/** Tier is visible -- the button offers to hide it. */
export const ShownTier: Story = { args: { block: block('Show') } }

/** Tier is hidden -- the button offers to show it. */
export const HiddenTier: Story = { args: { block: block('Hide') } }

/** PoE2's third state counts as visible, matching the block editor's pair. */
export const MinimalTier: Story = { args: { block: block('Minimal') } }
