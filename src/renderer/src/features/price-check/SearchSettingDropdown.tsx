import { renderSelectOptions } from '@renderer/shared/select-options'

/**
 * Compact `<select>` used in the per-search "Settings" row of the price checker.
 * Label-less by design -- the row sits tight below the filter chips where titles would add
 * vertical noise. Settings-tab dropdowns use `SettingSelectBox` instead.
 */
export function SearchSettingDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string; group?: string }>
  onChange: (v: T) => void
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="text-[11px] rounded bg-black/30 border border-border text-text outline-none px-[6px] py-[5px] cursor-pointer min-w-0"
    >
      {renderSelectOptions(options)}
    </select>
  )
}
