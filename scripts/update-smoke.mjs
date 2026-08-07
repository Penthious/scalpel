#!/usr/bin/env node
/**
 * End-to-end smoke test for the Windows auto-update path.
 *
 * `apply-update.bat` is written and spawned by the OLD installed build, so the applier
 * can only ever be exercised by the release AFTER the one that changes it. A broken
 * applier therefore ships undetected and then cannot repair itself, which is exactly how
 * v1.0.2-rc4/rc5 stranded every beta install. This script is the only place that code
 * gets tested before a tag goes up. Run it before every release.
 *
 * What it does:
 *   1. builds once, then packs two asars from that single tree: a pretend "old" install
 *      and the real "new" release
 *   2. assembles a genuine packaged app (electron dist + renamed exe + old asar), so the
 *      running process maps and LOCKS resources/app.asar exactly like a real install
 *   3. serves a fake GitHub release for the new version over loopback
 *   4. drives the real IPC: poll -> download -> install -> app exits -> batch applies
 *   5. asserts the swap landed, staging was cleaned up, and the updated app still boots
 *
 * Isolation: both asars are packed with `name` set to SMOKE_APP_NAME, so every instance
 * (including the one the batch relaunches, which gets no argv of ours) resolves userData
 * to %APPDATA%\<SMOKE_APP_NAME> and never touches a real Scalpel profile.
 *
 * Usage:
 *   node scripts/update-smoke.mjs [--skip-build] [--channel=stable|beta] [--keep]
 *   node scripts/update-smoke.mjs --old-asar=<path>    negative control: point at a
 *       known-broken build (e.g. a released rc5 app.asar) and the run MUST fail
 */
import { _electron as electron } from '@playwright/test'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'dist', 'update-smoke')
const INSTALL = join(WORK, 'install')
const OLD_DIR = join(WORK, 'old')
const NEW_DIR = join(WORK, 'new')
const MAIN_BUNDLE = join(ROOT, 'out', 'main', 'index.js')

const SMOKE_APP_NAME = 'scalpel-update-smoke'
const OLD_VERSION = '0.0.1-smoke'
const PORT = 45737
const REAL_API = 'https://api.github.com/repos/scalpelpoe/scalpel/releases/latest'
const FAKE_API = `http://127.0.0.1:${PORT}/repos/scalpelpoe/scalpel/releases/latest`

const argOf = (flag) => {
  const hit = process.argv.find((a) => a.startsWith(`--${flag}=`))
  return hit ? hit.slice(flag.length + 3) : null
}
const hasFlag = (flag) => process.argv.includes(`--${flag}`)

const CHANNEL = argOf('channel') ?? 'stable'
const OLD_ASAR_OVERRIDE = argOf('old-asar')
const NEW_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const ELECTRON_VERSION = JSON.parse(readFileSync(join(ROOT, 'node_modules/electron/package.json'), 'utf8')).version
const SMOKE_USER_DATA = join(process.env.APPDATA, SMOKE_APP_NAME)

