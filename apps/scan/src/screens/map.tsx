// T14: the main list. "What breaks on <date>", a countdown, rank sections and text-only cards.
// No logos: cards name the service by its sender's display name and domain only.
import type { Bucket, Cond, NanoItem, RankedAccount, ScanSettings, ScanStats, Section } from '../../../../packages/core/types.ts';
import { SOURCE_WORD, TIER_WORD } from '../../../../packages/core/evidence.ts';
import { NanoPanel } from './nano-panel.tsx';
import { countdown, longDate, shortDate } from '../dates.ts';
import { EvidenceDrawer } from './evidence-drawer.tsx';
import { useMemo, useState } from 'preact/hooks';
import { loadConnections, loadMoved, saveConnections, saveMoved } from '../checklist.ts';
import { applyConnections, type Connections } from '../../../../packages/core/connections.ts';
import { rank as rankAccounts } from '../../../../packages/core/rank.ts';
import { SchoolLoginStep } from './school-login.tsx';

type Props = {
  settings: ScanSettings; sample?: boolean; accounts: RankedAccount[]; stats: ScanStats; ms: number; nanoItems: NanoItem[];
  onAccounts: (a: RankedAccount[]) => void; onRestart: () => void;
};

export const BUCKET_TITLE: Record<Bucket, string> = {
  sso: 'You sign in with your school account',
  work: 'Holds your work',
  reset: 'Can reset your other accounts',
  money: 'Money',
  rest: 'Uses your school address',
};
const BUCKET_WHY: Record<Bucket, string> = {
  sso: 'These have no password of their own. They stop working the day the address does.',
  work: 'Files, code or documents you may lose access to.',
  reset: 'Password managers, phone and mail accounts that can recover everything else.',
  money: 'Banks, cards and subscriptions that bill you.',
  rest: 'Accounts where your school address is the login or contact email.',
};
const ALSO: Record<Exclude<Bucket, 'rest'>, string> = { sso: 'school login', work: 'holds work', reset: 'resets others', money: 'money' };
const OTHER_SECTIONS: { section: Exclude<Section, 'main'>; title: string; note: string }[] = [
  { section: 'maybe', title: 'Maybe accounts', note: 'Only newsletters or a single email so far. Check these if you have time.' },
  { section: 'ends-anyway', title: 'Ends with your address anyway', note: 'Run by your school. Nothing to move.' },
  { section: 'elsewhere', title: 'Tied to another address', note: 'Mail forwarded in from another address. Not affected by the shutoff.' },
  { section: 'ignored', title: 'Looks fake', note: 'Mail that failed sender checks or imitates a known service. Ignored.' },
];

export function Badge({ c }: { c: Cond }) {
  return <span class={`badge src-${c.source}`}>{SOURCE_WORD[c.source]}</span>;
}

function primary(a: RankedAccount): Cond {
  return a.bucket === 'rest' ? a.exists : a[a.bucket];
}

