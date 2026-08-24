import Store from 'electron-store'

interface PinStoreSchema {
  pins: Record<string, boolean>
}

// Own store file (not the main config store) so two electron-store instances
// never race on the same json. Lazy-init keeps module import side-effect free
// for tests and boot ordering.
let store: Store<PinStoreSchema> | null = null

function getStore(): Store<PinStoreSchema> {
  if (!store) {
    store = new Store<PinStoreSchema>({ name: 'scalpel-overlay-pins', defaults: { pins: {} } })
  }
  return store
}

/** The user's stored pin choice, or undefined when they never toggled this
 *  overlay. Undefined is meaningful: overlays with a pinned-by-default spec
 *  (plugin overlays) fall back to their default only when no explicit choice
 *  exists, so false must persist as false rather than being deleted. */
export function readOverlayPinned(id: string): boolean | undefined {
  return getStore().get('pins')[id]
}

export function writeOverlayPinned(id: string, pinned: boolean): void {
  getStore().set('pins', { ...getStore().get('pins'), [id]: pinned })
}
