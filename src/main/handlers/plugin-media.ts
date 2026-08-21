import path from 'node:path'
import { ipcMain, utilityProcess } from 'electron'
import type { IpcMainEvent, UtilityProcess, WebContents } from 'electron'
import type { MediaSession } from '../../plugin-sdk/src/types'
import type { MediaHostRequest, MediaHostResponse } from './media-host'

// WinRT's blocking waits deadlock/crash on Electron's main thread (a COM STA),
// so the SMTC natives live in a utilityProcess child (media-host.ts) and this
// handler only proxies. The child is forked on first use and kept for the app's
// lifetime; the WinRT listeners inside it start/stop with the subscriber count.

const GET_TIMEOUT_MS = 2_000

const subscribers = new Set<WebContents>()
const pendingGets = new Map<number, (session: MediaSession | null) => void>()
let child: UtilityProcess | null = null
let nextGetId = 1

function ensureChild(): UtilityProcess | null {
  if (process.platform !== 'win32') return null
  if (child) return child
  const spawned = utilityProcess.fork(path.join(__dirname, 'media-host.js'))
  child = spawned
  spawned.on('message', (msg: MediaHostResponse) => {
    if (msg.type === 'session') {
      const resolve = pendingGets.get(msg.id)
      pendingGets.delete(msg.id)
      resolve?.(msg.session)
    } else if (msg.type === 'changed') {
      for (const w of subscribers) {
        if (!w.isDestroyed()) w.send('plugins:media-changed', msg.session)
      }
    }
  })
  spawned.on('exit', () => {
    // A native crash inside the child must not wedge the renderer: resolve
    // whatever was in flight and let the next call re-fork.
    if (child === spawned) child = null
    for (const resolve of pendingGets.values()) resolve(null)
    pendingGets.clear()
  })
  if (subscribers.size > 0) send({ type: 'watch' })
  return spawned
}

function send(msg: MediaHostRequest): void {
  ensureChild()?.postMessage(msg)
}

function getSession(): Promise<MediaSession | null> {
  if (!ensureChild()) return Promise.resolve(null)
  return new Promise((resolve) => {
    const id = nextGetId++
    pendingGets.set(id, resolve)
    setTimeout(() => {
      if (pendingGets.delete(id)) resolve(null)
    }, GET_TIMEOUT_MS)
    send({ type: 'get', id })
  })
}

function removeSubscriber(wc: WebContents): void {
  if (!subscribers.delete(wc)) return
  if (subscribers.size === 0 && child) send({ type: 'unwatch' })
}

/** Register the now-playing capability backing `ctx.media`. Reads Windows'
 *  system media transport controls (SMTC) session; commands are synthesized
 *  system media keys, routed by Windows to whichever player is current. On
 *  non-Windows hosts every read resolves null and commands are no-ops. */
export function registerPluginMediaHandlers(): void {
  ipcMain.handle('plugins:media-get', () => getSession())

  ipcMain.on('plugins:media-command', (_evt, command: 'play-pause' | 'next' | 'previous') => {
    if (command === 'play-pause' || command === 'next' || command === 'previous') send({ type: 'command', command })
  })

  ipcMain.on('plugins:media-watch', (evt: IpcMainEvent) => {
    const wc = evt.sender
    if (subscribers.has(wc)) return
    subscribers.add(wc)
    wc.once('destroyed', () => removeSubscriber(wc))
    if (subscribers.size === 1) send({ type: 'watch' })
  })

  ipcMain.on('plugins:media-unwatch', (evt: IpcMainEvent) => {
    removeSubscriber(evt.sender)
  })
}
