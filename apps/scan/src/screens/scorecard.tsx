// The sample's answer key, scored live against the list on screen (packages/core/answer-key.ts).
// Only on the samples: a real mailbox has no key.
import { answerKey, scoreSample } from '../../../../packages/core/answer-key.ts';
import type { RankedAccount } from '../../../../packages/core/types.ts';
import { COPY, type Mode } from '../mode.ts';

export function Scorecard({ accounts, mode }: { accounts: RankedAccount[]; mode: Mode }) {
  const key = answerKey(mode);
  const title = COPY[mode].title;
  const s = scoreSample(accounts, key, (b) => title[b]);
  const perfect = s.misses.length === 0;
  return (
    <details class="scorecard" id="answer-key">
      <summary>
        <span class="chev" aria-hidden="true" />
        <strong>Answer key: {s.found} of {s.plantedOf} accounts found, {s.sorted} of {s.sortedOf} in the right line, {s.caught} of {s.trapsOf} traps caught.</strong>
      </summary>
      <div class="scorecard-body">
        <p class="meta">We wrote down what this sample holds before scoring it: the accounts a person would expect, and the traps
          that look like accounts but aren't. The score is worked out on this page from the list below{perfect ? '' : ', misses included'}.</p>
        {!perfect && <ul class="misses">{s.misses.map((m) => <li key={m}>{m}</li>)}</ul>}
        <h3>Accounts in the sample</h3>
        <ul class="plain key-list">{key.planted.map((x) => <li key={x.key}>{x.name} <span class="meta">({x.line === 'listed' ? 'one email, so Maybe is fine' : title[x.line]})</span></li>)}</ul>
        <h3>Traps</h3>
        <ul class="plain key-list">{key.traps.map((t) => <li key={t.what}>{t.what}</li>)}</ul>
      </div>
    </details>
  );
}
