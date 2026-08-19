import { Star } from '@icon-park/react'
import type { Listing } from '../trade-types'
import { ATZOATL_KEY_ROOMS } from '@shared/data/trade/atzoatl'
import { ModLine } from './ModLine'
import { RARITY_COLORS, MOD_COLORS, getItemSize } from './constants'
import { RuneSocketOverlayPoe2 } from '../../components/sockets/RuneSocketOverlay.poe2'
import { SocketOverlayPoe1, type SocketSpec } from '../../components/sockets/SocketOverlay.poe1'
import { usePoeVersion } from '../poe-version-context'
import { isSkillGem } from '@shared/poe-item'

const MOD_SEPARATOR = {
  backgroundImage: 'linear-gradient(90deg, transparent, var(--border) 20%, var(--border) 80%, transparent)',
  backgroundSize: '200px 1px',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'top center',
} as const

interface ExpandedListingProps {
  listing: Listing
  itemClass: string
  itemName: string
  itemRarity: string
}

function copyItemToClipboard(d: Listing['itemData'] & {}, rarity: string, btn: HTMLElement): void {
  const lines: string[] = []
  lines.push(`Rarity: ${rarity}`)
  if (d.name && d.name !== d.baseType) lines.push(d.name)
  if (d.baseType) lines.push(d.baseType)
  lines.push('--------')
  if (d.chartZone) lines.push(d.chartZone)
  if (d.ilvl) lines.push(`Item Level: ${d.ilvl}`)
  if (d.memoryStrands != null) lines.push(`Memory Strands: ${d.memoryStrands}`)
  if (d.intangibility != null) lines.push(`Intangibility: ${d.intangibility}%`)
  if (d.grantedSkills?.length) {
    lines.push('--------')
    for (const gs of d.grantedSkills) lines.push(`Grants Skill: ${gs.text}`)
  }
  // Warrants print one section per skill, supports beneath it with the tier -- copy
  // it back the same way so a pasted listing parses like an in-game Ctrl+C.
  for (const skill of d.mercenarySkills ?? []) {
    lines.push('--------')
    lines.push(skill.name)
    for (const sup of skill.supports) lines.push(sup.tier != null ? `${sup.name} (Tier: ${sup.tier})` : sup.name)
  }
  if (d.implicitMods?.length) {
    lines.push('--------')
    for (const mod of d.implicitMods) lines.push(`${mod} (implicit)`)
  }
  if (d.explicitMods?.length) {
    lines.push('--------')
    for (const mod of d.explicitMods) lines.push(mod)
  }
  navigator.clipboard.writeText(lines.join('\n'))
  btn.textContent = 'Copied!'
  setTimeout(() => {
    btn.textContent = 'Copy to Clipboard'
  }, 1500)
}

