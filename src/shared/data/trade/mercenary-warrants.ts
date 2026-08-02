/** PoE1 Mercenary Warrant support (Allflame league).
 *
 *  A warrant carries the mercenary it sells ("Build: Mysterious Diver" in the
 *  clipboard), and the trade API gives every build its own entry in the `map`
 *  group of /api/trade/data/items, expressed as a type + discriminator pair:
 *
 *    { "type": "DivingDuelist", "text": "Mercenary Warrant (Mysterious Diver)",
 *      "disc": "mercenary_warrant" }
 *
 *  The parenthesised text is display-only; a search sends
 *  `type: { option: "DivingDuelist", discriminator: "mercenary_warrant" }`. The
 *  bare "Mercenary Warrant" type is also valid and matches every build at once,
 *  which is what the search falls back to when the build chip is switched off.
 *
 *  Keys are the build name exactly as the clipboard's "Build:" line prints it,
 *  which is the same string the trade text shows in parentheses -- "Infamous"
 *  variants included, so no prefix inference is needed. Seven builds have no
 *  Infamous entry in the catalog; those warrants fall back to the bare type.
 *
 *  Option ids are GGG's internal names, transcribed verbatim (Striker really is
 *  "MeleeStrikesMaraduerPhys"). Probed 2026-08-02 against the live catalog. Same
 *  shape as SCRYING_ORB_AREAS in ./scrying-orbs.
 *
 *  Mercenary Level is not part of the type -- it indexes as misc_filters.ilvl
 *  (capped at 83), which the price-check chip uses.
 */
export const MERCENARY_WARRANT_DISCRIMINATOR = 'mercenary_warrant'

/** Trade base type that matches every build at once. */
export const MERCENARY_WARRANT_BASE_TYPE = 'Mercenary Warrant'

export const MERCENARY_WARRANT_BUILDS: Record<string, string> = {
  Bastion: 'PhysicalDuelistShields',
  'Infamous Bastion': 'PhysicalDuelistShieldsNoble',
  'Blade Ambusher': 'TrapsMinesShadowAttack',
  'Infamous Blade Ambusher': 'TrapsMinesShadowAttackNoble',
  Bladebitter: 'Crit1HShadowPoison',
  'Infamous Bladebitter': 'Crit1HShadowPoisonNoble',
  Bladecaster: 'Crit1HShadowPhysSpell',
  'Infamous Bladecaster': 'Crit1HShadowPhysSpellNoble',
  Bloodletter: 'PhysicalDuelistBleed',
  'Infamous Bloodletter': 'PhysicalDuelistBleedNoble',
  Cardinal: 'AurasMinionsTemplarStaff',
  'Infamous Cardinal': 'AurasMinionsTemplarStaffNoble',
  Combatant: 'MeleeAOEStrikeDuelistRangeStrikes',
  'Infamous Combatant': 'MeleeAOEStrikeDuelistRangeStrikesNoble',
  'Cruel Mistress': 'ChaosMinionWitchChaosHit',
  'Infamous Cruel Mistress': 'ChaosMinionWitchChaosHitNoble',
  Earthshaker: 'MeleeAOEMarauderPhysSlam',
  'Infamous Earthshaker': 'MeleeAOEMarauderPhysSlamNoble',
  Eruptor: 'MeleeAOEMarauderFireSlam',
  'Infamous Eruptor': 'MeleeAOEMarauderFireSlamNoble',
  'Fallen Reverend': 'AurasMinionsTemplarSpectres',
  'Infamous Fallen Reverend': 'AurasMinionsTemplarSpectresNoble',
  Flamehand: 'ElementalWitchFire',
  Flamequiver: 'EleBowRangerFire',
  'Infamous Flamequiver': 'EleBowRangerFireNoble',
  'Flaming Charlatan': 'PhysConvertTemplarFire',
  'Frost Ambusher': 'TrapsMinesShadowCold',
  Frosthand: 'ElementalWitchCold',
  'Infamous Frosthand': 'ElementalWitchColdNoble',
  Kineticist: 'MiscScionWandAttacks',
  'Infamous Kineticist': 'MiscScionWandAttacksNoble',
  Manyshot: 'EleBowRangerClones',
  'Infamous Manyshot': 'EleBowRangerClonesNoble',
  'Mysterious Diver': 'DivingDuelist',
  'Infamous Mysterious Diver': 'DivingDuelistNoble',
  Reanimator: 'ChaosMinionWitchInstability',
  'Infamous Reanimator': 'ChaosMinionWitchInstabilityNoble',
  Ripper: 'MeleeAOEMarauderNonSlam',
  'Infamous Ripper': 'MeleeAOEMarauderNonSlamNoble',
  Sanguimancer: 'MiscScionPhysDot',
  'Infamous Sanguimancer': 'MiscScionPhysDotNoble',
  Shattersword: 'PhysicalDuelistSteel',
  'Shock Ambusher': 'TrapsMinesShadowLightning',
  'Infamous Shock Ambusher': 'TrapsMinesShadowLightningNoble',
  Smoulderstrike: 'MeleeStrikesMarauderFire',
  Sniper: 'NonEleBowRangerPhys',
  'Infamous Sniper': 'NonEleBowRangerPhysNoble',
  Stormhand: 'ElementalWitchLightning',
  'Infamous Stormhand': 'ElementalWitchLightningNoble',
  'Storming Zealot': 'PhysConvertTemplarLightning',
  'Infamous Storming Zealot': 'PhysConvertTemplarLightningNoble',
  Striker: 'MeleeStrikesMaraduerPhys',
  'Infamous Striker': 'MeleeStrikesMaraduerPhysNoble',
  Swiftblade: 'MeleeAOEStrikeDuelistCyclone',
  'Infamous Swiftblade': 'MeleeAOEStrikeDuelistCycloneNoble',
  Thunderquiver: 'EleBowRangerLightning',
  Toxicologist: 'NonEleBowRangerChaos',
  'Infamous Toxicologist': 'NonEleBowRangerChaosNoble',
  Warpriest: 'AurasMinionsTemplarSmite',
  'Infamous Warpriest': 'AurasMinionsTemplarSmiteNoble',
  'Winter Deacon': 'PhysConvertTemplarCold',
  Withertouch: 'ChaosMinionWitchDot',
  'Infamous Withertouch': 'ChaosMinionWitchDotNoble',
}