const sha512 = (p) => createHash('sha512').update(readFileSync(p)).digest('base64')
const step = (msg) => console.log(`\n=== ${msg}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
  console.log(`  ok: ${msg}`)
}

async function until(label, fn, timeoutMs = 45_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let value
    try {
      value = await fn()
    } catch {
      value = null
    }
    if (value) return value
    if (Date.now() > deadline) throw new Error(`TIMEOUT waiting for: ${label}`)
    await sleep(intervalMs)
  }
}

// Single-quoted PowerShell strings take no backslash escapes, so the install path goes in
// verbatim. `-like` only treats *, ? and [ ] as wildcards, none of which occur here.
const PS_MATCH = `Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '${INSTALL}*' }`

/** Kill anything running out of the throwaway install dir. The batch relaunches the app
 *  with no arguments of ours, so this is how that instance gets reaped. */
function killSmokeProcesses() {
  try {
    execSync(`powershell -NoProfile -Command "${PS_MATCH} | Stop-Process -Force"`, { stdio: 'ignore' })
  } catch {
    /* nothing running, fine */
  }
}

function isSmokeRunning() {
  try {
    const out = execSync(`powershell -NoProfile -Command "@(${PS_MATCH}).Count"`, { encoding: 'utf8' })
    return Number(out.trim()) > 0
  } catch {
    return false
  }
}

/** Electron keeps leveldb handles open for a moment after the process dies. */
function rmWithRetry(target) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      rmSync(target, { recursive: true, force: true })
      return true
    } catch {
      execSync('powershell -NoProfile -Command "Start-Sleep -Milliseconds 400"', { stdio: 'ignore' })
    }
  }
  return false
}

// ---------------------------------------------------------------- build artifacts

function buildAndPack() {
  if (!hasFlag('skip-build')) {
    step('Building')
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' })
  }
  assert(existsSync(MAIN_BUNDLE), 'main bundle exists (run without --skip-build first)')

  step('Pointing the built main bundle at the loopback release server')
  const original = readFileSync(MAIN_BUNDLE, 'utf8')
  const occurrences = original.split(REAL_API).length - 1
  assert(occurrences >= 1, `found the releases API literal in the bundle (${occurrences} occurrence(s))`)
  writeFileSync(MAIN_BUNDLE, original.split(REAL_API).join(FAKE_API))

  try {
    step(`Packing new release asar (${NEW_VERSION})`)
    execSync(`node scripts/pack-asar.js --name=${SMOKE_APP_NAME} --out=${NEW_DIR}`, { cwd: ROOT, stdio: 'inherit' })

    if (hasFlag('break-applier')) {
      // Self-test of this harness: reintroduce the rc4/rc5 regression into the OLD build
      // only (the one that runs the applier). The run MUST fail at the swap. If it passes,
      // this script has stopped testing anything.
      step('Sabotaging the old build: dropping `detached` from the applier spawn')
      const bundle = readFileSync(MAIN_BUNDLE, 'utf8')
      const hits = bundle.split('detached: true,').length - 1
      assert(hits === 1, 'found exactly one `detached: true,` in the bundle to sabotage')
      writeFileSync(MAIN_BUNDLE, bundle.replace('detached: true,', 'detached: false,'))
    }

    step(`Packing old install asar (${OLD_VERSION})`)
    execSync(
      `node scripts/pack-asar.js --name=${SMOKE_APP_NAME} --version=${OLD_VERSION} --out=${OLD_DIR}`,
      { cwd: ROOT, stdio: 'inherit' },
    )
  } finally {
    // Never leave a localhost endpoint in the build output: dist:win rebuilds first, but
    // an unrestored bundle is one stray `electron-builder` away from shipping.
    writeFileSync(MAIN_BUNDLE, original)
  }
}

function assembleInstall() {
  step('Assembling a packaged install from the electron dist')
  rmSync(INSTALL, { recursive: true, force: true })
  cpSync(join(ROOT, 'node_modules/electron/dist'), INSTALL, { recursive: true })
  renameSync(join(INSTALL, 'electron.exe'), join(INSTALL, 'Scalpel.exe'))

  const oldAsar = OLD_ASAR_OVERRIDE ? resolve(OLD_ASAR_OVERRIDE) : join(OLD_DIR, 'app.asar')
  assert(existsSync(oldAsar), `old asar present at ${oldAsar}`)
  cpSync(oldAsar, join(INSTALL, 'resources', 'app.asar'))
  if (existsSync(join(OLD_DIR, 'app.asar.unpacked'))) {
    cpSync(join(OLD_DIR, 'app.asar.unpacked'), join(INSTALL, 'resources', 'app.asar.unpacked'), { recursive: true })
  }
  return join(INSTALL, 'Scalpel.exe')
}

function seedProfile() {
  step('Seeding an isolated profile')
  rmSync(SMOKE_USER_DATA, { recursive: true, force: true })
  mkdirSync(SMOKE_USER_DATA, { recursive: true })
  writeFileSync(
    join(SMOKE_USER_DATA, 'config.json'),
    JSON.stringify({ onboardingCompleted: true, startInTray: false, updateChannel: CHANNEL, poeVersion: 1 }),
  )
  // A real install always has a manifest; without one the first check treats the electron
  // version as changed and advertises a full upgrade instead of the asar path.
  writeFileSync(
    join(SMOKE_USER_DATA, 'install-manifest.json'),
    JSON.stringify({
      version: OLD_VERSION,
      electronVersion: ELECTRON_VERSION,
      asarUrl: '',
      asarSha512: '',
      asarSize: 0,
      nativeModules: JSON.parse(readFileSync(join(NEW_DIR, 'manifest.json'), 'utf8')).nativeModules,
    }),
  )
}

// ---------------------------------------------------------------- fake release server

function startReleaseServer() {
  step(`Serving a fake ${CHANNEL} release for ${NEW_VERSION} on 127.0.0.1:${PORT}`)
  const manifest = JSON.parse(readFileSync(join(NEW_DIR, 'manifest.json'), 'utf8'))
  const base = `http://127.0.0.1:${PORT}/assets`
  const assets = ['manifest.json', 'app.asar', 'app.asar.unpacked.zip']
    .filter((n) => existsSync(join(NEW_DIR, n)))
    .map((name) => ({ name, browser_download_url: `${base}/${name}` }))
  const release = { tag_name: `v${NEW_VERSION}`, prerelease: CHANNEL !== 'stable', assets }

  const server = createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (url.endsWith('/releases/latest')) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(release))
    }
    if (url.endsWith('/releases')) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify([release]))
    }
    if (url.startsWith('/assets/')) {
      const file = join(NEW_DIR, url.slice('/assets/'.length))
      if (existsSync(file)) {
        const body = readFileSync(file)
        res.writeHead(200, { 'Content-Length': body.length })
        return res.end(body)
      }
    }
    res.writeHead(404).end()
  })
  server.listen(PORT, '127.0.0.1')
  return server
}

