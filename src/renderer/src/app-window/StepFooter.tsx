/** Bottom-pinned footer chrome shared by every onboarding step, so the buttons
 *  land in the same place whether the step overflows the window or barely fills
 *  it. NavButtons wraps itself in this; DoneStep uses it directly because its
 *  two buttons are not a Back/Next pair.
 *
 *  Three things put it at the bottom and keep it there:
 *
 *  - `mt-auto` claims the leftover space in the step's flex column, which is
 *    what pins it on a SHORT step. Sticky alone would leave it sitting directly
 *    under the content, halfway up the window.
 *  - `sticky bottom-0` keeps it in view on a TALL step. It is deliberately not
 *    its own scroll container: nesting one inside AppWindow's overflow-y-auto
 *    wrapper produces two scrollbars and traps the inner region.
 *  - The zero-blur box-shadow paints an 8px band of the same colour below the
 *    footer. At fractional display scaling the bottom edge lands on a subpixel
 *    boundary and leaves a hairline gap the scrolling content shows through;
 *    the shadow covers it, and unlike padding it costs no layout height.
 *
 *  The gradient fades the top edge instead of butting content against a hard
 *  line -- text visibly dissolving into the footer reads as "there is more
 *  above", where a clean cut reads as the end of the page. The negative margin
 *  plus matching padding let it span the full card width while the content
 *  keeps its px-6 gutter. */
export function StepFooter({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      className="mt-auto sticky bottom-0 z-10 -mx-6 px-6 pt-9 pb-3 shadow-[0_8px_0_0_var(--bg-solid)]"
      style={{ background: 'linear-gradient(to bottom, transparent 0, var(--bg-solid) 30px)' }}
    >
      {children}
    </div>
  )
}
