export type Step =
  | 'welcome'
  | 'filter-folder-poe1'
  | 'filter-poe1'
  | 'online-filter-setup-poe1'
  | 'filter-folder-poe2'
  | 'filter-poe2'
  | 'online-filter-setup-poe2'
  | 'hotkey'
  | 'trade'
  | 'preferences'
  | 'plugins'
  | 'macros'
  | 'done'
  | 'settings'

export const STEP_ORDER: Step[] = [
  'welcome',
  'filter-folder-poe1',
  'filter-poe1',
  'online-filter-setup-poe1',
  'filter-folder-poe2',
  'filter-poe2',
  'online-filter-setup-poe2',
  'hotkey',
  'trade',
  'preferences',
  'plugins',
  'macros',
  'done',
  'settings',
]

export type SelectedGames = { poe1: boolean; poe2: boolean }

/** The numbered steps that follow the per-game filter setup, in display order.
 *  Adding a page to the onboarding tail means adding it here -- the total, the
 *  per-step numbers, and the numbering tests all derive from this one list. */
export const SHARED_STEPS: Step[] = ['hotkey', 'trade', 'preferences', 'plugins', 'macros']

/** Total visible onboarding steps for a given game selection.
 *  The shared tail plus 2 per game (folder, filter). */
export function totalOnboardingSteps(games: SelectedGames): number {
  const gameCount = (games.poe1 ? 1 : 0) + (games.poe2 ? 1 : 0)
  return SHARED_STEPS.length + 2 * Math.max(gameCount, 1)
}

/** Steps that existed in earlier builds and no longer render. A user who quit
 *  mid-onboarding has one of these persisted in `onboardingStep`; without a
 *  remap they resume to a step that renders nothing at all. */
const LEGACY_STEP_MAP: Record<string, Step> = {
  profiles: 'welcome',
  // Both folded into the Trade page, which carries the price-check hotkey and
  // the trade login button as its first section.
  'pricecheck-hotkey': 'trade',
  'trade-login': 'trade',
}

/** Resolve a persisted `onboardingStep` to a step that actually renders.
 *  Unknown values fall back to 'welcome': a restarted flow beats a blank window,
 *  and it means a future step removal degrades gracefully even if whoever
 *  removes it forgets to add a LEGACY_STEP_MAP entry. */
export function resolveResumeStep(persisted: string | undefined): Step | null {
  if (!persisted) return null
  if (STEP_ORDER.includes(persisted as Step)) return persisted as Step
  return LEGACY_STEP_MAP[persisted] ?? 'welcome'
}
