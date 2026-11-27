# Design

The look of the scan site (`apps/scan`) and the consent window (`apps/cloud/consent.html`). The tokens live at the top of `apps/scan/src/styles.css`; the consent window copies the colour tokens.

## Two modes, one map

The start screen asks "What are you sorting out?":

- **My school email is closing.** Move each account to an address you'll keep, before the shut-off date.
- **Someone has died.** List the accounts in their mailbox, in the order to deal with them: money (banks, pensions, insurance, bills) first, then photos and files, then other accounts, and their email, phone and passwords last, because notices from everything else arrive there.

The scan (`packages/core`) is the same for both. Only the words, the order of the lines and the steps change; they live in `apps/scan/src/mode.ts`. The second mode has no date, no student-discount chip and no school-login step. Its steps never link to a page that needs the person's login, and say not to sign in as them. A short note says the list isn't legal advice.

## Idea: the list is a route map

- Each bucket is a coloured **line**. Each account is a numbered square **stop** on it, in rank order.
- Marking an account moved (or done) fills its stop with a tick and sinks the card into the page.
- Colour is never the only signal. Every line has a written title, and every stop a number.

## Look

Dark by default: black page, warm off-white text, and one orange for the things that matter (the primary button, the chosen option, a status dot, the full stop at the end of the headline). Light is one choice away in the Display menu.

- Square corners everywhere. Frames are thin dashed lines, like a printed map's grid.
- Short labels (the wordmark, section labels, tiers) are in the mono face, uppercase and widely spaced.
- **Dot canvas** (`apps/scan/src/dots.tsx`): one canvas fixed to the window behind the page. Pictures are drawn into a tiny canvas (one pixel per dot), blurred, broken up by a slow noise field, and read back, so each picture becomes a shaded cloud of small orange squares. Sections ask for a shape with `data-dots`:
  - `hero`: an envelope, a key, a padlock, a map pin and the route mark, in turn, each dissolving into the next. It shrinks into a ball as the hero scrolls away.
  - `side`: the same picture, small, in the empty space to the right of the 46rem column (wide screens only).
  - `loader`: the picture in the middle, growing with `data-progress`. Used for the opening and the scan.
  - `word`: LEAVE A MAP spelled in dots in the footer.
  Each visible section is weighted by how much of it is on screen, so scrolling morphs one shape into the next. A row of ruler ticks on the right edge shows the scroll position. The page sits above the canvas, so cards cover it and text is never painted over. It is `aria-hidden`, and forced colours and print hide it.
- **Opening** (motion on only): a black page with the dot shape growing in the middle and a handwritten counter running to 100% in the bottom-right corner, about 1.4 s, then the page fades in. The scan screen uses the same loader and counter.
- **Layout**: full width with a gutter, left-aligned. Reading blocks keep a 46rem measure. The start screen's hero fills the first screen: mono labels on top, room for the picture, then the lede and a very large, tight headline that ends in an orange asterisk.
- **Curtain**: an orange full-width band after the hero with one big line ("Three steps. Nothing is uploaded."), and a black hill rising into its bottom edge. Where scroll-driven animation is supported, it opens from a tilted shape as it scrolls in.
- **Header**: dashed frame. The Display button is styled like a call-to-action: orange outline and text, its icon in a filled orange square.
- **Footer**: how it works, where the Display menu is, then the name in dots.
- Account cards end in label/value rows: a mono uppercase label over a bold value (emails to the address, the last one, fake ones ignored).
- No glows, gradients, blurred glass or confetti.

## Type

| Role | Font | Why |
|---|---|---|
| Headings | Plus Jakarta Sans, weight 700, tight letter spacing | A plain, strong sans for the big headings |
| Body and UI | Atkinson Hyperlegible Next | Made by the Braille Institute so that easily confused letters (I l 1, O 0) look different |
| Domains, counts, labels | Atkinson Hyperlegible Mono | Domains are read character by character |
| The scan's big percentage | Architects Daughter | One handwritten touch; decorative, so it's `aria-hidden` and the real progress is a `<progress>` |

All four fonts are bundled from Fontsource (OFL), so they're served from our own origin and the scan CSP (`font-src 'self'`) doesn't change. The cloud CSP has no `font-src`, so the consent window uses system fonts.

