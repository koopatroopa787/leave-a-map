// apps/scan/src/screens/reach.tsx: "How to reach them" and "Write to them" on each card.
// Contacts come from the company's own, checked emails (packages/core/contacts.ts). The draft is
// plain text the person edits here; it's copied or opened in their own email app, never sent from
// this page.
import { useState } from 'preact/hooks';
import type { Contacts } from '../../../../packages/core/contacts.ts';
import { draftMessage, mailtoHref } from '../../../../packages/core/draft.ts';
import type { RankedAccount } from '../../../../packages/core/types.ts';
import type { Mode } from '../mode.ts';

const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;

export function Reach({ a, mode, contacts, address }: { a: RankedAccount; mode: Mode; contacts?: Contacts; address: string }) {
  const loss = mode === 'loss';
  const any = !!contacts && (contacts.emails.length + contacts.phones.length + contacts.addresses.length) > 0;
  const [draft, setDraft] = useState(() => draftMessage({ mode, bucket: a.bucket, company: a.name, address }));
  const [copied, setCopied] = useState<'' | 'yes' | 'no'>('');
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
            {contacts!.emails.length > 0 && <div><dt>Email</dt><dd>{contacts!.emails.map((e) => <a key={e} href={`mailto:${e}`}>{e}</a>)}</dd></div>}
            {contacts!.phones.length > 0 && <div><dt>Phone</dt><dd>{contacts!.phones.map((p) => <a key={p} href={telHref(p)}>{p}</a>)}</dd></div>}
            {contacts!.addresses.length > 0 && <div><dt>Post</dt><dd>{contacts!.addresses.map((p) => <span key={p}>{p}</span>)}</dd></div>}
          </dl>
          <p class="meta">Found in {loss ? 'their' : 'your'} emails from {a.name} that passed the sender checks. Before you share anything personal, check them against {a.name}'s own website.</p>
        </div>
      ) : (
        <p class="meta reach-none">No contact details in {loss ? 'their' : 'your'} emails from {a.name}. Their website's help or contact page will have them{loss ? '; look for "bereavement" or "deceased customer"' : ''}.</p>
      )}
      <details class="draft">
        <summary><span class="chev" aria-hidden="true" />{loss ? `Write to ${a.name}: a ready-made message` : `Ask ${a.name} to change the email: a ready-made message`}</summary>
        <div class="draft-body">
          <p class="meta">Fill in the parts in [brackets], then copy it or open it in your email app. Nothing is sent until you press Send there.</p>
          <label for={`${id}-s`}>Subject</label>
          <input id={`${id}-s`} type="text" value={draft.subject} onInput={(e) => { setDraft({ ...draft, subject: e.currentTarget.value }); setCopied(''); }} />
          <label for={`${id}-b`}>Message</label>
          <textarea id={`${id}-b`} rows={14} value={draft.body} onInput={(e) => { setDraft({ ...draft, body: e.currentTarget.value }); setCopied(''); }} />
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
