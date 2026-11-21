// packages/core/rules/aggregate.ts: folds messages into one Account per sender domain, with the
// evidence conditions from analyst.md 2.2–2.3. Rules alone; pack, Nano and cloud fields come later.
import type { Account, Cond, MessageRecord, NanoItem, RankedAccount, ScanStats, Source, Tier } from '../types.ts';
import { prepForPrompt } from '../prompt-prep.ts';
import type { BodyInfo } from '../mbox/body.ts';
import { EMPTY_BODY } from '../mbox/body.ts';
import { accountKey, cleanName, registrableDomain } from './account-key.ts';
import { isManualForward, isPersonSender, listHost, schoolLink, type LinkContext } from './school-link.ts';
import { senderAuth } from './sender-auth.ts';
import { EXISTENCE, messageSignals, type SignalName } from './signals.ts';
import { idpNotice, isIdpSender, normaliseApp } from './idp-notice.ts';
import { EMPTY_PACK, labelOf, mailboxLookalike, suspiciousReason, type PackNames } from './suspicious.ts';

import { bestTier, tierRank } from '../tiers.ts';

export { bestTier, tierRank };
/** One step weaker: for signals the spec lists a column below the message's own tier. */
const weaker = (t: Tier): Tier => (t === 'seen' ? 'likely' : t === 'likely' ? 'possible' : null);
const none = (): Cond => ({ tier: null, source: 'rules', signal: '' });

type CondName = 'exists' | 'sso' | 'work' | 'reset' | 'money' | 'discount';

/** Which condition each signal feeds, and at what tier relative to the message (analyst.md 2.3). */
const FEEDS: Partial<Record<SignalName, [CondName, 'same' | 'weaker'][]>> = {
  WELCOME: [['exists', 'same']], VERIFY: [['exists', 'same']], RESET: [['exists', 'same']],
  SECURITY: [['exists', 'same']], RECEIPT: [['exists', 'same']],
  STATEMENT: [['exists', 'same'], ['money', 'same']],
  RECURRING: [['money', 'same']], 'CARD ON FILE': [['money', 'weaker']],
  'RECOVERY ADDRESS': [['reset', 'same']],
  'WORK STRONG': [['work', 'same']], 'WORK WEAK': [['work', 'weaker']],
  'STUDENT DISCOUNT': [['discount', 'same']],
};

type Acc = {
  key: string; names: Map<string, number>; link: Tier; nAll: number; nLinked: number; nMsgs: number;
  lastDate: number; otherAddress: string | null; suspicious: number; clean: number; health: boolean;
  /** Messages that passed sender authentication. Accounts with any can vouch for their brand name. */
  authPass: number;
  conds: Record<CondName, Cond>;
  /** The email Nano reads for this account: the newest non-bulk one, else the newest bulk one. */
  candidate: { msgId: string; date: number; subject: string; text: string; bulk: boolean } | null;
};

const newAcc = (key: string): Acc => ({
  key, names: new Map(), link: null, nAll: 0, nLinked: 0, nMsgs: 0, lastDate: 0, otherAddress: null,
  suspicious: 0, clean: 0, health: false, authPass: 0,
  conds: { exists: none(), sso: none(), work: none(), reset: none(), money: none(), discount: none() },
  candidate: null,
});

function offer(acc: Acc, cond: CondName, tier: Tier, signal: string, m: MessageRecord, quote?: string, source: Source = 'rules') {
  if (!tier || tierRank(tier) <= tierRank(acc.conds[cond].tier)) return;
  acc.conds[cond] = { tier, source, signal, msgId: String(m.index), ...(quote ? { quote } : {}), ...(m.date ? { date: m.date } : {}) };
}

export type AggregatorOptions = { pack?: PackNames };

