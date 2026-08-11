import appIcon from '../../../../../resources/icon.png'
import poe1Logo from '../../assets/other/poe1-logo.png'
import poe2Logo from '../../assets/other/poe2-logo.png'
import { IconGlow } from '../../shared/IconGlow'
import type { SelectedGames } from '../constants'
import { NavButtons } from '../NavButtons'
import { StepHeader } from '../StepHeader'
import { m } from '@shared/paraglide/messages.js'
import { GameCard } from './shared'

export function WelcomeStep({
  selectedGames,
  onSelectedGamesChange,
  onNext,
  onBackToSettings,
}: {
  selectedGames: SelectedGames
  onSelectedGamesChange: (g: SelectedGames) => void
  onNext: () => void
  onBackToSettings?: () => void
}): JSX.Element {
  const anySelected = selectedGames.poe1 || selectedGames.poe2
  return (
    <div>
      <IconGlow
        src={appIcon}
        size={64}
        blur={28}
        saturate={2}
        opacity={0.2}
        glowWidth={220}
        glowHeight={220}
        alt="Scalpel"
        className="mb-5"
      />
      <StepHeader title={m.onb_welcome_title()} subtitle={m.onb_welcome_subtitle()} />
      <div className="mb-5">
        <div className="flex gap-6 justify-center">
          <GameCard
            alt={m.onb_poe1_alt()}
            image={poe1Logo}
            selected={selectedGames.poe1}
            onClick={() => onSelectedGamesChange({ ...selectedGames, poe1: !selectedGames.poe1 })}
          />
          <GameCard
            alt={m.onb_poe2_alt()}
            image={poe2Logo}
            selected={selectedGames.poe2}
            onClick={() => onSelectedGamesChange({ ...selectedGames, poe2: !selectedGames.poe2 })}
          />
        </div>
      </div>
      <NavButtons
        onNext={onNext}
        nextLabel={m.common_continue()}
        nextDisabled={!anySelected}
        onBackToSettings={onBackToSettings}
      />
    </div>
  )
}
