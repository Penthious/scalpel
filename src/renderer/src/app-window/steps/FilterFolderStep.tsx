import { getGameFeatures } from '@shared/game-features'
import type { RuntimeSettings } from '@shared/types'
import { FilterPicker } from '../../components/FilterPicker'
import { NavButtons } from '../NavButtons'
import { StepHeader } from '../StepHeader'
import { m } from '@shared/paraglide/messages.js'
import { gameLabel } from './shared'

export function FilterFolderStep({
  settings,
  onSettingsChange,
  onNext,
  onBack,
  game,
  stepNum,
  totalSteps,
  onBackToSettings,
}: {
  settings: RuntimeSettings
  onSettingsChange: (s: RuntimeSettings) => void
  onNext: () => void
  onBack?: () => void
  game: 1 | 2 | null
  stepNum: number
  totalSteps: number
  onBackToSettings?: () => void
}): JSX.Element {
  const prefix = gameLabel(game)
  const folderHint = getGameFeatures(game ?? 1).filterFolderHint
  return (
    <div>
      <StepHeader
        stepNum={stepNum}
        totalSteps={totalSteps}
        title={prefix ? m.onb_folder_title_game({ prefix }) : m.onb_folder_title()}
        subtitle={m.onb_folder_subtitle({ hint: folderHint })}
      />
      <FilterPicker settings={settings} onSettingsChange={onSettingsChange} mode="folder" />
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
