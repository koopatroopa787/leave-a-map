# Demo video: script and shot list (T34)

**Target: 2:58, hard limit under 3:00.** The outline comes from `strategist.md` section 5, updated to match what was built. Everything is filmed on the two fictional sample mailboxes.

**Deadlines:**
- Nano footage filmed by **Thu 26**.
- Rough cut by **Fri 27, 22:00** (Gate 4).
- Public by **Sat 28, 22:00** (Gate 5).

## Rules for every frame

- **No brand logos, and no third-party brand names in captions or voice.** Use categories ("code host", "LaTeX editor"). Firebase, Gemini, Gemini Nano and Chrome are the platform and may be named.
- **Don't name a university.** The hook shows dates only. The sources go in the video description (see the end of this file).
- **No real mail, accounts or people.** Use only the sample mailbox, a fresh Chrome profile with no other tabs or bookmarks, and no notifications. If a school-login page is filmed at all, use a team test account and blur the account name.
- **Real names on screen:** the sample's three held-out sites (real non-profit research sites) appear as plain web addresses in the cloud lookup. Show the caption "Real research sites, shown as plain text. No affiliation." the first time they appear. **This needs both humans' OK. If either says no, film lane 3 on the fictional fallback instead**, regenerated with `--held-out`.
- **Measured numbers only.** Every number on screen must appear in the README's measured table. Show the evaluation result only if T27 has run, and then exactly as published, bad parts included.
- **Never fake on-device footage.** Lane 2 shots come from a machine where Nano reports `available` without bypass flags.

## Script

Voice is about 300 words, which is roughly 2:00 at a calm pace. No beat goes over 125 words a minute, which leaves room for pauses and on-screen reading.

| Time | Beat | On screen | Voice | Caption |
|---|---|---|---|---|
| 0:00–0:12 | **Hook** | Black, plain white text, one line at a time: "One university: alumni email ends 31 Jan 2027." / "Another deletes the class of 2026's accounts on 31 Mar 2027." | "Your school email has a shutoff date. After it, every account tied to that address loses its password reset." | Sources in the description |
| 0:12–0:27 | **What breaks** | The start screen. The cursor rests on "Try the sample", then clicks it | "Accounts you opened with your school login die outright. Others hold your thesis, or can reset everything else. Leave a Map finds them in your mailbox, without it leaving your laptop." | "Sample mailbox: a made-up student" |
| 0:27–0:52 | **Lane 1, rules** | The scan runs; split screen with DevTools → Network, which stays empty. The list "What breaks on 31 Mar 2027" fills in with buckets. Open one card's "Why this account?" drawer to show the quote, date, "Seen" and the "rules" badge | "First, plain rules, in a page that isn't allowed to connect to anything. Fifty-five emails in a few milliseconds. Every account says why it's here: the exact line from your email, its date, and how sure we are." | "Lane 1 · rules · no network" |
| 0:52–1:17 | **Lane 2, Gemini Nano** | Scroll to "On-device AI". Click it; cards gain "on-device AI" badges. Open a drawer showing `inferenceSource: on_device`. The Network panel is still 0 | "Then Gemini Nano, on this device, reads one cleaned email per account and says what it holds. Firebase AI Logic runs it in on-device-only mode, and we check every answer came from the device. Your mail never leaves the laptop." | "Lane 2 · Gemini Nano · ONLY_ON_DEVICE" |
| 1:17–1:32 | **School-login step** | "Check what uses your school login": the steps and the warning. Tick one app; it jumps to rank 1 under "You sign in with your school account" | "Accounts opened with your school login are the most urgent. Leave a Map walks you through your account's connected-apps page and warns you: add a password first, then disconnect." | "Opened with your school login → rank 1" |
| 1:32–2:15 | **Lane 3, the cascade** (core beat) | The "Look up services in the cloud" panel: "9 services can't be placed from your email alone." Click "Look these up". The consent window opens on the second site: every box unticked, "What is sent", the 18+ box. Tick the 18+ box, click "Select all except health and money", then send. Back on the map, cards get "Typical for this kind of service" lines: expected: a real research site **"Answered on-device"** with on-device badges, and a fictional one **"On-device: not recognised → asked the cloud"** with cloud badges. Film whatever actually happens, and if the trail differs, change the voice to match it, not the footage | "For services neither the rules nor the device know, there's a cloud lookup. But only the web address leaves, only after you tick it, in a separate window. The on-device model answers first. When it doesn't recognise a service, and only then, the cloud model fills the gap. Every line says which model answered." | "Lane 3 · PREFER_ON_DEVICE → ONLY_IN_CLOUD"; then "On-device answered what it knew. The cloud filled the gap." |
| 2:15–2:25 | **No Nano** | A second machine without Nano: the banner "Not available in this browser, so only the rules ran." The same lookup, every line "cloud" | "On a machine without Nano, nothing breaks. The rules still work, and the cloud takes every lookup, and says so." | "Without Gemini Nano" |
| 2:25–2:38 | **Proof** | Privacy receipt: "N web addresses looked up with your approval, 0 other requests from this page", next to the empty Network panel | "And here's the receipt: the web addresses you approved, and zero other requests from the page that read your mail." | "Measured: 0 requests from the scan page" |
| 2:38–2:48 | **Second mode** | Back to the start screen. "What are you sorting out?" → "Someone has died" → "Try the sample". The map: "Their accounts, money first", then one card's step "Contact … bereavement or estates team" and "Don't sign in as them" | "The same three lanes help when someone has died: their accounts, money first, each with the service's own bereavement process. Never signing in as them." | "Second mode · same scan, same privacy" |
| 2:48–2:58 | **Result and close** | The final list with the counter after a few ticks (for example "3 of 13 moved"), a card with "How to change it at …" and "Save a copy first". Then black: "The cloud knows the world. Only your laptop knows your life." Then "Leave a Map · Firebase AI Logic · github.com/romaaurora787/leave-a-map · Apache-2.0" | "Tick them off before the date. The cloud knows the world. Only your laptop knows your life." | – |

