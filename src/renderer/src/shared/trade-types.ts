export interface Listing {
  id: string
  price: { amount: number; currency: string } | null
  account: string
  characterName?: string
  online: boolean
  instantBuyout: boolean
  icon?: string
  indexed?: string
  itemData?: {
    name?: string
    baseType?: string
    explicitMods?: string[]
    implicitMods?: string[]
    enchantMods?: string[]
    runeMods?: string[]
    fracturedMods?: string[]
    foulbornMods?: string[]
    craftedMods?: string[]
    desecratedMods?: string[]
    ilvl?: number
    sockets?: Array<{ group: number; sColour: string }>
    gemLevel?: number
    quality?: number
    areaLevel?: number
    chartZone?: string
    heistJob?: { skill: string; level: number }
    corrupted?: boolean
    mirrored?: boolean
    sanctified?: boolean
    identified?: boolean
    templeOpenRooms?: string[]
    templeObstructedRooms?: string[]
    storedExperience?: number
    memoryStrands?: number
    /** Allflame crafting (3.29) fail chance, whole percent. Lower is better. */
    intangibility?: number
    modTiers?: Record<string, { tier: string; name: string; ranges: string }>
    grantedSkills?: Array<{ text: string; icon?: string }>
    /** Mercenary Warrant kit: each skill with the supports linked to it, in the
     *  order the item prints them. */
    mercenarySkills?: Array<{ name: string; icon?: string; supports: Array<{ name: string; tier?: number }> }>
    rarity?: string
    armour?: number
    evasion?: number
    energyShield?: number
    pdps?: number
    edps?: number
    dps?: number
    mapProperties?: Array<{ name: string; value: string }>
  }
}

export interface BulkListing {
  id: string
  account: string
  characterName?: string
  online: boolean
  stock: number
  pay: { amount: number; currency: string }
  get: { amount: number; currency: string }
  ratio: number
  whisper?: string
}
