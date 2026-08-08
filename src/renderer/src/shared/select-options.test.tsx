// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { renderSelectOptions } from './select-options'
import { getPriceOptions } from './trade-settings'

function renderSelect(options: Parameters<typeof renderSelectOptions>[0]): HTMLSelectElement {
  const { container } = render(<select defaultValue="">{renderSelectOptions(options)}</select>)
  return container.querySelector('select') as HTMLSelectElement
}

describe('renderSelectOptions', () => {
  it('renders ungrouped options bare', () => {
    const select = renderSelect([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ])
    expect(select.querySelectorAll('optgroup')).toHaveLength(0)
    expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual(['a', 'b'])
  })

  it('wraps consecutive same-group options in one optgroup', () => {
    const select = renderSelect([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', group: 'More' },
      { value: 'c', label: 'C', group: 'More' },
    ])
    const groups = [...select.querySelectorAll('optgroup')]
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('More')
    expect([...groups[0].querySelectorAll('option')].map((o) => o.value)).toEqual(['b', 'c'])
    // The bare option stays outside the group, above it.
    expect(select.children[0].tagName).toBe('OPTION')
  })

  it('opens a new optgroup when the group changes', () => {
    const select = renderSelect([
      { value: 'a', label: 'A', group: 'One' },
      { value: 'b', label: 'B', group: 'Two' },
    ])
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['One', 'Two'])
  })

  it('closes an open group when a bare option follows it', () => {
    const select = renderSelect([
      { value: 'a', label: 'A', group: 'One' },
      { value: 'b', label: 'B' },
    ])
    expect(select.querySelectorAll('optgroup')).toHaveLength(1)
    expect(select.children[1].tagName).toBe('OPTION')
  })

  it('keeps every buyout option selectable in both games', () => {
    for (const version of [1, 2] as const) {
      const options = getPriceOptions(version)
      const select = renderSelect(options)
      expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual(options.map((o) => o.value))
      expect(select.querySelectorAll('optgroup')).toHaveLength(1)
    }
  })
})
