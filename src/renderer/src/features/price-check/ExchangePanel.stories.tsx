import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ExchangeDetails } from '@shared/contracts/exchange'
import { ExchangePanel } from './ExchangePanel'

const DAY = 86400000
const START = Date.parse('2026-07-24T00:00:00Z')

function history(rates: number[], volumes?: number[]) {
  return rates.map((rate, i) => ({ t: START + i * DAY, rate, volume: volumes?.[i] ?? 0 }))
}

const LIQUID: ExchangeDetails = {
  name: 'Orb of Annulment',
  pairs: [
    {
      currency: 'chaos',
      rate: 9.69,
      volumePerHour: 176079,
      history: history(
        [6.2, 6.8, 7.1, 7.9, 8.4, 8.1, 8.8, 9.2, 9.0, 9.4, 9.9, 9.5, 9.3, 9.1, 9.4, 9.69],
        [
          90000, 104000, 118000, 126000, 133000, 141000, 150000, 149000, 155000, 161000, 168000, 158000, 162000, 150000,
          166000, 176079,
        ],
      ),
    },
    {
      currency: 'divine',
      rate: 0.04895,
      volumePerHour: 106620,
      history: history(
        [0.101, 0.09, 0.081, 0.075, 0.07, 0.065, 0.062, 0.059, 0.056, 0.055, 0.053, 0.052, 0.051, 0.05, 0.049, 0.04895],
        [
          40000, 46000, 51000, 58000, 63000, 69000, 74000, 79000, 84000, 88000, 92000, 96000, 99000, 102000, 104000,
          106620,
        ],
      ),
    },
  ],
}

/** Astragali: a real rate, effectively no market. Single pair, no volume. */
const ILLIQUID: ExchangeDetails = {
  name: 'Astragali',
  pairs: [
    { currency: 'chaos', rate: 0.03615, volumePerHour: 0, history: history([0.031, 0.033, 0.036, 0.034, 0.036]) },
  ],
}

const meta: Meta<typeof ExchangePanel> = {
  title: 'Price Check / ExchangePanel',
  component: ExchangePanel,
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: { vendor: 'Faustus', onOpenNinja: () => {} },
}
export default meta

type Story = StoryObj<typeof ExchangePanel>

/** The headline case: liquid currency, both pairs, click the pills to switch. */
export const Liquid: Story = { args: { details: LIQUID } }

/** A 20-stack, where the stack total is the number you actually care about. */
export const WithStack: Story = { args: { details: LIQUID, stackSize: 20 } }

/** One pair and no volume -- pills and the vol stat both drop out. */
export const Illiquid: Story = { args: { details: ILLIQUID } }

/** PoE2 swaps the portrait and the copy for Ange. */
export const AngeVendor: Story = { args: { details: LIQUID, vendor: 'Ange' } }
