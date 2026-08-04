import type { Meta, StoryObj } from '@storybook/react-vite'
import { ScryingOrbButton } from './ScryingOrbButton'

/** ScryingOrbButton rides in `ExpandedCardList`'s column header. The first click
 *  runs a live trade search for the map's Scrying Orb and leaves the cheapest
 *  listing price on the button; the second opens the trade site to that query.
 *  Clicking here is safe: the preview stubs `tradeSearch` with a canned listing
 *  and `openExternal` with a no-op, so the priced state renders without touching
 *  the network. */
const meta: Meta<typeof ScryingOrbButton> = {
  title: 'Div Card Explorer / ScryingOrbButton',
  component: ScryingOrbButton,
  decorators: [
    (Story) => (
      <div className="bg-bg-card p-3 rounded inline-block">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ScryingOrbButton>

export const Idle: Story = {
  args: { mapName: 'Dunes Map' },
}

export const UnknownArea: Story = {
  args: { mapName: 'Not A Real Map' },
  parameters: {
    docs: { description: { story: 'A map with no SCRYING_ORB_AREAS entry renders nothing (data-drift guard).' } },
  },
}
