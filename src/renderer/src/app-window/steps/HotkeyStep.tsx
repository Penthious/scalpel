import type { AppSettings } from '@shared/types'
import { HotkeyField } from '../../components/primitives/HotkeyField'
import { NavButtons } from '../NavButtons'
import { StepHeader } from '../StepHeader'
import { m } from '@shared/paraglide/messages.js'
import { WasdHotkeyTip } from './shared'

export function HotkeyStep({
  settings,
  onUpdate,
  onNext,
  onBack,
  stepNum,
  totalSteps,
  onBackToSettings,
  showWasdTip,
}: {
  settings: AppSettings
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  onNext: () => void
  onBack: () => void
  stepNum: number
  totalSteps: number
  onBackToSettings?: () => void
  showWasdTip?: boolean
}): JSX.Element {
  return (
    <div>
      <StepHeader
        stepNum={stepNum}
        totalSteps={totalSteps}
        title={m.onb_hotkey_title()}
        subtitle={m.onb_hotkey_subtitle()}
      />
      <HotkeyField value={settings.hotkey} onChange={(acc) => onUpdate('hotkey', acc)} />
      <WasdHotkeyTip show={showWasdTip} />
      <NavButtons onBack={onBack} onNext={onNext} onBackToSettings={onBackToSettings} />
    </div>
  )
}
