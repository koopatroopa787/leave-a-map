// T24: lane 3 from the scan page. Offers the services the rules couldn't place, opens the consent
// window on the cloud site, and hands the enum answers back. Nothing leaves this page except
// `{ id, senderDomain }` by postMessage to the popup, after a click.
import { useState } from 'preact/hooks';
import type { RankedAccount } from '../../../../packages/core/types.ts';
import type { ServiceInfo } from '../../../../packages/core/handoff.ts';
import { outboxFor } from '../../../../packages/core/outbox.ts';
import { answersByKey } from '../../../../packages/core/lane3.ts';
import { openConsent } from '../open-consent.ts';

type Props = { accounts: RankedAccount[]; onAnswers: (byKey: Map<string, ServiceInfo>) => void };

export function CloudPanel({ accounts, onAnswers }: Props) {
  const [status, setStatus] = useState<'idle' | 'open' | 'done' | 'cancelled' | 'blocked' | 'timeout'>('idle');
  const [got, setGot] = useState(0);
  const outbox = outboxFor(accounts);
  if (outbox.items.length === 0 && status === 'idle') return null;

  const start = async () => {
    setStatus('open');
    const r = await openConsent(outbox.items); // must run inside the click, or the popup is blocked
    if (r.kind === 'answers') {
      const byKey = answersByKey(r.items, outbox.keyById);
      setGot(byKey.size);
      onAnswers(byKey);
      setStatus('done');
    } else setStatus(r.kind);
  };

  return (
    <section class="cloud" aria-labelledby="cloud-title">
      <h2 id="cloud-title">Look up services in the cloud</h2>
      <p>
        {outbox.items.length} service{outbox.items.length === 1 ? '' : 's'} can't be placed from your email alone.
        A model can say what kind of service each one is from its web address. You choose which ones in a separate
        window, and nothing is sent until you approve.
      </p>
      <button type="button" id="cloud-start" onClick={start} disabled={status === 'open'}>
        {status === 'open' ? 'Waiting for the other window…' : status === 'done' ? 'Look up again' : 'Look these up'}
      </button>
      <p class="meta" aria-live="polite">
        {status === 'done' && `${got} answer${got === 1 ? '' : 's'} added to the cards, each marked on-device or cloud.`}
        {status === 'cancelled' && 'Nothing was sent.'}
        {status === 'blocked' && 'Your browser blocked the window. Allow pop-ups for this site and try again.'}
        {status === 'timeout' && 'The other window took too long, so its answers were dropped.'}
      </p>
    </section>
  );
}
