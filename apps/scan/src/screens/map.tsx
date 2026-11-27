// T14: the main list. "What breaks on <date>", a countdown, rank sections and text-only cards.
// No logos: cards name the service by its sender's display name and domain only.
import { emails } from '../words.ts';
import type { Bucket, Cond, NanoItem, RankedAccount, ScanSettings, ScanStats, Section } from '../../../../packages/core/types.ts';
import { SOURCE_WORD, TIER_WORD } from '../../../../packages/core/evidence.ts';
import { signalWords } from '../../../../packages/core/signal-words.ts';
import { NanoPanel } from './nano-panel.tsx';
import { countdown, longDate, shortDate } from '../dates.ts';
import { EvidenceDrawer } from './evidence-drawer.tsx';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadConnections, loadMoved, loadNotes, NOTE_MAX, saveConnections, saveMoved, saveNotes } from '../checklist.ts';
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
import { Check } from '../icons.tsx';
import { SiteFoot, TopBar } from '../display.tsx';
import { COPY, listKey, type Mode } from '../mode.ts';
import { Reach } from './reach.tsx';
import { groupLine } from '../../../../packages/core/subcategory.ts';
import type { Contacts } from '../../../../packages/core/contacts.ts';

type Props = {
  settings: ScanSettings; mode: Mode; sample?: boolean; accounts: RankedAccount[]; stats: ScanStats; ms: number; nanoItems: NanoItem[];
  contacts?: Record<string, Contacts>;
  onAccounts: (a: RankedAccount[]) => void; onRestart: () => void;
};

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
        ? <p>{exportFirst ? 'Then' : 'To move'}: at {where}, add a password or change the login email to one you'll keep. Only then disconnect your school or work login.</p>
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

/**
 * After a loss: general steps, never a link that needs their login. Not legal advice, and it
 * never suggests signing in as the person.
 */
function LossSteps({ a }: { a: RankedAccount }) {
  const where = a.name;
  const step = {
    money: <p>Contact {where}'s bereavement or estates team. They'll say what they need, usually a death certificate and proof that you can act for the estate. Ask about balances, claims and payments that should stop.</p>,
    work: <p>Ask {where} how it handles a member who has passed away. Some let family request a copy of photos and files, or turn the account into a memorial. Ask before anything is closed.</p>,
    sso: <p>{where} is reached through another of their accounts. Let {where} know they have passed away before you close that other account.</p>,
    rest: <p>Let {where} know they have passed away. Cancel anything that bills, then ask them to close or memorialise the account.</p>,
    reset: <p>Keep {where} open and paid while you work through the rest: notices and codes from other services arrive here. When you're ready to close it, ask {where} about its process for a member who has passed away.</p>,
  }[a.bucket];
  return <div class="move">{step}<p class="meta">Don't sign in as them, even if you know the password. Use each service's own process for families.</p></div>;
}

function primary(a: RankedAccount): Cond {
  return a.bucket === 'rest' ? a.exists : a[a.bucket];
}

function Card({ a, mode, rank, moved, onMoved, info, facts, contacts, address, note, onNote }: { a: RankedAccount; mode: Mode; rank: number; moved: boolean; onMoved: (v: boolean) => void; info?: ServiceInfo; facts?: ServiceFacts; contacts?: Contacts; address: string; note: string; onNote: (v: string) => void }) {
  const p = primary(a);
  const c = COPY[mode];
  const also = (['sso', 'work', 'reset', 'money'] as const)
    .filter((b) => b !== a.bucket && (a[b].tier === 'seen' || a[b].tier === 'likely'));
  return (
    <li class={`card${moved ? ' is-moved' : ''}`} id={`acct-${a.key}`}>
      <div class="card-head">
        <span class="rank" role="img" aria-label={`Rank ${rank}${moved ? `, ${c.done.toLowerCase()}` : ''}`}>{moved ? <Check /> : rank}</span>
        <div class="card-title">
          <h3 class="keep-words">{a.name}</h3>
          <span class="domain">{a.key.startsWith('app:') ? c.appKey : a.key}</span>
        </div>
        <label class="moved">
          <input type="checkbox" checked={moved} onChange={(e) => onMoved(e.currentTarget.checked)} aria-label={`${c.done}: ${a.name}`} />
          <span>{c.done}</span>
        </label>
      </div>
      {p.tier && (
        <p class="reason">
          <span class={`tier tier-${p.tier}`}>{TIER_WORD[p.tier]}</span> {p.quote ? <q>{p.quote}</q> : c.say(signalWords(p.signal))} <Badge c={p} />
        </p>
      )}
      {(also.length > 0 || (mode === 'school' && a.discount.tier)) && (
        <ul class="chips" aria-label="Also">
          {also.map((b) => <li key={b}>Also {c.also[b]} <Badge c={a[b]} /></li>)}
          {mode === 'school' && a.discount.tier && <li class="chip-warn">Student discount ends anyway. Export your data.</li>}
        </ul>
      )}
      {mode === 'loss' ? <LossSteps a={a} /> : <MoveSteps a={a} facts={facts} />}
      {!a.key.startsWith('app:') && <Reach a={a} mode={mode} contacts={contacts} address={address} />}
      <div class="note">
        <label for={`note-${a.key}`}>My notes</label>
        <textarea id={`note-${a.key}`} rows={2} maxLength={NOTE_MAX} value={note} placeholder="For example: rang them on 3 Dec, reference 88120, they'll post a form"
          onInput={(e) => onNote(e.currentTarget.value)} />
        {note && <p class="note-print">{note}</p>}
      </div>
      {info && <Lane3 info={info} />}
      <EvidenceDrawer a={a} mode={mode} />
      <dl class="facts">
        <div><dt>Emails to {mode === 'loss' ? 'their' : 'your'} address</dt><dd>{a.nLinked}</dd></div>
        {a.lastDate ? <div><dt>Last one</dt><dd>{shortDate(a.lastDate)}</dd></div> : null}
        {a.flags.suspiciousIgnored ? <div><dt>Fake ones ignored</dt><dd>{a.flags.suspiciousIgnored}</dd></div> : null}
      </dl>
    </li>
  );
}