export function ExpandedListing({ listing: l, itemClass, itemName, itemRarity }: ExpandedListingProps): JSX.Element {
  const d = l.itemData!
  const [slotW, slotH] = getItemSize(itemClass, d.name || itemName)
  const artW = slotW * 50
  // PoE2 skill gems can have up to 5 sockets which render as a 2x3 grid 90px tall; bump the art tile so the overlay fits.
  const artH = isSkillGem({ itemClass }) ? 100 : slotH * 40

  return (
    <div
      className="px-4 py-3 bg-black/25 flex items-center gap-[14px] relative overflow-hidden border-l-[3px] border-l-[rgba(200,169,110,0.7)]"
      style={{ minHeight: artH + 24 }}
    >
      {/* Background blur */}
      {l.icon && (
        <img
          src={l.icon}
          alt=""
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
          style={{ width: '120%', height: '120%', filter: 'blur(40px) saturate(2)', opacity: 0.15 }}
        />
      )}

      {/* Item art + sockets */}
      {l.icon && (
        <div className="absolute left-4 top-0 bottom-0 flex items-center z-[1]">
          <div className="relative" style={{ width: artW, height: artH }}>
            <img
              src={l.icon}
              alt=""
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
              style={{ width: artW * 1.8, height: artH * 1.5, filter: 'blur(14px) saturate(2)', opacity: 0.35 }}
            />
            <img src={l.icon} alt="" className="relative object-contain" style={{ width: artW, height: artH }} />
            {d.sockets && d.sockets.length > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <SocketOverlay sockets={d.sockets} itemClass={itemClass} itemName={d.name || itemName} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Copy to clipboard */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          copyItemToClipboard(d, itemRarity, e.currentTarget)
        }}
        className="absolute top-3 right-4 px-2 py-[3px] text-[9px] leading-none font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-text-dim hover:text-text border-none rounded-[3px] cursor-pointer z-[2] transition-colors"
      >
        Copy to Clipboard
      </button>

      {/* Item info + mods */}
      <div className="flex-1 flex flex-col gap-[2px] text-center items-center z-[1] relative max-w-[280px] mx-auto">
        {d.name && (
          <div className="text-xs font-semibold" style={{ color: RARITY_COLORS[d.rarity ?? itemRarity] ?? '#c8c8c8' }}>
            {d.name}
          </div>
        )}
        {d.baseType && (
          <div className="text-[10px] text-text-dim">
            {d.name !== d.baseType ? d.baseType : ''}
            {d.ilvl ? `${d.name !== d.baseType ? ' ' : ''}(iLvl ${d.ilvl})` : ''}
          </div>
        )}
        {d.memoryStrands != null && (
          <div className="text-[10px] text-text-dim">
            Memory Strands: <span className="text-[#00e0be] font-semibold">{d.memoryStrands}</span>
          </div>
        )}
        {/* Same green the price-check row uses for this filter (MOD_COLORS.gem), so the
         *  number reads as the same thing in both places. */}
        {d.intangibility != null && (
          <div className="text-[10px]" style={{ color: MOD_COLORS.gem }}>
            Intangibility: <span className="font-semibold">{d.intangibility}%</span>
          </div>
        )}
        {/* Map properties (tier, IIQ, pack size, etc.) */}
        {d.mapProperties && d.mapProperties.length > 0 && (
          <div className="mt-1 pt-1 w-full flex flex-col gap-[1px]" style={MOD_SEPARATOR}>
            {d.mapProperties.map((p, i) => (
              <div key={i} className="text-[10px] text-text-dim">
                {p.name}: <span className="text-[#88ccff] font-semibold">{p.value}</span>
              </div>
            ))}
          </div>
        )}

        {d.storedExperience != null && (
          <div className="text-[10px] text-text-dim">
            Stored Experience: <span className="text-text font-semibold">{d.storedExperience.toLocaleString()}</span>
          </div>
        )}

        {/* Temple rooms */}
        {d.templeOpenRooms && d.templeOpenRooms.length > 0 && (
          <div className="mt-1 pt-1 w-full" style={MOD_SEPARATOR}>
            <div className="text-[9px] text-text-dim uppercase tracking-wider mb-[2px]">Open Rooms</div>
            {d.templeOpenRooms.map((room, ri) => {
              const isKey = ATZOATL_KEY_ROOMS.has(room)
              return (
                <div
                  key={ri}
                  className="text-[10px] flex items-center justify-center gap-1"
                  style={{ color: isKey ? '#ffd700' : '#c4a35a', fontWeight: isKey ? 600 : 400 }}
                >
                  {isKey && <Star size={10} theme="filled" fill="#ffd700" />}
                  {room}
                </div>
              )
            })}
            {d.templeObstructedRooms && d.templeObstructedRooms.length > 0 && (
              <>
                <div className="text-[9px] text-text-dim uppercase tracking-wider mt-1 mb-[2px]">Obstructed</div>
                {d.templeObstructedRooms.map((room, ri) => (
                  <div key={ri} className="text-[10px] text-text-dim text-center">
                    {room}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Chart zone / Heist contract info */}
        {(d.chartZone || d.areaLevel || d.heistJob) && (
          <div className="text-[10px] text-text-dim flex gap-2">
            {d.chartZone && <span className="text-text font-semibold">{d.chartZone}</span>}
            {d.areaLevel && (
              <span>
                Area Level: <span className="text-text font-semibold">{d.areaLevel}</span>
              </span>
            )}
            {d.heistJob && (
              <span>
                {d.heistJob.skill}: <span className="text-text font-semibold">Lv{d.heistJob.level}</span>
              </span>
            )}
          </div>
        )}

        {/* Gem / quality */}
        {(d.gemLevel || d.quality) && (
          <div className="text-[10px] text-text-dim flex gap-2">
            {d.gemLevel && (
              <span>
                Level: <span className="text-text font-semibold">{d.gemLevel}</span>
              </span>
            )}
            {d.quality && (
              <span>
                Quality: <span className="text-text font-semibold">+{d.quality}%</span>
              </span>
            )}
          </div>
        )}

        {/* Defences */}
        {(d.armour || d.evasion || d.energyShield) && (
          <div className="text-[10px] text-text-dim flex gap-2">
            {d.armour ? (
              <span>
                AR: <span className="text-[#88ccff] font-semibold">{d.armour}</span>
              </span>
            ) : null}
            {d.evasion ? (
              <span>
                EV: <span className="text-[#88ccff] font-semibold">{d.evasion}</span>
              </span>
            ) : null}
            {d.energyShield ? (
              <span>
                ES: <span className="text-[#88ccff] font-semibold">{d.energyShield}</span>
              </span>
            ) : null}
          </div>
        )}

        {/* DPS */}
        {(d.pdps || d.edps) && (
          <div className="text-[10px] text-text-dim flex gap-2">
            {d.pdps ? (
              <span>
                pDPS: <span className="text-[#88ccff] font-semibold">{Math.round(d.pdps)}</span>
              </span>
            ) : null}
            {d.edps ? (
              <span>
                eDPS: <span className="text-[#88ccff] font-semibold">{Math.round(d.edps)}</span>
              </span>
            ) : null}
            {d.dps ? (
              <span>
                DPS: <span className="text-[#88ccff] font-semibold">{Math.round(d.dps)}</span>
              </span>
            ) : null}
          </div>
        )}

        {/* Enchant mods */}
        {d.enchantMods && d.enchantMods.length > 0 && (
          <div className="mt-1 pt-1 w-full" style={MOD_SEPARATOR}>
            {d.enchantMods.map((mod, mi) => (
              <ModLine key={mi} text={mod} color={MOD_COLORS.enchant} />
            ))}
          </div>
        )}

        {/* Rune mods (PoE2 socketed runes) */}
        {d.runeMods && d.runeMods.length > 0 && (
          <div className="mt-1 pt-1 w-full" style={MOD_SEPARATOR}>
            {d.runeMods.map((mod, mi) => (
              <ModLine key={mi} text={mod} color={MOD_COLORS.rune} />
            ))}
          </div>
        )}

        {/* Mercenary Warrant kit: one row per skill (with its game icon), its
            supports listed under it with the tier that is part of their trade
            identity. This block IS the item on a warrant -- there are no mods. */}
        {d.mercenarySkills && d.mercenarySkills.length > 0 && (
          <div className="mt-1 pt-1 w-full flex flex-col gap-[3px]" style={MOD_SEPARATOR}>
            {d.mercenarySkills.map((skill, si) => (
              <div key={si} className="flex flex-col items-center">
                <div
                  className="text-[10px] flex items-center justify-center gap-1 font-semibold"
                  style={{ color: MOD_COLORS.skill }}
                >
                  {skill.icon && <img src={skill.icon} alt="" className="w-4 h-4 object-contain" />}
                  <span>{skill.name}</span>
                </div>
                {skill.supports.map((sup, ui) => (
                  <div key={ui} className="text-[10px] flex items-center justify-center gap-1 text-text-dim">
                    <span>{sup.name}</span>
                    {sup.tier != null && (
                      <span className="rounded-[2px] bg-black/35 px-[3px] text-[9px] leading-[13px]">T{sup.tier}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Granted skills */}
        {d.grantedSkills && d.grantedSkills.length > 0 && (
          <div className="mt-1 pt-1 w-full flex flex-col gap-[2px]" style={MOD_SEPARATOR}>
            {d.grantedSkills.map((gs, gi) => (
              <div
                key={gi}
                className="text-[10px] flex items-center justify-center gap-1"
                style={{ color: MOD_COLORS.skill }}
              >
                {gs.icon && <img src={gs.icon} alt="" className="w-4 h-4 object-contain" />}
                <span>Grants Skill: {gs.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Implicit mods */}
        {d.implicitMods && d.implicitMods.length > 0 && (
          <div className="mt-1 pt-1 w-full" style={MOD_SEPARATOR}>
            {d.implicitMods.map((mod, mi) => (
              <ModLine key={mi} text={mod} color={MOD_COLORS.implicit} tierInfo={d.modTiers?.[mod]} />
            ))}
          </div>
        )}

        {/* Explicit mods */}
        {d.explicitMods && d.explicitMods.length > 0 && (
          <div className="mt-[2px] pt-1 w-full" style={MOD_SEPARATOR}>
            {(() => {
              const fracturedSet = new Set(d.fracturedMods ?? [])
              const foulbornSet = new Set(d.foulbornMods ?? [])
              const craftedSet = new Set(d.craftedMods ?? [])
              const desecratedSet = new Set(d.desecratedMods ?? [])
              const tiers = d.modTiers
              const mods = d.explicitMods!
              const fractured = mods.filter((m) => fracturedSet.has(m))
              const prefixes = mods.filter((m) => !fracturedSet.has(m) && tiers?.[m]?.tier?.startsWith('P'))
              const suffixes = mods.filter((m) => !fracturedSet.has(m) && tiers?.[m]?.tier?.startsWith('S'))
              const other = mods.filter(
                (m) => !fracturedSet.has(m) && !tiers?.[m]?.tier?.startsWith('P') && !tiers?.[m]?.tier?.startsWith('S'),
              )
              const sorted = [...fractured, ...prefixes, ...suffixes, ...other]
              return sorted.map((mod, mi) => (
                <ModLine
                  key={mi}
                  text={mod}
                  color={
                    foulbornSet.has(mod)
                      ? MOD_COLORS.foulborn
                      : fracturedSet.has(mod)
                        ? MOD_COLORS.fractured
                        : craftedSet.has(mod)
                          ? MOD_COLORS.crafted
                          : desecratedSet.has(mod)
                            ? MOD_COLORS.desecrated
                            : MOD_COLORS.explicit
                  }
                  tierInfo={tiers?.[mod]}
                />
              ))
            })()}
          </div>
        )}

        {/* Status flags */}
        {(d.identified === false || d.corrupted || d.mirrored || d.sanctified) && (
          <div className="mt-1 pt-1 w-full flex flex-col gap-[2px]" style={MOD_SEPARATOR}>
            {d.identified === false && <div className="text-[10px] text-[#ef5350] font-semibold">Unidentified</div>}
            {d.mirrored && <div className="text-[10px] text-[#8787FE] font-semibold">Mirrored</div>}
            {d.sanctified && <div className="text-[10px] text-[#e7b356] font-semibold">Sanctified</div>}
            {d.corrupted && <div className="text-[10px] text-[#ef5350] font-semibold">Corrupted</div>}
          </div>
        )}
      </div>
    </div>
  )
}

/** Socket overlay for item art */
function SocketOverlay({
  sockets,
  itemClass,
  itemName,
}: {
  sockets: SocketSpec[]
  itemClass: string
  itemName: string
}): JSX.Element | null {
  const poeVersion = usePoeVersion()
  const sz = 20,
    gap = 5

  if (poeVersion === 2) {
    return <RuneSocketOverlayPoe2 count={sockets.length} itemClass={itemClass} itemName={itemName} sz={sz} gap={gap} />
  }

  return <SocketOverlayPoe1 sockets={sockets} itemClass={itemClass} itemName={itemName} sz={sz} gap={gap} linkPx={5} />
}
