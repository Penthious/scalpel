#!/usr/bin/env node
/**
 * Build src/shared/data/items/vestigial-poe1.json from poedb.
 *
 * Enshrouding a unique armour hands one of its mods to the resulting item as a
 * Vestigial implicit. poedb's /us/Vestigial page is the only published source
 * that carries the donor <-> mod association (RePoE-fork has every `Divergent*`
 * mod but no unique -> mod list). poedb derives the link by stripping the
 * `Divergent` prefix off the mod id, which misses ~30 mods GGG renamed; those
 * arrive as rows with no item link. We close that gap by matching each orphan
 * against every armour unique's own mod list, read from the `og:description`
 * meta on its poedb page, and accept only unambiguous single matches.
 *
 * Build-time only; never bundled, never run by the app.
 *
 * Usage: node scripts/build-vestigial-mods.js
 */

const path = require('node:path')
const https = require('node:https')
const fs = require('node:fs')

const OUT_FILE = path.join(__dirname, '..', 'src', 'shared', 'data', 'items', 'vestigial-poe1.json')

/** poedb and RePoE-fork endpoints. Build scripts keep their sources local --
 *  src/shared/endpoints.ts covers URLs the app hits at runtime, and none of
 *  this ships. Mirrors scripts/build-tier-data.js. */
const SOURCES = {
  aggregate: 'https://poedb.tw/us/Vestigial',
  uniquePage: (slug) => `https://poedb.tw/us/${slug}`,
  repoeUniques: 'https://repoe-fork.github.io/uniques.json',
}

/** RePoE-fork item_class values that can donate a vestigial mod (singular there;
 *  poedb's aggregate page labels the same classes in the plural). */
const ARMOUR_ITEM_CLASSES = new Set(['Helmet', 'Body Armour', 'Gloves', 'Boots', 'Shield'])

/** Thresholds that turn a silently-degraded scrape into a build failure. A poedb
 *  markup change would otherwise ship as "this unique donates nothing". */
const GATES = {
  minDonors: 380,
  minCandidates: 430,
  requiredClasses: ['Helmets', 'Body Armours', 'Gloves', 'Boots', 'Shields'],
  maxUnresolved: 40,
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } // plain space on purpose; normalizeChars would fold a real NBSP anyway

function decodeEntities(s) {
  return s.replace(/&(#\d+|#[xX][0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    return Object.hasOwn(NAMED_ENTITIES, code) ? NAMED_ENTITIES[code] : match
  })
}

/** Dash-like code points poedb serves inside numeric ranges (figure, en, em,
 *  horizontal bar). Matched by code point rather than a literal character class
 *  so none of them ever appear in this repo's source. */
const DASH_CODE_POINTS = new Set([0x2012, 0x2013, 0x2014, 0x2015])
const NBSP_CODE_POINT = 0x00a0

/** Fold dash-likes to a plain hyphen and non-breaking spaces to a plain space.
 *  poedb serves both; the repo bans en/em dashes outright. */
function normalizeChars(text) {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (DASH_CODE_POINTS.has(cp)) out += '-'
    else if (cp === NBSP_CODE_POINT) out += ' '
    else out += ch
  }
  return out
}

/** A poedb mod <div> body to display text. <br> is how poedb writes a two-line
 *  mod; range dashes arrive inside <span class="ndash"> as real en dashes, and
 *  the repo bans en/em dashes outright, so they normalize to a plain hyphen. */
