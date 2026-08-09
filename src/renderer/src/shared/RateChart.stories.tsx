import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ExchangePoint } from '@shared/contracts/exchange'
import { RateChart } from './RateChart'

/** RateChart renders inside the ExchangePanel card, so each story sits on a
 *  card-width, card-coloured backdrop to match its real context. */
const DAY = 86400000
const START = Date.parse('2026-07-24T00:00:00Z')

function series(rates: number[], volumes?: number[]): ExchangePoint[] {
  return rates.map((rate, i) => ({ t: START + i * DAY, rate, volume: volumes?.[i] ?? 0 }))
}

const meta: Meta<typeof RateChart> = {
  title: 'Shared / RateChart',
  component: RateChart,
  decorators: [
    (Story) => (
      <div style={{ width: 380, padding: 12, background: 'var(--bg-card)', borderRadius: 8 }}>
        <Story />
      </div>
    ),
  ],
  args: { currency: 'chaos' },
}
export default meta

type Story = StoryObj<typeof RateChart>

/** A full league of an item that trended up hard -- the common case mid-league. */
export const FullLeague: Story = {
  args: {
    points: series(
      [61, 64, 70, 82, 95, 110, 138, 160, 190, 240, 300, 420, 520, 610, 700, 808],
      [
        140766, 160000, 180000, 210000, 240000, 260000, 300000, 320000, 350000, 400000, 430000, 460000, 500000, 520000,
        550000, 571679,
      ],
    ),
  },
}

/** Two days in. The line is short and the chart must not special-case it. */
export const LeagueStart: Story = {
  args: { points: series([9.1, 9.69], [150000, 176079]) },
}

/** A single sample -- day one of a league. */
export const SinglePoint: Story = {
  args: { points: series([9.69], [176079]) },
}

/** A pegged rate. Zero range must center, not divide by zero. */
export const FlatLine: Story = {
  args: { points: series([1, 1, 1, 1, 1, 1, 1], [900, 1200, 800, 1500, 1100, 1000, 1300]) },
}

/** An illiquid item: real rates, no volume. The bars and the vol readout vanish. */
export const NoVolume: Story = {
  args: { points: series([0.031, 0.033, 0.036, 0.034, 0.036]), currency: 'chaos' },
}

/** A downtrend, to check the stroke flips to the down colour. */
export const Downtrend: Story = {
  args: { points: series([420, 380, 340, 300, 260, 210, 180], [50000, 44000, 40000, 36000, 30000, 26000, 22000]) },
}
