// Lane 2 controls under the list: start Nano from a click, show progress, and record U2, U4, U6.
import { useEffect, useState } from 'preact/hooks';
import type { NanoItem, RankedAccount } from '../../../../packages/core/types.ts';
import { logLocal, outboundCount } from '../lockdown.ts';
import type { NanoRunStats, Timing } from '../nano-run.ts';

type Props = { items: NanoItem[]; accounts: RankedAccount[]; onAccounts: (a: RankedAccount[]) => void };
type Probe = 'checking' | 'ready' | 'needs-download' | 'unavailable';

export function NanoPanel({ items, accounts, onAccounts }: Props) {
  const [probe, setProbe] = useState<Probe>('checking');
  const [startState, setStartState] = useState<Probe | null>(null);
  const [download, setDownload] = useState<{ events: number; last: number } | null>(null);
  const [stats, setStats] = useState<NanoRunStats | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [egress, setEgress] = useState({ before: 0, after: 0 });

  // Load the SDK only when Nano might run, so a plain scan ships no Firebase code.
  useEffect(() => { import('../nano.ts').then((m) => m.probeNano()).then(setProbe); }, []);

  const start = async () => {
    setRunning(true); setError(''); setStartState(probe);
    const before = outboundCount();
    const timings: Timing[] = [];
    try {
      const { startNano } = await import('../nano.ts');
      const { labelAccounts } = await import('../nano-run.ts');
      const nano = await startNano((p) => setDownload((d) => ({ events: (d?.events ?? 0) + 1, last: p })),
        (e) => timings.push({ id: e.id, ms: e.ms, valid: e.valid }));
      setProbe('ready');
      let last: NanoRunStats | null = null;
      await labelAccounts(items, accounts, nano, timings, (a, s) => { onAccounts(a); setStats(s); last = s; });
      if (last) logLocal(`Gemini Nano labelled ${(last as NanoRunStats).done} accounts on this device`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEgress({ before, after: outboundCount() });
      setRunning(false);
    }
  };

  if (probe === 'unavailable') {
    return <section class="nano"><h2>On-device AI</h2><p>Not available in this browser, so only the rules ran. The list above is complete without it.</p></section>;
  }
  const pct = stats ? Math.round((stats.done / Math.max(stats.total, 1)) * 100) : 0;
  return (
    <section class="nano">
      <h2>On-device AI</h2>
      <p>Gemini Nano can read one email from each of {items.length} accounts to fill in what they hold. It runs on this device; nothing is sent.</p>
      {!stats && !running && <button type="button" id="nano-start" onClick={start} disabled={probe === 'checking' || items.length === 0}>
        {probe === 'needs-download' ? 'Download the on-device model and label' : 'Label with on-device AI'}</button>}
      {download && download.last < 1 && <p aria-live="polite">Downloading the model: {Math.round(download.last * 100)}%</p>}
      {stats && <p aria-live="polite">{running ? 'Labelling' : 'Labelled'} {stats.done} of {stats.total} ({pct}%).</p>}
      {stats?.stopped && <p class="error" role="alert">Stopped: {stats.stopped}. No email was sent anywhere.</p>}
      {error && <p class="error" role="alert">{error}</p>}
      {stats && !running && (
        <details>
          <summary>Measurements</summary>
          <table>
            <tbody>
              <tr><th scope="row">U2 speed</th><td>Median {stats.first50.medianMs} ms over the first {stats.first50.n} (pass: at most 3,600 ms). Median over all {stats.done - stats.errors}: {stats.medianMs} ms</td></tr>
              <tr><th scope="row">U2 invalid</th><td>{stats.first50.invalidPct}% of the first {stats.first50.n} (pass: under 2%). {stats.invalid} invalid and {stats.errors} errors in total</td></tr>
              <tr><th scope="row">U4 silence</th><td>{egress.after - egress.before} outbound attempts during labelling, {egress.after} since the page loaded (pass: 0)</td></tr>
              <tr><th scope="row">U6 download</th><td>Model was "{startState}" at the start. {download ? `${download.events} progress updates, reached ${Math.round(download.last * 100)}%` : 'No download was needed'}</td></tr>
            </tbody>
          </table>
          <pre id="nano-stats">{JSON.stringify({ ...stats, startState, download, egress })}</pre>
        </details>
      )}
    </section>
  );
}
