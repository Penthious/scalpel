import { describe, expect, it } from 'vitest'
import { resolveResumeStep, SHARED_STEPS, totalOnboardingSteps } from './constants'
import { filterStepNum, selectedGameOrder, sharedStepNum } from './onboarding-nav'

const both = { poe1: true, poe2: true }
const onlyPoe1 = { poe1: true, poe2: false }
const onlyPoe2 = { poe1: false, poe2: true }

describe('totalOnboardingSteps', () => {
  it('counts two steps per game plus the shared tail', () => {
    expect(totalOnboardingSteps(onlyPoe1)).toBe(SHARED_STEPS.length + 2)
    expect(totalOnboardingSteps(both)).toBe(SHARED_STEPS.length + 4)
  })

  it('treats a no-game selection as one game rather than returning the tail alone', () => {
    expect(totalOnboardingSteps({ poe1: false, poe2: false })).toBe(SHARED_STEPS.length + 2)
  })
})

describe('sharedStepNum', () => {
  it('starts the shared tail after the per-game filter steps', () => {
    expect(sharedStepNum(onlyPoe1, 'hotkey')).toBe(3)
    expect(sharedStepNum(both, 'hotkey')).toBe(5)
  })

  it('places trade directly after the filter hotkey', () => {
    expect(sharedStepNum(onlyPoe1, 'trade')).toBe(4)
    expect(sharedStepNum(both, 'trade')).toBe(6)
  })

  it('numbers the tail in SHARED_STEPS order', () => {
    const nums = SHARED_STEPS.map((s) => sharedStepNum(both, s))
    expect(nums).toEqual([...nums].sort((a, b) => a - b))
    expect(new Set(nums).size).toBe(SHARED_STEPS.length)
  })

  it('places plugins after preferences', () => {
    expect(sharedStepNum(onlyPoe1, 'plugins')).toBe(6)
    expect(sharedStepNum(both, 'plugins')).toBe(8)
  })

  it('places macros last in the tail', () => {
    expect(sharedStepNum(onlyPoe1, 'macros')).toBe(7)
    expect(sharedStepNum(both, 'macros')).toBe(9)
  })
})

describe('step numbering as a whole', () => {
  for (const [label, games] of [
    ['single game', onlyPoe1],
    ['single game poe2', onlyPoe2],
    ['both games', both],
  ] as const) {
    it(`assigns every number exactly once and never exceeds the total (${label})`, () => {
      const total = totalOnboardingSteps(games)
      const nums = [
        ...selectedGameOrder(games).flatMap((g) => [
          filterStepNum(games, g, 'folder'),
          filterStepNum(games, g, 'filter'),
        ]),
        ...SHARED_STEPS.map((s) => sharedStepNum(games, s)),
      ].sort((a, b) => a - b)
      expect(nums).toEqual(Array.from({ length: total }, (_, i) => i + 1))
    })
  }
})

describe('resolveResumeStep', () => {
  it('returns null when nothing was persisted', () => {
    expect(resolveResumeStep(undefined)).toBeNull()
    expect(resolveResumeStep('')).toBeNull()
  })

  it('passes a still-valid step through untouched', () => {
    expect(resolveResumeStep('hotkey')).toBe('hotkey')
  })

  it('remaps the removed "profiles" step to welcome', () => {
    expect(resolveResumeStep('profiles')).toBe('welcome')
  })

  it('remaps both steps the trade page replaced', () => {
    expect(resolveResumeStep('pricecheck-hotkey')).toBe('trade')
    expect(resolveResumeStep('trade-login')).toBe('trade')
  })

  it('falls back to welcome for an unrecognised step rather than a blank window', () => {
    expect(resolveResumeStep('some-step-from-the-future')).toBe('welcome')
  })
})
