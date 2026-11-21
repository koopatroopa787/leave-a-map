import { useState } from 'preact/hooks';
import type { ScanSettings } from '../../../../packages/core/types.ts';

type Props = { onScan: (file: File, settings: ScanSettings) => void; error?: string };

const EMAIL_RE = /^[^@\s]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;

export function StartScreen({ onScan, error }: Props) {
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
          Your exported mailbox (.mbox)
          <input type="file" accept=".mbox,application/mbox,text/plain" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} required />
        </label>
        {(problem || error) && <p class="error" role="alert">{problem || error}</p>}
        <button type="submit">Find my accounts</button>
      </form>
    </main>
  );
}
