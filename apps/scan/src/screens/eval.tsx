// T27: eval mode (`?eval=1`, docs/EVAL.md). Same page, same CSP, no network. The owner labels
// their own mail on their own machine; the only thing that can leave is the counts JSON, which
// they copy by hand. Results stay hidden until labelling is done, so the memory test is honest.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { FromWorker, NanoItem, RankedAccount, ScanSettings, ScanStats } from '../../../../packages/core/types.ts';
import type { Label } from '../../../../packages/core/contract.ts';
import {
  candidates, computeCounts, memoryNames, nameMatches, safeCounts, EVAL_COMMIT,
  type Answer, type NanoRun, type Q1, type Q2,
} from '../../../../packages/core/eval.ts';
import { StartScreen } from './start.tsx';
import { logLocal } from '../lockdown.ts';

const SEED = 2026;
const MEMORY_SECONDS = 120;
const Q2_LABEL: Record<Q2, string> = {
  sso: 'Opened with my school login', work: 'Holds my work or files', reset: 'Can reset other accounts',
  money: 'Holds money or a saved card', none: 'None of these',
};

type Scan = { settings: ScanSettings; accounts: RankedAccount[]; stats: ScanStats; nanoItems: NanoItem[] };
type Step = 'memory' | 'start' | 'scanning' | 'nano' | 'label' | 'misses' | 'counts';

