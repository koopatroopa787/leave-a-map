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
| Headings | Fraunces, upright, weight 620, soft axis at 100 | Rounded, friendly headings. Never italic |

All three fonts are bundled from `@fontsource-variable` (OFL), so they're served from our own origin and the scan CSP (`font-src 'self'`) doesn't change. The cloud CSP has no `font-src`, so the consent window uses system fonts.

Body text is 17 px with a line height of 1.6. Every size is in rem, so browser zoom and text size settings work.

## Colour

- All colours are OKLCH tokens, with light and dark sets. The palette is a soft lilac-white with an indigo accent and a warm coral for human touches (the hand-drawn underline, the greeting dot). A faint colour glow sits behind the page; high contrast removes it.
- `prefers-contrast: more`, or High in the Display menu, makes muted text full ink.
- `forced-colors` (Windows High Contrast) switches lines and stops to system colours.
- Measured on the start screen, the Display panel and the sample map (with one and with all accounts moved), at 320, 375 and 1280 px, in light, dark and high contrast, and with Larger text and Wider spacing: every text node is at least 5.7:1, against AA's 4.5:1.

| Line | Bucket |
|---|---|
| Red | You sign in with your school account |
| Blue | Holds your work |
| Violet | Can reset your other accounts |
| Amber | Money |
| Green | Uses your school address |

## Display menu

Every main screen has a **Display** button (top right). It opens a native `popover` with five choices, saved in this browser only (`localStorage`, key `leave-a-map:display`):

| Setting | Options | How it works |
|---|---|---|
| Text size | Normal, Large (115%), Larger (132%) | `data-text` on `<html>`; every size is in rem |
| Colours | Match device, Light, Dark | `data-theme` |
| Contrast | Normal, High | `data-contrast`; muted text becomes full ink, lines darken, glow goes |
| Animation | Match device, On, Off | the `.motion-ok` class on `<html>` |
| Letter spacing | Normal, Wider | `data-spacing`; wider letter, word and line spacing, which helps some dyslexic readers |

## Typing help on the start screen

- Email: no auto-capitals or autocorrect, and an email keyboard on phones. As you type, a note says which domain will be searched. It gently warns if the address is incomplete or looks personal (gmail, outlook, icloud and similar).
- Date: quick choices (in 30 days, 3 months, 6 months) next to the date field. The chosen date is read back in words, like "24 Feb 2027, in 92 days".
- Enter moves on to the next empty step instead of showing an error.
- The mailbox file can be dropped anywhere on the page.
- When something is missing, focus moves to that field and the message says what to do.

## Motion

All motion is CSS, and it only runs when `<html>` has `.motion-ok`. `display.tsx` sets that class from the Display menu; "Match device" follows `prefers-reduced-motion`. Without the class, every animation and transition is off.

- Opening: the colour glow fades up, the headline's words land one by one, a hand-drawn underline draws under "going away.", and the routes draw themselves before a small train sets off along one.
- The Display panel slides in. Primary buttons get a soft shine on hover.
- Screens rise in, one block after another.
- The scan screen fills a line, with a pulsing marker at its end.
- A bucket's line grows down, and its cards rise in as they scroll into view (`animation-timeline: view()`, where supported).
- Stops pop when ticked. Ticking the last one shows a short celebration with a little confetti, and the progress line says how you're doing ("First one done.", "Over halfway.", "All done.").
- `<details>` open smoothly where `interpolate-size` is supported.

## Accessibility checklist

- Jump links under the map's summary go straight to each line.
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