export class Aggregator {
  private readonly accounts = new Map<string, Acc>();
  private readonly apps = new Map<string, { name: string; m: MessageRecord; quote: string }>();
  private readonly ctx: LinkContext;
  private readonly schoolKey: string;
  private readonly pack: PackNames;
  readonly stats: ScanStats = { bytes: 0, messages: 0, schoolLinked: 0,
    skipped: { forwardedManually: 0, personSender: 0, noFrom: 0 } };

  constructor(ctx: LinkContext, opts: AggregatorOptions = {}) {
    this.ctx = ctx;
    this.schoolKey = registrableDomain(ctx.school);
    this.pack = opts.pack ?? EMPTY_PACK;
  }

  add(m: MessageRecord, body: BodyInfo = EMPTY_BODY) {
    this.stats.messages++;
    if (!m.from) { this.stats.skipped.noFrom++; return; }
    if (isPersonSender(m.from.address)) { this.stats.skipped.personSender++; return; }
    const manualForward = isManualForward(m);
    if (manualForward) this.stats.skipped.forwardedManually++;

    const link = schoolLink(m, this.ctx);
    const auth = senderAuth(m);
    // The person's own addresses: what they typed, plus school addresses this message was delivered to.
    const own = [...this.ctx.own, ...m.deliveredTo.filter((a) => this.ctx.isSchool(a))];

    // School-login notices are evidence for the app named inside, not for the sign-in provider.
    if (isIdpSender(m.from.address)) {
      const headerLinked = link.kind === 'school' && link.rule.startsWith('D');
      const notice = idpNotice(m, body, auth, headerLinked, own);
      if (notice) {
        this.stats.schoolLinked++;
        const k = normaliseApp(notice.app);
        if (k && !this.apps.has(k)) this.apps.set(k, { name: notice.app, m, quote: notice.quote });
      }
      // Other mail from the sign-in provider is about the school sign-in itself, which ends anyway.
      return;
    }

    const key = listHost(m, this.ctx) ?? accountKey(m.from.address);
    let a = this.accounts.get(key);
    if (!a) { a = newAcc(key); this.accounts.set(key, a); }
    a.nAll++;
    const name = cleanName(m.from.name);
    if (name) a.names.set(name, (a.names.get(name) ?? 0) + 1);

    if (suspiciousReason(m, auth, this.pack)) { a.suspicious++; return; }
    a.clean++;
    if (auth === 'pass' || auth === 'pass-forwarded') a.authPass++;
    if (link.kind === 'other-address') { a.otherAddress ??= link.address; return; }
    if (link.kind === 'none') return;

    this.stats.schoolLinked++;
    a.link = bestTier(a.link, link.tier);
    a.nLinked++;
    const msgTier: Tier = auth === 'pass' || auth === 'pass-forwarded' ? 'seen' : 'likely';
    const fired = manualForward ? [] : messageSignals(m, body, own);
    const bulk = m.bulk || (m.listUnsubscribe && !fired.some((f) => EXISTENCE.has(f.name)));
    if (!bulk) {
      a.nMsgs++;
      if (m.date && m.date > a.lastDate) a.lastDate = m.date;
    }
    const c = a.candidate;
    const date = m.date ?? 0;
    if (!manualForward && (!c || (c.bulk && !bulk) || (c.bulk === bulk && date >= c.date))) {
      a.candidate = { msgId: String(m.index), date, subject: m.subject, text: body.text, bulk };
    }
    for (const f of fired) {
      if (f.name === 'HEALTH') { a.health = true; continue; }
      // "Deals for students" in marketing mail isn't evidence the person has a student discount.
      if (bulk && f.name === 'STUDENT DISCOUNT') continue;
      if (f.name === 'SSO-WELCOME') { offer(a, 'sso', 'likely', f.name, m, f.quote); continue; }
      for (const [cond, how] of FEEDS[f.name] ?? []) offer(a, cond, how === 'same' ? msgTier : weaker(msgTier), f.name, m, f.quote);
    }
  }

