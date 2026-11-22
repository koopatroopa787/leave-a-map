// T14: the main list. "What breaks on <date>", a countdown, rank sections and text-only cards.
// No logos: cards name the service by its sender's display name and domain only.
import type { Bucket, Cond, NanoItem, RankedAccount, ScanSettings, ScanStats, Section } from '../../../../packages/core/types.ts';
import { SOURCE_WORD, TIER_WORD } from '../../../../packages/core/evidence.ts';
import { signalWords } from '../../../../packages/core/signal-words.ts';
import { NanoPanel } from './nano-panel.tsx';
import { countdown, longDate, shortDate } from '../dates.ts';
import { EvidenceDrawer } from './evidence-drawer.tsx';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadConnections, loadMoved, saveConnections, saveMoved } from '../checklist.ts';
import { applyConnections, type Connections } from '../../../../packages/core/connections.ts';
import { rank as rankAccounts } from '../../../../packages/core/rank.ts';
import { SchoolLoginStep } from './school-login.tsx';
import { CloudPanel } from './cloud-panel.tsx';
import { CLOUD_LOOKUP_ON } from '../cloud-switch.ts';
import { NoAiBanner } from './no-ai-banner.tsx';
import { Receipt } from './receipt.tsx';
import type { ServiceInfo } from '../../../../packages/core/handoff.ts';
import type { AnswerSource } from '../../../../packages/core/cascade.ts';
import { applyLane3, BASIS_WORD, serviceLines, trail } from '../../../../packages/core/lane3.ts';
import { applyPack, type Link, type Pack, type ServiceFacts } from '../../../../packages/core/pack.ts';
import { loadPack } from '../pack-loader.ts';

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

export function Badge({ c }: { c: Pick<Cond, 'source'> }) {
  return <span class={`badge src-${c.source}`}>{SOURCE_WORD[c.source]}</span>;
}

/** Lane 3: one line per field, each with the model it came from, and how the answer was reached. */
function Lane3({ info }: { info: ServiceInfo }) {
  const lines = serviceLines(info);
  return (
    <div class="lane3">
      <p class="lane3-head">Typical for this kind of service <span class="meta">({BASIS_WORD[info.basis]})</span></p>
      {lines.length > 0
        ? <ul>{lines.map((l) => <li key={l.label}>{l.label}: {l.value} <Badge c={{ source: l.source as AnswerSource }} /></li>)}</ul>
        : <p class="meta">{info.basis === 'unknown' ? 'Neither model recognises this service, so nothing is guessed.' : 'Neither model could say.'}</p>}
      <p class="meta trail">{trail(info)}</p>
    </div>
  );
}

/** A pack link. Example links are text only: .example domains don't resolve. */
function PackLink({ link, children }: { link: Link; children: string }) {
  if (link.example) return <span class="example-link">{children} <span class="meta">({link.url.replace('https://', '')}, example link)</span></span>;
  return <a href={link.url} target="_blank" rel="noopener noreferrer">{children}</a>;
}

const strong = (c: Cond) => c.tier === 'seen' || c.tier === 'likely';

/**
 * How to move, from the move pack when it has a checked link, otherwise the generic steps. No model
 * ever supplies a URL. When a student discount ends anyway and there's work or an export link,
 * exporting comes first (analyst.md 2.5): the data matters more than the login.
 */
