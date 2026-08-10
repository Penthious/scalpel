import { expect, test } from '@playwright/test'
import { launchScalpelE2E } from './helpers/electron'

interface ProfileApi {
  api: {
    ensureProfileForGame: (variant: 1 | 2) => Promise<void>
    listProfiles: () => Promise<Array<{ gameVariant: 1 | 2; league: string }>>
  }
}

// A profile created after a league rotation used to be born on a hardcoded
// league name and stay there -- the league refresh only migrates profiles that
// already exist. Setting up a fresh install mid-league has to land on the league
// that is actually running.
test('a first-run profile starts on the current league from the cached list', async () => {
  const scalpel = await launchScalpelE2E({
    seedConfig: {
      onboardingCompleted: false,
      startInTray: false,
      leaguesPoe1: ['Keepers of the Flame', 'Hardcore Keepers of the Flame', 'Standard', 'Hardcore'],
      leaguesPoe2: ['Rise of the Abyssal', 'HC Rise of the Abyssal', 'Standard', 'Hardcore'],
    },
  })
  try {
    const profiles = await scalpel.window.evaluate(async () => {
      const { api } = window as unknown as ProfileApi
      await api.ensureProfileForGame(1)
      await api.ensureProfileForGame(2)
      return api.listProfiles()
    })

    expect(profiles.find((p) => p.gameVariant === 1)?.league).toBe('Keepers of the Flame')
    expect(profiles.find((p) => p.gameVariant === 2)?.league).toBe('Rise of the Abyssal')
  } finally {
    await scalpel.cleanup()
  }
})
