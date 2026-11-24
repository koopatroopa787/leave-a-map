import { useEffect, useState } from 'preact/hooks';
import type { ScanSettings } from '../../../../packages/core/types.ts';
import { HeroRoutes, Lock, Upload } from '../icons.tsx';
import { TopBar } from '../display.tsx';
import { countdown, longDate } from '../dates.ts';
import type { Mode } from '../mode.ts';

type Props = { onScan: (file: File, settings: ScanSettings, mode: Mode) => void; onSample: (mode: Mode) => void; error?: string };

const EMAIL_RE = /^[^@\s]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
// Common personal providers. Only used for a friendly hint; the scan still runs if the person insists.
const PERSONAL = /@(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|mac|proton|protonmail|pm|aol|gmx|zoho)\.[a-z.]+$/i;
type Field = 'email' | 'date' | 'file';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const inMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return iso(d); };
const QUICK: [string, () => string][] = [['In 30 days', () => inDays(30)], ['In 3 months', () => inMonths(3)], ['In 6 months', () => inMonths(6)]];

function emailNote(v: string, mode: Mode): { text: string; tone: '' | 'is-warn' | 'is-good' } {
  const t = v.trim();
  const eg = mode === 'loss' ? 'name@example.com' : 'name@school.edu';
  if (!t) return { text: '', tone: '' };
  if (!t.includes('@')) return { text: `Add the part after the @, like ${eg}.`, tone: 'is-warn' };
  if (!EMAIL_RE.test(t)) return { text: `That doesn't look complete yet, like ${eg}.`, tone: 'is-warn' };
  if (mode === 'loss') return { text: `We'll look for mail sent to ${t.toLowerCase()}.`, tone: 'is-good' };
  if (PERSONAL.test(t)) return { text: 'That looks like a personal address. Use the school one that\'s shutting down.', tone: 'is-warn' };
  return { text: `We'll look for mail sent to @${EMAIL_RE.exec(t)![1].toLowerCase()}.`, tone: 'is-good' };
}

const MODES: [Mode, string, string][] = [
  ['school', 'My school email is closing', 'Move each account to an address you\'ll keep.'],
  ['loss', 'Someone has died', 'List their accounts: money, bills, photos, and what to close.'],
];

