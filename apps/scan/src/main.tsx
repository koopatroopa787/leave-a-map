import './lockdown.ts';
import { logLocal } from './lockdown.ts';
import { emails } from './words.ts';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/atkinson-hyperlegible-mono';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/architects-daughter/latin-400.css';
import './styles.css';
import { applyDisplay, loadDisplay, TopBar } from './display.tsx';
import { sampleFailed, sampleLoaded, sampleWanted, STALE_MESSAGE, storage } from './stale-page.ts';
import { Dots } from './dots.tsx';

applyDisplay(loadDisplay());
import { StartScreen } from './screens/start.tsx';
import { MapScreen } from './screens/map.tsx';
import type { Mode } from './mode.ts';
import type { StartValues } from './screens/start.tsx';
import type { FromWorker, NanoItem, RankedAccount, ScanSettings, ScanStats } from '../../../packages/core/types.ts';

type State =
  | { step: 'start'; error?: string; last?: StartValues }
  | { step: 'scanning'; settings: ScanSettings; mode: Mode; sample: boolean; bytesRead: number; totalBytes: number; messages: number }
  | { step: 'done'; settings: ScanSettings; mode: Mode; sample: boolean; accounts: RankedAccount[]; stats: ScanStats; ms: number; nanoItems: NanoItem[] };

const pad = (n: number) => String(n).padStart(2, '0');
const SAMPLE_MODE_KEY = 'leave-a-map:sample-mode';

/**
 * The opening, when motion is on: a dot shape grows in the middle of a black page while a
 * handwritten counter runs to 100, then the page fades in. About 1.4 s. The page stays in the
 * accessibility tree the whole time; it's only transparent.
 */
function Intro({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const root = document.documentElement, t0 = performance.now();
    root.classList.add('is-intro');
    let r = 0;
    const step = (now: number) => {
      const v = Math.min(100, Math.round((now - t0) / 14));
      setP(v);
      if (v < 100) r = requestAnimationFrame(step); else { root.classList.remove('is-intro'); onDone(); }
    };
    r = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(r); root.classList.remove('is-intro'); };
  }, []);
  return (
    <div class="intro" data-dots="loader" data-progress={p / 100} aria-hidden="true">
      <p class="hand-pct">{pad(p)}<span>%</span></p>
    </div>
  );
}

function App() {
  const [state, setState] = useState<State>({ step: 'start' });
  const [intro, setIntro] = useState(() => document.documentElement.classList.contains('motion-ok'));

  const scan = (file: File, settings: ScanSettings, mode: Mode, sample = false) => {
    const worker = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' });
    // If the file turns out to be unreadable, the form comes back with what was typed, not empty.
    const last: StartValues | undefined = sample ? undefined : { mode, email: settings.ownAddresses[0] ?? '', date: settings.shutoffDate };
    setState({ step: 'scanning', settings, mode, sample, bytesRead: 0, totalBytes: file.size, messages: 0 });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'progress') setState({ step: 'scanning', settings, mode, sample, ...m });
      else if (m.type === 'done') { worker.terminate(); logLocal(`Read ${emails(m.stats.messages)} in ${m.ms} ms, in a Worker on this device`); setState({ step: 'done', settings, mode, sample, accounts: m.accounts, stats: m.stats, ms: m.ms, nanoItems: m.nanoItems }); }
      else { worker.terminate(); setState({ step: 'start', error: m.message, last }); }
    };
    worker.onerror = (e) => { worker.terminate(); setState({ step: 'start', error: e.message || 'The scan stopped unexpectedly.', last }); };
    worker.postMessage({ type: 'scan', file, settings });
  };

  const trySample = async (mode: Mode) => {
    let mod: typeof import('./sample.ts');
    try { mod = await import('./sample.ts'); } catch {
      // A page older than the site asks for a sample chunk that's gone (see stale-page.ts).
      // Remember which sample was asked for, so the fresh page runs the same one.
      try { storage()?.setItem(SAMPLE_MODE_KEY, mode); } catch { /* falls back to the school sample */ }
      if (sampleFailed(storage(), () => location.reload()) === 'gave-up') setState({ step: 'start', error: STALE_MESSAGE });
      return;
    }
    sampleLoaded(storage());
    const [file, settings] = mod.sample(mode);
    scan(file, settings, mode, true);
  };
  // After the reload above, run the same sample straight away.
  useEffect(() => {
    if (!sampleWanted(storage())) return;
    let mode: Mode = 'school';
    try { if (storage()?.getItem(SAMPLE_MODE_KEY) === 'loss') mode = 'loss'; storage()?.removeItem(SAMPLE_MODE_KEY); } catch { /* school sample */ }
    void trySample(mode);
  }, []);
  if (state.step === 'start') return <>{intro && <Intro onDone={() => setIntro(false)} />}<StartScreen onScan={scan} onSample={trySample} error={state.error} initial={state.last} /></>;
  if (state.step === 'scanning') {
    const pct = state.totalBytes ? Math.floor((state.bytesRead / state.totalBytes) * 100) : 0;
    const loss = state.mode === 'loss';
    const stage = pct < 25 ? 'Opening the mailbox…' : pct < 75 ? `Reading who sends ${loss ? 'them' : 'you'} mail…` : 'Sorting what matters most…';
    return (
      <main id="main" class="page scanning screen">
        <TopBar />
        <h1>Reading {loss ? 'their' : 'your'} mailbox<span class="dot" aria-hidden="true">*</span></h1>
        <div class="scan-stage" data-dots="loader" data-progress={pct / 100} aria-hidden="true" />
        <p class="hand-pct" aria-hidden="true">{pad(pct)}<span>%</span></p>
        <progress class="vh" max={100} value={pct} aria-label="Scan progress" />
        <p class="scan-count" aria-live="polite">{pct}% · {emails(state.messages)} read</p>
        <p class="scan-status" key={stage}>{stage}</p>
        <p class="assure">It stays on this device. Nothing is uploaded.</p>
      </main>
    );
  }
  return <MapScreen {...state} onAccounts={(accounts) => setState({ ...state, accounts })} onRestart={() => setState({ step: 'start' })} />;
}

// Firebase loads only on the Nano check screen, so the normal scan ships no SDK code.
const NanoCheck = lazy(() => import('./screens/nano-check.tsx').then((m) => ({ default: m.NanoCheck })));

// Eval mode (T27): `?eval=1`. Its own flow; the normal map is never shown.
const EvalApp = lazy(() => import('./screens/eval.tsx').then((m) => ({ default: m.EvalApp })));

const HandoffCheck = lazy(() => import('./screens/handoff-check.tsx').then((m) => ({ default: m.HandoffCheck })));

const root = document.getElementById('app')!;
const loading = <main id="main" class="page" aria-busy="true">Loading…</main>;
if (location.hash === '#nano-check') render(<Suspense fallback={loading}><NanoCheck /></Suspense>, root);
else if (location.hash === '#handoff-check') render(<Suspense fallback={loading}><HandoffCheck /></Suspense>, root);
else if (new URLSearchParams(location.search).get('eval') === '1') render(<Suspense fallback={loading}><EvalApp /></Suspense>, root);
else render(<><Dots /><App /></>, root);