// ---------------------------------------------------------------- the run

async function run() {
  buildAndPack()
  const exe = assembleInstall()
  seedProfile()

  const newSha = sha512(join(NEW_DIR, 'app.asar'))
  const installedAsar = join(INSTALL, 'resources', 'app.asar')
  assert(sha512(installedAsar) !== newSha, 'install starts on the OLD asar')

  const server = startReleaseServer()
  let app = null
  try {
    step('Launching the packaged app')
    app = await electron.launch({ executablePath: exe })
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')

    const running = await app.evaluate(({ app }) => app.getVersion())
    assert(running === OLD_VERSION || !!OLD_ASAR_OVERRIDE, `app reports the old version (${running})`)

    step('Waiting for the update to be offered')
    const offered = await until('update-available', async () => {
      const s = await win.evaluate(() => window.api.getUpdateState())
      return s?.updateVersion ?? null
    })
    assert(offered === NEW_VERSION, `offered ${NEW_VERSION}`)

    step('Downloading')
    await win.evaluate(() => window.api.downloadUpdate())
    await until('update-downloaded', async () => {
      const s = await win.evaluate(() => window.api.getUpdateState())
      return s?.updateReady === true
    })
    assert(true, 'download verified and staged')

    step('Installing (app exits, batch applies)')
    win.evaluate(() => {
      window.api.installUpdate()
    }).catch(() => {
      /* the page dies with the process; expected */
    })
    await app.waitForEvent('close', { timeout: 20_000 }).catch(() => {})
    app = null

    step('Waiting for the batch to apply the swap')
    await until('app.asar replaced by the new build', () => sha512(installedAsar) === newSha, 60_000)
    assert(true, 'resources/app.asar is now the new asar')
    assert(!existsSync(join(SMOKE_USER_DATA, 'update-staging')), 'staging directory cleaned up')
    assert(!existsSync(join(SMOKE_USER_DATA, 'apply-update.bat')), 'apply-update.bat self-deleted')
    const applied = JSON.parse(readFileSync(join(SMOKE_USER_DATA, 'install-manifest.json'), 'utf8'))
    assert(applied.version === NEW_VERSION, `install manifest says ${NEW_VERSION}`)

    step('Checking the batch relaunched the app')
    const relaunched = await until('relaunched instance', () => isSmokeRunning(), 20_000)
    assert(relaunched, 'batch relaunched the app')
    killSmokeProcesses()
    await sleep(1000)

    step('Booting the updated app to prove the swapped asar is good')
    const after = await electron.launch({ executablePath: exe })
    const afterVersion = await after.evaluate(({ app }) => app.getVersion())
    await after.close().catch(() => {})
    assert(afterVersion === NEW_VERSION, `updated app boots and reports ${NEW_VERSION}`)
  } finally {
    // Cleanup must never throw: an error here would replace whatever actually failed.
    try {
      if (app) await app.close().catch(() => {})
      server.close()
      killSmokeProcesses()
      await until('smoke processes to exit', () => !isSmokeRunning(), 15_000, 400).catch(() => {})
      if (!hasFlag('keep')) {
        await sleep(500)
        rmWithRetry(SMOKE_USER_DATA)
        rmWithRetry(WORK)
      }
    } catch (cleanupErr) {
      console.error(`  (cleanup warning: ${cleanupErr.message})`)
    }
  }
}

run().then(
  () => {
    console.log('\nUPDATE SMOKE PASSED')
  },
  (err) => {
    console.error(`\nUPDATE SMOKE FAILED\n${err.message}`)
    killSmokeProcesses()
    process.exit(1)
  },
)
