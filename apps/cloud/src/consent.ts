// apps/cloud/src/consent.ts: the consent window. Shows every sender domain it was given, each
// with an unticked box. Only ticked rows are looked up; unticked rows are discarded here.
// The lookup itself (lane 3 cascade) is in egress.ts; Firebase loads only after the click below.
// T22: every box starts unticked; "Select all except health and money"; an 18+ box; the
// logging notice for the tier this build runs on (never "nothing is kept"). On the free tier, also
// a required region box, no health or money rows, and a cap per lookup (packages/core/cloud-tier.ts).
import { MSG, parseOutbox, type OutboxItem } from '../../../packages/core/handoff.ts';
import { blockedBy, canSend, cloudTier, FREE_TIER_MAX } from '../../../packages/core/cloud-tier.ts';

const SCAN_ORIGIN: string = import.meta.env.VITE_CLOUD_SCAN_ORIGIN ?? 'https://leave-a-map.web.app';
const app = document.getElementById('app')!;
const opener = window.opener as Window | null;

function el(tag: string, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElement {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

const TERMS = 'https://ai.google.dev/gemini-api/terms';

/**
 * Which Gemini tier this build looks things up on: VITE_CLOUD_LOOKUP=paid-tier-on once billing is
 * on, free-tier-on for the free tier, unset for off. The notice below describes that tier's terms.
 * Local development (`vite`, `--mode debug`) always can.
 */
const TIER = cloudTier(import.meta.env.VITE_CLOUD_LOOKUP, import.meta.env.DEV);
export const LOOKUP_ON = TIER !== 'off';

/** Shown instead of the list while the lookup is off. The scan page is never sent the ready signal, so it hands over nothing. */
function showOff() {
  const close = el('button', { type: 'button', id: 'consent-close', className: 'primary', textContent: 'Close' }) as HTMLButtonElement;
  close.onclick = () => { opener?.postMessage({ type: MSG.cancelled }, SCAN_ORIGIN); window.close(); };
  app.replaceChildren(
    el('h1', { textContent: 'The cloud lookup isn\u2019t switched on yet' }),
    el('p', { textContent: 'It isn\u2019t on for this site yet. Leave a Map sent this window nothing, and nothing will be looked up.' }),
    el('p', { textContent: 'Everything else works without it: the rules and the on-device AI already ran on your device.' }),
    el('div', { className: 'actions' }, close),
  );
}
const SENSITIVE_WORD = { health: 'health', money: 'money' } as const;

function show(items: OutboxItem[]) {
  const free = TIER === 'free';
  const boxes = items.map((i) => {
    const sendable = canSend(TIER, i);
    const box = el('input', { type: 'checkbox', checked: false, value: i.id, disabled: !sendable }) as HTMLInputElement;
    box.id = `row-${i.id}`;
    const tag = i.sensitive ? el('span', { className: `tag ${i.sensitive}`,
      textContent: sendable ? `${SENSITIVE_WORD[i.sensitive]}: tick on its own` : `${SENSITIVE_WORD[i.sensitive]}: not sent on the free service` }) : '';
    return { item: i, box, sendable, row: el('li', {}, el('label', { htmlFor: box.id }, box, el('span', { className: 'domain', textContent: i.senderDomain }), tag)) };
  });
  const adult = el('input', { type: 'checkbox', checked: false, id: 'consent-adult' }) as HTMLInputElement;
  // Free tier only: Google's free Gemini service may not be offered to people in these places.
  const region = el('input', { type: 'checkbox', checked: false, id: 'consent-region' }) as HTMLInputElement;
  const send = el('button', { type: 'button', id: 'consent-send', className: 'primary' }) as HTMLButtonElement;
  const cancel = el('button', { type: 'button', id: 'consent-cancel', textContent: 'Cancel, send nothing' }) as HTMLButtonElement;
  const selectSafe = el('button', { type: 'button', id: 'consent-select-safe', textContent: 'Select all except health and money' }) as HTMLButtonElement;
  const clear = el('button', { type: 'button', id: 'consent-clear', textContent: 'Clear' }) as HTMLButtonElement;
  const hint = el('p', { id: 'consent-hint', className: 'hint' });

  const HINT = {
    off: '', adult: 'Tick the 18+ box to continue.',
    region: 'Tick the region box to continue. The free service can’t be used from there.',
    'none-ticked': 'Tick at least one service.',
    'too-many': `The free service looks up at most ${FREE_TIER_MAX} at a time. Untick some to continue.`,
  } as const;
  const ticked = () => boxes.filter((b) => b.box.checked && b.sendable);
  const blocked = () => blockedBy(TIER, { adult: adult.checked, region: region.checked, ticked: ticked().length });
  const refresh = () => {
    const n = ticked().length;
    send.textContent = n === 1 ? 'Look up 1 service' : `Look up ${n} services`;
    const why = blocked();
    send.disabled = why !== null;
    hint.textContent = why ? HINT[why] : '';
  };
  for (const b of boxes) b.box.addEventListener('change', refresh);
  adult.addEventListener('change', refresh);
  region.addEventListener('change', refresh);
  selectSafe.onclick = () => {
    let room = free ? FREE_TIER_MAX : Infinity;
    for (const b of boxes) b.box.checked = b.sendable && !b.item.sensitive && room-- > 0;
    refresh();
  };
  clear.onclick = () => { for (const b of boxes) b.box.checked = false; refresh(); };

  send.onclick = async () => {
    if (blocked() !== null) return;
    // Unticked rows are discarded here: they are never sent to the model or back to the scan page.
    const approved = ticked().map((b) => b.item);
    if (approved.length === 0) return;
    send.disabled = true; selectSafe.disabled = true; clear.disabled = true;
    for (const b of boxes) b.box.disabled = true;
    adult.disabled = true; region.disabled = true;
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
        free
          ? el('li', {}, 'It goes to Google\u2019s free Gemini service through Firebase, with your IP address and an app check token, like any web request. On the free service, Google may use what is sent and its answers to improve its products, and people at Google may read them (', terms, '). Don\u2019t tick a service you want to keep private. Health and money services are never sent.')
          : el('li', {}, 'It goes to Google\u2019s Gemini model through Firebase, with your IP address and an app check token, like any web request. The paid Gemini service keeps requests and answers for a limited time (', terms, '), so don\u2019t tick a service you want to keep private.'),
      ),
    ),
    el('div', { className: 'bulk' }, selectSafe, ' ', clear),
    el('ul', { className: 'rows' }, ...boxes.map((b) => b.row)),
    el('label', { htmlFor: adult.id, className: 'adult' }, adult, ' I\u2019m 18 or older.'),
    free ? el('label', { htmlFor: region.id, className: 'adult' }, region, ' I\u2019m not in the European Economic Area, Switzerland or the UK.') : '',
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
} else if (opener && !LOOKUP_ON) showOff();
else if (opener) opener.postMessage({ type: MSG.ready }, SCAN_ORIGIN);
else app.replaceChildren(el('p', { textContent: 'Open this window from Leave a Map.' }));
