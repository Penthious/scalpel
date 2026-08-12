// Compiled-pattern caches, keyed by input text. text -> RegExp is a pure
// function so cached entries never go stale (no invalidation needed), and the
// cached instances are safe to share across callers because neither pattern
// uses the `g` flag (no `lastIndex` state to stomp on).
const PATTERN_CACHE = new Map<string, RegExp>()
const RELAXED_PATTERN_CACHE = new Map<string, RegExp>()

/** The game prints the noun a number governs with the plurality that number
 *  implies ("Gain Adrenaline for 2 seconds on Kill"), but a trade stat text
 *  carries only one form -- whichever GGG's reference roll happened to use
 *  ("Gain Adrenaline for # second on Kill", explicit.stat_4145689649). Death Rush
 *  rolls 1-3 seconds, so every roll above 1 matched nothing and lost its row
 *  (#577); the same goes for "# metre(s)", "# time(s)", "# charge(s)".
 *
 *  So make the trailing "s" optional across the run of words right after a `#`
 *  capture -- the number's noun phrase, the only stretch whose plurality the roll
 *  can change. The head noun is not always the first word of that run: the relic
 *  stat "Duplicates up to # random Offer Reward upon defeating the Herald of the
 *  Scourge" (sanctum.stat_502549687) pluralizes "Reward", two words out, so a
 *  first-word-only relaxation still lost every roll above 1 (#582).
 *
 *  Two restrictions keep the widening from making distinct entries interchangeable,
 *  which the longest-text tiebreak in mod-matcher would then resolve arbitrarily.
 *  A word directly followed by anything other than a space or the end of the text
 *  is left alone: the PoE1 catalog carries a typo twin of Warlord's Mark ("Trigger
 *  Level # Warlords's Mark"), and relaxing the "s" before that apostrophe makes
 *  each of the pair match the other's clipboard text. And past the first word,
 *  end-of-text does not count either -- that is where the PoE1 socketed-support
 *  family parks its gem names, including a "Level # Cluster Trap"/"Cluster Traps"
 *  pair that only escapes collision today because one of the two lives in the
 *  separately-filtered indexable_support bucket.
 *
 *  A signature sweep over both games' live catalogs finds no two entries in a
 *  matcher bucket that collapse together under these rules. Re-run it before
 *  widening further. */
function relaxNumberGovernedPlural(escaped: string): string {
  // `(.+?)` is what a `#` compiles to; the run is the words that follow it.
  return escaped.replace(/(\(\.\+\?\))((?: [A-Za-z]+)+)/g, (match, capture: string, run: string, offset: number) => {
    const after = escaped[offset + match.length] ?? ''
    const words = run.slice(1).split(' ')
    const relaxed = words.map((word, i) => {
      const followedBy = i === words.length - 1 ? after : ' '
      const relaxable = followedBy === ' ' || (i === 0 && followedBy === '')
      return relaxable ? `${word.replace(/s$/, '')}s?` : word
    })
    return `${capture} ${relaxed.join(' ')}`
  })
}

// Build regex patterns from stat text: "+# to maximum Life" -> /^\+(\d+(?:\.\d+)?) to maximum Life$/
function statTextToPattern(text: string): RegExp {
  const cached = PATTERN_CACHE.get(text)
  if (cached) return cached
  // Normalize whitespace (including `\n` between multi-line stat parts) to a single
  // space before escaping, so a two-line crafted mod like
  //   "Trigger a Socketed Spell ... Cooldown\nSpells Triggered this way ..."
  // matches regardless of whether the caller joined its lines with `\n` or ` `.
  // Callers also normalize their input text to a single space before `.match(pattern)`.
  const normalized = text.replace(/\s+/g, ' ')
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/#/g, '(.+?)')
  const pattern = new RegExp(`^${relaxNumberGovernedPlural(escaped)}$`, 'i')
  PATTERN_CACHE.set(text, pattern)
  return pattern
}

/** Validates a `(.+?)` capture as a numeric value worth parsing. Allows an
 *  optional leading sign because PoE2's trade stat texts omit the "+" that
 *  PoE2 item clipboard text includes ("# to maximum Life" vs "+50 to maximum
 *  Life"), so the capture comes back as "+50" -- parseFloat handles that
 *  fine, but we still want to reject non-numeric captures like option text. */
const NUMERIC_CAPTURE = /^[+-]?\d+(?:\.\d+)?$/

/** Relaxed pattern: also treat hardcoded numbers in stat text as wildcards.
 *  Used as fallback when exact matching fails -- handles cases where
 *  trade API has a fixed number but the item text has a different value. */
function statTextToRelaxedPattern(text: string): RegExp {
  const cached = RELAXED_PATTERN_CACHE.get(text)
  if (cached) return cached
  // Same whitespace normalization as statTextToPattern -- see that function for details.
  const normalized = text.replace(/\s+/g, ' ')
  let escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/#/g, '(.+?)')
  // Replace hardcoded numbers (e.g. "50%", "20") with numeric capture groups only.
  // Using (.+?) here let "Has 1 Socket" match "Has 1 Abyssal Socket" by swallowing
  // "1 Abyssal" -- wrong trade id for Stygian Vise and zero results.
  escaped = escaped.replace(/\d+(?:\\\.\d+)?/g, '(\\d+(?:\\.\\d+)?)')
  const pattern = new RegExp(`^${relaxNumberGovernedPlural(escaped)}$`, 'i')
  RELAXED_PATTERN_CACHE.set(text, pattern)
  return pattern
}

export { NUMERIC_CAPTURE, statTextToPattern, statTextToRelaxedPattern }
