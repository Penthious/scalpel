import { RARITY_COLORS } from '../constants'
import { getItemSize } from '../item-display'

export { RARITY_COLORS, getItemSize }

export const MOD_COLORS: Record<string, string> = {
  'temple-key': '#ffd700',
  temple: '#c4a35a',
  foulborn: '#EA44A8',
  heist: '#ffcc88',
  gem: '#a8e6cf',
  weapon: '#88ccff',
  defence: '#88ccff',
  pseudo: '#88ccff',
  implicit: '#af8aff',
  crafted: '#B8DAF1',
  fractured: 'var(--accent)',
  desecrated: '#9ccc65',
  imbued: '#a8e6cf',
  enchant: '#a8e6cf',
  rune: '#a8e6cf',
  skill: '#a8e6cf',
  map: '#80cbc4',
  mercenary: '#a8e6cf',
  explicit: '#8787FE',
  tierPrefix: '#ec7676',
  tierSuffix: '#7aaff1',
}

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
