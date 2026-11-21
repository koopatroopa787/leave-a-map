// T13: the evidence drawer. Opening a card shows every piece of evidence: what it shows, how sure
// (tier), where it came from (rules, on-device AI, cloud, you), the email's date and the exact quote.
// Native <details>, so it opens with Enter or Space and needs no script for keyboard use.
import type { Cond, RankedAccount } from '../../../../packages/core/types.ts';
import { SOURCE_WORD, TIER_WORD } from '../../../../packages/core/evidence.ts';
import { shortDate } from '../dates.ts';

const ROWS: { key: 'exists' | 'sso' | 'work' | 'reset' | 'money' | 'discount'; label: string }[] = [
  { key: 'exists', label: 'You have an account' },
  { key: 'sso', label: 'You sign in with your school account' },
  { key: 'work', label: 'Holds your work' },
  { key: 'reset', label: 'Can reset your other accounts' },
  { key: 'money', label: 'Money' },
  { key: 'discount', label: 'Student discount' },
];

function Row({ label, c }: { label: string; c: Cond }) {
  return (
    <li class="ev-row">
      <div class="ev-what">
        <span class="ev-label">{label}</span>
        <span class={`tier tier-${c.tier}`}>{c.tier ? TIER_WORD[c.tier] : ''}</span>
        <span class={`badge src-${c.source}`}>{SOURCE_WORD[c.source]}</span>
      </div>
      {c.quote ? <blockquote class="ev-quote">{c.quote}</blockquote> : <p class="ev-signal">{c.signal}</p>}
      <p class="ev-meta">
        {c.date ? `Email of ${shortDate(c.date)}` : 'No single email'}
        {c.quote && c.signal ? ` · rule: ${c.signal}` : ''}
        {c.source === 'on_device' ? ' · inferenceSource: on_device' : ''}
        {c.source === 'in_cloud' ? ' · inferenceSource: in_cloud, typical for this kind of service' : ''}
      </p>
    </li>
  );
}

export function EvidenceDrawer({ a }: { a: RankedAccount }) {
  const rows = ROWS.filter((r) => a[r.key].tier !== null);
  if (rows.length === 0) return null;
  return (
    <details class="drawer">
      <summary>Why this account? <span class="meta">({rows.length} piece{rows.length === 1 ? '' : 's'} of evidence)</span></summary>
      <ul class="ev-list">{rows.map((r) => <Row key={r.key} label={r.label} c={a[r.key]} />)}</ul>
      <p class="ev-key"><strong>Seen</strong>: an authenticated email says so. <strong>Likely</strong>: strong signs, or AI quoting your email. <strong>Possible</strong>: weak signs. AI is never Seen.</p>
    </details>
  );
}
