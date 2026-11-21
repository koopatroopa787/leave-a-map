// apps/cloud/src/consent.ts: the consent window. Shows every sender domain it was given, each
// with an unticked box. Only ticked rows are looked up; unticked rows are discarded here.
// The lookup itself (lane 3 cascade) is in egress.ts; Firebase loads only after the click below.
// T22 adds the 18+ box, the "select all except health and money" button and the paid-tier text.
import { MSG, parseOutbox, type OutboxItem } from '../../../packages/core/handoff.ts';

const SCAN_ORIGIN: string = import.meta.env.VITE_CLOUD_SCAN_ORIGIN ?? 'https://leave-a-map.web.app';
const app = document.getElementById('app')!;
const opener = window.opener as Window | null;

function el(tag: string, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElement {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

function show(items: OutboxItem[]) {
  const boxes = items.map((i) => {
    const box = el('input', { type: 'checkbox', checked: false, value: i.id }) as HTMLInputElement;
    box.id = `row-${i.id}`;
    return { item: i, box, row: el('li', {}, el('label', { htmlFor: box.id }, box, ` ${i.senderDomain}`)) };
  });
  const send = el('button', { type: 'button', id: 'consent-send', textContent: 'Look up the ticked services' }) as HTMLButtonElement;
  const cancel = el('button', { type: 'button', id: 'consent-cancel', textContent: 'Cancel' }) as HTMLButtonElement;
  send.onclick = async () => {
    const approved = boxes.filter((b) => b.box.checked).map((b) => b.item);
    send.disabled = true;
    const progress = el('p', { id: 'consent-progress', textContent: `Looking up 0 of ${approved.length}…` });
    send.after(progress);
    let answers;
    try {
      const { lookupAll } = await import('./egress.ts'); // Firebase and App Check load only now
      answers = await lookupAll(approved, (n) => { progress.textContent = `Looking up ${n} of ${approved.length}…`; },
        (l) => console.info('lane 3', l));
    } catch (e) {
      app.replaceChildren(el('p', { id: 'consent-error', textContent: `The lookup couldn't run (${(e as Error).message}). Nothing was sent back.` }));
      opener?.postMessage({ type: MSG.cancelled }, SCAN_ORIGIN);
      return;
    }
    opener?.postMessage({ type: MSG.services, items: answers }, SCAN_ORIGIN);
    app.replaceChildren(el('p', { id: 'consent-done', textContent: `Sent ${answers.length} answers back. You can close this window.` }));
    setTimeout(() => window.close(), 800);
  };
  cancel.onclick = () => { opener?.postMessage({ type: MSG.cancelled }, SCAN_ORIGIN); window.close(); };
  app.replaceChildren(
    el('h1', { textContent: 'Approve what is looked up' }),
    el('p', { textContent: 'Only the service names you tick are sent to the cloud model. Nothing from your emails is here.' }),
    el('ul', {}, ...boxes.map((b) => b.row)),
    send, ' ', cancel,
  );
}

addEventListener('message', (e: MessageEvent) => {
  if (e.origin !== SCAN_ORIGIN || e.source !== opener) return;
  const items = parseOutbox(e.data);
  if (items) show(items);
  else app.replaceChildren(el('p', { textContent: 'The list was not in the expected form, so nothing was shown or sent.' }));
});

if (opener) opener.postMessage({ type: MSG.ready }, SCAN_ORIGIN);
else app.replaceChildren(el('p', { textContent: 'Open this window from Leave a Map.' }));
