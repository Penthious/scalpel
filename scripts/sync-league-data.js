const fs = require('node:fs')
const path = require('node:path')

const BASE_URL = 'https://raw.githubusercontent.com/deathbeam/maps-of-exile/main/site/src/data/'
const OUT_DIR = path.join(__dirname, '..', 'src', 'shared', 'data', 'economy')

const FILES = [
  { remote: 'cards.json', local: 'div-cards.json' },
  { remote: 'maps.json', local: 'div-maps.json' },
  { remote: 'globals.json', local: 'div-globals.json' },
]

const WRAECLAST_BASE = 'https://wraeclast.cards'
const WRAECLAST_INDEX = `${WRAECLAST_BASE}/data/drop-rates/index.json`
const WRAECLAST_SCHEMA_VERSION = 6
const WRAECLAST_MIN_OBSERVED_TOTAL = 250000

async function downloadFile(remote, local) {
  const url = BASE_URL + remote
  const outPath = path.join(OUT_DIR, local)
  console.log(`Fetching ${url} ...`)

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }

  const text = await res.text()
  fs.writeFileSync(outPath, text, 'utf-8')
  console.log(`  Saved to ${local} (${(text.length / 1024).toFixed(1)} KB)`)
}

/** Pull the current-league stacked-deck drop dataset from wraeclast.cards and
 *  write a trimmed snapshot. Card weights are global game data -- wraeclast's
 *  per-league files are observation buckets, not per-league weight sets -- so
 *  we always take the live (non-historical) PoE1 league rather than matching
 *  the player's league, which would break on "Hardcore Allflame" and would
 *  hand a Standard player stale weights from a dead league.
 *
 *  This only trims fields. Which of the two weights wins is decided once, in
 *  src/renderer/src/features/div-card-explorer/weights.ts. */
async function downloadCardWeights() {
  console.log(`Fetching ${WRAECLAST_INDEX} ...`)
  const ires = await fetch(WRAECLAST_INDEX)
  if (!ires.ok) {
    throw new Error(`HTTP ${ires.status} ${ires.statusText}`)
  }
  const index = await ires.json()
  if (index.schema_version !== WRAECLAST_SCHEMA_VERSION) {
    throw new Error(`index schema_version ${index.schema_version}, expected ${WRAECLAST_SCHEMA_VERSION}`)
  }
  const league = (index.games && index.games.poe1 ? index.games.poe1.leagues || [] : []).find((l) => !l.historical)
  if (!league) {
    throw new Error('no live PoE1 league in the index')
  }

  // A fresh league's sample is noise in the rare, high-value cards; keep the
  // existing snapshot rather than baking thin data into the bundle. Not a
  // failure -- there is simply nothing worth updating yet.
  if (typeof league.observed_total !== 'number' || league.observed_total < WRAECLAST_MIN_OBSERVED_TOTAL) {
    console.warn(
      `  SKIPPED div-card-weights.json: ${league.name} has ${league.observed_total} observed openings, ` +
        `below the ${WRAECLAST_MIN_OBSERVED_TOTAL} floor. Keeping the existing snapshot.`,
    )
    return
  }

  const url = WRAECLAST_BASE + league.url
  console.log(`Fetching ${url} ...`)
  const dres = await fetch(url)
  if (!dres.ok) {
    throw new Error(`HTTP ${dres.status} ${dres.statusText}`)
  }
  const data = await dres.json()
  if (data.schema_version !== WRAECLAST_SCHEMA_VERSION) {
    throw new Error(`league schema_version ${data.schema_version}, expected ${WRAECLAST_SCHEMA_VERSION}`)
  }

  const snapshot = {
    schema_version: data.schema_version,
    generated_at: data.generated_at,
    league: league.name,
    observed_total: league.observed_total,
    cards: data.cards.map((c) => ({
      name: c.name,
      community_estimated_weight: c.community_estimated_weight,
      reference_weight: c.reference_weight,
    })),
  }

  const outPath = path.join(OUT_DIR, 'div-card-weights.json')
  const text = `${JSON.stringify(snapshot, null, 2)}\n`
  fs.writeFileSync(outPath, text, 'utf-8')
  console.log(
    `  Saved to div-card-weights.json (${(text.length / 1024).toFixed(1)} KB, ${snapshot.cards.length} cards, ${league.name})`,
  )
}

async function main() {
  console.log(`Output directory: ${OUT_DIR}\n`)

  let failures = 0
  for (const { remote, local } of FILES) {
    try {
      await downloadFile(remote, local)
    } catch (err) {
      console.error(`  FAILED ${remote}: ${err.message}`)
      failures++
    }
  }

  try {
    await downloadCardWeights()
  } catch (err) {
    console.error(`  FAILED div-card-weights.json: ${err.message}`)
    failures++
  }

  console.log('')
  if (failures > 0) {
    console.error(`Done with ${failures} failure(s).`)
    process.exit(1)
  } else {
    console.log('All files updated successfully.')
  }
}

main()
