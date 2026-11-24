import { useState } from 'preact/hooks';
import type { ScanSettings } from '../../../../packages/core/types.ts';
import { HeroRoutes, Lock, Mark, Upload } from '../icons.tsx';

type Props = { onScan: (file: File, settings: ScanSettings) => void; onSample: () => void; error?: string };

const EMAIL_RE = /^[^@\s]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
type Field = 'email' | 'date' | 'file';

export function StartScreen({ onScan, onSample, error }: Props) {
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<{ field: Field; text: string } | null>(null);
  const [over, setOver] = useState(false);

  const submit = (e: Event) => {
    e.preventDefault();
    const m = EMAIL_RE.exec(email.trim());
    const bad = (field: Field, text: string) => { setProblem({ field, text }); document.getElementById(`f-${field}`)?.focus(); };
    if (!m) return bad('email', 'Enter your full school email address, like name@school.edu.');
    if (!date) return bad('date', 'Enter the date your school email shuts off.');
    if (!file) return bad('file', 'Choose your exported .mbox file.');
    setProblem(null);
    onScan(file, { schoolDomain: m[1].toLowerCase(), ownAddresses: [email.trim().toLowerCase()], shutoffDate: date });
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) setFile(f); };
  const invalid = (f: Field) => (problem?.field === f ? 'true' : undefined);
  const done = { email: EMAIL_RE.test(email.trim()), date: !!date, file: !!file };
  const message = problem?.text || error;

  return (
    <main id="main" class="page start screen">
      <p class="wordmark"><Mark /> Leave a Map</p>
      <header class="hero">
        <h1>Your school email is going away.</h1>
        <p class="lede">Find the accounts tied to it before it does.</p>
        <HeroRoutes />
      </header>
      <p class="assure"><Lock /><span>Your mailbox is read on this device. This page can't send anything over the network.</span></p>

      <form class="start-form" onSubmit={submit} noValidate aria-describedby={message ? 'start-error' : undefined}>
        <ol class="stations">
          <li class={`station${done.email ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">1</span>
            <label class="field">
              Your school email address
              <input id="f-email" type="email" autoComplete="email" inputMode="email" spellcheck={false} value={email}
                onInput={(e) => setEmail(e.currentTarget.value)} required aria-invalid={invalid('email')} />
            </label>
          </li>
          <li class={`station${done.date ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">2</span>
            <label class="field">
              Date it shuts off
              <input id="f-date" type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} required aria-invalid={invalid('date')} />
            </label>
          </li>
          <li class={`station${done.file ? ' is-done' : ''}`}>
            <span class="station-n" aria-hidden="true">3</span>
            <div class="field">
              <span id="f-file-label">Your exported mailbox</span>
              <span class="field-hint">The .mbox file, or the file named "mbox" inside an exported .mbox folder.</span>
              <label class={`drop${over ? ' is-over' : ''}${file ? ' has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
                <Upload />
                {file
                  ? <><span class="drop-file">{file.name}</span><span class="meta">{(file.size / 1e6).toFixed(1)} MB · choose a different file</span></>
                  : <><span class="drop-main">Choose a file</span><span class="meta">or drop it here</span></>}
                <input id="f-file" type="file" aria-labelledby="f-file-label" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
                  required aria-invalid={invalid('file')} />
              </label>
            </div>
          </li>
        </ol>
        <div class="form-foot">
          {message && <p class="error" id="start-error" role="alert">{message}</p>}
          <button type="submit">Find my accounts</button>
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
