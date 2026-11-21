import './lockdown.ts';
import { logLocal } from './lockdown.ts';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import './styles.css';
import { StartScreen } from './screens/start.tsx';
import { MapScreen } from './screens/map.tsx';
import type { FromWorker, NanoItem, RankedAccount, ScanSettings, ScanStats } from '../../../packages/core/types.ts';

type State =
  | { step: 'start'; error?: string }
  | { step: 'scanning'; settings: ScanSettings; sample: boolean; bytesRead: number; totalBytes: number; messages: number }
  | { step: 'done'; settings: ScanSettings; sample: boolean; accounts: RankedAccount[]; stats: ScanStats; ms: number; nanoItems: NanoItem[] };

function App() {
  const [state, setState] = useState<State>({ step: 'start' });

  const scan = (file: File, settings: ScanSettings, sample = false) => {
    const worker = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' });
    setState({ step: 'scanning', settings, sample, bytesRead: 0, totalBytes: file.size, messages: 0 });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'progress') setState({ step: 'scanning', settings, sample, ...m });
      else if (m.type === 'done') { worker.terminate(); logLocal(`Read ${m.stats.messages.toLocaleString()} emails in ${m.ms} ms, in a Worker on this device`); setState({ step: 'done', settings, sample, accounts: m.accounts, stats: m.stats, ms: m.ms, nanoItems: m.nanoItems }); }
      else { worker.terminate(); setState({ step: 'start', error: m.message }); }
    };
    worker.onerror = (e) => { worker.terminate(); setState({ step: 'start', error: e.message || 'The scan stopped unexpectedly.' }); };
    worker.postMessage({ type: 'scan', file, settings });
  };

  const trySample = async () => {
    const { sampleFile, SAMPLE_SETTINGS } = await import('./sample.ts');
    scan(sampleFile(), SAMPLE_SETTINGS, true);
  };
  if (state.step === 'start') return <StartScreen onScan={scan} onSample={trySample} error={state.error} />;
  if (state.step === 'scanning') {
    const pct = state.totalBytes ? Math.floor((state.bytesRead / state.totalBytes) * 100) : 0;
    return (
      <main class="page">
        <h1>Reading your mailbox</h1>
        <p>It stays on this device. Nothing is uploaded.</p>
        <progress max={100} value={pct} aria-label="Scan progress" />
        <p aria-live="polite">{pct}% · {state.messages.toLocaleString()} emails read</p>
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
const loading = <main class="page">Loading…</main>;
if (location.hash === '#nano-check') render(<Suspense fallback={loading}><NanoCheck /></Suspense>, root);
else if (location.hash === '#handoff-check') render(<Suspense fallback={loading}><HandoffCheck /></Suspense>, root);
else if (new URLSearchParams(location.search).get('eval') === '1') render(<Suspense fallback={loading}><EvalApp /></Suspense>, root);
else render(<App />, root);
