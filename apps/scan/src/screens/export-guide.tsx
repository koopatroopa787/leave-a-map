// apps/scan/src/screens/export-guide.tsx: "How do I get this file?" under step 3 of the start form.
// Pick the email provider, get numbered steps. Static text only; the links open in a new tab.
import { useState } from 'preact/hooks';
import { GUIDES, PROVIDERS, type Provider } from '../export-steps.ts';
import type { Mode } from '../mode.ts';

export function ExportGuide({ mode }: { mode: Mode }) {
  const [p, setP] = useState<Provider>('gmail');
  const g = GUIDES[p];
  const loss = mode === 'loss';
  return (
    <details class="guide">
      <summary><span class="chev" aria-hidden="true" />How do I get this file? Step-by-step help</summary>
      <div class="guide-body">
        {loss && (
          <div class="guide-loss">
            <p>Only use their mailbox if you're allowed to. Don't sign in as them, even if you know the password. Ways families get a copy:</p>
            <ul>
              <li><strong>Apple:</strong> someone they named as a Legacy Contact can ask Apple for their iCloud data, which includes Mail.</li>
              <li><strong>Google:</strong> if they set up Inactive Account Manager and chose you, Google sends you a download. Otherwise, families can use Google's request form for a deceased person's account. Google decides case by case and may not release email.</li>
              <li><strong>Others:</strong> most providers have a process for families on their help pages.</li>
            </ul>
            <p>Got a download? Look inside it for a file ending in .mbox. If you've been given access to the mail in an email app, the steps below show how to save it as a file.</p>
          </div>
        )}
        <fieldset class="seg">
          <legend>{loss ? 'Their email is with' : 'My email is with'}</legend>
          <div class="seg-row">
            {PROVIDERS.map((k) => (
              <label key={k}>
                <input type="radio" name="export-provider" checked={p === k} onChange={() => setP(k)} />
                {GUIDES[k].label}
              </label>
            ))}
          </div>
        </fieldset>
        {g.note && <p class="field-hint">{g.note}</p>}
        {g.intro && <p>{g.intro}</p>}
        <ol class="guide-steps" aria-live="polite">
          {g.steps.map((s, i) => (
            <li key={`${p}-${i}`}>
              {s.text}
              {s.link && <> <a href={s.link.href} target="_blank" rel="noopener noreferrer">{s.link.label}</a></>}
            </li>
          ))}
        </ol>
        {g.after && <p class="field-hint">{g.after}</p>}
        <p class="field-hint">The file stays on this computer. Leave a Map reads it here and never uploads it.</p>
      </div>
    </details>
  );
}