**The counts depend on the run.** "9 services" and the receipt's N come from the sample as it is today. Read them off the screen while filming, and don't edit them afterwards. If T27 has published results by Fri, add one caption at 2:38 with its headline, worded exactly as in the README.

## Shot list

| # | Shot | Machine | Who | Setup | Needs |
|---|---|---|---|---|---|
| S1 | Hook text cards | Editor | User | Titles only | – |
| S2 | Start screen → "Try the sample" | Nano machine | Kanishk | Fresh profile, 1280×800 window, browser zoom 110% | Hosted scan site with main deployed, or the local preview |
| S3 | Lane 1 scan with DevTools Network open, then one evidence drawer | Nano machine | Kanishk | DevTools docked right, "Preserve log" on, filter cleared | – |
| S4 | Lane 2: "On-device AI" run, drawer with `inferenceSource: on_device`, Network still 0 | Nano machine | Kanishk | `LanguageModel.availability()` is `available` beforehand; model already downloaded so the take is short | Nano machine with a display |
| S5 | School-login step: tick an app, it moves to rank 1 | Nano machine | Kanishk | Use the "I saw these on the page" ticks. **Don't film a real account page** | – |
| S6 | Lane 3: panel → consent window → answers on the cards | Nano machine | Kanishk | Both windows visible (side by side). Paid tier on | **The hosted cloud lookup working (reCAPTCHA fix)**, or a local debug build. If filmed locally, the address bar shows `localhost`; crop it |
| S7 | No-Nano: banner, then the same lookup with "cloud" lines | Any machine without Nano (the 8 GB Mac as it is) | User | Fresh profile | Same as S6 |
| S8 | Receipt next to the Network panel | Nano machine | Kanishk | After S6, same session, so the counts are real | – |
| S9 | Final list with ticks and a move link card | Nano machine | Kanishk | Tick 3 cards in the same session | – |
| S9b | Second mode: start screen → "Someone has died" → sample → a money card's steps | Any machine | Either | Same fresh profile. Lanes 1 and 3 only are fine here | Hosted scan site with both modes |
| S10 | Closing cards | Editor | User | – | – |

**Recording:** 1080p, 30 fps. Use system cursor highlighting and no system sound. Record each shot as its own clip with a few seconds of padding. Voice is recorded separately by the User and laid over the clips.

## Before filming (checklist)

- [ ] `main` is deployed to both sites, or every shot uses the same local build.
- [x] The cloud lookup is switched on and works on the hosted site (paid tier, 24 Nov).
- [x] Hosted reCAPTCHA attests, with App Check enforced (24 Nov). S6 to S8 can be filmed on the live sites.
- [ ] Both humans have OK'd the real held-out sites appearing on screen, or the sample is regenerated with the fictional fallback.
- [ ] Fresh Chrome profile: no bookmarks bar, extensions, other tabs, signed-in account or notifications.
- [ ] Nano machine: Nano is `available` with no bypass flag. Take a screenshot of `chrome://on-device-internals` for our own record only. Don't put it in the video.
- [ ] Every number to be shown is in the README's measured table.

## After filming (checklist)

- [ ] The cut is under 3:00 (aim for 2:50).
- [ ] No brand names, logos, real people, real mail, or account names visible anywhere. Check every frame of S5 and S6.
- [ ] Captions (subtitles) uploaded.
- [ ] Public on the video platform, with the description below.
- [ ] The link is in the Devpost submission (T35).

## Video description

> Leave a Map ranks the accounts tied to your school email before it shuts off. Your mail is read on your device: rules, then Gemini Nano on-device through Firebase AI Logic. Only web addresses you approve go to a cloud model, in a separate window.
>
> Shutoff dates in the opening: https://alumni.duke.edu/benefits-services and https://services.northwestern.edu/TDClient/30/Portal/KB/Article/2658/Google-Workspace-FAQ-for-Alumni
>
> Filmed on a fictional sample mailbox. The three research sites in the cloud lookup are real and shown as plain text, with no affiliation.
>
> Code (Apache-2.0): https://github.com/romaaurora787/leave-a-map
