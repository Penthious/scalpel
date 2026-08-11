import type { AppSettings, RuntimeSettings } from '@shared/types'
import { ErrorBanner } from '@renderer/components/ErrorBanner'
import {
  createTryHotkey,
  narrowScopeForCrossGameConflict,
  type HotkeySlot,
} from '@renderer/components/primitives/hotkey-collisions'
import { MacrosTab } from '@renderer/features/settings/tabs/MacrosTab'
import { PoeVersionProvider } from '@renderer/shared/poe-version-context'
import { m } from '@shared/paraglide/messages.js'
import { isStarterApplied, starterKey, startersForGame, type Starter } from '../onboarding-macro-starters'
import { NavButtons } from '../NavButtons'
import { StepHeader } from '../StepHeader'
import { useStepError } from '../use-step-error'
import { APP_MACRO_DEFS } from '@renderer/features/settings/tabs/utils'

function starterLabel(starter: Starter): string {
  if (starter.kind === 'chat') return starter.command
  return APP_MACRO_DEFS.find((d) => d.id === starter.action)?.label ?? starter.action
}

export function MacrosStep({
  settings,
  onUpdate,
  onNext,
  onBack,
  stepNum,
  totalSteps,
  onBackToSettings,
}: {
  settings: RuntimeSettings
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  onNext: () => void
  onBack: () => void
  stepNum: number
  totalSteps: number
  onBackToSettings?: () => void
}): JSX.Element {
  const { error, tone, showError } = useStepError()
  const game = settings.poeVersion ?? 1
  const tryHotkey = createTryHotkey(() => settings, game, showError)

  const applyStarter = (starter: Starter): void => {
    // The suggested hotkey is a suggestion, not a guarantee: the user may have
    // bound it to the filter or price-check hotkey two steps ago. On a collision
    // add the row with no hotkey so they can record their own, rather than
    // silently stealing a binding they just chose.
    //
    // HotkeySlot for these two kinds carries the row index (see
    // hotkey-collisions.ts), and the row is about to be appended, so the index
    // is the current array length. Passing the wrong index makes the new row
    // collide with itself and every suggestion falls back to empty.
    //
    // A suggested hotkey can also be held by an other-game-only entry, which
    // passes the current-game collision check above but would collide back in
    // that other game. narrowScopeForCrossGameConflict is the same guard
    // MacrosTab and ExtraFeaturesPanel run on every hotkey write; skipping it
    // here would let a starter chip write a `both`-scope row over a PoE1-only
    // binding.
    if (starter.kind === 'chat') {
      const rows = settings.chatCommands ?? []
      const slot: HotkeySlot = { kind: 'chat', index: rows.length }
      const ok = tryHotkey(starter.suggested, slot)
      const hotkey = ok ? starter.suggested : ''
      const scope = narrowScopeForCrossGameConflict(settings, hotkey, slot, game)
      onUpdate('chatCommands', [...rows, { hotkey, command: starter.command, scope }])
    } else {
      const rows = settings.appMacros ?? []
      const slot: HotkeySlot = { kind: 'appmacro', index: rows.length }
      const ok = tryHotkey(starter.suggested, slot)
      const hotkey = ok ? starter.suggested : ''
      const scope = narrowScopeForCrossGameConflict(settings, hotkey, slot, game)
      onUpdate('appMacros', [...rows, { action: starter.action, hotkey, scope }])
    }
  }

  return (
    <div>
      <ErrorBanner message={error} tone={tone} inline />
      <StepHeader
        stepNum={stepNum}
        totalSteps={totalSteps}
        title={m.onb_macros_title()}
        subtitle={m.onb_macros_subtitle()}
      />
      <section className="flex flex-col gap-2 mb-2">
        <div className="settings-section-title">{m.onb_macros_suggested()}</div>
        <div className="flex flex-wrap gap-1.5">
          {startersForGame(game).map((starter) => {
            const applied = isStarterApplied(starter, settings)
            return (
              <button
                key={starterKey(starter)}
                disabled={applied}
                onClick={() => applyStarter(starter)}
                className={`text-[11px] px-3 py-1.5 ${
                  applied ? 'bg-accent/20 text-accent cursor-default' : 'text-text-dim'
                }`}
              >
                {starterLabel(starter)}
              </button>
            )
          })}
        </div>
      </section>
      <PoeVersionProvider version={game}>
        <div className="flex flex-col gap-6">
          <MacrosTab settings={settings} update={onUpdate} tryHotkey={tryHotkey} />
        </div>
      </PoeVersionProvider>
      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextLabel={m.common_finish()}
        secondaryLabel={m.onb_skip_for_now()}
        onSecondary={onNext}
        onBackToSettings={onBackToSettings}
      />
    </div>
  )
}
