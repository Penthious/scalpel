/** Type declarations for the CJS build script, consumed by the co-located Vitest test. */

export interface VestigialRow {
  unique: string
  itemClass: string
  from: string
  to: string
}

export interface OrphanMod {
  to: string
}

export interface VestigialCandidate {
  from: string
  to: string
}

export type VestigialDataset = Record<string, VestigialCandidate[]>

export declare function decodeEntities(s: string): string
export declare function modText(html: string): string
export declare function normalizeChars(text: string): string
export declare function normKey(text: string): string
export declare function matchKey(text: string): string
export declare function parseAggregate(html: string): { rows: VestigialRow[]; orphans: OrphanMod[] }
export declare function parseUniqueModTexts(html: string): string[]
export declare function attributeOrphans(
  orphans: OrphanMod[],
  modsByUnique: Record<string, string[]>,
): { resolved: VestigialRow[]; unresolved: string[] }
export declare function buildDataset(rows: VestigialRow[]): VestigialDataset
export declare function assertSane(dataset: VestigialDataset, classes: Set<string>, unresolved: string[]): void
export declare function poedbSlug(name: string): string
export declare function main(): Promise<void>

export declare const GATES: {
  minDonors: number
  minCandidates: number
  requiredClasses: string[]
  maxUnresolved: number
}
export declare const ARMOUR_ITEM_CLASSES: Set<string>
export declare const OUT_FILE: string
export declare const SOURCES: {
  aggregate: string
  uniquePage: (slug: string) => string
  repoeUniques: string
}
