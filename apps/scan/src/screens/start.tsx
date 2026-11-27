import { useEffect, useState } from 'preact/hooks';
import type { ScanSettings } from '../../../../packages/core/types.ts';
import { HeroRoutes, Lock, Scribble, Upload } from '../icons.tsx';
import { TopBar } from '../display.tsx';
import { countdown, longDate } from '../dates.ts';

type Props = { onScan: (file: File, settings: ScanSettings) => void; onSample: () => void; error?: string };

const EMAIL_RE = /^[^@\s]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
// Common personal providers. Only used for a friendly hint; the scan still runs if the person insists.
const PERSONAL = /@(gmail|googlemail|outlook|hotmail|live|msn|yahoo|ymail|icloud|me|mac|proton|protonmail|pm|aol|gmx|zoho)\.[a-z.]+$/i;
type Field = 'email' | 'date' | 'file';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const inMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return iso(d); };
const QUICK: [string, () => string][] = [['In 30 days', () => inDays(30)], ['In 3 months', () => inMonths(3)], ['In 6 months', () => inMonths(6)]];

function emailNote(v: string): { text: string; tone: '' | 'is-warn' | 'is-good' } {
  const t = v.trim();
  if (!t) return { text: '', tone: '' };
  if (!t.includes('@')) return { text: 'Add the part after the @, like name@school.edu.', tone: 'is-warn' };
  if (!EMAIL_RE.test(t)) return { text: 'That doesn\'t look complete yet, like name@school.edu.', tone: 'is-warn' };
  if (PERSONAL.test(t)) return { text: 'That looks like a personal address. Use the school one that\'s shutting down.', tone: 'is-warn' };
  return { text: `We'll look for mail sent to @${EMAIL_RE.exec(t)![1].toLowerCase()}.`, tone: 'is-good' };
}

export function StartScreen({ onScan, onSample, error }: Props) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<{ field: Field; text: string } | null>(null);
  const [over, setOver] = useState(false);

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
    if (!m) return bad('email', 'Enter your full school email address, like name@school.edu.');
    if (!date) return bad('date', 'Enter the date your school email shuts off, or pick one of the quick choices.');
    if (!file) return bad('file', 'Choose your exported .mbox file.');
    setProblem(null);
    onScan(file, { schoolDomain: m[1].toLowerCase(), ownAddresses: [email.trim().toLowerCase()], shutoffDate: date });
  };
  // Enter moves on to the next empty step instead of failing the whole form.
  const next = (from: Field) => (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (from === 'email' && EMAIL_RE.test(email.trim()) && !date) { e.preventDefault(); setTouched(true); focus('date'); }
    else if (from === 'date' && date && !file) { e.preventDefault(); focus('file'); }
  };
  const pick = (v: string) => { setDate(v); if (problem?.field === 'date') setProblem(null); };

  const invalid = (f: Field) => (problem?.field === f ? 'true' : undefined);
  const done = { email: EMAIL_RE.test(email.trim()), date: !!date, file: !!file };
  const note = touched || problem?.field === 'email' ? emailNote(email) : { text: '', tone: '' };
  const message = problem?.text || error;
  const allSet = done.email && done.date && done.file;

  return (
    <main id="main" class={`page start screen${over ? ' drop-anywhere' : ''}`}>
      <TopBar />
      <header class="hero">
        <p class="hello">Hi. Let's draw your map.</p>
        <h1>
          <span class="w">Your</span> <span class="w">school</span> <span class="w">email</span> <span class="w">is</span>{' '}
          <span class="w scribble">going away.<Scribble /></span>
        </h1>
        <p class="lede">Find the accounts tied to it before it does. Three quick steps.</p>
        <HeroRoutes />
      </header>
      <p class="assure"><Lock /><span>Your mailbox is read on this device. This page can't send anything over the network.</span></p>

      <form class="start-form" onSubmit={submit} noValidate aria-describedby={message ? 'start-error' : undefined}>
        <ol class="stations">
          <li class={`station${done.email ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">1</span>
            <div class="field">
              <label for="f-email">Your school email address</label>
              <input id="f-email" type="email" autoComplete="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellcheck={false}
                enterKeyHint="next" placeholder="name@school.edu" value={email} aria-describedby="f-email-note"
                onInput={(e) => { setEmail(e.currentTarget.value); if (problem?.field === 'email') setProblem(null); }}
                onBlur={() => setTouched(true)} onKeyDown={next('email')} required aria-invalid={invalid('email')} />
              <p id="f-email-note" class={`field-note ${note.tone}`} aria-live="polite">{note.text}</p>
            </div>
          </li>
          <li class={`station${done.date ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">2</span>
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
          <li class={`station${done.file ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">3</span>
            <div class="field">
              <span id="f-file-label">Your exported mailbox</span>
              <span class="field-hint">The .mbox file, or the file named "mbox" inside an exported .mbox folder. You can drop it anywhere on this page.</span>
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
          <button type="submit" class={allSet ? 'is-ready' : undefined}>Find my accounts</button>
        </div>
      </form>

      <section class="sample" aria-labelledby="sample-title">
        <h2 id="sample-title">No mailbox handy?</h2>
        <p>Run Leave a Map on a made-up student's 55 emails. The people and services are fictional, apart from three real research sites, so the cloud lookup has something it can recognise.</p>
        <button type="button" id="try-sample" class="secondary" onClick={onSample}>Try the sample</button>
      </section>
    </main>
  );
}
