// League-name rules shared by the league refresh (migrating a profile off a
// league that rotated out) and profile creation (picking the league a brand new
// profile starts on). Both answer the same question -- "which entry in this list
// is the current trade league?" -- so they answer it with the same code.

/** Ruthless is an opt-in ladder with its own economy. Never auto-pick it or
 *  auto-migrate someone into it; it has to be chosen by hand. */
function isRuthless(name: string): boolean {
  return /(^|\s)Ruthless(\s|$)/.test(name)
}

export function isHardcoreLeague(name: string): boolean {
  return name.startsWith('Hardcore ') || name.startsWith('HC ') || name === 'Hardcore'
}

export function isPermanentLeague(name: string): boolean {
  return name === 'Standard' || name === 'Hardcore'
}

/** The current challenge league from a league list, softcore unless asked
 *  otherwise. GGG returns the live challenge leagues first, so the first
 *  non-permanent, non-Ruthless entry of the right hardcore-ness is it. Falls
 *  back to the matching permanent league between leagues, and to the first
 *  entry if the list is shaped in some way we don't recognise. */
export function currentTradeLeague(
  list: readonly string[],
  { hardcore = false }: { hardcore?: boolean } = {},
): string | null {
  const challenge = list.find((l) => isHardcoreLeague(l) === hardcore && !isPermanentLeague(l) && !isRuthless(l))
  const permanent = list.find((l) => l === (hardcore ? 'Hardcore' : 'Standard'))
  return challenge ?? permanent ?? list[0] ?? null
}
