import { describe, expect, it } from 'vitest'
import type { RegistryEntry } from '@shared/plugin-registry-types'
import { partitionFeatured } from './featured'

const entry = (id: string, featured?: boolean): RegistryEntry =>
  ({
    id,
    name: id,
    author: 'a',
    description: 'd',
    repo: 'o/r',
    latestVersion: '1.0.0',
    scalpelMinVersion: '>=1.0.0',
    sha256: 'a'.repeat(64),
    featured,
  }) as RegistryEntry

describe('partitionFeatured', () => {
  it('splits featured from the rest', () => {
    const { featured, rest } = partitionFeatured([entry('a', true), entry('b'), entry('c', true)])
    expect(featured.map((e) => e.id)).toEqual(['a', 'c'])
    expect(rest.map((e) => e.id)).toEqual(['b'])
  })

  it('preserves registry array order within each group', () => {
    const { featured } = partitionFeatured([entry('z', true), entry('a', true)])
    expect(featured.map((e) => e.id)).toEqual(['z', 'a'])
  })

  it('returns everything as rest when no entry is featured', () => {
    const { featured, rest } = partitionFeatured([entry('a'), entry('b')])
    expect(featured).toEqual([])
    expect(rest).toHaveLength(2)
  })

  it('handles an empty registry', () => {
    expect(partitionFeatured([])).toEqual({ featured: [], rest: [] })
  })
})
