import { StepFooter } from '../StepFooter'
import { StepHeader } from '../StepHeader'
import { m } from '@shared/paraglide/messages.js'

export function DoneStep({
  onOpenSettings,
  onCloseWindow,
}: {
  onOpenSettings: () => void
  onCloseWindow: () => void
}): JSX.Element {
  return (
    <div>
      <StepHeader title={m.onb_done_title()} subtitle={m.onb_done_subtitle()} />
      {/* Uses StepFooter directly rather than NavButtons: these are two terminal
          actions, not a Back/Next pair, but they sit where every other step's
          buttons sit. */}
      <StepFooter>
        <div className="flex gap-[10px]">
          <button className="primary px-6 py-[10px] text-[13px] font-semibold" onClick={onOpenSettings}>
            {m.onb_done_open_settings()}
          </button>
          <button onClick={onCloseWindow} className="px-6 py-[10px] text-[13px]">
            {m.onb_done_close_window()}
          </button>
        </div>
      </StepFooter>
    </div>
  )
}
