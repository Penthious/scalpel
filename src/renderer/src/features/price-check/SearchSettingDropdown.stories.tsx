import type { Meta, StoryObj } from '@storybook/react-vite'
import { SearchSettingDropdown } from './SearchSettingDropdown'
import { LISTED_TIME_OPTIONS, getPriceOptions, STATUS_OPTIONS } from './search-settings'

/** The per-search settings row of the price checker: three compact `<select>`s
 *  sharing one `grid-cols-3`. The buyout-currency dropdown carries GGG's full
 *  option list for the active game, with the niche currencies under an
 *  "Other currencies" `<optgroup>`.
 *
 *  What these stories are for is the *closed* state. The options themselves
 *  render in an OS-owned popup that neither Storybook nor a screenshot can
 *  capture, so the grouping is covered by select-options.test.tsx instead;
 *  what needs eyes is whether GGG's longer labels ("Chaos Orb Equivalent")
 *  still fit a third of the overlay's width. The decorator pins each story to
 *  a realistic panel width. */
const meta: Meta<typeof SearchSettingDropdown> = {
  title: 'Price Check / SearchSettingDropdown',
  component: SearchSettingDropdown,
}
export default meta

type Story = StoryObj<typeof SearchSettingDropdown>

function SettingsRow({ version, width }: { version: 1 | 2; width: number }): JSX.Element {
  return (
    <div style={{ width }} className="grid grid-cols-3 gap-[6px]">
      <SearchSettingDropdown value="" options={LISTED_TIME_OPTIONS} onChange={() => {}} />
      <SearchSettingDropdown
        value={version === 2 ? 'exalted_equivalent' : 'chaos_equivalent'}
        options={getPriceOptions(version)}
        onChange={() => {}}
      />
      <SearchSettingDropdown value="available" options={STATUS_OPTIONS} onChange={() => {}} />
    </div>
  )
}

/** The full row at a typical overlay width, PoE1. */
export const Poe1Row: Story = {
  render: () => <SettingsRow version={1} width={420} />,
}

export const Poe2Row: Story = {
  render: () => <SettingsRow version={2} width={420} />,
}

/** A narrow panel -- the tightest the row is likely to get before the user
 *  widens the zone. */
export const NarrowRow: Story = {
  render: () => <SettingsRow version={1} width={320} />,
}

/** Every PoE1 buyout option rendered as the closed value, so label lengths can
 *  be compared at a glance. */
export const AllPoe1Options: Story = {
  render: () => (
    <div style={{ width: 140 }} className="grid gap-[6px]">
      {getPriceOptions(1).map((o) => (
        <SearchSettingDropdown key={o.value} value={o.value} options={getPriceOptions(1)} onChange={() => {}} />
      ))}
    </div>
  ),
}