function modText(html) {
  const text = normalizeChars(decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')))
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

/** Comparison key for a single mod line: ranges and bare numbers collapse to `#`
 *  so a donor's roll ("+(25-30) to all Attributes") matches the fixed vestigial
 *  value ("+20 to all Attributes"). Ranges go first; `#` is not a number, so the
 *  bare-number pass cannot re-eat them. */
function normKey(text) {
  return text
    .replace(/[+-]?\(\s*[+-]?[\d.]+\s*-\s*[+-]?[\d.]+\s*\)/g, '#')
    .replace(/[+-]?\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Orphans carry the full multi-line vestigial text while a donor's og:description
 *  lists each line separately, so attribution compares first lines only. */
function matchKey(text) {
  return normKey(text.split('\n')[0])
}

/** Split the aggregate Vestigial page into attributed rows and the mods poedb
 *  could not tie to a unique (rendered without an item link). */
function parseAggregate(html) {
  const start = html.indexOf('Vestigial Uniques')
  const body = start >= 0 ? html.slice(start) : html
  const rows = []
  const orphans = []
  for (const chunk of body.split('<div class="col">').slice(1)) {
    const to = chunk.match(/<div class="divergentMod">([\s\S]*?)<\/div>/)
    if (!to) continue
    const toText = modText(to[1])
    if (!toText) continue
    const head = chunk.match(/ms-2"><a class="UniqueItems UniqueItem"[^>]*>([^<]*)<\/a>\s*([^<]*)</)
    if (!head) {
      orphans.push({ to: toText })
      continue
    }
    const from = chunk.match(/<div class="explicitMod">([\s\S]*?)<\/div>/)
    rows.push({
      unique: decodeEntities(head[1]).trim(),
      itemClass: decodeEntities(head[2]).trim(),
      from: from ? modText(from[1]) : toText,
      to: toText,
    })
  }
  return { rows, orphans }
}

/** A unique's own mod lines, read off the og:description meta every poedb unique
 *  page carries. Cheaper and far more stable than parsing the stat table. */
function parseUniqueModTexts(html) {
  const meta = html.match(/<meta property="og:description" content="([\s\S]*?)"\s*\/?>/)
  if (!meta) return []
  const text = modText(meta[1])
  return text ? text.split('\n') : []
}

/** Pin orphaned vestigial mods to a donor by matching normalized mod text. Only
 *  an unambiguous single match counts -- "Cannot be Frozen" sits on several
 *  shields and must stay unattributed rather than get pinned to the wrong one. */
function attributeOrphans(orphans, modsByUnique) {
  const byKey = new Map()
  for (const [unique, lines] of Object.entries(modsByUnique)) {
    for (const line of lines) {
      const key = matchKey(line)
      if (!key) continue
      if (!byKey.has(key)) byKey.set(key, new Map())
      const hit = byKey.get(key)
      if (!hit.has(unique)) hit.set(unique, line)
    }
  }
  const resolved = []
  const unresolved = []
  for (const orphan of orphans) {
    const hit = byKey.get(matchKey(orphan.to))
    if (hit && hit.size === 1) {
      const [unique, from] = [...hit][0]
      resolved.push({ unique, itemClass: '', from, to: orphan.to })
    } else {
      unresolved.push(orphan.to)
    }
  }
  return { resolved, unresolved }
}

/** Merge rows into the shipped shape: donor name -> candidates. Keys and
 *  candidates are sorted and deduped so the committed file diffs cleanly. */
function buildDataset(rows) {
  const grouped = {}
  for (const row of rows) {
    if (!row.unique || !row.from || !row.to) continue
    if (!grouped[row.unique]) grouped[row.unique] = []
    const list = grouped[row.unique]
    if (!list.some((c) => c.from === row.from && c.to === row.to)) list.push({ from: row.from, to: row.to })
  }
  const sorted = {}
  for (const name of Object.keys(grouped).sort((a, b) => a.localeCompare(b))) {
    sorted[name] = grouped[name].sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from))
  }
  return sorted
}

function assertSane(dataset, classes, unresolved) {
  const donors = Object.keys(dataset).length
  const candidates = Object.values(dataset).reduce((n, list) => n + list.length, 0)
  if (donors < GATES.minDonors) throw new Error(`only ${donors} donors, expected at least ${GATES.minDonors}`)
  if (candidates < GATES.minCandidates) {
    throw new Error(`only ${candidates} candidates, expected at least ${GATES.minCandidates}`)
  }
  for (const cls of GATES.requiredClasses) {
    if (!classes.has(cls)) throw new Error(`no rows for item class ${cls}`)
  }
  for (const [name, list] of Object.entries(dataset)) {
    if (list.length === 0) throw new Error(`${name} has no candidates`)
    for (const candidate of list) {
      if (!candidate.from || !candidate.to) throw new Error(`${name} has a candidate missing from/to`)
    }
  }
  if (unresolved.length > GATES.maxUnresolved) {
    throw new Error(`${unresolved.length} unattributed mods, expected at most ${GATES.maxUnresolved}`)
  }
}

/** poedb page slug. Mirrors the poedb rule in src/shared/external-link.ts:
 *  apostrophes stripped, spaces to underscores. */
function poedbSlug(name) {
  return encodeURIComponent(name.replace(/'/g, '').replace(/\s+/g, '_'))
}

/** GET with redirect following and a browser UA -- poedb 403s the default Node
 *  agent. Resolves the body as UTF-8; poedb serves en dashes and apostrophes
 *  that mangle under any other encoding. */
function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/json' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          if (redirects >= 5) return reject(new Error(`too many redirects for ${url}`))
          return httpGet(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject)
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        res.setEncoding('utf-8')
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => resolve(body))
      })
      .on('error', reject)
  })
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Run `worker` over `items` with a small fixed concurrency. 500-odd poedb page
 *  fetches at full parallelism would be rude and would get us throttled. */
