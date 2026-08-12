import type { StatFilter } from '../../trade'
import { SKILL_GEM_CLASSES } from '@shared/poe-item'

type SocketItemInfo = {
  sockets: string
  linkedSockets: number
  itemClass: string
  runes?: string[]
}

// Socket chips: rune sockets (PoE2), white sockets, abyssal sockets, links
export function buildSocketFilters(
  itemInfo: SocketItemInfo | undefined,
  explicits: string[] = [],
  implicits: string[] = [],
): StatFilter[] {
  if (!itemInfo) return []

  // Gems are not socketable items in either game -- PoE1 gems have no sockets;
  // PoE2 gem sockets are support slots handled by the gems producer. Skip here
  // to avoid emitting bogus rune-socket chips for support-gem socket lines.
  if (SKILL_GEM_CLASSES.has(itemInfo.itemClass)) return []

  const out: StatFilter[] = []

  // Parse socket colors
  const socketStr = itemInfo.sockets.replace(/[-\s]/g, '')
  const w = (socketStr.match(/W/g) ?? []).length
  const a = (socketStr.match(/A/g) ?? []).length
  const s = (socketStr.match(/S/g) ?? []).length // PoE2 rune sockets

  // PoE2 rune sockets: one chip per item with min = current count. Rune-socket count
  // is load-bearing for PoE2 (2-socket body armours trade at a premium); enabled by
  // default so searches narrow to "at least this many" unless the user turns it off.
  //
  // Special-rune mechanic: some "(rune)"-tagged mods occupy a visible socket without
  // counting toward the GGG trade site's rune_sockets equipment filter, so the visible
  // socket count over-states what trade will match. Two known kinds:
  //   - Warping runes: "Can roll <Theme> modifiers" (Chronomancy, Berserking, etc.)
  //   - Modifier-grant runes: "+N Prefix/Suffix Modifier(s) allowed"
  // Subtract one per special rune. Normal stat runes (resistances, life, ...) DO count
  // and are not matched here. Verified by live trade2 probing: a 2-socket boot with two
  // special runes indexes as rune_sockets 0; with one, as 1. The patterns are
  // case-sensitive so the capital-M implicit "Can roll Ring Modifiers" (never in
  // runes[]) is never discounted.
  if (s > 0) {
    const specialRune = /^(?:Can roll .+ modifiers|\+\d+ (?:Prefix|Suffix) Modifiers? allowed)$/
    const specialRuneCount = (itemInfo.runes ?? []).filter((r) => specialRune.test(r.trim())).length
    const effectiveRuneSockets = s - specialRuneCount
    if (effectiveRuneSockets > 0) {
      out.push({
        id: 'socket.rune_sockets',
        text: `${effectiveRuneSockets} Rune Socket${effectiveRuneSockets === 1 ? '' : 's'}`,
        value: effectiveRuneSockets,
        min: effectiveRuneSockets,
        max: null,
        enabled: true,
        type: 'socket',
      })
    }
  }

  // White sockets chip goes into filters (type: 'explicit') -- preserved quirk from
  // the original inline block. Returned here so the orchestrator can spread it into
  // the right array.
  // NOTE: callers must spread the white-sockets entry into the `filters` array (not
  // miscFilters) to match original behavior. The chip is returned as a normal entry;
  // the caller is responsible for routing it.
  if (w > 0) {
    out.push({
      id: 'socket.white_sockets',
      text: 'White Sockets',
      value: w,
      min: w,
      max: null,
      enabled: false,
      type: 'explicit',
    })
  }

  if (a > 0) {
    // Trade indexes each abyssal-socket GRANT under its own id at its own value,
    // never the item's total socket count: a Darkness Enthroned carries the
    // Stygian Vise implicit "Has 1 Abyssal Socket" AND the unique's own explicit
    // copy of that line, and indexes as implicit.stat_3527617737 = 1 plus
    // explicit.stat_3527617737 = 1. One chip at the socket count therefore asked
    // for "implicit >= 2" and matched nothing (probe-verified). So: one chip
    // per source, each pinned to the number printed on that source's own line. A
    // grant covering several sockets prints them as one line and indexes as that
    // one value ("Has 2 Abyssal Sockets" on a two-socket Bubonic Trail = 2), which
    // is why the count comes off the line rather than from counting `A`s.
    //
    // The implicit-vs-explicit split follows the clipboard text, not advancedMods --
    // basic copies (no advanced mod block, chat-linked items) still carry the raw
    // explicits[] / implicits[] lines, so this signal exists on every copy path.
    const abyssLine = /^Has (\d+) Abyssal Sockets?$/i
    const stripTag = (l: string) => l.replace(/\s*\((?:implicit|crafted|fractured)\)\s*$/i, '').trim()
    const granted = (lines: string[]) => lines.reduce((n, l) => n + Number(abyssLine.exec(stripTag(l))?.[1] ?? 0), 0)
    const sources: Array<{ domain: 'implicit' | 'explicit'; count: number }> = []
    const implicitCount = granted(implicits)
    const explicitCount = granted(explicits)
    if (implicitCount > 0) sources.push({ domain: 'implicit', count: implicitCount })
    if (explicitCount > 0) sources.push({ domain: 'explicit', count: explicitCount })
    // No abyss line at all (unidentified item, inherent unique socket) keeps the
    // old default: a single implicit chip at the socket count.
    if (sources.length === 0) sources.push({ domain: 'implicit', count: a })
    // Both sources granting means two rows on two different ids; name the source so
    // they don't read as one row printed twice.
    const nameSource = sources.length > 1
    for (const { domain, count } of sources) {
      out.push({
        id: `${domain}.stat_3527617737`,
        text: nameSource ? `Abyssal Sockets (${domain})` : 'Abyssal Sockets',
        value: count,
        min: count,
        max: null,
        enabled: true,
        type: domain,
      })
    }
  }

  if (itemInfo.linkedSockets >= 5) {
    out.push({
      id: 'socket.links',
      text: `${itemInfo.linkedSockets}L`,
      value: itemInfo.linkedSockets,
      min: itemInfo.linkedSockets,
      max: null,
      enabled: true,
      type: 'socket',
    })
  }

  return out
}
