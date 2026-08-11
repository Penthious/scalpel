import { useCallback, useState } from 'react'

/** Transient error surface for onboarding steps that host a hotkey recorder.
 *  createTryHotkey needs a showError sink, and onboarding has no error banner
 *  of its own the way SettingsPanel does.
 *
 *  SettingsPanel keeps its own variant on purpose: it can lift errors to a
 *  parent via an onError prop, which no onboarding step does. */
export function useStepError(): {
  error: string | null
  tone: 'error' | 'warn'
  showError: (msg: string, tone?: 'error' | 'warn') => void
} {
  const [error, setError] = useState<string | null>(null)
  const [tone, setTone] = useState<'error' | 'warn'>('error')

  const showError = useCallback((msg: string, nextTone: 'error' | 'warn' = 'error'): void => {
    setError(msg)
    setTone(nextTone)
    setTimeout(() => setError(null), nextTone === 'warn' ? 5000 : 3000)
  }, [])

  return { error, tone, showError }
}
