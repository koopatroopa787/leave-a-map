// The Nano check screen (open the scan site with #nano-check). T17's proof: probe Nano, start it
// from a click, label five emails, and show the source and timing of each. T27's eval mode builds on it.
import { useEffect, useState } from 'preact/hooks';
import { probeNano, startNano, type InferenceLog, type NanoState } from '../nano.ts';
import { outboundCount } from '../lockdown.ts';
import { prepForPrompt } from '../../../../packages/core/prompt-prep.ts';
import type { Label } from '../../../../packages/core/contract.ts';

const OWN = ['jreyes@alderbrook.example'];
/** Fictional emails (`.example` domains only). Real-mail runs use the person's own export. */
const SAMPLES = [
  { id: 's1', domain: 'forkyard.example', subject: 'Sam commented on your pull request', body: 'Sam commented on pull request #12 in alderbrook/thesis-code: "Looks good."' },
  { id: 's2', domain: 'ledgerly.example', subject: 'Your monthly statement is ready', body: 'Your statement for the account ending 4471 is ready. Balance: $1,204.10.' },
  { id: 's3', domain: 'notewise.example', subject: 'Account updated', body: 'Hi Jordan, your recovery email is now jreyes@alderbrook.example. Notewise keeps the passwords for your other accounts.' },
  { id: 's4', domain: 'pagewell.example', subject: 'Top stories this week', body: 'Five stories we think you will like. Unsubscribe at any time.' },
  { id: 's5', domain: 'quillbase.example', subject: 'Your project was shared with you', body: 'Dr. Ames shared the project "Lab report draft" with you. Open it to start editing.' },
];

type Row = { id: string; domain: string; label: Label | null; log?: InferenceLog; error?: string };

export function NanoCheck() {
  const [state, setState] = useState<NanoState | 'checking'>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { probeNano().then(setState); }, []);

  const run = async () => {
    setBusy(true); setError(''); setRows([]);
    const logs = new Map<string, InferenceLog>();
    try {
      const nano = await startNano((p) => setProgress(p), (e) => logs.set(e.id, e));
      for (const s of SAMPLES) {
        const text = prepForPrompt(s.subject, s.body, { ownAddresses: OWN });
        try {
          const label = await nano.classify(s.id, s.domain, text);
          setRows((r) => [...r, { id: s.id, domain: s.domain, label, log: logs.get(s.id) }]);
        } catch (e) {
          setRows((r) => [...r, { id: s.id, domain: s.domain, label: null, error: e instanceof Error ? e.message : String(e) }]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setState(await probeNano());
    }
  };

  return (
    <main id="main" class="page wide">
      <h1>Nano check</h1>
      <p>On-device model: <strong id="nano-state">{state}</strong>{progress !== null && progress < 1 ? ` · downloading ${Math.round(progress * 100)}%` : ''}</p>
      {state === 'unavailable'
        ? <p>On-device AI isn't available in this browser. The rules still work; lane 2 is skipped.</p>
        : <button type="button" id="nano-run" onClick={run} disabled={busy}>{busy ? 'Labelling…' : 'Start Nano and label 5 sample emails'}</button>}
      {error && <p class="error" role="alert">{error}</p>}
      {rows.length > 0 && (
        <table id="nano-results">
          <thead><tr><th scope="col">Email</th><th scope="col">Source</th><th scope="col">Time</th><th scope="col">Label</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id} · {r.domain}</td>
                <td>{r.log?.source ?? '—'}</td>
                <td>{r.log ? `${r.log.ms} ms` : '—'}</td>
                <td>{r.error ? `Error: ${r.error}` : r.label ? `${r.label.isAccount ? 'account' : 'not an account'} · ${r.label.type} · ${r.label.holds}${r.label.quote ? ` · “${r.label.quote}”` : ''}` : 'invalid answer (dropped)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p id="egress">Outbound attempts on this page: {outboundCount()}</p>
    </main>
  );
}
