import type { OverlayAnchor } from '@shared/types'

/** The structural slice of the settings store this module touches. Narrower
 *  than Store<AppSettings> so tests can pass a plain object without mocking
 *  electron-store. */
export interface AnchorStore {
  get(key: 'pluginOverlayAnchors'): Record<string, OverlayAnchor> | undefined
  set(key: 'pluginOverlayAnchors', value: Record<string, OverlayAnchor>): void
}

/** The user-moved position of a plugin's overlay window, or undefined when the
 *  user has never moved it (the plugin's declared default anchor then wins). */
export function getPluginOverlayAnchor(store: AnchorStore, pluginId: string): OverlayAnchor | undefined {
  return store.get('pluginOverlayAnchors')?.[pluginId]
}

export function setPluginOverlayAnchor(store: AnchorStore, pluginId: string, anchor: OverlayAnchor): void {
  store.set('pluginOverlayAnchors', { ...store.get('pluginOverlayAnchors'), [pluginId]: anchor })
}

/** Drop a plugin's remembered geometry (on uninstall), so a later reinstall
 *  starts from the plugin's declared default again. */
export function clearPluginOverlayAnchor(store: AnchorStore, pluginId: string): void {
  const all = store.get('pluginOverlayAnchors')
  if (!all || !(pluginId in all)) return
  const rest = { ...all }
  delete rest[pluginId]
  store.set('pluginOverlayAnchors', rest)
}