/** A word of encouragement next to the moved count. */
const cheer = (mode: Mode, n: number, of: number) => mode === 'loss'
  ? (n === 0 ? 'Tick each one when it\'s dealt with. There\'s no rush.' : n === of ? 'Everything on this list is dealt with.' : '')
  : n === 0 ? 'Tick each one as you move it.' : n === of ? 'All done.' : n * 2 >= of ? 'Over halfway.' : n === 1 ? 'First one done.' : 'Keep going.';

function Plain({ a, info }: { a: RankedAccount; info?: ServiceInfo }) {
  const why = a.flags.forwardedIn ? `forwarded from ${a.flags.forwardedIn}`
    : a.section === 'ignored' ? `${a.flags.suspiciousIgnored} email${a.flags.suspiciousIgnored === 1 ? '' : 's'} ignored`
    : `${a.nLinked} email${a.nLinked === 1 ? '' : 's'}`;
  return <li><strong>{a.name}</strong> <span class="domain">{a.key}</span> <span class="meta">· {why}</span>{info && <Lane3 info={info} />}</li>;
}

export function MapScreen({ settings, mode, sample, accounts: scanned, stats, ms, nanoItems, contacts = {}, onAccounts, onRestart }: Props) {
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
  const c = COPY[mode];
  const who = settings.ownAddresses[0] ?? settings.schoolDomain;
  const store = listKey(mode, settings.schoolDomain, who);
  const [moved, setMoved] = useState(() => loadMoved(store));
  const [saved, setSaved] = useState(true);
  // Notes per account, kept in this browser with the ticks.
  const [notes, setNotes] = useState(() => loadNotes(store));
  const note = (key: string, v: string) => setNotes((prev) => {
    const next = { ...prev, [key]: v };
    if (!v) delete next[key];
    saveNotes(store, next);
    return next;
  });
  const toggle = (key: string, v: boolean) => {
    setMoved((prev) => {
      const next = new Set(prev);
      if (v) next.add(key); else next.delete(key);
      setSaved(saveMoved(store, next));
      return next;
    });
  };
  const movedCount = main.filter((a) => moved.has(a.key)).length;
  const buckets = c.order.map((b) => [b, main.filter((a) => a.bucket === b)] as const);
  // The list replaces the start screen, so move keyboard and screen-reader focus to its heading.
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  let rank = 0;
  return (
    <main id="main" class="page map screen">
      <TopBar />
      <header class="map-head" data-dots="side">
        {sample && <p class="sample-note" role="note">{mode === 'loss'
          ? 'Sample mailbox: Robin Hale, a made-up person. Every person and service in it is fictional.'
          : 'Sample mailbox: Jordan Reyes, a made-up student. Every person and service is fictional except three real non-profit research sites (arxiv.org, zenodo.org, openreview.net). Their emails here are made up too.'}</p>}
        {mode === 'loss' ? <>
          <p class="eyebrow">Mail sent to {who}</p>
          <h1 ref={title} tabIndex={-1}>Their accounts, money first<span class="dot" aria-hidden="true">*</span></h1>
        </> : <>
          <p class="eyebrow">@{settings.schoolDomain} shuts off {countdown(settings.shutoffDate)}</p>
          <h1 ref={title} tabIndex={-1}>What breaks on {longDate(settings.shutoffDate)}<span class="dot" aria-hidden="true">*</span></h1>
        </>}
        <p class="summary">
          <strong>{main.length} account{main.length === 1 ? '' : 's'} {mode === 'loss' ? 'found' : 'to move'}</strong>, {mode === 'loss' ? 'in the order to deal with them' : 'most urgent first'}.
          Read from {emails(stats.messages)} in {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}, on this device.
        </p>
        {main.length > 0 && (
          <p class="progress" aria-live="polite">
            <strong id="moved-count">{movedCount} of {main.length} {c.done.toLowerCase()}</strong>
            <span class="cheer">{cheer(mode, movedCount, main.length)}</span>
            <progress max={main.length} value={movedCount} aria-hidden="true" />
            {!saved && <span class="meta"> This browser won't save your ticks, so they'll be gone if you reload.</span>}
          </p>
        )}
        {main.length > 0 && (
          <p class="print-row"><button type="button" class="secondary" onClick={() => print()}>Print or save as PDF</button>
            <span class="meta"> The list with your ticks and notes, to keep or share. To get a PDF, choose "Save as PDF" as the printer.</span></p>
        )}
        {buckets.some(([, l]) => l.length > 0) && (
          <nav class="jump" aria-label="Jump to a line">
            <ul>{buckets.filter(([, l]) => l.length > 0).map(([b, l]) => (
              <li key={b}><a href={`#h-${b}`} class={`line-${b}`}>{c.title[b]} <span class="count">{l.length}</span></a></li>
            ))}</ul>
          </nav>
        )}
        {mode === 'school' && main.length > 0 && movedCount === main.length && (
          <div class="celebrate" role="status">
            <strong>Every account on this list is moved.</strong>
            <p>Nothing here depends on @{settings.schoolDomain} any more.</p>
          </div>
        )}
        {mode === 'loss' && (
          <p class="loss-note" role="note">
            This is a list, not legal advice. Rules differ by country and by service. A solicitor, the probate
            or estates office where they lived, or a local bereavement service can tell you who can act and what each
            place will ask for. Some governments run one service that tells many offices at once.
          </p>
        )}
      </header>

      <NoAiBanner />
      {mode === 'school' && <SchoolLoginStep candidates={scanned} connections={connections} onChange={changeConnections} saved={connSaved} />}

      {main.length === 0 && <p class="empty">{mode === 'loss' ? `No accounts tied to ${who} were found in this file. Check that it's the export of their mailbox.` : `No accounts tied to @${settings.schoolDomain} were found in this file. Check that it's the export of the mailbox for that address.`}</p>}

      {buckets.filter(([, list]) => list.length > 0).map(([b, list]) => (
        <section key={b} class={`bucket line-${b}`} aria-labelledby={`h-${b}`} data-dots="side">
          <h2 id={`h-${b}`}>{c.title[b]} <span class="count">{list.length}</span></h2>
          <p class="bucket-why">{c.why[b]}</p>
          {groupLine(list, b).map(({ label, items }) => (
            <div key={label || 'all'} class={label ? 'subgroup' : undefined}>
              {label && <h3 class="subgroup-title">{label} <span class="count">{items.length}</span></h3>}
              <ol class="cards">{items.map((a) => <Card key={a.key} a={a} mode={mode} rank={++rank} moved={moved.has(a.key)} onMoved={(v) => toggle(a.key, v)} info={lane3.get(a.key)} facts={pack?.lookup(a.key)} contacts={contacts[a.key]} address={who} note={notes[a.key] ?? ''} onNote={(v) => note(a.key, v)} />)}</ol>
            </div>
          ))}
        </section>
      ))}

      {c.other.map(({ section, title, note }) => {
        const list = accounts.filter((a) => a.section === section);
        if (list.length === 0) return null;
        return (
          <details key={section} class="other" open={section === 'maybe' && list.some((a) => lane3.has(a.key))}>
            <summary><h2><span class="chev" aria-hidden="true" />{title} <span class="count">{list.length}</span></h2></summary>
            <p class="bucket-why">{note}</p>
            <ul class="plain">{list.map((a) => <Plain key={a.key} a={a} info={lane3.get(a.key)} />)}</ul>
          </details>
        );
      })}

      <NanoPanel items={nanoItems} accounts={scanned} onAccounts={onAccounts} />
      {CLOUD_LOOKUP_ON && pack !== undefined && <CloudPanel accounts={accounts} known={pack?.known} onAnswers={(m) => setLane3((prev) => new Map([...prev, ...m]))} />}
      <Receipt />
      {pack && <p class="foot">Move and delete links: a snapshot from {pack.taken} of 2FA Directory, the Passkeys directory (CC BY 4.0) and JustDeleteMe, plus links we checked by hand. Credits in NOTICE.md.</p>}
      <p class="foot">{emails(stats.skipped.personSender)} from people and {(stats.messages - stats.schoolLinked).toLocaleString()} not sent to {mode === 'loss' ? who : `@${settings.schoolDomain}`} were skipped.</p>
      <div class="end"><button type="button" class="secondary" onClick={onRestart}>Scan another file</button></div>
      <SiteFoot />
    </main>
  );
}