function Card({ a, rank, moved, onMoved }: { a: RankedAccount; rank: number; moved: boolean; onMoved: (v: boolean) => void }) {
  const p = primary(a);
  const also = (['sso', 'work', 'reset', 'money'] as const)
    .filter((b) => b !== a.bucket && (a[b].tier === 'seen' || a[b].tier === 'likely'));
  return (
    <li class={`card${moved ? ' is-moved' : ''}`} id={`acct-${a.key}`}>
      <div class="card-head">
        <span class="rank" aria-label={`Rank ${rank}`}>{rank}</span>
        <div class="card-title">
          <h4>{a.name}</h4>
          <span class="domain">{a.key.startsWith('app:') ? 'connected with your school login' : a.key}</span>
        </div>
        <label class="moved">
          <input type="checkbox" checked={moved} onChange={(e) => onMoved(e.currentTarget.checked)} />
          <span>Moved</span>
        </label>
      </div>
      {p.tier && (
        <p class="reason">
          <span class={`tier tier-${p.tier}`}>{TIER_WORD[p.tier]}</span> {p.quote ? <q>{p.quote}</q> : p.signal} <Badge c={p} />
        </p>
      )}
      {(also.length > 0 || a.discount.tier) && (
        <ul class="chips" aria-label="Also">
          {also.map((b) => <li key={b}>Also {ALSO[b]}</li>)}
          {a.discount.tier && <li class="chip-warn">Student discount ends anyway. Export your data.</li>}
        </ul>
      )}
      {a.bucket === 'sso'
        ? <p class="move">To move: at {a.key.startsWith('app:') ? a.name : a.key}, add a password or change the login email to one you'll keep. Only then disconnect your school login.</p>
        : <p class="move">To move: open {a.key.startsWith('app:') ? a.name : a.key}, go to account settings, and change the login email to one you'll keep.</p>}
      <EvidenceDrawer a={a} />
      <p class="meta">{a.nLinked} email{a.nLinked === 1 ? '' : 's'} to your school address{a.lastDate ? `, last on ${shortDate(a.lastDate)}` : ''}{a.flags.suspiciousIgnored ? `. ${a.flags.suspiciousIgnored} fake-looking email${a.flags.suspiciousIgnored === 1 ? '' : 's'} ignored` : ''}.</p>
    </li>
  );
}

function Plain({ a }: { a: RankedAccount }) {
  const why = a.flags.forwardedIn ? `forwarded from ${a.flags.forwardedIn}`
    : a.section === 'ignored' ? `${a.flags.suspiciousIgnored} email${a.flags.suspiciousIgnored === 1 ? '' : 's'} ignored`
    : `${a.nLinked} email${a.nLinked === 1 ? '' : 's'}`;
  return <li><strong>{a.name}</strong> <span class="domain">{a.key}</span> <span class="meta">· {why}</span></li>;
}

export function MapScreen({ settings, sample, accounts: scanned, stats, ms, nanoItems, onAccounts, onRestart }: Props) {
  // The person's school-login ticks sit on top of the scan (and Nano's labels), never inside them.
  const [connections, setConnections] = useState<Connections>(() => loadConnections(settings.schoolDomain));
  const [connSaved, setConnSaved] = useState(true);
  const changeConnections = (c: Connections) => { setConnections(c); setConnSaved(saveConnections(settings.schoolDomain, c)); };
  const accounts = useMemo(() => rankAccounts(applyConnections(scanned, connections)), [scanned, connections]);
  const main = accounts.filter((a) => a.section === 'main');
  const [moved, setMoved] = useState(() => loadMoved(settings.schoolDomain));
  const [saved, setSaved] = useState(true);
  const toggle = (key: string, v: boolean) => {
    setMoved((prev) => {
      const next = new Set(prev);
      if (v) next.add(key); else next.delete(key);
      setSaved(saveMoved(settings.schoolDomain, next));
      return next;
    });
  };
  const movedCount = main.filter((a) => moved.has(a.key)).length;
  const buckets = (['sso', 'work', 'reset', 'money', 'rest'] as const).map((b) => [b, main.filter((a) => a.bucket === b)] as const);
  let rank = 0;
  return (
    <main class="page map">
      <header class="map-head">
        {sample && <p class="sample-note" role="note">Sample mailbox: Jordan Reyes, a made-up student. Every name and service here is fictional.</p>}
        <p class="eyebrow">@{settings.schoolDomain} shuts off {countdown(settings.shutoffDate)}</p>
        <h1>What breaks on {longDate(settings.shutoffDate)}</h1>
        <p class="summary">
          <strong>{main.length} account{main.length === 1 ? '' : 's'} to move</strong>, most urgent first.
          Read from {stats.messages.toLocaleString()} emails in {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}, on this device.
        </p>
        {main.length > 0 && (
          <p class="progress" aria-live="polite">
            <strong id="moved-count">{movedCount} of {main.length} moved</strong>
            <progress max={main.length} value={movedCount} aria-hidden="true" />
            {!saved && <span class="meta"> This browser won't save your ticks, so they'll be gone if you reload.</span>}
          </p>
        )}
      </header>

      <SchoolLoginStep candidates={scanned} connections={connections} onChange={changeConnections} saved={connSaved} />

      {main.length === 0 && <p class="empty">No accounts tied to @{settings.schoolDomain} were found in this file. Check that it's the export of your school mailbox.</p>}

      {buckets.filter(([, list]) => list.length > 0).map(([b, list]) => (
        <section key={b} class="bucket" aria-labelledby={`h-${b}`}>
          <h2 id={`h-${b}`}>{BUCKET_TITLE[b]} <span class="count">{list.length}</span></h2>
          <p class="bucket-why">{BUCKET_WHY[b]}</p>
          <ol class="cards">{list.map((a) => <Card key={a.key} a={a} rank={++rank} moved={moved.has(a.key)} onMoved={(v) => toggle(a.key, v)} />)}</ol>
        </section>
      ))}

      {OTHER_SECTIONS.map(({ section, title, note }) => {
        const list = accounts.filter((a) => a.section === section);
        if (list.length === 0) return null;
        return (
          <details key={section} class="other">
            <summary><h2>{title} <span class="count">{list.length}</span></h2></summary>
            <p class="bucket-why">{note}</p>
            <ul class="plain">{list.map((a) => <Plain key={a.key} a={a} />)}</ul>
          </details>
        );
      })}

      <NanoPanel items={nanoItems} accounts={scanned} onAccounts={onAccounts} />
      <p class="foot">{stats.skipped.personSender.toLocaleString()} emails from people and {(stats.messages - stats.schoolLinked).toLocaleString()} not sent to @{settings.schoolDomain} were skipped.</p>
      <button type="button" class="secondary" onClick={onRestart}>Scan another file</button>
    </main>
  );
}
