import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const onLine = { cb: null as ((line: string) => void) | null }

vi.mock('./watcher', () => ({
  startWatcher: (_path: string, cb: (line: string) => void) => {
    onLine.cb = cb
  },
}))
vi.mock('./path-resolver', () => ({ resolveClientLogPath: () => 'C:/fake/Client.txt' }))
vi.mock('./seed-last-zone', () => ({ readLastZoneFromLog: () => null }))
vi.mock('../game-state', () => ({ getPoeVersion: () => 2 }))
vi.mock('./zone-state', () => ({
  getCurrentZone: () => null,
  ingestZoneEvent: vi.fn(),
  onZoneChanged: vi.fn(),
}))

import { _resetForTests, forwardLogLinesTo, startClientLogWatcher } from './index'
import { _resetForTests as resetBuffer, addLogLineSubscriberRef, getRecentLogLines } from './tail-buffer'

function fakeWin(): import('electron').BrowserWindow {
  return {
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  } as unknown as import('electron').BrowserWindow
}

describe('client-log index forwarding', () => {
  beforeEach(() => {
    resetBuffer()
    _resetForTests()
    onLine.cb = null
  })
  afterEach(() => vi.clearAllMocks())

  it('buffers every raw line including non-zone lines', () => {
    startClientLogWatcher(fakeWin())
    onLine.cb?.('2024/01/01 12:00:00 random chat line')
    expect(getRecentLogLines()).toContain('2024/01/01 12:00:00 random chat line')
  })

  it('forwards raw lines to subscribed windows only when a subscriber exists', () => {
    startClientLogWatcher(fakeWin())
    const logWin = fakeWin()
    forwardLogLinesTo(() => logWin)

    // No subscriber yet -> no forward.
    onLine.cb?.('line-without-subscriber')
    expect(logWin.webContents.send).not.toHaveBeenCalled()

    // With a subscriber -> forwarded on channel client-log:line.
    addLogLineSubscriberRef()
    onLine.cb?.('line-with-subscriber')
    expect(logWin.webContents.send).toHaveBeenCalledTimes(1)
    expect(logWin.webContents.send).toHaveBeenCalledWith('client-log:line', 'line-with-subscriber')
  })

  it('forwards lines to the overlay window passed to startClientLogWatcher', () => {
    const overlay = fakeWin()
    startClientLogWatcher(overlay)
    addLogLineSubscriberRef()
    onLine.cb?.('to-overlay')
    expect(overlay.webContents.send).toHaveBeenCalledWith('client-log:line', 'to-overlay')
  })
})
