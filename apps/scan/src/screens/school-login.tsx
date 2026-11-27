// T19: the school-login step. The connected-apps page of the school account is the main source
// of "you sign in with your school account" services; email notices are only a bonus. The person
// opens the page, then ticks what they see here. Ticks are Seen, labelled "you confirmed".
// Wording from BUILD-PLAN section 4. Links open the real pages in a new tab; nothing is fetched.
import { useState } from 'preact/hooks';
import type { RankedAccount } from '../../../../packages/core/types.ts';
import type { Connections } from '../../../../packages/core/connections.ts';

const GOOGLE_LINKED_APPS = 'https://myaccount.google.com/linkedapps?filters=4';
const MICROSOFT_MY_APPS = 'https://myapps.microsoft.com';

type Props = {
  /** Accounts as scanned, before any ticks: the tick list offers these. */
  candidates: RankedAccount[];
  connections: Connections;
  onChange: (c: Connections) => void;
  saved: boolean;
};

export function SchoolLoginStep({ candidates, connections, onChange, saved }: Props) {
  const [provider, setProvider] = useState<'google' | 'microsoft'>('google');
  const [name, setName] = useState('');
  const ticked = new Set(connections.ticked);
  // Already found by a sign-in notice: shown as done, not tickable.
  const fromEmail = candidates.filter((a) => a.sso.tier === 'seen' && a.sso.source !== 'user');
  const offer = candidates.filter((a) => !fromEmail.includes(a) && !a.key.startsWith('app:') &&
    (a.section === 'main' || a.section === 'maybe' || a.section === 'elsewhere'));
  const toggle = (key: string, on: boolean) =>
    onChange({ ...connections, ticked: on ? [...connections.ticked, key] : connections.ticked.filter((k) => k !== key) });
  const add = (e: Event) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || connections.added.some((x) => x.toLowerCase() === n.toLowerCase())) return setName('');
    onChange({ ...connections, added: [...connections.added, n.slice(0, 80)] });
    setName('');
  };
  const remove = (n: string) => onChange({ ...connections, added: connections.added.filter((x) => x !== n) });
  const count = connections.ticked.length + connections.added.length;

  return (
    <details class="step" id="school-login-step">
      <summary>
        <span class="chev" aria-hidden="true" />
        <div>
        <h2>Check what uses your school or work login</h2>
        <p class="bucket-why">
          Your email can't show every app you signed into with your school or work account. Your account's own page can.
          {count > 0 && <strong> {count} confirmed.</strong>}
        </p>
        </div>
      </summary>

      <div class="provider" role="radiogroup" aria-label="Your school or work sign-in">
        <label><input type="radio" name="provider" checked={provider === 'google'} onChange={() => setProvider('google')} /> Google</label>
        <label><input type="radio" name="provider" checked={provider === 'microsoft'} onChange={() => setProvider('microsoft')} /> Microsoft</label>
      </div>

      {provider === 'google' ? (
        <ol class="steps">
          <li>Open <a href={GOOGLE_LINKED_APPS} target="_blank" rel="noopener noreferrer">Linked apps in your Google Account</a> and sign in with your school or work account.</li>
          <li>Look at the apps listed under <strong>Sign in with Google</strong>.</li>
          <li>Tick each one below, or type its name if it isn't listed.</li>
        </ol>
      ) : (
        <ol class="steps">
          <li>Open <a href={MICROSOFT_MY_APPS} target="_blank" rel="noopener noreferrer">My Apps</a> and sign in with your school or work account.</li>
          <li>For an app you're not sure about, select its tile's <strong>...</strong>, then <strong>Manage your application</strong>.</li>
          <li>Tick each one below, or type its name if it isn't listed.</li>
        </ol>
      )}

      <p class="warn" role="note">
        {provider === 'google'
          ? <>Don't select <strong>Stop using Sign in with Google</strong> until you've added a password or changed the login email at that service. Do this before your shutoff date.</>
          : <>Don't remove an app's access until you've added a password or changed the login email at that service. Do this before your shutoff date. Your school or employer can hide apps, so this list may be incomplete.</>}
      </p>

      {fromEmail.length > 0 && (
        <p class="meta">Already found from your email: {fromEmail.map((a) => a.name).join(', ')}.</p>
      )}

      {offer.length > 0 && (
        <fieldset class="ticks">
          <legend>I saw these on the page</legend>
          <ul>
            {offer.map((a) => (
              <li key={a.key}>
                <label>
                  <input type="checkbox" checked={ticked.has(a.key)} onChange={(e) => toggle(a.key, e.currentTarget.checked)} />
                  <span><strong>{a.name}</strong> <span class="domain">{a.key}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <form class="add" onSubmit={add}>
        <label>
          Not in the list? Type the app's name as the page shows it
          <span class="add-row">
            <input type="text" value={name} maxLength={80} autoComplete="off" onInput={(e) => setName(e.currentTarget.value)} />
            <button type="submit" class="secondary">Add</button>
          </span>
        </label>
      </form>
      {connections.added.length > 0 && (
        <ul class="added">
          {connections.added.map((n) => (
            <li key={n}>{n} <button type="button" class="link" onClick={() => remove(n)} aria-label={`Remove ${n}`}>Remove</button></li>
          ))}
        </ul>
      )}
      {!saved && <p class="meta">This browser won't save these, so they'll be gone if you reload.</p>}
    </details>
  );
}
