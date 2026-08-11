import poeFilterSettingImg from '../../assets/other/poe-filter-setting.png'
import { NavButtons } from '../NavButtons'
import { StepHeader } from '../StepHeader'
import { m } from '@shared/paraglide/messages.js'

export function OnlineFilterSetupStep({
  filterName,
  onNext,
  onBack,
  onBackToSettings,
}: {
  filterName: string
  onNext: () => void
  onBack: () => void
  onBackToSettings?: () => void
}): JSX.Element {
  return (
    <div>
      <StepHeader title={m.onb_online_title()} subtitle={m.onb_online_subtitle({ filter: filterName })} />

      <ol className="text-xs text-text-dim m-0 pl-5 leading-8 list-decimal -mt-4">
        <li>{m.onb_online_step1()}</li>
        <li>{m.onb_online_step2()}</li>
        <li>{m.onb_online_step3({ filter: filterName })}</li>
      </ol>

      <img
        src={poeFilterSettingImg}
        alt={m.onb_online_img_alt()}
        className="mt-4 rounded border border-border w-full"
      />

      <NavButtons onNext={onNext} onBack={onBack} nextLabel={m.common_done()} onBackToSettings={onBackToSettings} />
    </div>
  )
}
