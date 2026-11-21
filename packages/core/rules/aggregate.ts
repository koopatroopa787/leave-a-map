// packages/core/rules/aggregate.ts: folds message records into one Account per sender domain.
// v1 (T06): existence comes from message counts only. The service-mail patterns land in T10.
import type { Account, Cond, MessageRecord, ScanStats, Tier } from '../types.ts';
import type { BodyInfo } from '../mbox/body.ts';
import { accountKey, cleanName, registrableDomain } from './account-key.ts';
import { isManualForward, isPersonSender, listHost, schoolLink, type LinkContext } from './school-link.ts';

const RANK: Record<Exclude<Tier, null>, number> = { seen: 3, likely: 2, possible: 1 };
export const tierRank = (t: Tier) => (t ? RANK[t] : 0);
export const bestTier = (a: Tier, b: Tier): Tier => (tierRank(a) >= tierRank(b) ? a : b);
const none = (): Cond => ({ tier: null, source: 'rules', signal: '' });

type Acc = {
  key: string; names: Map<string, number>; link: Tier; nAll: number; nLinked: number; nMsgs: number;
  lastDate: number; otherAddress: string | null; firstMsg: number;
};

export class Aggregator {
  private readonly accounts = new Map<string, Acc>();
  private readonly schoolKey: string;
  readonly stats: ScanStats = { bytes: 0, messages: 0, schoolLinked: 0,
    skipped: { forwardedManually: 0, personSender: 0, noFrom: 0 } };

  private readonly ctx: LinkContext;

  constructor(ctx: LinkContext) {
    this.ctx = ctx;
    this.schoolKey = registrableDomain(ctx.school);
  }

  // `body` is read from T09 onwards; the service-mail patterns (T10) use it.
  add(m: MessageRecord, _body?: BodyInfo) {
    this.stats.messages++;
    if (!m.from) { this.stats.skipped.noFrom++; return; }
    if (isPersonSender(m.from.address)) { this.stats.skipped.personSender++; return; }
    if (isManualForward(m)) this.stats.skipped.forwardedManually++;

    const key = listHost(m, this.ctx) ?? accountKey(m.from.address);
    let a = this.accounts.get(key);
    if (!a) {
      a = { key, names: new Map(), link: null, nAll: 0, nLinked: 0, nMsgs: 0, lastDate: 0, otherAddress: null, firstMsg: m.index };
      this.accounts.set(key, a);
    }
    a.nAll++;
    const name = cleanName(m.from.name);
    if (name) a.names.set(name, (a.names.get(name) ?? 0) + 1);

    const link = schoolLink(m, this.ctx);
    if (link.kind === 'other-address') { a.otherAddress ??= link.address; return; }
    if (link.kind === 'none') return;
    this.stats.schoolLinked++;
    a.link = bestTier(a.link, link.tier);
    a.nLinked++;
    if (!m.bulk) {
      a.nMsgs++;
      if (m.date && m.date > a.lastDate) a.lastDate = m.date;
    }
  }

  accountsOut(): Account[] {
    return [...this.accounts.values()].map((a) => {
      const name = [...a.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? a.key;
      const exists: Cond = a.nMsgs >= 2 ? { tier: 'likely', source: 'rules', signal: `${a.nMsgs} non-bulk emails to your school address (v1)` }
        : a.nMsgs === 1 ? { tier: 'possible', source: 'rules', signal: '1 non-bulk email to your school address (v1)' }
        : a.nLinked > 0 ? { tier: 'possible', source: 'rules', signal: 'newsletters only' }
        : none();
      return {
        key: a.key, name, link: a.link, exists,
        sso: none(), work: none(), reset: none(), money: none(), discount: none(),
        flags: { schoolRun: a.key === this.schoolKey, forwardedIn: a.link ? null : a.otherAddress,
          suspiciousOnly: false, bulkOnly: a.nLinked > 0 && a.nMsgs === 0, suspiciousIgnored: 0 },
        lastDate: a.lastDate, nMsgs: a.nMsgs, nLinked: a.nLinked, nAll: a.nAll,
      };
    });
  }
}
