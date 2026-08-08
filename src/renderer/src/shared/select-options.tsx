/**
 * Shared `<option>` rendering for the app's native `<select>` dropdowns.
 *
 * An option may carry a `group`; consecutive entries sharing one are wrapped in
 * a single `<optgroup>`, which the OS renders as a non-selectable bold heading
 * with the members indented under it. That is how the buyout-currency dropdowns
 * separate the handful of commonly-used currencies from GGG's long tail without
 * needing a custom popup. Options with no `group` render bare, so every other
 * dropdown in the app is unaffected.
 *
 * Grouping is positional, not by key: entries are chunked as they appear, so
 * the caller controls ordering and a group name that reappears later would open
 * a second `<optgroup>` rather than reordering anything.
 */
export interface SelectOption<T extends string> {
  value: T
  label: string
  group?: string
}

export function renderSelectOptions<T extends string>(options: ReadonlyArray<SelectOption<T>>): JSX.Element[] {
  const nodes: JSX.Element[] = []
  let pending: SelectOption<T>[] = []

  const flush = (): void => {
    if (pending.length === 0) return
    const group = pending[0].group as string
    nodes.push(
      <optgroup key={`group-${group}-${pending[0].value}`} label={group}>
        {pending.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </optgroup>,
    )
    pending = []
  }

  for (const o of options) {
    if (!o.group) {
      flush()
      nodes.push(
        <option key={o.value} value={o.value}>
          {o.label}
        </option>,
      )
      continue
    }
    if (pending.length > 0 && pending[0].group !== o.group) flush()
    pending.push(o)
  }
  flush()

  return nodes
}
