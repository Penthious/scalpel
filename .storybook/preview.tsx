import type { Preview } from '@storybook/react-vite'
import { PoeVersionProvider } from '../src/renderer/src/shared/poe-version-context'
import '../src/renderer/src/styles.css'

/** Stub the renderer's `window.api` IPC surface for stories.
 *
 *  In production the preload installs `window.api` with all the IPC channels
 *  components reach for. Storybook has no preload, so any component that
 *  calls e.g. `window.api.lookupBaseType` would crash on click. This mock
 *  layer provides no-op stubs for every IPC channel a storied component
 *  currently uses; new channels added to the preload should be mirrored here
 *  as soon as a story for the consuming component exists.
 *
 *  Set at module load (not inside a Storybook decorator) so the stubs are in
 *  place before any story file loads -- some libraries (e.g. ReactSortable)
 *  invoke their setList callback synchronously during initialization, which
 *  reaches `window.api` before any useEffect-based stubbing would run. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any
win.api = win.api ?? {}
const apiStub = (): void => undefined
const apiAsyncStub = async (): Promise<void> => undefined
win.api.lookupBaseType ??= apiStub
win.api.openExternal ??= apiStub
win.api.sisterOpenPriceCheck ??= apiStub
win.api.reorderRegexPresets ??= apiAsyncStub
// Two channels that need real-shaped data rather than a no-op: ScryingOrbButton
// reads the league/version off getSettings and renders the cheapest listing from
// tradeSearch, so undefined returns would leave it stuck mid-click.
win.api.getSettings ??= async (): Promise<unknown> => ({ activeProfile: { league: 'Standard' }, poeVersion: 1 })
win.api.tradeSearch ??= async (): Promise<unknown> => ({
  total: 41,
  listings: [{ id: 'stub', price: { amount: 12, currency: 'chaos' } }],
  queryId: 'storybook',
  remainingIds: [],
})

/** Storybook preview config -- runs once for every story.
 *
 *  - Imports the renderer's full stylesheet so Tailwind and the CSS-variable
 *    design tokens (--bg-solid, --text, --accent, ...) are available inside
 *    the preview iframe exactly as they are inside the real overlay.
 *  - Wraps every story in `PoeVersionProvider` because lots of components call
 *    `usePoeVersion()` in their render path. Defaults to PoE1; flip via the
 *    "PoE Version" toolbar control above the canvas to verify PoE2 variants.
 *  - Sets the canvas background to the real overlay backdrop so chip/text
 *    contrast looks the way the user actually sees it; the default Storybook
 *    white blew out our dim-on-dark palette and made every story look broken. */
const preview: Preview = {
  globalTypes: {
    poeVersion: {
      description: 'PoE game version provided to components via context',
      defaultValue: 1,
      toolbar: {
        title: 'PoE Version',
        items: [
          { value: 1, title: 'PoE 1' },
          { value: 2, title: 'PoE 2' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const v = (ctx.globals.poeVersion as 1 | 2) ?? 1
      return (
        <PoeVersionProvider version={v}>
          <Story />
        </PoeVersionProvider>
      )
    },
  ],
  parameters: {
    backgrounds: {
      default: 'overlay',
      values: [
        { name: 'overlay', value: '#171821' },
        { name: 'translucent-card', value: '#23232e' },
        { name: 'white', value: '#ffffff' },
      ],
    },
  },
}

export default preview