async function mapPool(items, concurrency, worker) {
  const results = []
  let next = 0
  const runners = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}

async function main() {
  console.log(`Fetching ${SOURCES.aggregate} ...`)
  const { rows, orphans } = parseAggregate(await httpGet(SOURCES.aggregate))
  const classes = new Set(rows.map((r) => r.itemClass).filter(Boolean))
  console.log(`  ${rows.length} attributed rows, ${orphans.length} orphans, classes: ${[...classes].join(', ')}`)

  console.log(`Fetching ${SOURCES.repoeUniques} ...`)
  const uniques = JSON.parse(await httpGet(SOURCES.repoeUniques))
  const armour = [
    ...new Set(
      Object.values(uniques)
        .filter((u) => ARMOUR_ITEM_CLASSES.has(u.item_class))
        .map((u) => u.name),
    ),
  ].sort((a, b) => a.localeCompare(b))
  console.log(`  ${armour.length} armour uniques to crawl`)

  const modsByUnique = {}
  let done = 0
  let failed = 0
  await mapPool(armour, 4, async (name) => {
    try {
      const html = await httpGet(SOURCES.uniquePage(poedbSlug(name)))
      const lines = parseUniqueModTexts(html)
      if (lines.length > 0) modsByUnique[name] = lines
    } catch {
      failed++
    }
    done++
    if (done % 50 === 0) console.log(`  ${done}/${armour.length} pages`)
  })
  console.log(`  read mods for ${Object.keys(modsByUnique).length} uniques (${failed} pages failed)`)

  const { resolved, unresolved } = attributeOrphans(orphans, modsByUnique)
  console.log(`  attributed ${resolved.length} orphans, ${unresolved.length} left unattributed:`)
  for (const text of unresolved) console.log(`    - ${text.replace(/\n/g, ' / ')}`)

  const dataset = buildDataset([...rows, ...resolved])
  assertSane(dataset, classes, unresolved)

  fs.writeFileSync(OUT_FILE, `${JSON.stringify(dataset, null, 2)}\n`, 'utf-8')
  const candidates = Object.values(dataset).reduce((n, list) => n + list.length, 0)
  console.log(`Wrote ${OUT_FILE}: ${Object.keys(dataset).length} donors, ${candidates} candidates`)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = {
  ARMOUR_ITEM_CLASSES,
  GATES,
  OUT_FILE,
  SOURCES,
  assertSane,
  attributeOrphans,
  buildDataset,
  decodeEntities,
  main,
  matchKey,
  modText,
  normalizeChars,
  normKey,
  parseAggregate,
  parseUniqueModTexts,
  poedbSlug,
}
