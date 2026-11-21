# Leave a Map

When a university shuts off a graduate's school email, every account tied to that address becomes hard to recover. Leave a Map reads an exported mailbox **on your own device**, finds the accounts tied to the school address, and ranks what to move first.

> **Status:** early build for #BuildHybridAI 2026. Lane 1 (rules, no AI) works on `.mbox` files. Gemini Nano (lane 2) and the consented cloud lookup (lane 3) are in progress.

## How it works

| Lane | Runs where | Sees what |
|---|---|---|
| 1. Rules | Your browser, no AI | Your mailbox, on the scan site, which can't make network requests (`connect-src 'none'`) |
| 2. Gemini Nano | Your browser, on-device, `ONLY_ON_DEVICE` | Short, cleaned text from your mail. It never leaves the device |
| 3. Service lookup | `PREFER_ON_DEVICE`, then the cloud model if needed | Only sender domains you tick, on a separate site. Answers are fixed categories, never links |

## Run it

```bash
npm install
npm test
npm run dev
```

Then open the printed local address, enter a school address and shutoff date, and choose an `.mbox` file. For a synthetic test mailbox:

```bash
npm run fixture
```

That writes `fixtures/fixture-200.example.mbox`, with the school address `jreyes@alderbrook.example`.

## Repository layout

| Path | What |
|---|---|
| `apps/scan` | Site 1: import, rules, Nano, the list. No network access |
| `apps/cloud` | Site 2: consent window and the cloud lookup |
| `packages/core` | Pure TypeScript: mbox splitter, rules, ranking, the shared contracts |
| `tests/unit` | Vitest tests |
| `tools` | Fixture and data tools |

## Licence

Apache-2.0. See `LICENSE` and `NOTICE.md`.