Body text is 17 px with a line height of 1.6. Every size is in rem, so browser zoom and text size settings work.

## Colour

- All colours are OKLCH tokens. Dark is the base set; light is a second set.
- `prefers-contrast: more`, or High in the Display menu, makes muted text full ink.
- `forced-colors` (Windows High Contrast) switches lines and stops to system colours.
- Measured on the start screen and the map in both modes (with none and with all accounts ticked), at 320 and 1280 px, in dark, light and high contrast: no axe violations, and every text node is at least 5.7:1, against AA's 4.5:1.

| Line | School mode | Someone has died |
|---|---|---|
| Red | You sign in with your school account | Signs in through another of their accounts |
| Blue | Holds your work | Holds their photos and files |
| Violet | Can reset your other accounts | Their email, phone and passwords |
| Amber | Money | Money: banks, pensions, insurance, bills |
| Green | Uses your school address | Other accounts in their name |

## Display menu

Every main screen has a **Display** button (top right). It opens a native `popover` with five choices, saved in this browser only (`localStorage`, key `leave-a-map:display`):

| Setting | Options | How it works |
|---|---|---|
| Text size | Normal, Large (115%), Larger (132%) | `data-text` on `<html>`; every size is in rem |
| Colours | Match device, Light, Dark (default) | `data-theme` |
| Contrast | Normal, High | `data-contrast`; muted text becomes full ink, lines darken |
| Animation | Match device, On, Off | the `.motion-ok` class on `<html>` |
| Letter spacing | Normal, Wider | `data-spacing`; wider letter, word and line spacing, which helps some dyslexic readers |

## Typing help on the start screen

- Email: no auto-capitals or autocorrect, and an email keyboard on phones. As you type, a note says which address or domain will be searched. In school mode it gently warns if the address looks personal (gmail, outlook, icloud and similar).
- Date (school mode): quick choices (in 30 days, 3 months, 6 months) next to the date field. The chosen date is read back in words, like "24 Feb 2027, in 92 days".
- Enter moves on to the next empty step instead of showing an error.
- The mailbox file can be dropped anywhere on the page.
- When something is missing, focus moves to that field and the message says what to do.

## Motion

All motion is CSS, and it only runs when `<html>` has `.motion-ok`. `display.tsx` sets that class from the Display menu; "Match device" follows `prefers-reduced-motion`. Without the class, every animation and transition is off.

- Screens rise in, one block after another. The dotted routes fade in and the stops pop.
- The opening loader, and the scan's: the dot shape grows from the middle as the counter climbs.
- The dot canvas flickers at about 12 frames a second, the hero picture changes every few seconds, and the shapes morph as you scroll. With motion off, the canvas holds one still frame and only redraws when the page scrolls or changes.
- The orange curtain opens as it scrolls in (`animation-timeline: view()`, where supported).
- A bucket's line grows down, and its cards rise in as they scroll into view (`animation-timeline: view()`, where supported).
- Stops pop when ticked. In school mode, the progress line says how you're doing ("First one done.", "Over halfway.", "All done."). The other mode stays quiet: "There's no rush."
- `<details>` open smoothly where `interpolate-size` is supported.

## Accessibility checklist

- Jump links under the map's summary go straight to each line.
- Skip link to `#main` on every screen. Focus moves to the map's heading when the map appears.
- Focus ring: 3 px in its own colour (`--focus`), never removed.
- Targets: buttons are 48 px tall and toggles 44 px. Nothing is under 24 px (WCAG 2.5.8).
- Start form errors are linked to the field (`aria-invalid`), and focus moves to the field. The error itself is `role="alert"`.
- The file field is a real `<input type="file">` laid over a drop zone, so the keyboard, screen readers and drag and drop all work.
- The scan progress keeps a native `<progress>` for screen readers. The dot canvas and the big handwritten percentage are `aria-hidden`.
- Print stylesheet: the map prints as a plain checklist.

## Rules for new UI

- Use the tokens. Don't put hex or OKLCH values in components.
- No inline `style` attributes or `<style>` tags on the scan site; the CSP blocks them. Put styles in `styles.css`.
- No HTML strings (Trusted Types). Icons are Preact SVG elements in `apps/scan/src/icons.tsx`.
- New motion goes inside `:root.motion-ok`.
- New wording that differs between the modes goes in `mode.ts`.
