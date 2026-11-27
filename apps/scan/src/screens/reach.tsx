// apps/scan/src/screens/reach.tsx: "How to reach them" and "Write to them" on each card.
// Contacts come from the company's own, checked emails (packages/core/contacts.ts). The draft is
// plain text the person edits here; it's copied or opened in their own email app, never sent from
// this page.
import { useEffect, useState } from 'preact/hooks';
import type { RewriteStyle } from '../nano.ts';
import type { Contacts } from '../../../../packages/core/contacts.ts';
import { draftMessage, mailtoHref } from '../../../../packages/core/draft.ts';
import type { RankedAccount } from '../../../../packages/core/types.ts';
import type { Mode } from '../mode.ts';

// Whether Gemini Nano can run here, asked once for the whole list.
let nanoHere: Promise<boolean> | null = null;
const canRewrite = () => (nanoHere ??= import('../nano.ts').then((m) => m.probeNano()).then((s) => s !== 'unavailable', () => false));

const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;
// .example domains (the samples) don't exist, so they're shown as text, not links.
const isExample = (d: string) => /\.(?:example|test|invalid|localhost)$/.test(d);

function Website({ domain }: { domain: string }) {
  return isExample(domain)
    ? <span>{domain} <span class="meta">(made-up sample site)</span></span>
    : <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">{domain}</a>;
}

export function Reach({ a, mode, contacts, address }: { a: RankedAccount; mode: Mode; contacts?: Contacts; address: string }) {
  const loss = mode === 'loss';
  const any = !!contacts && (contacts.emails.length + contacts.phones.length + contacts.addresses.length) > 0;
  const [draft, setDraft] = useState(() => draftMessage({ mode, bucket: a.bucket, company: a.name, address }));
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('');
  const [nano, setNano] = useState(false);
  const [busy, setBusy] = useState('');
  useEffect(() => { let live = true; void canRewrite().then((v) => { if (live) setNano(v); }); return () => { live = false; }; }, []);
  const rewrite = async (style: RewriteStyle) => {
    setBusy('Rewriting on this device…'); setCopied('');
    try {
      const { rewriteOnDevice } = await import('../nano.ts');
      const body = await rewriteOnDevice(draft.body, style, (l) => setBusy(`Getting the on-device model ready: ${Math.round(l * 100)}%`));
      setDraft((d) => ({ ...d, body }));
      setBusy('Rewritten on this device by Gemini Nano. Nothing left this computer. Check it before you send it.');
    } catch (e) {
      setBusy((e as Error).message === 'lost-blanks' ? 'The rewrite dropped some of the [blanks], so your version is kept.' : 'Couldn\u2019t rewrite it on this device. Your version is kept.');
    }
  };
  const to = contacts?.emails[0];
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`); setCopied('yes'); }
    catch { setCopied('no'); }
  };
  const id = `draft-${a.key.replace(/[^a-z0-9-]/gi, '-')}`;
  return (
    <div class="reach">
      {any ? (
        <div class="reach-found">
          <p class="reach-head">How to reach {a.name}</p>
          <dl>
            <div><dt>Website</dt><dd><Website domain={a.key} /></dd></div>
            {contacts!.emails.length > 0 && <div><dt>Email</dt><dd>{contacts!.emails.map((e) => <a key={e} href={`mailto:${e}`}>{e}</a>)}</dd></div>}
            {contacts!.phones.length > 0 && <div><dt>Phone</dt><dd>{contacts!.phones.map((p) => <a key={p} href={telHref(p)}>{p}</a>)}</dd></div>}
            {contacts!.addresses.length > 0 && <div><dt>Post</dt><dd>{contacts!.addresses.map((p) => <span key={p}>{p}</span>)}</dd></div>}
          </dl>
          <p class="meta">Found in {loss ? 'their' : 'your'} emails from {a.name} that passed the sender checks. Before you share anything personal, check them against {a.name}'s own website.</p>
        </div>
      ) : (
        <div class="reach-found">
          <p class="reach-head">How to reach {a.name}</p>
          <dl><div><dt>Website</dt><dd><Website domain={a.key} /></dd></div></dl>
          <p class="meta">No email address or phone number in {loss ? 'their' : 'your'} emails from {a.name}. Look for "Contact us" or "Help" on the website{loss ? ', and for "bereavement" or "deceased customer"' : ''}.</p>
        </div>
      )}
      <details class="draft">
        <summary><span class="chev" aria-hidden="true" />{loss ? `Write to ${a.name}: a ready-made message` : `Ask ${a.name} to change the email: a ready-made message`}</summary>
        <div class="draft-body">
          <p class="meta">Fill in the parts in [brackets], then copy it or open it in your email app. Nothing is sent until you press Send there.</p>
          <label for={`${id}-s`}>Subject</label>
          <input id={`${id}-s`} type="text" value={draft.subject} onInput={(e) => { setDraft({ ...draft, subject: e.currentTarget.value }); setCopied(''); }} />
          <label for={`${id}-b`}>Message</label>
          <textarea id={`${id}-b`} rows={14} value={draft.body} onInput={(e) => { setDraft({ ...draft, body: e.currentTarget.value }); setCopied(''); }} />
          {nano && (
            <div class="draft-actions rewrite" role="group" aria-label="Rewrite on this device">
              <span class="meta">Rewrite on this device:</span>
              <button type="button" class="secondary" disabled={busy.endsWith('…') || busy.includes('%')} onClick={() => void rewrite('shorter')}>Shorter</button>
              <button type="button" class="secondary" disabled={busy.endsWith('…') || busy.includes('%')} onClick={() => void rewrite('formal')}>More formal</button>
              <button type="button" class="secondary" disabled={busy.endsWith('…') || busy.includes('%')} onClick={() => void rewrite('simple')}>Simpler words</button>
            </div>
          )}
          {busy && <p class="meta" role="status">{busy}</p>}
          <div class="draft-actions">
            <button type="button" class="secondary" onClick={copy}>Copy message</button>
            <a class="button-link" href={mailtoHref(to, draft)}>{to ? `Open in my email app, to ${to}` : 'Open in my email app'}</a>
          </div>
          <p class="meta" aria-live="polite">{copied === 'yes' ? 'Copied. Paste it into a new email.' : copied === 'no' ? 'Couldn’t copy here. Select the message and copy it yourself.' : ''}</p>
        </div>
      </details>
    </div>
  );
}
