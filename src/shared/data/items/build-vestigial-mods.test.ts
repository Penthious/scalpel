import { describe, expect, it } from 'vitest'
// CJS module; import its pure exports.
import {
  attributeOrphans,
  buildDataset,
  matchKey,
  modText,
  normKey,
  parseAggregate,
  parseUniqueModTexts,
  poedbSlug,
  assertSane,
} from '../../../../scripts/build-vestigial-mods.js'

/** poedb writes range dashes as a real en dash inside <span class="ndash">.
 *  Kept as an escape so the character never appears literally in the repo. */
const NDASH = String.fromCodePoint(0x2013)

/** Two attributed rows plus one orphan, in poedb's real markup. The ndash span is
 *  how poedb writes a numeric range; the <br> is how it writes a two-line mod. */

const AGGREGATE = `
<h5 class="card-header">Vestigial Uniques /3 </h5>
<div class="row"><div class="col"><div class="d-flex border-top rounded"><div class="flex-shrink-0"><a class="UniqueItems UniqueItem" href="Forbidden_Shako"><img src="x.webp" /></a></div><div class="flex-grow-1 ms-2"><a class="UniqueItems UniqueItem" href="Forbidden_Shako">Forbidden Shako</a> Helmets<div class="explicitMod"><span class='mod-value'>+(25<span class="ndash">${NDASH}</span>30)</span> to all Attributes</div><div class="divergentMod"><span class='mod-value'>+20</span> to all Attributes</div></div></div></div><div class="col"><div class="d-flex border-top rounded"><div class="flex-shrink-0"><a class="UniqueItems UniqueItem" href="Vix_Lunaris"><img src="y.webp" /></a></div><div class="flex-grow-1 ms-2"><a class="UniqueItems UniqueItem" href="Vix_Lunaris">Vix Lunaris</a> Shields<div class="explicitMod">Cannot be Frozen</div><div class="divergentMod">Cannot be Frozen</div></div></div></div><div class="col"><div class="d-flex border-top rounded"><div class="flex-shrink-0"></div><div class="flex-grow-1 ms-2"><div class="divergentMod">Your Fire Damage can Poison<br><span class='mod-value'>50</span>% less Poison Duration</div></div></div></div></div>
`

const UNIQUE_PAGE = `
<meta property="og:title" content="Volkuur's Guidance" />
<meta property="og:description" content="Adds (1${NDASH}3) to (42${NDASH}47) Lightning Damage to Spells and Attacks
Your Fire Damage can Poison
+(20${NDASH}30) to maximum Energy Shield" />
`

describe('modText', () => {
  it('drops tags, decodes entities, and normalizes range dashes to a hyphen', () => {
    expect(modText(`<span class='mod-value'>+(25<span class="ndash">${NDASH}</span>30)</span> to all Attributes`)).toBe(
      '+(25-30) to all Attributes',
    )
    expect(modText('Doedre&#39;s Skin')).toBe("Doedre's Skin")
  })

  it('turns <br> into a line break and trims each line', () => {
    expect(modText(`Your Fire Damage can Poison<br> <span class='mod-value'>50</span>% less Poison Duration`)).toBe(
      'Your Fire Damage can Poison\n50% less Poison Duration',
    )
  })
})

describe('normKey / matchKey', () => {
  it('collapses a rolled range and a fixed roll to the same key', () => {
    expect(normKey('+(25-30) to all Attributes')).toBe(normKey('+20 to all Attributes'))
    expect(normKey('(600-1000)% more Physical Damage')).toBe(normKey('500% more Physical Damage'))
  })

  it('keeps different mods apart', () => {
    expect(normKey('Cannot be Frozen')).not.toBe(normKey('Cannot be Ignited'))
  })

  it('matchKey only looks at the first line', () => {
    expect(matchKey('Your Fire Damage can Poison\n50% less Poison Duration')).toBe(
      matchKey('Your Fire Damage can Poison'),
    )
  })
})

describe('parseAggregate', () => {
  it('splits attributed rows from orphans', () => {
    const { rows, orphans } = parseAggregate(AGGREGATE)
    expect(rows).toEqual([
      {
        unique: 'Forbidden Shako',
        itemClass: 'Helmets',
        from: '+(25-30) to all Attributes',
        to: '+20 to all Attributes',
      },
      { unique: 'Vix Lunaris', itemClass: 'Shields', from: 'Cannot be Frozen', to: 'Cannot be Frozen' },
    ])
    expect(orphans).toEqual([{ to: 'Your Fire Damage can Poison\n50% less Poison Duration' }])
  })
})

