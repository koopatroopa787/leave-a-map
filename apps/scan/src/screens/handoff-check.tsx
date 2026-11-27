// The two-site check (open the scan site with #handoff-check). T23a's proof for U5: send three
// sender domains to the consent window, get enum answers back, and show this page stayed offline.
import { useState } from 'preact/hooks';
import { openConsent, CLOUD_ORIGIN, type HandoffResult } from '../open-consent.ts';
import { egressLog } from '../lockdown.ts';
import { toOutboxItem } from '../../../../packages/core/handoff.ts';

const ITEMS = [toOutboxItem('h1', 'forkyard.example'), toOutboxItem('h2', 'ledgerly.example'), toOutboxItem('h3', 'notewise.example')];

export function HandoffCheck() {
  const [result, setResult] = useState<HandoffResult | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); setResult(null); setResult(await openConsent(ITEMS)); setBusy(false); };
  const outside = () => performance.getEntriesByType('resource').filter((e) => !e.name.startsWith(location.origin)).length;
  return (
    <main class="page wide">
      <h1>Two-site check</h1>
      <p>Sends 3 fictional sender domains to the consent window on {CLOUD_ORIGIN}. Nothing else leaves this page.</p>
      <button type="button" id="handoff-run" onClick={run} disabled={busy}>{busy ? 'Waiting for the consent window…' : 'Open the consent window'}</button>
      {result && <pre id="handoff-result">{JSON.stringify(result, null, 2)}</pre>}
      <p id="handoff-egress">Log on this page: {JSON.stringify(egressLog.map((e) => `${e.kind}: ${e.detail}`))}. Requests to other origins: {outside()}</p>
    </main>
  );
}