export function EvalApp() {
  const [step, setStep] = useState<Step>('memory');
  const [typed, setTyped] = useState('');
  const [ram, setRam] = useState('');
  const [left, setLeft] = useState(MEMORY_SECONDS);
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState('');
  const [nanoState, setNanoState] = useState<'checking' | 'unavailable' | 'ready' | 'running' | 'done' | 'skipped'>('checking');
  const [nanoRuns, setNanoRuns] = useState<NanoRun[]>([]);
  const [nanoNote, setNanoNote] = useState('');
  const [answers, setAnswers] = useState(new Map<string, Answer>());
  const [sameAs, setSameAs] = useState(new Map<string, string>()); // typed name → candidate key
  const [missed, setMissed] = useState(new Set<string>()); // typed names confirmed as misses
  const [others, setOthers] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (step !== 'memory' || left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, left]);

  const runScan = (file: File, settings: ScanSettings) => {
    setStep('scanning');
    const worker = new Worker(new URL('../scan.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'done') {
        worker.terminate();
        logLocal(`Eval mode: read ${m.stats.messages.toLocaleString()} emails on this device`);
        setScan({ settings, accounts: m.accounts, stats: m.stats, nanoItems: m.nanoItems });
        setStep('nano');
        import('../nano.ts').then((n) => n.probeNano()).then((s) => setNanoState(s === 'unavailable' ? 'unavailable' : 'ready'), () => setNanoState('unavailable'));
      } else if (m.type === 'error') { worker.terminate(); setError(m.message); setStep('start'); }
    };
    worker.postMessage({ type: 'scan', file, settings });
  };
  const trySample = async () => { const { sampleFile, SAMPLE_SETTINGS } = await import('../sample.ts'); runScan(sampleFile(), SAMPLE_SETTINGS); };

  // Arm H: the same scan labelled by Nano, twice. Each run records Nano's own label per account.
  const runNano = async () => {
    if (!scan) return;
    setNanoState('running');
    try {
      const { startNano } = await import('../nano.ts');
      const { labelAccounts } = await import('../nano-run.ts');
      let timings: { id: string; ms: number; valid: boolean }[] = [];
      const nano = await startNano(() => {}, (e) => timings.push({ id: e.id, ms: e.ms, valid: e.valid }));
      const keyByMsg = new Map(scan.nanoItems.map((i) => [i.msgId, i.key]));
      const runs: NanoRun[] = [];
      for (let r = 0; r < 2; r++) {
        timings = [];
        const labels = new Map<string, { isAccount: boolean; holds: Label['holds'] }>();
        const recorder = { classify: async (id: string, d: string, t: string) => {
          const l = await nano.classify(id, d, t);
          const k = keyByMsg.get(id);
          if (l && k) labels.set(k, { isAccount: l.isAccount, holds: l.holds });
          return l;
        } };
        setNanoNote(`Run ${r + 1} of 2…`);
        const arm = await labelAccounts(scan.nanoItems, scan.accounts, recorder, timings, () => {});
        runs.push({ arm, labels, timingsMs: timings.map((t) => t.ms), calls: timings.length, valid: timings.filter((t) => t.valid).length });
      }
      setNanoRuns(runs);
      setNanoState('done');
      setNanoNote('');
    } catch (e) {
      setNanoNote(`On-device AI stopped: ${e instanceof Error ? e.message : String(e)}. Continue with the rules arm only.`);
      setNanoState('unavailable');
    }
  };

  const cand = useMemo(() => (scan ? candidates([scan.accounts, ...nanoRuns.map((r) => r.arm)], SEED) : { keys: [], sampled: false }), [scan, nanoRuns]);
  const byKey = useMemo(() => {
    const m = new Map<string, RankedAccount>();
    for (const arm of [scan?.accounts ?? [], ...nanoRuns.map((r) => r.arm)]) for (const a of arm) if (!m.has(a.key)) m.set(a.key, a);
    return m;
  }, [scan, nanoRuns]);
  const snippet = useMemo(() => new Map((scan?.nanoItems ?? []).map((i) => [i.key, i.text.replace(/\s+/g, ' ').slice(0, 110)])), [scan]);
  const names = useMemo(() => memoryNames(typed, (scan?.accounts ?? []).filter((a) => a.section === 'ends-anyway')), [typed, scan]);

  const setQ1 = (k: string, q1: Q1) => setAnswers((m) => new Map(m).set(k, { q1, q2: q1 === 'yes' ? (m.get(k)?.q2 ?? []) : [] }));
  const toggleQ2 = (k: string, q: Q2, on: boolean) => setAnswers((m) => {
    const a = m.get(k) ?? { q1: 'yes' as Q1, q2: [] };
    const q2 = on ? [...a.q2.filter((x) => (q === 'none' ? false : x !== 'none')), q] : a.q2.filter((x) => x !== q);
    return new Map(m).set(k, { ...a, q2 });
  });
  const answered = cand.keys.filter((k) => answers.has(k)).length;

  if (step === 'memory') {
    return (
      <main class="page eval">
        <p class="eyebrow">Evaluation mode · nothing leaves this page</p>
        <h1>First, from memory</h1>
        <p>Type every account you think uses your school email, one per line. Don't look at your inbox. You have two minutes; you can finish early.</p>
        <textarea id="eval-memory" rows={8} value={typed} onInput={(e) => setTyped(e.currentTarget.value)} disabled={left <= 0} aria-describedby="eval-timer" />
        <p id="eval-timer" class="meta" aria-live="polite">{left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left` : 'Time is up.'}</p>
        <label>
          Your laptop's RAM in GB (optional; used only to know whether on-device AI could run)
          <input type="number" min="0" max="512" value={ram} onInput={(e) => setRam(e.currentTarget.value)} />
        </label>
        <button type="button" id="eval-memory-done" onClick={() => setStep('start')}>Done, scan my mailbox</button>
      </main>
    );
  }
  if (step === 'start') return <StartScreen onScan={runScan} onSample={trySample} error={error} />;
  if (step === 'scanning') return <main class="page eval"><h1>Reading your mailbox</h1><p>It stays on this device. Results stay hidden until you've labelled them.</p></main>;

  if (step === 'nano') {
    return (
      <main class="page eval">
        <h1>On-device AI</h1>
        {nanoState === 'checking' && <p>Checking whether Gemini Nano runs in this browser…</p>}
        {nanoState === 'unavailable' && <p>Gemini Nano isn't available here, so only the rules arm runs. That's a useful result too.</p>}
        {nanoState === 'ready' && <><p>Gemini Nano will label your accounts twice, on this device, so we can see how consistent it is. It can take a few minutes.</p>
          <button type="button" id="eval-nano" onClick={runNano}>Run on-device AI twice</button> <button type="button" class="secondary" onClick={() => setNanoState('skipped')}>Skip</button></>}
        {nanoState === 'running' && <p aria-live="polite">{nanoNote}</p>}
        {nanoState === 'done' && <p>Done: two runs.</p>}
        {nanoNote && nanoState !== 'running' && <p class="error">{nanoNote}</p>}
        {nanoState !== 'checking' && nanoState !== 'running' && nanoState !== 'ready' &&
          <button type="button" id="eval-to-label" onClick={() => setStep('label')}>Next: label the list</button>}
      </main>
    );
  }

  if (step === 'label') {
    return (
      <main class="page eval">
        <h1>Is each one yours?</h1>
        <p>{cand.keys.length} services, in random order{cand.sampled ? ' (a sample of a long list)' : ''}. For each: do you have, or did you have, an account there tied to your school address?</p>
        <p class="meta" aria-live="polite">{answered} of {cand.keys.length} answered</p>
        <ol class="eval-list">
          {cand.keys.map((k) => {
            const a = byKey.get(k);
            const ans = answers.get(k);
            return (
              <li key={k} class="card">
                <p><strong>{a?.name ?? k}</strong> <span class="domain">{k.startsWith('app:') ? 'connected app' : k}</span></p>
                {snippet.get(k) && <p class="meta">Newest email: {snippet.get(k)}</p>}
                <div class="q1" role="radiogroup" aria-label={`Is ${a?.name ?? k} yours?`}>
                  {(['yes', 'no', 'not-sure'] as const).map((q) => (
                    <label key={q}><input type="radio" name={`q1-${k}`} checked={ans?.q1 === q} onChange={() => setQ1(k, q)} /> {q === 'yes' ? 'Yes' : q === 'no' ? 'No' : 'Not sure'}</label>
                  ))}
                </div>
                {ans?.q1 === 'yes' && (
                  <fieldset class="q2"><legend>Tick all that apply</legend>
                    {(Object.keys(Q2_LABEL) as Q2[]).map((q) => (
                      <label key={q}><input type="checkbox" checked={ans.q2.includes(q)} onChange={(e) => toggleQ2(k, q, e.currentTarget.checked)} /> {Q2_LABEL[q]}</label>
                    ))}
                  </fieldset>
                )}
              </li>
            );
          })}
        </ol>
        <button type="button" id="eval-to-misses" disabled={answered < cand.keys.length} onClick={() => setStep('misses')}>Next: anything missing?</button>
      </main>
    );
  }

  if (step === 'misses') {
    return (
      <main class="page eval">
        <h1>Anything missing?</h1>
        {names.length === 0 ? <p>You didn't type any names in the memory test.</p> : <p>These are the names you typed at the start.</p>}
        <ul class="eval-misses">
          {names.map((n) => {
            const sug = cand.keys.filter((k) => byKey.get(k) && nameMatches(n, byKey.get(k)!));
            const chosen = sameAs.get(n);
            return (
              <li key={n}>
                <strong>{n}</strong>
                {sug.map((k) => (
                  <label key={k}><input type="checkbox" checked={chosen === k} onChange={(e) => setSameAs((m) => { const x = new Map(m); if (e.currentTarget.checked) x.set(n, k); else x.delete(n); return x; })} />
                    {' '}Same as {byKey.get(k)!.name}</label>
                ))}
                {!chosen && (
                  <label><input type="checkbox" checked={missed.has(n)} onChange={(e) => setMissed((s) => { const x = new Set(s); if (e.currentTarget.checked) x.add(n); else x.delete(n); return x; })} />
                    {' '}A real account on my school address that the list missed</label>
                )}
              </li>
            );
          })}
        </ul>
        <label>Any other accounts on your school address that weren't in the list? How many?
          <input type="number" min="0" max="500" value={others} onInput={(e) => setOthers(Math.max(0, Number(e.currentTarget.value) || 0))} />
        </label>
        <button type="button" id="eval-to-counts" onClick={() => setStep('counts')}>See my counts</button>
      </main>
    );
  }

  // counts
  const counts = safeCounts(computeCounts({
    ramGB: ram ? Number(ram) : null,
    nanoAvailable: nanoState === 'done' || nanoState === 'ready' || nanoState === 'skipped',
    messages: scan?.stats.messages ?? 0,
    schoolLinkedMessages: scan?.stats.schoolLinked ?? 0,
    rules: scan?.accounts ?? [],
    nano: nanoRuns,
    candidates: { ...cand, seed: SEED },
    answers,
    ownerAddedMisses: [...missed].filter((n) => !sameAs.has(n)).length + others,
    memory: { named: names.length, matchedKeys: new Set(sameAs.values()) },
  }));
  const json = JSON.stringify(counts, null, 2);
  const m = counts.memory;
  const copy = async () => { try { await navigator.clipboard.writeText(json); setCopied(true); } catch { setCopied(false); } };
  return (
    <main class="page eval">
      <h1>Your counts</h1>
      <p class="summary" id="eval-summary">You named {m.named}. We found {m.foundConfirmed} confirmed account{m.foundConfirmed === 1 ? '' : 's'}, {m.foundNotNamed} you didn't name. We missed {m.namedNotFound} you named.</p>
      <p>This is everything that would be shared: numbers only, no names, no addresses, no email. Read it, then copy it to the team if you're happy.</p>
      <pre id="eval-counts">{json}</pre>
      <button type="button" id="eval-copy" onClick={copy}>{copied ? 'Copied' : 'Copy counts'}</button>
      <p class="meta">Pre-registered at commit {EVAL_COMMIT}. You can delete your .mbox file now.</p>
    </main>
  );
}
