import type { RuntimeSettings } from '@shared/types'
import { FilterPicker } from '../../components/FilterPicker'
import { NavButtons } from '../NavButtons'
import { StepHeader } from '../StepHeader'
import { m } from '@shared/paraglide/messages.js'
import { gameLabel } from './shared'

export function FilterStep({
  settings,
  onSettingsChange,
  onNext,
  onBack,
  onOnlineImport,
  game,
  stepNum,
  totalSteps,
  onBackToSettings,
}: {
  settings: RuntimeSettings
  onSettingsChange: (s: RuntimeSettings) => void
  onNext: () => void
  onBack: () => void
  onOnlineImport?: (name: string) => void
  game: 1 | 2 | null
  stepNum: number
  totalSteps: number
  onBackToSettings?: () => void
}): JSX.Element {
  const prefix = gameLabel(game)
  return (
    <div>
      <StepHeader
        stepNum={stepNum}
        totalSteps={totalSteps}
        title={prefix ? m.onb_filter_title_game({ prefix }) : m.onb_filter_title()}
        subtitle={m.onb_filter_subtitle()}
      />
      <div className="-mt-3">
        <FilterPicker
          settings={settings}
          onSettingsChange={onSettingsChange}
          onOnlineImport={onOnlineImport}
          mode="list"
          maxListHeight={140}
        />
      </div>
      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!settings.activeProfile?.filterPath}
        secondaryLabel={m.onb_skip_for_now()}
        onSecondary={onNext}
        onBackToSettings={onBackToSettings}
      />
    </div>
  )
}
