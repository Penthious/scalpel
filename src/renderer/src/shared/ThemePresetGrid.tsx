import type { AppSettings } from '@shared/types'
import type { ThemePalette, ThemePreset } from '@shared/theme/palette'
import { resolveActivePalette } from '@shared/theme/active'
import { applyPalette } from '@renderer/shared/apply-theme'

/** Select a theme preset: resolve its palette, apply it to this window for
 *  immediate feedback, and persist the id. Returns the resolved palette so the
 *  Settings editor can seed its working copy from it; onboarding ignores it. */
export function applyThemePreset(
  id: string,
  settings: Pick<AppSettings, 'customThemePalette'>,
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void,
): ThemePalette {
  const palette = resolveActivePalette(id, settings.customThemePalette ?? null)
  applyPalette(palette)
  update('themeId', id)
  return palette
}

/** Swatch grid of theme presets. The caller chooses which presets to pass, so
 *  Settings can include the saved custom palette and onboarding can leave it
 *  (and the joke theme) out. */
export function ThemePresetGrid({
  presets,
  selectedId,
  onSelect,
}: {
  presets: ThemePreset[]
  selectedId: string
  onSelect: (id: string) => void
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5 mt-[6px]">
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          title={p.name}
          className={`text-[11px] px-3 py-1.5 flex items-center gap-2 ${
            selectedId === p.id ? 'bg-accent text-bg-solid' : 'text-text-dim'
          }`}
        >
          <span className="flex">
            {[p.palette.bgCard, p.palette.accent].map((c, i) => (
              <span
                key={i}
                className="w-3 h-3 inline-block"
                style={{ background: c, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.5)' }}
              />
            ))}
          </span>
          {p.name}
        </button>
      ))}
    </div>
  )
}
