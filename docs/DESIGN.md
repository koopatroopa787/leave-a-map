# Design

The look of the scan site (`apps/scan`) and the consent window (`apps/cloud/consent.html`). The tokens live at the top of `apps/scan/src/styles.css`; the consent window copies the colour tokens.

## Idea: the list is a route map

- Each bucket is a coloured **line**. Each account is a numbered **stop** on it, in rank order.
- Marking an account moved fills its stop with a tick and sinks the card into the page.
- Colour is never the only signal. Every line has a written title, and every stop a number.

## Type

| Role | Font | Why |
|---|---|---|
| Body and UI | Atkinson Hyperlegible Next | Made by the Braille Institute so that easily confused letters (I l 1, O 0) look different |
| Domains, counts, quotes | Atkinson Hyperlegible Mono | Domains are read character by character |
| Headings | Fraunces, upright, weight 620 | Gives the headings some warmth. Never italic |

All three fonts are bundled from `@fontsource-variable` (OFL), so they're served from our own origin and the scan CSP (`font-src 'self'`) doesn't change. The cloud CSP has no `font-src`, so the consent window uses system fonts.

Body text is 17 px with a line height of 1.6. Every size is in rem, so browser zoom and text size settings work.

## Colour

- All colours are OKLCH tokens, with light and dark sets.
- `prefers-contrast: more` makes muted text full ink.
- `forced-colors` (Windows High Contrast) switches lines and stops to system colours.
- Measured on the sample map at 375 px: every text node is at least 6.0:1 in light mode and 6.8:1 in dark mode, against AA's 4.5:1.

| Line | Bucket |
|---|---|
| Red | You sign in with your school account |
| Blue | Holds your work |
| Violet | Can reset your other accounts |
| Amber | Money |
| Green | Uses your school address |

## Motion

All motion is CSS and sits inside `@media (prefers-reduced-motion: no-preference)`. With reduced motion on, nothing moves.

- Screens rise in, one block after another.
- The start screen's route lines draw themselves.
- The scan screen fills a line, with a pulsing marker at its end.
- A bucket's line grows down, and its cards rise in as they scroll into view (`animation-timeline: view()`, where supported).
- Stops pop when ticked.
- `<details>` open smoothly where `interpolate-size` is supported.

## Accessibility checklist

- Skip link to `#main` on every screen. Focus moves to the map's heading when the map appears.
- Focus ring: 3 px in its own colour (`--focus`), never removed.
- Targets: buttons are 48 px tall and toggles 44 px. Nothing is under 24 px (WCAG 2.5.8).
- Start form errors are linked to the field (`aria-invalid`), and focus moves to the field. The error itself is `role="alert"`.
- The file field is a real `<input type="file">` laid over a drop zone, so the keyboard, screen readers and drag and drop all work.
- The scan progress keeps a native `<progress>` for screen readers. The drawn line is `aria-hidden`.
- Print stylesheet: the map prints as a plain checklist.

## Rules for new UI

- Use the tokens. Don't put hex or OKLCH values in components.
- No inline `style` attributes or `<style>` tags on the scan site; the CSP blocks them. Put styles in `styles.css`.
- No HTML strings (Trusted Types). Icons are Preact SVG elements in `apps/scan/src/icons.tsx`.
- New motion goes inside the reduced-motion query.
