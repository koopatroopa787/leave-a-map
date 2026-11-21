// T08: the bare ranked list. T14 replaces it with the full main list.
import type { RankedAccount, ScanSettings, ScanStats, Section } from '../../../../packages/core/types.ts';

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
                <th scope="col">Emails to your school address</th><th scope="col">Last email</th><th scope="col">Evidence</th></tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.key}>
                  <td>{i + 1}</td>
                  <td>{a.name}</td>
                  <td>{a.key}</td>
                  <td>{a.nLinked}</td>
                  <td>{day(a.lastDate)}</td>
                  <td>{a.exists.tier ? `${TIER_WORD[a.exists.tier]}: ${a.exists.signal}` : a.flags.forwardedIn ? `Forwarded from ${a.flags.forwardedIn}` : '—'}</td>
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