  accountsOut(): Account[] {
    // Lookalikes of services in this same mailbox (P3/P4 without the pack): every message from
    // such a sender counts as fake-looking, so the account is ignored.
    const trusted = new Map<string, number>();
    for (const a of this.accounts.values()) {
      if (a.authPass > 0 && !a.key.includes(':')) trusted.set(labelOf(a.key), (trusted.get(labelOf(a.key)) ?? 0) + a.authPass);
    }
    const out = [...this.accounts.values()].map((a) => {
      const acc = this.toAccount(a);
      if (a.key === this.schoolKey || a.key.includes(':') || !mailboxLookalike(a.key, trusted)) return acc;
      return { ...acc, link: null, exists: none(), sso: none(), work: none(), reset: none(), money: none(), discount: none(),
        flags: { ...acc.flags, suspiciousOnly: true, suspiciousIgnored: a.nAll } };
    });
    // Attach each school-login notice to a matching account, or add an app-only account.
    for (const [k, app] of this.apps) {
      const match = out.find((acc) => normaliseApp(acc.name) === k || normaliseApp(labelOf(acc.key)) === k);
      const sso: Cond = { tier: 'seen', source: 'rules', signal: 'IDP-NOTICE', msgId: String(app.m.index), quote: app.quote,
        ...(app.m.date ? { date: app.m.date } : {}) };
      if (match) {
        match.sso = sso;
        if (tierRank(match.exists.tier) < tierRank('seen')) match.exists = sso;
        match.link = 'seen';
        match.flags.forwardedIn = null;
      } else {
        out.push({ key: `app:${k}`, name: app.name, link: 'seen', exists: sso, sso, work: none(), reset: none(), money: none(),
          discount: none(), flags: { schoolRun: false, forwardedIn: null, suspiciousOnly: false, bulkOnly: false,
            suspiciousIgnored: 0, health: false }, lastDate: app.m.date ?? 0, nMsgs: 1, nLinked: 1, nAll: 1 });
      }
    }
    return out;
  }

  /**
   * Up to `max` emails for Nano, one per account, in ranked order: accounts to move first, then
   * maybe accounts. Accounts that end anyway, live elsewhere or look fake are skipped.
   */
  nanoItems(ranked: readonly RankedAccount[], max = 200): NanoItem[] {
    const own = [...this.ctx.own];
    const out: NanoItem[] = [];
    for (const r of ranked) {
      if (out.length >= max) break;
      if (r.section !== 'main' && r.section !== 'maybe') continue;
      const c = this.accounts.get(r.key)?.candidate;
      if (!c) continue;
      out.push({ key: r.key, msgId: c.msgId, ...(c.date ? { date: c.date } : {}), senderDomain: r.key,
        text: prepForPrompt(c.subject, c.text, { ownAddresses: own }) });
    }
    return out;
  }

  private toAccount(a: Acc): Account {
    const name = [...a.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? a.key;
    let exists = a.conds.exists;
    const transactional: Cond = a.nMsgs >= 2 ? { tier: 'likely', source: 'rules', signal: `TRANSACTIONAL ×${a.nMsgs}` }
      : a.nMsgs === 1 ? { tier: 'possible', source: 'rules', signal: 'TRANSACTIONAL ×1' }
      : a.nLinked > 0 ? { tier: 'possible', source: 'rules', signal: 'newsletters only' }
      : none();
    if (tierRank(transactional.tier) > tierRank(exists.tier)) exists = transactional;
    return {
      key: a.key, name, link: a.link, exists,
      sso: a.conds.sso, work: a.conds.work, reset: a.conds.reset, money: a.conds.money, discount: a.conds.discount,
      flags: { schoolRun: a.key === this.schoolKey, forwardedIn: a.link ? null : a.otherAddress,
        suspiciousOnly: a.suspicious > 0 && a.clean === 0, bulkOnly: a.nLinked > 0 && a.nMsgs === 0,
        suspiciousIgnored: a.suspicious, health: a.health },
      lastDate: a.lastDate, nMsgs: a.nMsgs, nLinked: a.nLinked, nAll: a.nAll,
    };
  }
}
