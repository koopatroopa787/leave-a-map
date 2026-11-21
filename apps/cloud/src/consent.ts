// apps/cloud/src/consent.ts: the consent window. Shows every sender domain it was given, each
// with an unticked box. Only ticked rows are looked up; unticked rows are discarded here.
// The lookup itself (lane 3 cascade) is in egress.ts; Firebase loads only after the click below.
// T22: every box starts unticked; "Select all except health and money"; an 18+ box; the
// paid-tier logging notice (never "nothing is kept").
import { MSG, parseOutbox, type OutboxItem } from '../../../packages/core/handoff.ts';

const SCAN_ORIGIN: string = import.meta.env.VITE_CLOUD_SCAN_ORIGIN ?? 'https://leave-a-map.web.app';
const app = document.getElementById('app')!;
const opener = window.opener as Window | null;

function el(tag: string, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElement {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

const TERMS = 'https://ai.google.dev/gemini-api/terms';
const SENSITIVE_WORD = { health: 'health', money: 'money' } as const;

function show(items: OutboxItem[]) {
  const boxes = items.map((i) => {
    const box = el('input', { type: 'checkbox', checked: false, value: i.id }) as HTMLInputElement;
    box.id = `row-${i.id}`;
    const tag = i.sensitive ? el('span', { className: `tag ${i.sensitive}`, textContent: `${SENSITIVE_WORD[i.sensitive]}: tick on its own` }) : '';
    return { item: i, box, row: el('li', {}, el('label', { htmlFor: box.id }, box, el('span', { className: 'domain', textContent: i.senderDomain }), tag)) };
  });
  const adult = el('input', { type: 'checkbox', checked: false, id: 'consent-adult' }) as HTMLInputElement;
  const send = el('button', { type: 'button', id: 'consent-send', className: 'primary' }) as HTMLButtonElement;
  const cancel = el('button', { type: 'button', id: 'consent-cancel', textContent: 'Cancel, send nothing' }) as HTMLButtonElement;
  const selectSafe = el('button', { type: 'button', id: 'consent-select-safe', textContent: 'Select all except health and money' }) as HTMLButtonElement;
  const clear = el('button', { type: 'button', id: 'consent-clear', textContent: 'Clear' }) as HTMLButtonElement;
  const hint = el('p', { id: 'consent-hint', className: 'hint' });

  const refresh = () => {
    const n = boxes.filter((b) => b.box.checked).length;
    send.textContent = n === 1 ? 'Look up 1 service' : `Look up ${n} services`;
    send.disabled = n === 0 || !adult.checked;
    hint.textContent = !adult.checked ? 'Tick the 18+ box to continue.' : n === 0 ? 'Tick at least one service.' : '';
  };
  for (const b of boxes) b.box.addEventListener('change', refresh);
  adult.addEventListener('change', refresh);
  selectSafe.onclick = () => { for (const b of boxes) b.box.checked = !b.item.sensitive; refresh(); };
  clear.onclick = () => { for (const b of boxes) b.box.checked = false; refresh(); };

  send.onclick = async () => {
    if (!adult.checked) return;
    // Unticked rows are discarded here: they are never sent to the model or back to the scan page.
    const approved = boxes.filter((b) => b.box.checked).map((b) => b.item);
    if (approved.length === 0) return;
    send.disabled = true; selectSafe.disabled = true; clear.disabled = true;
    for (const b of boxes) b.box.disabled = true;
    adult.disabled = true;
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

  const terms = el('a', { href: TERMS, target: '_blank', rel: 'noopener noreferrer', textContent: 'Gemini API terms' });
  app.replaceChildren(
    el('h1', { textContent: 'Look these up in the cloud?' }),
    el('p', { textContent: 'Leave a Map couldn\u2019t tell from your email what these services usually hold. A model can guess from the web address alone. Nothing is ticked until you tick it.' }),
    el('div', { className: 'what' },
      el('h2', { textContent: 'What is sent' }),
      el('ul', {},
        el('li', { textContent: 'Only the web address of each service you tick, like forkyard.example.' }),
        el('li', { textContent: 'Never your emails, your address, names or dates.' }),
        el('li', {}, 'It goes to Google\u2019s Gemini model through Firebase, with your IP address and an app check token, like any web request. The paid Gemini service keeps requests and answers for a limited time (', terms, '), so don\u2019t tick a service you want to keep private.'),
      ),
    ),
    el('div', { className: 'bulk' }, selectSafe, ' ', clear),
    el('ul', { className: 'rows' }, ...boxes.map((b) => b.row)),
    el('label', { htmlFor: adult.id, className: 'adult' }, adult, ' I\u2019m 18 or older.'),
    hint,
    el('div', { className: 'actions' }, send, ' ', cancel),
  );
  refresh();
}

addEventListener('message', (e: MessageEvent) => {
  if (e.origin !== SCAN_ORIGIN || e.source !== opener) return;
  const items = parseOutbox(e.data);
  if (items) show(items);
  else app.replaceChildren(el('p', { textContent: 'The list was not in the expected form, so nothing was shown or sent.' }));
});

// Development only: `?demo` shows sample rows without the scan page, for checking the layout.
if (import.meta.env.DEV && location.search === '?demo') {
  show([{ id: 'd1', senderDomain: 'quillpad.example' }, { id: 'd2', senderDomain: 'clinic.example', sensitive: 'health' },
    { id: 'd3', senderDomain: 'penny.example', sensitive: 'money' }, { id: 'd4', senderDomain: 'osf.io' }]);
} else if (opener) opener.postMessage({ type: MSG.ready }, SCAN_ORIGIN);
else app.replaceChildren(el('p', { textContent: 'Open this window from Leave a Map.' }));
