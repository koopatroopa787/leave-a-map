// packages/core/eval.ts: the T27 evaluation maths (docs/EVAL.md). Pure, so every number in the
// counts JSON is unit-tested. Nothing here touches mail text: inputs are account keys, buckets,
// the owner's answers and Nano's enum labels.
import type { Bucket, RankedAccount } from './types.ts';
import type { Holds } from './contract.ts';

/** The commit that pre-registered the evaluation. Cited in the counts and the README. */
export const EVAL_COMMIT = '03b3f2a';
export const SAMPLE_ALL_UP_TO = 150;
export const SAMPLE_REST = 50;

// --- statistics --------------------------------------------------------------------------------

/** Wilson 95% interval for k successes in n. */
export function wilson(k: number, n: number, z = 1.96): { p: number; lo: number; hi: number } {
  if (n === 0) return { p: 0, lo: 0, hi: 0 };
  const p = k / n;
  const z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

export function percentile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}

// --- seeded shuffle and sampling ---------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: readonly T[], seed: number): T[] {
  const out = [...xs];
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** An arm's result: the ranked list it produced. */
export type Arm = readonly RankedAccount[];

const strong = (a: RankedAccount) => a.primaryTier === 'seen' || a.primaryTier === 'likely';

/**
 * Candidates: the main and maybe lists of every arm, de-duplicated. Up to 150 are all labelled;
 * above that, every Likely-or-better from any arm plus a seeded random 50 of the rest.
 */
export function candidates(arms: readonly Arm[], seed: number): { keys: string[]; sampled: boolean } {
  const all = new Map<string, boolean>();
  for (const arm of arms) {
    for (const a of arm) {
      if (a.section !== 'main' && a.section !== 'maybe') continue;
      all.set(a.key, (all.get(a.key) ?? false) || (a.section === 'main' && strong(a)));
    }
  }
  const keys = [...all.keys()];
  if (keys.length <= SAMPLE_ALL_UP_TO) return { keys: shuffle(keys, seed), sampled: false };
  const sure = keys.filter((k) => all.get(k));
  const rest = shuffle(keys.filter((k) => !all.get(k)), seed).slice(0, SAMPLE_REST);
  return { keys: shuffle([...sure, ...rest], seed + 1), sampled: true };
}

// --- memory test -------------------------------------------------------------------------------

export const normName = (s: string) =>
  s.toLowerCase().replace(/\.(?:com|org|net|io|app|co|example|edu)\b.*$/, '').replace(/[^a-z0-9]/g, '');

export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

const commonPrefix = (a: string, b: string) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i; };

/**
 * A typed name and an account match if their normalised forms are within 2 edits, one starts with
 * the other (4+ characters), or they share a 5+ character prefix ("proofwrite" and "proofwright").
 * The owner confirms every match, so a loose rule only costs a click.
 */
export function nameMatches(typed: string, a: Pick<RankedAccount, 'key' | 'name'>): boolean {
  const t = normName(typed);
  if (t.length < 2) return false;
  const forms = [normName(a.name), normName(a.key.replace(/^app:/, '').split('.')[0])].filter((f) => f.length >= 2);
  return forms.some((f) => editDistance(t, f) <= 2 || (t.length >= 4 && f.length >= 4 && (f.startsWith(t) || t.startsWith(f))) || commonPrefix(t, f) >= 5);
}

/** Typed names, normalised and de-duplicated, minus ones that name a school-run sender. */
export function memoryNames(raw: string, schoolRun: readonly Pick<RankedAccount, 'key' | 'name'>[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/[\n,;]+/)) {
    const name = line.trim().slice(0, 60);
    const n = normName(name);
    if (!n || seen.has(n) || schoolRun.some((a) => nameMatches(name, a))) continue;
    seen.add(n);
    out.push(name);
  }
  return out;
}

// --- answers and counts ------------------------------------------------------------------------

