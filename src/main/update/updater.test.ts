import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MOCK_USER_DATA = vi.hoisted(() =>
  require('node:path').join(require('node:os').tmpdir(), `scalpel-updater-${Date.now()}`),
)
// IS_DEV is captured at module load and gates every destructive handler off.
vi.hoisted(() => {
  delete process.env.ELECTRON_RENDERER_URL
})

const HANDLERS = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
const SPAWN = vi.hoisted(() => vi.fn(() => ({ unref: vi.fn() })))
const APP_EXIT = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ spawn: SPAWN, execSync: vi.fn() }))
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => MOCK_USER_DATA),
    getVersion: vi.fn(() => '1.0.2-rc4'),
    exit: APP_EXIT,
    relaunch: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => HANDLERS.set(channel, fn)),
    on: vi.fn(),
  },
}))
vi.mock('../diagnostics', () => ({ recordMainBreadcrumb: vi.fn(), registerDiagnosticProvider: vi.fn() }))
vi.mock('../hotkeys', () => ({ stopHotkeyListener: vi.fn() }))

import './updater'

const STAGING = join(MOCK_USER_DATA, 'update-staging')
const BAT_PATH = join(MOCK_USER_DATA, 'apply-update.bat')

function stageAsarUpdate(): void {
  rmSync(MOCK_USER_DATA, { recursive: true, force: true })
  mkdirSync(STAGING, { recursive: true })
  writeFileSync(join(STAGING, 'app.asar.new'), 'asar bytes')
  writeFileSync(join(STAGING, 'manifest.pending.json'), JSON.stringify({ version: '1.0.2-rc5' }))
}

describe('install-update', () => {
  beforeEach(() => {
    SPAWN.mockClear()
    APP_EXIT.mockClear()
    stageAsarUpdate()
  })

  it('spawns the apply batch detached so it outlives app.exit', () => {
    HANDLERS.get('install-update')?.()

    // Regression guard for the rc4/rc5 dead-update bug: libuv puts every non-detached
    // child into a job object with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, so dropping
    // `detached` means Windows kills the batch the moment app.exit() runs and no update
    // ever applies. `.unref()` does not substitute for it.
    expect(SPAWN).toHaveBeenCalledTimes(1)
    const [command, args, options] = SPAWN.mock.calls[0] as unknown as [string, string[], Record<string, unknown>]
    expect(command).toBe('cmd.exe')
    expect(args).toEqual(['/c', BAT_PATH])
    expect(options.detached).toBe(true)
    expect(options.stdio).toBe('ignore')
    expect(options.windowsHide).toBe(true)
  })

  it('writes a batch that copies the staged asar over the installed one, then exits', () => {
    HANDLERS.get('install-update')?.()

    expect(existsSync(BAT_PATH)).toBe(true)
    const bat = readFileSync(BAT_PATH, 'utf8')
    expect(bat).toContain(join(STAGING, 'app.asar.new'))
    expect(bat).toContain('app.asar')
    expect(APP_EXIT).toHaveBeenCalledWith(0)
  })

  it('records the pending version so the post-update banner can name it', () => {
    HANDLERS.get('install-update')?.()

    const justUpdated = JSON.parse(readFileSync(join(MOCK_USER_DATA, 'just-updated.json'), 'utf8'))
    expect(justUpdated.version).toBe('1.0.2-rc5')
  })
})
