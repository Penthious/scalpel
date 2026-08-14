import type {
  Intent,
  MoveBaseTypePayload,
  RemoveBaseTypePayload,
  AddBaseTypePayload,
  SetActionPayload,
  SetThresholdPayload,
  SetVisibilityPayload,
} from './intents'

/** Turn a recorded intent into a human-readable description (+ item name for moves). */
export function describeIntent(intent: Intent): { description: string; itemName?: string } {
  const { typePath, tier } = intent.target
  if (intent.type === 'move-basetype') {
    const p = intent.payload as MoveBaseTypePayload
    return { description: `Moved to ${tier}`, itemName: p.value }
  }
  if (intent.type === 'remove-basetype') {
    const p = intent.payload as RemoveBaseTypePayload
    return { description: `Removed from ${tier}`, itemName: p.value }
  }
  if (intent.type === 'add-basetype') {
    const p = intent.payload as AddBaseTypePayload
    return { description: `Hidden in ${tier}`, itemName: p.value }
  }
  if (intent.type === 'set-visibility') {
    const p = intent.payload as SetVisibilityPayload
    return { description: `Set ${typePath}/${tier} to ${p.visibility}` }
  }
  if (intent.type === 'set-threshold') {
    const p = intent.payload as SetThresholdPayload
    return { description: `Set ${p.condition} ${p.operator} ${p.value} on ${typePath}/${tier}` }
  }
  if (intent.type === 'set-action') {
    const p = intent.payload as SetActionPayload
    return { description: `Changed ${p.action} on ${typePath}/${tier}` }
  }
  // Safe fallback for any future intent type (avoids "Changed undefined ...").
  return { description: `Changed ${typePath}/${tier}` }
}
