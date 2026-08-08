import type { PoeItem } from '@shared/types'
import { getVestigialMods } from '@shared/vestigial'
import { HoverTooltip } from './HoverTooltip'
import { InfoChip } from './InfoChip'
import { usePoeVersion } from './poe-version-context'

/** Enshrouding a unique armour turns it into a different unique of the same class
 *  carrying one of this item's mods as a Vestigial implicit (issue #566). The chip
 *  marks the item as a donor; the tooltip lists the implicit(s) it can hand over.
 *
 *  Renders nothing when the item donates nothing -- the dataset only lists real
 *  donors, and roughly a fifth of armour uniques are not one. PoE1 only. */
export function VestigialChip({ item }: { item: PoeItem }): JSX.Element | null {
  const version = usePoeVersion()
  if (version !== 1 || item.rarity !== 'Unique') return null

  const mods = getVestigialMods(item.name)
  if (!mods) return null

  return (
    <HoverTooltip text={mods.map((mod) => mod.to).join('\n')}>
      <InfoChip color="#c8a96e">
        <span className="font-semibold">Vestigial Mod</span>
        {mods.length > 1 && <span className="text-text-dim">{mods.length}</span>}
      </InfoChip>
    </HoverTooltip>
  )
}
