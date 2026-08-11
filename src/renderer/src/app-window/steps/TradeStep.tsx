import type { AppSettings, ProfileSettingValue, RuntimeSettings } from '@shared/types'
import { ErrorBanner } from '@renderer/components/ErrorBanner'
import { createTryHotkey } from '@renderer/components/primitives/hotkey-collisions'
import { PriceCheckTab } from '@renderer/features/settings/tabs/PriceCheckTab'
import { m } from '@shared/paraglide/messages.js'
import { NavButtons } from '../NavButtons'
import { StepHeader } from '../StepHeader'
import { useStepError } from '../use-step-error'
import { WasdHotkeyTip } from './shared'

export function TradeStep({
  settings,
  onUpdate,
  onProfileUpdate,
  onNext,
  onBack,
  stepNum,
  totalSteps,
  onBackToSettings,
  showWasdTip,
}: {
  settings: RuntimeSettings
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  onProfileUpdate: <K extends 'tradePriceOption'>(key: K, value: ProfileSettingValue<K>) => Promise<void>
  onNext: () => void
  onBack: () => void
  stepNum: number
  totalSteps: number
  onBackToSettings?: () => void
  showWasdTip?: boolean
}): JSX.Element {
  const { error, tone, showError } = useStepError()
  const tryHotkey = createTryHotkey(() => settings, settings.poeVersion ?? 1, showError)

  return (
    <div>
      <ErrorBanner message={error} tone={tone} inline />
      <StepHeader
        stepNum={stepNum}
        totalSteps={totalSteps}
        title={m.onb_trade_page_title()}
        subtitle={m.onb_trade_page_subtitle()}
      />
      <WasdHotkeyTip show={showWasdTip} />
      {/* gap-6 matches SettingsPanel's spacing for this tab's section titles. */}
      <div className="flex flex-col gap-6">
        <PriceCheckTab settings={settings} update={onUpdate} updateProfile={onProfileUpdate} tryHotkey={tryHotkey} />
      </div>
      <NavButtons
        onBack={onBack}
        onNext={onNext}
        secondaryLabel={m.onb_skip_for_now()}
        onSecondary={onNext}
        onBackToSettings={onBackToSettings}
      />
    </div>
  )
}
