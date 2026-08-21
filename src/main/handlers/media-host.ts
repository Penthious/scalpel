// utilityProcess child hosting the Windows media natives. WinRT's blocking
// waits deadlock/crash on Electron's main thread (a COM STA), so every SMTC
// call lives here, in a plain Node process, and plugin-media.ts only proxies.
// Forked on win32 only.
import { SMTCMonitor } from '@coooookies/windows-smtc-monitor'
import koffi from 'koffi'
import { normalizeMediaInfo } from './media-normalize'
import type { MediaSession } from '../../plugin-sdk/src/types'

export type MediaHostRequest =
  | { type: 'get'; id: number }
  | { type: 'command'; command: 'play-pause' | 'next' | 'previous' }
  | { type: 'watch' }
  | { type: 'unwatch' }

export type MediaHostResponse =
  | { type: 'session'; id: number; session: MediaSession | null }
  | { type: 'changed'; session: MediaSession | null }

const VK_MEDIA: Record<'play-pause' | 'next' | 'previous', number> = {
  'play-pause': 0xb3,
  next: 0xb0,
  previous: 0xb1,
}
const KEYEVENTF_EXTENDEDKEY = 0x1
const KEYEVENTF_KEYUP = 0x2

const user32 = koffi.load('user32.dll')
const keybdEvent = user32.func('void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)')

function sendMediaKey(vk: number): void {
  keybdEvent(vk, 0, KEYEVENTF_EXTENDEDKEY, 0)
  keybdEvent(vk, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)
}

function currentSession(): MediaSession | null {
  try {
    const info = SMTCMonitor.getCurrentMediaSession()
    return info ? normalizeMediaInfo(info, Date.now()) : null
  } catch {
    return null
  }
}

const post = (msg: MediaHostResponse): void => process.parentPort.postMessage(msg)

let monitor: SMTCMonitor | null = null
let emitTimer: NodeJS.Timeout | null = null

// Debounce: SMTC fires media/playback/timeline in bursts on track change; one
// coalesced push with the fresh state is enough.
function scheduleEmit(): void {
  if (emitTimer) return
  emitTimer = setTimeout(() => {
    emitTimer = null
    post({ type: 'changed', session: currentSession() })
  }, 150)
}

function startWatching(): void {
  if (monitor) return
  monitor = new SMTCMonitor()
  monitor.on('current-session-changed', scheduleEmit)
  monitor.on('session-added', scheduleEmit)
  monitor.on('session-removed', scheduleEmit)
  monitor.on('session-media-changed', scheduleEmit)
  monitor.on('session-playback-changed', scheduleEmit)
  monitor.on('session-timeline-changed', scheduleEmit)
}

function stopWatching(): void {
  if (!monitor) return
  monitor.destroy()
  monitor = null
  if (emitTimer) {
    clearTimeout(emitTimer)
    emitTimer = null
  }
}

process.parentPort.on('message', (e: { data: MediaHostRequest }) => {
  const msg = e.data
  switch (msg.type) {
    case 'get':
      post({ type: 'session', id: msg.id, session: currentSession() })
      break
    case 'command': {
      const vk = VK_MEDIA[msg.command]
      if (vk) sendMediaKey(vk)
      break
    }
    case 'watch':
      startWatching()
      break
    case 'unwatch':
      stopWatching()
      break
  }
})