describe('parseUniqueModTexts', () => {
  it('reads the mod lines out of og:description', () => {
    expect(parseUniqueModTexts(UNIQUE_PAGE)).toEqual([
      'Adds (1-3) to (42-47) Lightning Damage to Spells and Attacks',
      'Your Fire Damage can Poison',
      '+(20-30) to maximum Energy Shield',
    ])
  })

  it('returns nothing when the meta tag is missing', () => {
    expect(parseUniqueModTexts('<html></html>')).toEqual([])
  })
})

describe('attributeOrphans', () => {
  const orphans = [{ to: 'Your Fire Damage can Poison\n50% less Poison Duration' }, { to: 'Cannot be Frozen' }]
  const modsByUnique = {
    "Volkuur's Guidance": ['Your Fire Damage can Poison', '+(20-30) to maximum Energy Shield'],
    'Vix Lunaris': ['Cannot be Frozen'],
    'Replica Vix Lunaris': ['Cannot be Frozen'],
  }

  it('attributes an unambiguous orphan to its donor', () => {
    const { resolved } = attributeOrphans(orphans, modsByUnique)
    expect(resolved).toEqual([
      {
        unique: "Volkuur's Guidance",
        itemClass: '',
        from: 'Your Fire Damage can Poison',
        to: 'Your Fire Damage can Poison\n50% less Poison Duration',
      },
    ])
  })

  it('leaves an orphan matching several uniques unattributed rather than guessing', () => {
    const { unresolved } = attributeOrphans(orphans, modsByUnique)
    expect(unresolved).toEqual(['Cannot be Frozen'])
  })
})

describe('buildDataset', () => {
  it('groups by unique, dedupes, and sorts keys and candidates', () => {
    const dataset = buildDataset([
      { unique: 'Zebra', itemClass: 'Boots', from: 'b', to: 'b2' },
      { unique: 'Alpha', itemClass: 'Helmets', from: 'z', to: 'z2' },
      { unique: 'Alpha', itemClass: 'Helmets', from: 'a', to: 'a2' },
      { unique: 'Alpha', itemClass: 'Helmets', from: 'a', to: 'a2' },
    ])
    expect(Object.keys(dataset)).toEqual(['Alpha', 'Zebra'])
    expect(dataset.Alpha).toEqual([
      { from: 'a', to: 'a2' },
      { from: 'z', to: 'z2' },
    ])
  })

  it('drops rows missing a donor or either side of the pair', () => {
    expect(buildDataset([{ unique: '', itemClass: '', from: 'a', to: 'b' }])).toEqual({})
    expect(buildDataset([{ unique: 'Alpha', itemClass: '', from: '', to: 'b' }])).toEqual({})
  })
})

describe('assertSane', () => {
  const classes = new Set(['Helmets', 'Body Armours', 'Gloves', 'Boots', 'Shields'])
  const big = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`U${i}`, [{ from: 'a', to: 'b' }]]))

  it('passes a healthy dataset', () => {
    expect(() => assertSane(big, classes, [])).not.toThrow()
  })

  it('throws when the scrape collapsed', () => {
    expect(() => assertSane({ Alpha: [{ from: 'a', to: 'b' }] }, classes, [])).toThrow(/donors/)
  })

  it('throws when an item class produced no rows', () => {
    expect(() => assertSane(big, new Set(['Helmets']), [])).toThrow(/Body Armours/)
  })

  it('throws when too many mods stayed unattributed', () => {
    expect(() =>
      assertSane(
        big,
        classes,
        Array.from({ length: 99 }, (_, i) => `m${i}`),
      ),
    ).toThrow(/unattributed/)
  })
})

describe('poedbSlug', () => {
  it('strips apostrophes and underscores spaces, matching external-link.ts', () => {
    expect(poedbSlug("Doryani's Delusion")).toBe('Doryanis_Delusion')
    expect(poedbSlug('The Three Dragons')).toBe('The_Three_Dragons')
  })
})
