import type { RegistryEntry } from '@shared/plugin-registry-types'

/** Split registry entries into the promoted group and everything else,
 *  preserving registry array order within each -- the registry array order is
 *  the curator's ordering and the only ranking signal the schema carries. */
export function partitionFeatured(entries: RegistryEntry[]): {
  featured: RegistryEntry[]
  rest: RegistryEntry[]
} {
  const featured: RegistryEntry[] = []
  const rest: RegistryEntry[] = []
  for (const entry of entries) {
    if (entry.featured) featured.push(entry)
    else rest.push(entry)
  }
  return { featured, rest }
}