export type Q1 = 'yes' | 'no' | 'not-sure';
export type Q2 = 'sso' | 'work' | 'reset' | 'money' | 'none';
export type Answer = { q1: Q1; q2: Q2[] };

const Q2_ORDER: Exclude<Bucket, 'rest'>[] = ['sso', 'work', 'reset', 'money'];
const firstBucket = (q2: readonly Q2[]): Bucket => Q2_ORDER.find((b) => q2.includes(b)) ?? 'rest';
const HOLDS_MATCH: Record<Exclude<Holds, 'nothing-seen'>, Q2[]> = {
  documents: ['work'], payment: ['money'], 'login-for-others': ['reset'], purchases: ['money', 'none'],
};

export type NanoRun = {
  arm: Arm;
  /** Nano's label per account key: is it an account, and what it holds. */
  labels: ReadonlyMap<string, { isAccount: boolean; holds: Holds }>;
  timingsMs: readonly number[];
  calls: number;
  valid: number;
};

export type EvalInput = {
  ramGB: number | null;
  nanoAvailable: boolean;
  messages: number;
  schoolLinkedMessages: number;
  rules: Arm;
  nano: readonly NanoRun[];
  candidates: { keys: readonly string[]; sampled: boolean; seed: number };
  answers: ReadonlyMap<string, Answer>;
  ownerAddedMisses: number;
  memory: { named: number; matchedKeys: ReadonlySet<string> };
};

const mainKeys = (arm: Arm) => arm.filter((a) => a.section === 'main');

function armCounts(arm: Arm, answers: ReadonlyMap<string, Answer>) {
  const found = mainKeys(arm);
  return {
    found: found.length,
    tp: found.filter((a) => answers.get(a.key)?.q1 === 'yes').length,
    fp: found.filter((a) => answers.get(a.key)?.q1 === 'no').length,
  };
}

function bucketAgree(arm: Arm, answers: ReadonlyMap<string, Answer>): [number, number] {
  const tp = mainKeys(arm).filter((a) => answers.get(a.key)?.q1 === 'yes');
  return [tp.filter((a) => a.bucket === firstBucket(answers.get(a.key)!.q2)).length, tp.length];
}

export function computeCounts(x: EvalInput) {
  const excluded = { schoolRun: 0, looksFake: 0, elsewhere: 0 };
  for (const a of x.rules) {
    if (a.section === 'ends-anyway') excluded.schoolRun++;
    else if (a.section === 'ignored') excluded.looksFake++;
    else if (a.section === 'elsewhere') excluded.elsewhere++;
  }
  const labels = { yes: 0, no: 0, notSure: 0 };
  for (const k of x.candidates.keys) {
    const q = x.answers.get(k)?.q1;
    if (q === 'yes') labels.yes++; else if (q === 'no') labels.no++; else if (q === 'not-sure') labels.notSure++;
  }

  // Holds accuracy over run 1's true accounts where Nano gave a "holds" value.
  let judged = 0, correct = 0;
  const run1 = x.nano[0];
  if (run1) {
    for (const a of mainKeys(run1.arm)) {
      const ans = x.answers.get(a.key);
      const label = run1.labels.get(a.key);
      if (ans?.q1 !== 'yes' || !label || label.holds === 'nothing-seen') continue;
      judged++;
      if (HOLDS_MATCH[label.holds].some((q) => ans.q2.includes(q))) correct++;
    }
  }

  // Run-to-run agreement on "is an account", over keys both runs labelled.
  let both = 0, same = 0;
  if (x.nano.length >= 2) {
    for (const [k, l1] of x.nano[0].labels) {
      const l2 = x.nano[1].labels.get(k);
      if (!l2) continue;
      both++;
      if (l1.isAccount === l2.isAccount) same++;
    }
  }
  const times = x.nano.flatMap((r) => r.timingsMs);
  const calls = x.nano.reduce((n, r) => n + r.calls, 0);

  // Memory test, on the shipped arm (H run 1 when Nano ran, else R).
  const shipped = x.nano[0]?.arm ?? x.rules;
  const confirmed = new Set(mainKeys(shipped).filter((a) => x.answers.get(a.key)?.q1 === 'yes').map((a) => a.key));
  const overlap = [...x.memory.matchedKeys].filter((k) => confirmed.has(k)).length;

  return {
    v: 1,
    evalCommit: EVAL_COMMIT,
    arms: x.nano.length ? ['rules', 'rules+nano'] : ['rules'],
    nanoAvailable: x.nanoAvailable,
    ramGB: x.ramGB ?? 0,
    messages: x.messages,
    schoolLinkedMessages: x.schoolLinkedMessages,
    excluded,
    candidates: x.candidates.keys.length,
    sampled: x.candidates.sampled,
    seed: x.candidates.seed,
    labels,
    ownerAddedMisses: x.ownerAddedMisses,
    rules: armCounts(x.rules, x.answers),
    nano: x.nano.map((r) => armCounts(r.arm, x.answers)),
    nanoRuns: {
      calls,
      valid: x.nano.reduce((n, r) => n + r.valid, 0),
      onDevice: times.length, // every timed answer was checked on-device; any other stops the run
      medianMs: percentile(times, 0.5),
      p90Ms: percentile(times, 0.9),
      agreement: both ? Math.round((same / both) * 1000) / 1000 : 0,
    },
    holds: { judged, correct },
    bucketAgree: { rules: bucketAgree(x.rules, x.answers), nano: run1 ? bucketAgree(run1.arm, x.answers) : [0, 0] },
    memory: {
      named: x.memory.named,
      foundConfirmed: confirmed.size,
      overlap,
      foundNotNamed: confirmed.size - overlap,
      namedNotFound: x.memory.named - overlap,
    },
  };
}