function MoveSteps({ a, facts }: { a: RankedAccount; facts?: ServiceFacts }) {
  const where = a.key.startsWith('app:') ? a.name : a.key;
  const change = facts?.changeEmail;
  const name = facts?.name ?? where;
  const exportLink = facts?.exportData;
  const exportFirst = strong(a.discount) && (strong(a.work) || !!exportLink);
  const exportStep = exportLink
    ? <p>{exportFirst ? 'First: ' : 'Save a copy first: '}<PackLink link={exportLink}>{`export your data from ${name}`}</PackLink></p>
    : exportFirst ? <p>First, export your data from {where}. The student discount ends anyway, whatever happens to the login.</p> : null;
  return (
    <div class="move">
      {exportFirst && exportStep}
      {a.bucket === 'sso'
        ? <p>{exportFirst ? 'Then' : 'To move'}: at {where}, add a password or change the login email to one you'll keep. Only then disconnect your school login.</p>
        : change
          ? <p>{exportFirst ? 'Then' : 'To move'}: change the login email to one you'll keep. <PackLink link={change}>{`How to change it at ${name}`}</PackLink>
            {change.checked && <span class="meta"> (checked {change.checked})</span>}</p>
          : <p>{exportFirst ? 'Then' : 'To move'}: open {where}, go to account settings, and change the login email to one you'll keep.</p>}
      {a.bucket === 'sso' && change && <p><PackLink link={change}>{`How to change the login email at ${name}`}</PackLink></p>}
      {!exportFirst && exportStep}
      {facts?.passkeys && <p class="meta">{facts.name} takes passkeys. Adding one on a device you keep means signing in won't depend on the old address.</p>}
      {facts?.deleteAccount && <p class="meta">Don't need it any more? <PackLink link={facts.deleteAccount}>Delete the account instead</PackLink>{facts.deleteAccount.difficulty && ` (rated ${facts.deleteAccount.difficulty} on a public list)`}.</p>}
    </div>
  );
}

function primary(a: RankedAccount): Cond {
  return a.bucket === 'rest' ? a.exists : a[a.bucket];
}

function Card({ a, rank, moved, onMoved, info, facts }: { a: RankedAccount; rank: number; moved: boolean; onMoved: (v: boolean) => void; info?: ServiceInfo; facts?: ServiceFacts }) {
  const p = primary(a);
  const also = (['sso', 'work', 'reset', 'money'] as const)
    .filter((b) => b !== a.bucket && (a[b].tier === 'seen' || a[b].tier === 'likely'));
  return (
    <li class={`card${moved ? ' is-moved' : ''}`} id={`acct-${a.key}`}>
      <div class="card-head">
        <span class="rank" aria-label={`Rank ${rank}`}>{rank}</span>
        <div class="card-title">
          <h3>{a.name}</h3>
          <span class="domain">{a.key.startsWith('app:') ? 'connected with your school login' : a.key}</span>
        </div>
        <label class="moved">
          <input type="checkbox" checked={moved} onChange={(e) => onMoved(e.currentTarget.checked)} aria-label={`Moved: ${a.name}`} />
          <span>Moved</span>
        </label>
      </div>
      {p.tier && (
        <p class="reason">
          <span class={`tier tier-${p.tier}`}>{TIER_WORD[p.tier]}</span> {p.quote ? <q>{p.quote}</q> : signalWords(p.signal)} <Badge c={p} />
        </p>
      )}
      {(also.length > 0 || a.discount.tier) && (
        <ul class="chips" aria-label="Also">
          {also.map((b) => <li key={b}>Also {ALSO[b]} <Badge c={a[b]} /></li>)}
          {a.discount.tier && <li class="chip-warn">Student discount ends anyway. Export your data.</li>}
        </ul>
      )}
      <MoveSteps a={a} facts={facts} />
      {info && <Lane3 info={info} />}
      <EvidenceDrawer a={a} />
      <p class="meta">{a.nLinked} email{a.nLinked === 1 ? '' : 's'} to your school address{a.lastDate ? `, last on ${shortDate(a.lastDate)}` : ''}{a.flags.suspiciousIgnored ? `. ${a.flags.suspiciousIgnored} fake-looking email${a.flags.suspiciousIgnored === 1 ? '' : 's'} ignored` : ''}.</p>
    </li>
  );
}

function Plain({ a, info }: { a: RankedAccount; info?: ServiceInfo }) {
  const why = a.flags.forwardedIn ? `forwarded from ${a.flags.forwardedIn}`
    : a.section === 'ignored' ? `${a.flags.suspiciousIgnored} email${a.flags.suspiciousIgnored === 1 ? '' : 's'} ignored`
    : `${a.nLinked} email${a.nLinked === 1 ? '' : 's'}`;
  return <li><strong>{a.name}</strong> <span class="domain">{a.key}</span> <span class="meta">· {why}</span>{info && <Lane3 info={info} />}</li>;
}

export function MapScreen({ settings, sample, accounts: scanned, stats, ms, nanoItems, onAccounts, onRestart }: Props) {
  // The person's school-login ticks sit on top of the scan (and Nano's labels), never inside them.
  const [connections, setConnections] = useState<Connections>(() => loadConnections(settings.schoolDomain));
  const [connSaved, setConnSaved] = useState(true);
  const changeConnections = (c: Connections) => { setConnections(c); setConnSaved(saveConnections(settings.schoolDomain, c)); };
  // Lane 3 answers sit on top too, under the evidence caps, so the card can show where each came from.
  const [lane3, setLane3] = useState<Map<string, ServiceInfo>>(new Map());
  // The move pack loads as its own chunk. undefined while loading, null if it failed.
  const [pack, setPack] = useState<Pack | null | undefined>(undefined);
  useEffect(() => { let live = true; loadPack().then((p) => { if (live) setPack(p); }); return () => { live = false; }; }, []);
  const accounts = useMemo(() => rankAccounts(applyConnections(applyLane3(applyPack(scanned, pack ?? null), lane3), connections)),
    [scanned, connections, lane3, pack]);
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
  // The list replaces the start screen, so move keyboard and screen-reader focus to its heading.
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  let rank = 0;
  return (
    <main class="page map">
      <header class="map-head">
        {sample && <p class="sample-note" role="note">Sample mailbox: Jordan Reyes, a made-up student. Every person and service is fictional except three real non-profit research sites (arxiv.org, zenodo.org, openreview.net). Their emails here are made up too.</p>}
        <p class="eyebrow">@{settings.schoolDomain} shuts off {countdown(settings.shutoffDate)}</p>
        <h1 ref={title} tabIndex={-1}>What breaks on {longDate(settings.shutoffDate)}</h1>
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

      <NoAiBanner />
      <SchoolLoginStep candidates={scanned} connections={connections} onChange={changeConnections} saved={connSaved} />

      {main.length === 0 && <p class="empty">No accounts tied to @{settings.schoolDomain} were found in this file. Check that it's the export of your school mailbox.</p>}

      {buckets.filter(([, list]) => list.length > 0).map(([b, list]) => (
        <section key={b} class="bucket" aria-labelledby={`h-${b}`}>
          <h2 id={`h-${b}`}>{BUCKET_TITLE[b]} <span class="count">{list.length}</span></h2>
          <p class="bucket-why">{BUCKET_WHY[b]}</p>
          <ol class="cards">{list.map((a) => <Card key={a.key} a={a} rank={++rank} moved={moved.has(a.key)} onMoved={(v) => toggle(a.key, v)} info={lane3.get(a.key)} facts={pack?.lookup(a.key)} />)}</ol>
        </section>
      ))}

      {OTHER_SECTIONS.map(({ section, title, note }) => {
        const list = accounts.filter((a) => a.section === section);
        if (list.length === 0) return null;
        return (
          <details key={section} class="other" open={section === 'maybe' && list.some((a) => lane3.has(a.key))}>
            <summary><h2>{title} <span class="count">{list.length}</span></h2></summary>
            <p class="bucket-why">{note}</p>
            <ul class="plain">{list.map((a) => <Plain key={a.key} a={a} info={lane3.get(a.key)} />)}</ul>
          </details>
        );
      })}

      <NanoPanel items={nanoItems} accounts={scanned} onAccounts={onAccounts} />
      {CLOUD_LOOKUP_ON && pack !== undefined && <CloudPanel accounts={accounts} known={pack?.known} onAnswers={(m) => setLane3((prev) => new Map([...prev, ...m]))} />}
      <Receipt />
      {pack && <p class="foot">Move and delete links: a snapshot from {pack.taken} of 2FA Directory, the Passkeys directory (CC BY 4.0) and JustDeleteMe, plus links we checked by hand. Credits in NOTICE.md.</p>}
      <p class="foot">{stats.skipped.personSender.toLocaleString()} emails from people and {(stats.messages - stats.schoolLinked).toLocaleString()} not sent to @{settings.schoolDomain} were skipped.</p>
      <button type="button" class="secondary" onClick={onRestart}>Scan another file</button>
    </main>
  );
}
