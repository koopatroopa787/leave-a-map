// T08: the bare ranked list. T14 replaces it with the full main list.
import type { Bucket, Cond, RankedAccount, ScanSettings, ScanStats, Section } from '../../../../packages/core/types.ts';

type Props = { settings: ScanSettings; accounts: RankedAccount[]; stats: ScanStats; ms: number; onRestart: () => void };

const TITLES: Record<Section, string> = {
  main: 'Accounts to move',
  maybe: 'Maybe accounts',
  'ends-anyway': 'Ends with your address anyway',
  elsewhere: 'Tied to another address',
  ignored: 'Looks fake',
};
const TIER_WORD = { seen: 'Seen', likely: 'Likely', possible: 'Possible' } as const;
const day = (ms: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—');
const REASON: Record<Bucket, string> = {
  sso: 'You sign in with your school account',
  work: 'Holds your work',
  reset: 'Can reset your other accounts',
  money: 'Money',
  rest: 'Uses your school address',
};
const ALSO: Record<Exclude<Bucket, 'rest'>, string> = { sso: 'school login', work: 'work', reset: 'resets others', money: 'money' };

function evidence(c: Cond) {
  if (!c.tier) return '—';
  return `${TIER_WORD[c.tier]}: ${c.signal}${c.quote ? ` (“${c.quote}”)` : ''}`;
}

function why(a: RankedAccount) {
  if (a.flags.forwardedIn) return `Forwarded from ${a.flags.forwardedIn}`;
  if (a.section === 'ignored') return `${a.flags.suspiciousIgnored} fake-looking email${a.flags.suspiciousIgnored === 1 ? '' : 's'} ignored`;
  const primary = a.bucket === 'rest' ? a.exists : a[a.bucket];
  const also = (['sso', 'work', 'reset', 'money'] as const)
    .filter((b) => b !== a.bucket && (a[b].tier === 'seen' || a[b].tier === 'likely')).map((b) => ALSO[b]);
  const extra = [
    also.length ? `Also: ${also.join(', ')}` : '',
    a.discount.tier ? 'Student discount: the discount ends anyway. Export your data.' : '',
    a.flags.suspiciousIgnored ? `${a.flags.suspiciousIgnored} fake-looking email${a.flags.suspiciousIgnored === 1 ? '' : 's'} ignored` : '',
  ].filter(Boolean);
  return (
    <>
      {a.section === 'main' && <strong>{REASON[a.bucket]}. </strong>}
      {evidence(primary)}
      {extra.map((t) => <div key={t} class="muted">{t}</div>)}
    </>
  );
}

export function ListScreen({ settings, accounts, stats, ms, onRestart }: Props) {
  const sections = (Object.keys(TITLES) as Section[])
    .map((s) => [s, accounts.filter((a) => a.section === s)] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <main class="page wide">
      <h1>What breaks on {settings.shutoffDate}</h1>
      <p>
        {stats.messages.toLocaleString()} emails read in {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}.{' '}
        {stats.schoolLinked.toLocaleString()} were sent to @{settings.schoolDomain}.{' '}
        {stats.skipped.personSender.toLocaleString()} from people were skipped.
      </p>
      {sections.map(([section, list]) => (
        <section key={section}>
          <h2>{TITLES[section]} ({list.length})</h2>
          <table>
            <thead>
              <tr><th scope="col">#</th><th scope="col">Account</th><th scope="col">Sender domain</th>
                <th scope="col">Emails to your school address</th><th scope="col">Last email</th><th scope="col">Why</th></tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.key}>
                  <td>{i + 1}</td>
                  <td>{a.name}</td>
                  <td>{a.key}</td>
                  <td>{a.nLinked}</td>
                  <td>{day(a.lastDate)}</td>
                  <td>{why(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <button type="button" onClick={onRestart}>Scan another file</button>
    </main>
  );
}
