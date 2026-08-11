import type { AppSettings } from '@shared/types'
import { appMacroScope, chatCommandScope, scopeAppliesTo } from '@shared/macro-scope'
import { APP_MACRO_DEFS } from '@renderer/features/settings/tabs/utils'

type AppMacroId = (typeof APP_MACRO_DEFS)[number]['id']

export type Starter =
  | { kind: 'chat'; command: string; suggested: string }
  | { kind: 'macro'; action: AppMacroId; suggested: string }

/** Starter macros offered during onboarding. No `scope` field on purpose:
 *  macro-scope.ts already derives scope from the command text and action id, and
 *  a second copy here would be one more thing to keep in sync.
 *
 *  Suggested hotkeys avoid the `hotkey` / `priceCheckHotkey` defaults
 *  (Ctrl+D, Ctrl+A) and everything in POE_PROTECTED_HOTKEYS. They are only
 *  suggestions: the caller runs each through tryHotkey, because the user may
 *  have rebound the defaults two steps earlier. */
export const MACRO_STARTERS: Starter[] = [
  { kind: 'chat', command: '/hideout', suggested: 'CommandOrControl+H' },
  { kind: 'chat', command: '/exit', suggested: 'CommandOrControl+X' },
  { kind: 'chat', command: '/dnd', suggested: 'CommandOrControl+G' },
  { kind: 'chat', command: '/delve', suggested: 'CommandOrControl+V' },
  { kind: 'macro', action: 'openRegex', suggested: 'CommandOrControl+R' },
  { kind: 'macro', action: 'toggleWhiteboard', suggested: 'CommandOrControl+B' },
  { kind: 'macro', action: 'openDivCards', suggested: 'CommandOrControl+J' },
]

/** Stable identity for a starter, used as a React key and for dedupe. */
export function starterKey(starter: Starter): string {
  return starter.kind === 'chat' ? `chat:${starter.command}` : `macro:${starter.action}`
}

/** Starters that apply to the given game, using the same scope derivation the
 *  Macros tab uses to decide which existing rows to show. */
export function startersForGame(game: 1 | 2): Starter[] {
  return MACRO_STARTERS.filter((starter) =>
    scopeAppliesTo(starter.kind === 'chat' ? chatCommandScope(starter.command) : appMacroScope(starter.action), game),
  )
}

/** Whether the user already has this starter, so its chip renders inert.
 *  Compared on command/action only - a user who rebound the hotkey still has it. */
export function isStarterApplied(starter: Starter, settings: Pick<AppSettings, 'chatCommands' | 'appMacros'>): boolean {
  if (starter.kind === 'chat') {
    const target = starter.command.trim().toLowerCase()
    return (settings.chatCommands ?? []).some((c) => c.command.trim().toLowerCase() === target)
  }
  return (settings.appMacros ?? []).some((macro) => macro.action === starter.action)
}
