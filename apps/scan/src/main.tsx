import './lockdown.ts';
import { logLocal } from './lockdown.ts';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/atkinson-hyperlegible-mono';
import '@fontsource-variable/fraunces/full.css';
import './styles.css';
import { applyDisplay, loadDisplay, TopBar } from './display.tsx';

applyDisplay(loadDisplay());
import { StartScreen } from './screens/start.tsx';
import { MapScreen } from './screens/map.tsx';
import type { Mode } from './mode.ts';
import type { FromWorker, NanoItem, RankedAccount, ScanSettings, ScanStats } from '../../../packages/core/types.ts';

type State =
  | { step: 'start'; error?: string }
  | { step: 'scanning'; settings: ScanSettings; mode: Mode; sample: boolean; bytesRead: number; totalBytes: number; messages: number }
  | { step: 'done'; settings: ScanSettings; mode: Mode; sample: boolean; accounts: RankedAccount[]; stats: ScanStats; ms: number; nanoItems: NanoItem[] };

function App() {
  const [state, setState] = useState<State>({ step: 'start' });

  const scan = (file: File, settings: ScanSettings, mode: Mode, sample = false) => {
    const worker = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' });
    setState({ step: 'scanning', settings, mode, sample, bytesRead: 0, totalBytes: file.size, messages: 0 });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'progress') setState({ step: 'scanning', settings, mode, sample, ...m });
      else if (m.type === 'done') { worker.terminate(); logLocal(`Read ${m.stats.messages.toLocaleString()} emails in ${m.ms} ms, in a Worker on this device`); setState({ step: 'done', settings, mode, sample, accounts: m.accounts, stats: m.stats, ms: m.ms, nanoItems: m.nanoItems }); }
      else { worker.terminate(); setState({ step: 'start', error: m.message }); }
    };
    worker.onerror = (e) => { worker.terminate(); setState({ step: 'start', error: e.message || 'The scan stopped unexpectedly.' }); };
    worker.postMessage({ type: 'scan', file, settings });
  };

  const trySample = async (mode: Mode) => {
    const [file, settings] = (await import('./sample.ts')).sample(mode);
    scan(file, settings, mode, true);
  };
  if (state.step === 'start') return <StartScreen onScan={scan} onSample={trySample} error={state.error} />;
  if (state.step === 'scanning') {
    const pct = state.totalBytes ? Math.floor((state.bytesRead / state.totalBytes) * 100) : 0;
    const x = 20 + (pct / 100) * 480;
    const loss = state.mode === 'loss';
    const stage = pct < 25 ? 'Opening the mailbox…' : pct < 75 ? `Reading who sends ${loss ? 'them' : 'you'} mail…` : 'Sorting what matters most…';
    return (
      <main id="main" class="page scanning screen">
        <TopBar />
        <h1>Reading {loss ? 'their' : 'your'} mailbox</h1>
        <p class="scan-pct" aria-hidden="true">{pct}%</p>
        <svg class="scan-art" viewBox="0 0 520 40" aria-hidden="true" focusable="false">
          <path class="track" d="M20 20 H500" />
          <path class="done" d="M20 20 H500" pathLength={1} stroke-dasharray="1" stroke-dashoffset={1 - pct / 100} />
          <circle class="train" cx={x} cy="20" r="9" />
        </svg>
        <progress class="vh" max={100} value={pct} aria-label="Scan progress" />
        <p class="scan-count" aria-live="polite">{pct}% · {state.messages.toLocaleString()} emails read</p>
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
else render(<App />, root);