export type Counts = ReturnType<typeof computeCounts>;

/**
 * The only object that may be copied off the machine. Rebuilt key by key from a fixed shape:
 * numbers, booleans, the commit hash and the arm names. Anything else is dropped or zeroed.
 */
export function safeCounts(c: unknown): Counts {
  const o = (c ?? {}) as Record<string, any>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const b = (v: unknown) => v === true;
  const pick = <K extends string>(v: any, keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, n(v?.[k])])) as Record<K, number>;
  const arm = (v: any) => pick(v, ['found', 'tp', 'fp'] as const);
  const pair = (v: any): [number, number] => [n(v?.[0]), n(v?.[1])];
  return {
    v: 1,
    evalCommit: typeof o.evalCommit === 'string' && /^[0-9a-f]{7,40}$/.test(o.evalCommit) ? o.evalCommit : EVAL_COMMIT,
    arms: (Array.isArray(o.arms) ? o.arms : []).filter((a: unknown) => a === 'rules' || a === 'rules+nano').slice(0, 2),
    nanoAvailable: b(o.nanoAvailable),
    ramGB: n(o.ramGB),
    messages: n(o.messages),
    schoolLinkedMessages: n(o.schoolLinkedMessages),
    excluded: pick(o.excluded, ['schoolRun', 'looksFake', 'elsewhere'] as const),
    candidates: n(o.candidates),
    sampled: b(o.sampled),
    seed: n(o.seed),
    labels: pick(o.labels, ['yes', 'no', 'notSure'] as const),
    ownerAddedMisses: n(o.ownerAddedMisses),
    rules: arm(o.rules),
    nano: (Array.isArray(o.nano) ? o.nano : []).slice(0, 2).map(arm),
    nanoRuns: pick(o.nanoRuns, ['calls', 'valid', 'onDevice', 'medianMs', 'p90Ms', 'agreement'] as const),
    holds: pick(o.holds, ['judged', 'correct'] as const),
    bucketAgree: { rules: pair(o.bucketAgree?.rules), nano: pair(o.bucketAgree?.nano) },
    memory: pick(o.memory, ['named', 'foundConfirmed', 'overlap', 'foundNotNamed', 'namedNotFound'] as const),
  } as Counts;
}
