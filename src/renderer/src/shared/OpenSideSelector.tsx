import type { AppSettings } from '@shared/types'
import { m } from '@shared/paraglide/messages.js'

/** Which screen edge the overlay mounts on at scan time. Shared by the View
 *  settings tab and the onboarding Preferences step. */
export function OpenSideSelector({
  value,
  onChange,
}: {
  value: AppSettings['openSide'] | undefined
  onChange: (value: AppSettings['openSide']) => void
}): JSX.Element {
  return (
    <div className="flex gap-1.5 mt-[6px]">
      {(
        [
          ['both', m.settings_side_both()],
          ['right', m.settings_side_right()],
          ['left', m.settings_side_left()],
        ] as const
      ).map(([option, label]) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`text-[11px] px-3 py-1.5 ${
            (value ?? 'both') === option ? 'bg-accent text-bg-solid' : 'text-text-dim'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
