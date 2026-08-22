import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (...a: unknown[]) => unknown>()
const listeners = new Map<string, (...a: unknown[]) => unknown>()

type FakeChild = {
  postMessage: ReturnType<typeof vi.fn>
  kill: ReturnType<typeof vi.fn>
  on: (ev: string, fn: (...a: unknown[]) => void) => void
  emit: (ev: string, ...a: unknown[]) => void
}

const forkedChildren: FakeChild[] = []
function makeFakeChild(): FakeChild {
  const handlersByEvent = new Map<string, ((...a: unknown[]) => void)[]>()
  return {
    postMessage: vi.fn(),
    kill: vi.fn(),
    on: (ev, fn) => {
      const list = handlersByEvent.get(ev) ?? []
      list.push(fn)
      handlersByEvent.set(ev, list)
    },
    emit: (ev, ...a) => {
      for (const fn of handlersByEvent.get(ev) ?? []) fn(...a)
    },
  }
}

const fork = vi.fn(() => {
  const c = makeFakeChild()
  forkedChildren.push(c)
  return c
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: (ch: string, fn: (...a: unknown[]) => unknown) => handlers.set(ch, fn),
    on: (ch: string, fn: (...a: unknown[]) => unknown) => listeners.set(ch, fn),
  },
  utilityProcess: { fork: (...a: unknown[]) => fork(...(a as [])) },
}))

describe('plugin media handlers', () => {
  // The suite exercises the Windows proxy path; ensureChild() no-ops on any
  // other platform, so pin win32 regardless of the host running the tests.
  const realPlatform = process.platform
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    handlers.clear()
    listeners.clear()
    forkedChildren.length = 0
    vi.clearAllMocks()
    vi.resetModules()
  })
  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: realPlatform })
  })

  it('resolves null without forking on non-Windows hosts', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const { registerPluginMediaHandlers } = await import('./plugin-media')
    registerPluginMediaHandlers()
    await expect(handlers.get('plugins:media-get')!({})).resolves.toBeNull()
    expect(fork).not.toHaveBeenCalled()
  })

  it('registers get / command / watch / unwatch channels', async () => {
    const { registerPluginMediaHandlers } = await import('./plugin-media')
    registerPluginMediaHandlers()
    expect([...handlers.keys()]).toEqual(expect.arrayContaining(['plugins:media-get']))
    expect([...listeners.keys()]).toEqual(
      expect.arrayContaining(['plugins:media-command', 'plugins:media-watch', 'plugins:media-unwatch']),
    )
  })

  it('get forks the child once and resolves with its response', async () => {
    const { registerPluginMediaHandlers } = await import('./plugin-media')
    registerPluginMediaHandlers()
    const p = handlers.get('plugins:media-get')!({}) as Promise<unknown>
    expect(fork).toHaveBeenCalledTimes(1)
    const child = forkedChildren[0]
    const sent = child.postMessage.mock.calls[0][0] as { type: string; id: number }
    expect(sent.type).toBe('get')
    child.emit('message', { type: 'session', id: sent.id, session: { title: 'CANDLELIGHT' } })
    await expect(p).resolves.toMatchObject({ title: 'CANDLELIGHT' })
  })

  it('starts watching on the first subscriber and stops on the last', async () => {
    const { registerPluginMediaHandlers } = await import('./plugin-media')
    registerPluginMediaHandlers()
    const wcA = { once: vi.fn(), isDestroyed: () => false, send: vi.fn() }
    const wcB = { once: vi.fn(), isDestroyed: () => false, send: vi.fn() }
    listeners.get('plugins:media-watch')!({ sender: wcA })
    listeners.get('plugins:media-watch')!({ sender: wcB })
    expect(fork).toHaveBeenCalledTimes(1)
    const child = forkedChildren[0]
    const types = child.postMessage.mock.calls.map((c) => (c[0] as { type: string }).type)
    expect(types).toContain('watch')
    listeners.get('plugins:media-unwatch')!({ sender: wcA })
    expect(child.postMessage.mock.calls.map((c) => (c[0] as { type: string }).type)).not.toContain('unwatch')
    listeners.get('plugins:media-unwatch')!({ sender: wcB })
    expect(child.postMessage.mock.calls.map((c) => (c[0] as { type: string }).type)).toContain('unwatch')
  })

  it('fans changed pushes out to live subscribers', async () => {
    const { registerPluginMediaHandlers } = await import('./plugin-media')
    registerPluginMediaHandlers()
    const wc = { once: vi.fn(), isDestroyed: () => false, send: vi.fn() }
    listeners.get('plugins:media-watch')!({ sender: wc })
    forkedChildren[0].emit('message', { type: 'changed', session: null })
    expect(wc.send).toHaveBeenCalledWith('plugins:media-changed', null)
  })

  it('resolves in-flight gets with null and re-forks after a child crash', async () => {
    const { registerPluginMediaHandlers } = await import('./plugin-media')
    registerPluginMediaHandlers()
    const p = handlers.get('plugins:media-get')!({}) as Promise<unknown>
    forkedChildren[0].emit('exit', 1)
    await expect(p).resolves.toBeNull()
    void handlers.get('plugins:media-get')!({})
    expect(fork).toHaveBeenCalledTimes(2)
  })

  it('routes transport commands to the child', async () => {
    const { registerPluginMediaHandlers } = await import('./plugin-media')
    registerPluginMediaHandlers()
    listeners.get('plugins:media-command')!({}, 'play-pause')
    expect(forkedChildren[0].postMessage).toHaveBeenCalledWith({ type: 'command', command: 'play-pause' })
    listeners.get('plugins:media-command')!({}, 'not-a-command')
    expect(forkedChildren[0].postMessage).toHaveBeenCalledTimes(1)
  })
})
