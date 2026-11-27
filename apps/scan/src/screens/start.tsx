import { useState } from 'preact/hooks';
import type { ScanSettings } from '../../../../packages/core/types.ts';

type Props = { onScan: (file: File, settings: ScanSettings) => void; onSample: () => void; error?: string };

const EMAIL_RE = /^[^@\s]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;

export function StartScreen({ onScan, onSample, error }: Props) {
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState('');

  const submit = (e: Event) => {
    e.preventDefault();
    const m = EMAIL_RE.exec(email.trim());
    if (!m) return setProblem('Enter your full school email address, like name@school.edu.');
    if (!date) return setProblem('Enter the date your school email shuts off.');
    if (!file) return setProblem('Choose your exported .mbox file.');
    setProblem('');
    onScan(file, { schoolDomain: m[1].toLowerCase(), ownAddresses: [email.trim().toLowerCase()], shutoffDate: date });
  };

  return (
    <main class="page">
      <h1>Leave a Map</h1>
      <p class="lede">Your school email is going away. Find the accounts tied to it before it does.</p>
      <p>Your mailbox is read on this device. This page can't send anything over the network.</p>
      <form onSubmit={submit} noValidate>
        <label>
          Your school email address
          <input type="email" autoComplete="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} required />
        </label>
        <label>
          Date it shuts off
          <input type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} required />
        </label>
        <label>
          Your exported mailbox (.mbox file, or the file named "mbox" inside an exported .mbox folder)
          <input type="file" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} required />
        </label>
        {(problem || error) && <p class="error" role="alert">{problem || error}</p>}
        <button type="submit">Find my accounts</button>
      </form>
      <section class="sample" aria-labelledby="sample-title">
        <h2 id="sample-title">No mailbox handy?</h2>
        <p>Run Leave a Map on a made-up student's 55 emails. The people and services are fictional, apart from three real research sites, so the cloud lookup has something it can recognise.</p>
        <button type="button" id="try-sample" class="secondary" onClick={onSample}>Try the sample</button>
      </section>
    </main>
  );
}
