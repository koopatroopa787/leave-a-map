# Evaluation: rules alone vs rules + Gemini Nano (pre-registration)

**Status: pre-registered, not yet run.** This file was committed before any real mailbox was scanned in eval mode. The thresholds, metrics and table below are fixed. Results are added under "Results" only, with every row, including bad ones. The commit hash of this file goes in the README.

Design from `analyst.md` section 4 (the four-agent review, 21 Nov 2026).

## Question

On real mailboxes, does adding Gemini Nano (lane 2) to the rules find more true accounts tied to the school address, without losing precision? And is Nano's "what it holds" tag right?

## Pre-registered claims

| Claim | We say it only if |
|---|---|
| **Nano finds more accounts** | Extra true accounts from Nano are **at least 10%** of the true accounts found by the rules alone, **and** precision with Nano is **no more than 5 points** below the rules' precision |
| **The "holds" tag is reliable** | **At least 80%** correct on **at least 30** judged accounts |

If either fails, the README says so, and the pitch drops to "rules first, Nano adds holds tags", or less.

## Units and arms

- **Unit:** an account (a registrable domain, or an `app:` name from a school-login notice) with at least one school-linked message. Accounts in "looks fake", "ends anyway" (school-run) and "tied to another address" are removed first, and their counts are reported separately.
- **Arm R (rules):** found = the main list of the rules-only scan.
- **Arm H (rules + Nano):** found = the main list after Nano labels the same scan. It runs **twice**, because Nano has no temperature control. Both runs are reported, plus how often they agree on "is this an account".
- **Lane 3 (cloud lookup) is out of scope.** It answers general questions about a service, not about the mailbox, and testers would need the paid tier and consent for every domain.

## Mailboxes and who can run arm H

- **Mail never moves between people.** Each owner runs eval mode on their own machine. Only the counts below are shared.
- **Arm H needs Gemini Nano on the owner's own machine.** Owners without Nano run arm R plus the memory test, and their rows say "H: not run (no Nano)".
- **Target:** 3 mailboxes, 2 from the team and at least 1 from a tester. If only team mailboxes qualify, they are published anyway and labelled "team member".
- **Sampling:** every candidate is labelled when there are 150 or fewer. Above 150: every candidate that either arm rated Likely or Seen, plus a random 50 of the rest, chosen with a fixed seed. The seed and the sampling are reported.
- **If behind:** cut to 2 mailboxes and one Nano run, and the table says "single run".

## Procedure (eval mode: the scan site with `?eval=1`, same CSP, no network)

1. **Memory test first.** Before any result is visible, the owner types the accounts they think use their school email, for up to 2 minutes.
2. **Scan.** Arm R, then arm H runs 1 and 2 where Nano exists. Results stay hidden.
3. **Blind list.** Candidates are the union of the main and "maybe" lists from every arm, shuffled with a fixed seed. Each shows its name, domain and the start of its newest email (cleaned: no links, addresses or codes). Arm, tier and bucket are hidden.
4. For each candidate, the owner answers:
   - **Q1:** "Do you have, or did you have, an account here tied to your school address?" Yes / No / Not sure.
   - **Q2** (only after Yes), tick all that apply: opened with my school login / holds my work or files / can reset other accounts / holds money or a saved card / none of these.
5. **Misses.** Memory-test names that match no candidate are listed. The owner confirms which are real accounts on the school address and adds any others. These count toward the truth.
6. **Counts.** The screen shows the counts as JSON text with a Copy button. Nothing else leaves the machine.

## Metrics

| Metric | Definition |
|---|---|
| Truth T | Candidates answered Yes, plus confirmed misses. "Not sure" is excluded and counted |
| TP, FP | Found by the arm and Yes; found by the arm and No |
| Precision | TP / (TP + FP) |
| Pooled recall | TP / T. "Pooled" because truth is only what any arm or the owner found |
| Arm H | Per run. The headline is the mean of the 2 runs, with the min and max |
| Gain | (TP_H − TP_R) / TP_R, plus the absolute extra count |
| Holds accuracy | Over arm H's true accounts where Nano gave a "holds" value other than nothing-seen: the share matching any ticked Q2 box. documents ↔ work; payment ↔ money; login-for-others ↔ reset; purchases ↔ money or none |
| Bucket agreement | Share of true accounts whose bucket in the app equals the first ticked Q2 box in the app's order (none → the "rest" bucket). Reported for R and H |
| Nano reliability | Calls, valid answers %, on-device % (must be 100), median and p90 ms, run-to-run agreement on "is an account" |
| Confidence intervals | Wilson 95% on precision, recall and holds accuracy, with z = 1.96 |

## What each owner shares: counts only

Only integers, booleans and fixed words. The Copy button builds this object from a fixed list of keys. A unit test checks that no other string can appear.

```json
{
  "v": 1, "evalCommit": "<hash>", "arms": ["rules", "rules+nano"], "nanoAvailable": true,
  "ramGB": 16, "messages": 0, "schoolLinkedMessages": 0,
  "excluded": { "schoolRun": 0, "looksFake": 0, "elsewhere": 0 },
  "candidates": 0, "sampled": false, "seed": 0,
  "labels": { "yes": 0, "no": 0, "notSure": 0 }, "ownerAddedMisses": 0,
  "rules": { "found": 0, "tp": 0, "fp": 0 },
  "nano": [ { "found": 0, "tp": 0, "fp": 0 }, { "found": 0, "tp": 0, "fp": 0 } ],
  "nanoRuns": { "calls": 0, "valid": 0, "onDevice": 0, "medianMs": 0, "p90Ms": 0, "agreement": 0 },
  "holds": { "judged": 0, "correct": 0 },
  "bucketAgree": { "rules": [0, 0], "nano": [0, 0] },
  "memory": { "named": 0, "foundConfirmed": 0, "overlap": 0, "foundNotNamed": 0, "namedNotFound": 0 }
}
```

## Results (empty until the runs)

### Evaluation: rules alone vs rules + Gemini Nano (pre-registered at commit `<this file's commit>`)

| Mailbox | Owner | Messages | Candidates | Yes / No / Not sure | Owner-added misses | Rules: found · precision | Rules + Nano: found · precision (run 1 / run 2) | Extra true accounts from Nano | Pooled recall: rules → + Nano | "Holds" tag correct | Bucket agreement: rules → + Nano |
|---|---|---:|---:|---|---:|---|---|---:|---|---|---|
| M1 | team | | | | | | | | | | |
| M2 | team | | | | | | | | | | |
| M3 | tester | | | | | | | | | | |
| **All** | | | | | | | | | | | |

| Nano reliability | Calls | Valid | On-device | Median ms | p90 ms | Run-to-run agreement |
|---|---:|---:|---:|---:|---:|---:|
| All mailboxes | | | | | | |

Excluded before labelling: school-run ___, looks fake ___, tied to another address ___.
Owners labelled their own mail on their own machines; only these counts were shared.
Thresholds set before running: Nano counts as helping if extra true accounts ≥ 10% of rules-alone and precision drops ≤ 5 points; holds tag reliable if ≥ 80% on ≥ 30 accounts.
Result: ___.

## Known issues going in (noted before any run)

- Nano over-labels "work": on the 21 Nov development mailbox it put 28 accounts there against about 20 real ones, e.g. a password manager.
- Nano says it recognises services that don't exist (lane 3 check on fictional domains).

Recording these now means a result can't be explained away afterwards.