export function StartScreen({ onScan, onSample, error }: Props) {
  const [mode, setMode] = useState<Mode>('school');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<{ field: Field; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const loss = mode === 'loss';

  // Drop the file anywhere on the page, not only on the drop zone.
  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setOver(true); } };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setOver(false); };
    const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) { setFile(f); setProblem(null); } };
    addEventListener('dragover', over); addEventListener('dragleave', leave); addEventListener('drop', drop);
    return () => { removeEventListener('dragover', over); removeEventListener('dragleave', leave); removeEventListener('drop', drop); };
  }, []);

  const focus = (f: Field) => document.getElementById(`f-${f}`)?.focus();
  const submit = (e: Event) => {
    e.preventDefault();
    const m = EMAIL_RE.exec(email.trim());
    const bad = (field: Field, text: string) => { setProblem({ field, text }); focus(field); };
    if (!m) return bad('email', loss ? 'Enter their full email address, like name@example.com.' : 'Enter your full school email address, like name@school.edu.');
    if (!loss && !date) return bad('date', 'Enter the date your school email shuts off, or pick one of the quick choices.');
    if (!file) return bad('file', 'Choose the exported .mbox file.');
    setProblem(null);
    // ponytail: loss mode has no date; the core never reads shutoffDate.
    onScan(file, { schoolDomain: m[1].toLowerCase(), ownAddresses: [email.trim().toLowerCase()], shutoffDate: loss ? '' : date }, mode);
  };
  // Enter moves on to the next empty step instead of failing the whole form.
  const next = (from: Field) => (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (from === 'email' && EMAIL_RE.test(email.trim()) && !loss && !date) { e.preventDefault(); setTouched(true); focus('date'); }
    else if (from === 'email' && EMAIL_RE.test(email.trim()) && loss && !file) { e.preventDefault(); setTouched(true); focus('file'); }
    else if (from === 'date' && date && !file) { e.preventDefault(); focus('file'); }
  };
  const pick = (v: string) => { setDate(v); if (problem?.field === 'date') setProblem(null); };
  const choose = (m: Mode) => { setMode(m); setProblem(null); };

  const invalid = (f: Field) => (problem?.field === f ? 'true' : undefined);
  const done = { email: EMAIL_RE.test(email.trim()), date: !!date, file: !!file };
  const note = touched || problem?.field === 'email' ? emailNote(email, mode) : { text: '', tone: '' };
  const message = problem?.text || error;
  const allSet = done.email && (loss || done.date) && done.file;
  let n = 0;

  return (
    <main id="main" class={`page start screen${over ? ' drop-anywhere' : ''}`}>
      <TopBar />
      <header class="hero">
        <h1>{loss ? 'Find the accounts they left behind.' : 'Your school email is going away.'}</h1>
        <p class="lede">{loss
          ? 'Their mailbox shows which banks, insurers, bills and sites they used. Make a list, then work through it at your own pace.'
          : 'Find the accounts tied to it before it does. Three quick steps.'}</p>
        <HeroRoutes />
      </header>

      <fieldset class="modes">
        <legend>What are you sorting out?</legend>
        {MODES.map(([m, title, sub]) => (
          <label key={m} class="mode">
            <input type="radio" name="mode" checked={mode === m} onChange={() => choose(m)} />
            <span class="mode-text"><strong>{title}</strong><span>{sub}</span></span>
          </label>
        ))}
      </fieldset>

      <p class="assure"><Lock /><span>The mailbox is read on this device. This page can't send anything over the network.</span></p>

      <form class="start-form" onSubmit={submit} noValidate aria-describedby={message ? 'start-error' : undefined}>
        <ol class="stations">
          <li class={`station${done.email ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">{++n}</span>
            <div class="field">
              <label for="f-email">{loss ? 'Their email address' : 'Your school email address'}</label>
              <input id="f-email" type="email" autoComplete={loss ? 'off' : 'email'} inputMode="email" autoCapitalize="off" autoCorrect="off" spellcheck={false}
                enterKeyHint="next" placeholder={loss ? 'name@example.com' : 'name@school.edu'} value={email} aria-describedby="f-email-note"
                onInput={(e) => { setEmail(e.currentTarget.value); if (problem?.field === 'email') setProblem(null); }}
                onBlur={() => setTouched(true)} onKeyDown={next('email')} required aria-invalid={invalid('email')} />
              <p id="f-email-note" class={`field-note ${note.tone}`} aria-live="polite">{note.text}</p>
            </div>
          </li>
          {!loss && (
            <li class={`station${done.date ? ' is-done' : ''}`}>
              <span class="station-n" aria-hidden="true">{++n}</span>
              <div class="field">
                <label for="f-date">Date it shuts off</label>
                <div class="quick" role="group" aria-label="Quick choices">
                  {QUICK.map(([label, get]) => {
                    const v = get();
                    return <button type="button" key={label} class="chip-btn" aria-pressed={date === v} onClick={() => pick(v)}>{label}</button>;
                  })}
                </div>
                <input id="f-date" type="date" enterKeyHint="next" value={date} aria-describedby="f-date-note"
                  onInput={(e) => pick(e.currentTarget.value)} onKeyDown={next('date')} required aria-invalid={invalid('date')} />
                <p id="f-date-note" class={`field-note${date ? ' is-good' : ''}`} aria-live="polite">
                  {date ? `${longDate(date)}, ${countdown(date)}.` : 'Not sure? Your school\'s IT pages usually say. You can pick a rough date and change it later.'}
                </p>
              </div>
            </li>
          )}
          <li class={`station${done.file ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">{++n}</span>
            <div class="field">
              <span id="f-file-label">{loss ? 'Their exported mailbox' : 'Your exported mailbox'}</span>
              <span class="field-hint">{loss
                ? "The .mbox file. Only use a mailbox you're allowed to open, for example as their executor or through the email provider's process for families. You can drop it anywhere on this page."
                : 'The .mbox file, or the file named "mbox" inside an exported .mbox folder. You can drop it anywhere on this page.'}</span>
              <label class={`drop${over ? ' is-over' : ''}${file ? ' has-file' : ''}`}>
                <Upload />
                {file
                  ? <><span class="drop-file">{file.name}</span><span class="meta">{(file.size / 1e6).toFixed(1)} MB · choose a different file</span></>
                  : <><span class="drop-main">Choose a file</span><span class="meta">or drop it here</span></>}
                <input id="f-file" type="file" aria-labelledby="f-file-label"
                  onChange={(e) => { setFile(e.currentTarget.files?.[0] ?? null); if (problem?.field === 'file') setProblem(null); }}
                  required aria-invalid={invalid('file')} />
              </label>
            </div>
          </li>
        </ol>
        <div class="form-foot">
          {message && <p class="error" id="start-error" role="alert">{message}</p>}
          <button type="submit" class={allSet ? 'is-ready' : undefined}>{loss ? 'Make the list' : 'Find my accounts'}</button>
        </div>
      </form>

      <section class="sample" aria-labelledby="sample-title">
        <h2 id="sample-title">No mailbox handy?</h2>
        <p>{loss
          ? 'Run Leave a Map on the mailbox of Robin Hale, a made-up person. Every person, bank and service in it is fictional.'
          : 'Run Leave a Map on a made-up student\'s 55 emails. The people and services are fictional, apart from three real research sites, so the cloud lookup has something it can recognise.'}</p>
        <button type="button" id="try-sample" class="secondary" onClick={() => onSample(mode)}>Try the sample</button>
      </section>
    </main>
  );
}
