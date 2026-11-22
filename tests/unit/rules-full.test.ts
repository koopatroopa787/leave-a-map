import { describe, expect, it } from 'vitest';
import type { MessageRecord } from '../../packages/core/types.ts';
import type { BodyInfo } from '../../packages/core/mbox/body.ts';
import { senderAuth } from '../../packages/core/rules/sender-auth.ts';
import { messageSignals } from '../../packages/core/rules/signals.ts';
import { suspiciousReason } from '../../packages/core/rules/suspicious.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { rank } from '../../packages/core/rank.ts';

const ME = 'jreyes@alderbrook.example';
let n = 0;
const msg = (p: Partial<MessageRecord>): MessageRecord => ({
  index: n++, start: 0, bodyStart: 0, end: 0, from: null, to: [ME], cc: [], deliveredTo: [ME], xOriginalTo: [],
  xForwardedFor: [], returnPath: null, resentFrom: [], listId: null, subject: '', date: 1, bulk: false,
  listUnsubscribe: false, authResults: null, arcResults: null, ...p,
});
const body = (text: string, orderMarkup = false): BodyInfo => ({ text, orderMarkup });
const from = (address: string, name = '') => ({ address, name });
const gmailPass = (d: string) =>
  `mx.google.com; dkim=pass header.i=@${d} header.s=s1 header.b=abc; spf=pass (google.com: domain of bounce@${d}) smtp.mailfrom=bounce@${d}; dmarc=pass (p=REJECT) header.from=${d}`;

describe('sender authentication (1.3)', () => {
  it('passes on aligned DMARC or DKIM, at the organisational domain', () => {
    expect(senderAuth(msg({ from: from('a@mail.forkyard.example'), authResults: gmailPass('forkyard.example') }))).toBe('pass');
    expect(senderAuth(msg({ from: from('a@forkyard.example'), authResults: 'mx.google.com; dkim=pass header.d=mail.forkyard.example; spf=neutral' }))).toBe('pass');
  });
  it('fails on DMARC fail, or SPF fail without aligned DKIM', () => {
    expect(senderAuth(msg({ from: from('a@forkyard.example'), authResults: 'mx.google.com; dmarc=fail (p=NONE) header.from=forkyard.example' }))).toBe('fail');
    expect(senderAuth(msg({ from: from('a@forkyard.example'), authResults: 'mx.google.com; spf=softfail smtp.mailfrom=a@forkyard.example' }))).toBe('fail');
    expect(senderAuth(msg({ from: from('a@forkyard.example'), authResults: 'mx.google.com; dkim=pass header.d=other.example; spf=fail' }))).toBe('fail');
  });
  it('is unknown with no results, and pass-forwarded through ARC', () => {
    expect(senderAuth(msg({ from: from('a@forkyard.example') }))).toBe('unknown');
    expect(senderAuth(msg({ from: from('a@forkyard.example'), authResults: 'mx.google.com; dkim=fail header.d=forkyard.example; arc=pass (i=1)',
      arcResults: `i=1; ${gmailPass('forkyard.example')}` }))).toBe('pass-forwarded');
  });
});

describe('service-mail signals (1.4)', () => {
  const names = (subject: string, text = '', markup = false) =>
    messageSignals(msg({ subject }), body(text, markup), [ME]).map((f) => f.name);
  it('fires the existence signals', () => {
    expect(names('Welcome to Forkyard')).toContain('WELCOME');
    expect(names('Please confirm your email address')).toContain('VERIFY');
    expect(names('Hello', 'Your code is 48213X')).toContain('VERIFY');
    expect(names('Reset your password')).toContain('RESET');
    expect(names('Security alert: new sign-in')).toContain('SECURITY');
    expect(names('Your monthly statement is ready')).toContain('STATEMENT');
  });
  it('needs an amount for a receipt, unless order markup is present', () => {
    expect(names('Your order has shipped')).not.toContain('RECEIPT');
    expect(names('Your order has shipped', 'Total: $12.40')).toContain('RECEIPT');
    expect(names('Thanks!', '', true)).toContain('RECEIPT');
  });
  it('puts money, work and discount signals in the right place', () => {
    expect(names('Your plan renews soon', 'You will be billed $9.99. Card ending in 4242')).toEqual(expect.arrayContaining(['RECURRING', 'CARD ON FILE']));
    expect(names('Your plan renews soon')).not.toContain('RECURRING');
    expect(names('Sam commented on your pull request')).toContain('WORK STRONG');
    expect(names('New project created')).toEqual(expect.arrayContaining(['WORK WEAK']));
    expect(names('Sam commented on your project')).not.toContain('WORK WEAK');
    expect(names('Your student plan')).toContain('STUDENT DISCOUNT');
    expect(names('Appointment reminder')).toContain('HEALTH');
    expect(names('Hi', 'You signed up with Google on 3 May')).toContain('SSO-WELCOME');
    expect(names('Your account', "You don't have a password yet. Add a password to your account to sign in without your school login.")).toContain('NO-PASSWORD HINT');
    expect(names('Reset your password', 'Choose a new password.')).not.toContain('NO-PASSWORD HINT');
  });
  it('needs one of your own addresses near a recovery address phrase', () => {
    expect(names('Account updated', `Your recovery email is now ${ME}.`)).toContain('RECOVERY ADDRESS');
    expect(names('Account updated', 'Your recovery email is now someone@else.example.')).not.toContain('RECOVERY ADDRESS');
  });
  it('quotes text copied exactly from the source', () => {
    const [f] = messageSignals(msg({ subject: 'Hi' }), body('Lots of words before. You have successfully created an account with us.'), [ME]);
    expect('Lots of words before. You have successfully created an account with us.').toContain(f.quote);
  });
});

describe('fake-looking mail (1.7)', () => {
  const pack = { labels: new Set(['forkyard', 'ledgerly']), byName: new Map([['ledgerly', 'ledgerly.example']]) };
  it('flags failed auth, punycode, lookalikes, brand-plus-word and a borrowed display name', () => {
    expect(suspiciousReason(msg({ from: from('a@b.example') }), 'fail')).toMatch(/^P1/);
    expect(suspiciousReason(msg({ from: from('a@xn--frkyard-0ya.example') }), 'unknown')).toMatch(/^P2/);
    expect(suspiciousReason(msg({ from: from('a@f0rkyard.example') }), 'unknown', pack)).toMatch(/^P3/);
    expect(suspiciousReason(msg({ from: from('a@forkyard-security.example') }), 'unknown', pack)).toMatch(/^P4/);
    expect(suspiciousReason(msg({ from: from('a@cheap-mail.example', 'Ledgerly') }), 'unknown', pack)).toMatch(/^P5/);
    expect(suspiciousReason(msg({ from: from('a@forkyard.example', 'Forkyard') }), 'pass', pack)).toBeNull();
  });
});

describe('aggregate and rank with full rules', () => {
  const ctx = makeLinkContext('alderbrook.example', [ME]);
  const run = (items: [Partial<MessageRecord>, BodyInfo?][], pack?: Parameters<typeof suspiciousReason>[2]) => {
    const agg = new Aggregator(ctx, { pack });
    for (const [p, b] of items) agg.add(msg(p), b);
    return rank(agg.accountsOut());
  };

  it('ranks school login, then work, reset, money, rest', () => {
    const out = run([
      [{ from: from('no-reply@accounts.google.com'), subject: 'Security alert', authResults: gmailPass('accounts.google.com') },
        body(`Quillbase was granted access to your Google Account\n${ME}\nIf you did not grant access, check this activity.`)],
      [{ from: from('hello@quillbase.example', 'Quillbase'), subject: 'Welcome to Quillbase', authResults: gmailPass('quillbase.example') }, body('')],
      // One strong email alone is only Possible existence (analyst.md 2.4 step 5), so each has two.
      [{ from: from('a@forkyard.example', 'Forkyard'), subject: 'Sam commented on your pull request', authResults: gmailPass('forkyard.example') }, body('')],
      [{ from: from('a@forkyard.example', 'Forkyard'), subject: 'Weekly summary', authResults: gmailPass('forkyard.example') }, body('')],
      [{ from: from('a@notewise.example', 'Notewise'), subject: 'Account updated', authResults: gmailPass('notewise.example') }, body(`Your recovery email is ${ME}.`)],
      [{ from: from('a@notewise.example', 'Notewise'), subject: 'Your notes were backed up', authResults: gmailPass('notewise.example') }, body('')],
      [{ from: from('a@ledgerly.example', 'Ledgerly'), subject: 'Your monthly statement is ready', authResults: gmailPass('ledgerly.example') }, body('')],
      [{ from: from('a@cartwheel.example', 'Cartwheel'), subject: 'Your order', authResults: gmailPass('cartwheel.example') }, body('Total $5.00')],
    ]);
    expect(out.map((a) => [a.key, a.bucket])).toEqual([
      ['quillbase.example', 'sso'], ['forkyard.example', 'work'], ['notewise.example', 'reset'],
      ['ledgerly.example', 'money'], ['cartwheel.example', 'rest'],
    ]);
    expect(out[0].sso).toMatchObject({ tier: 'seen', signal: 'IDP-NOTICE' });
    expect(out.some((a) => a.key === 'google.com')).toBe(false);
  });

  it('adds an app-only account when no sender matches the notice, and ignores a replayed notice', () => {
    const notice = (text: string, to = ME) => [{ from: from('no-reply@accounts.google.com'), subject: 'Security alert',
      authResults: gmailPass('accounts.google.com'), deliveredTo: [to] }, body(text)] as [Partial<MessageRecord>, BodyInfo];
    const out = run([notice(`Sketchpad Pro was granted access to your Google Account\n${ME}`)]);
    expect(out[0]).toMatchObject({ key: 'app:sketchpadpro', name: 'Sketchpad Pro', bucket: 'sso' });
    expect(run([notice('Sketchpad Pro was granted access to your Google Account\nvictim@other.example')])).toEqual([]);
  });

  it('keeps the no-password hint at Possible, so it never moves a card into the school-login bucket', () => {
    const [a] = run([
      [{ from: from('a@pinboard.example', 'Pinboard'), subject: 'Welcome to Pinboard', authResults: gmailPass('pinboard.example') }, body("You don't have a password on this account.")],
      [{ from: from('a@pinboard.example', 'Pinboard'), subject: 'Your weekly digest', authResults: gmailPass('pinboard.example') }, body('')],
    ]);
    expect(a.sso).toMatchObject({ tier: 'possible', signal: 'NO-PASSWORD HINT' });
    expect(a.bucket).toBe('rest');
  });

  it('caps unauthenticated mail at Likely, and weak signals one step lower', () => {
    const [a] = run([[{ from: from('a@forkyard.example'), subject: 'New project created' }, body('')],
      [{ from: from('a@forkyard.example'), subject: 'Welcome to Forkyard' }, body('')]]);
    expect(a.exists.tier).toBe('likely');
    expect(a.work).toMatchObject({ tier: 'possible', signal: 'WORK WEAK' });
    expect(a.bucket).toBe('rest');
  });

  it('keeps List-Unsubscribe mail with a welcome out of bulk, and sends fake-only senders to Looks fake', () => {
    const out = run([
      [{ from: from('a@forkyard.example'), subject: 'Welcome to Forkyard', listUnsubscribe: true }, body('')],
      [{ from: from('a@pagewell.example'), subject: 'Top stories', listUnsubscribe: true }, body('')],
      [{ from: from('a@phish.example'), subject: 'Verify your account', authResults: 'mx.google.com; dmarc=fail header.from=phish.example' }, body('')],
    ]);
    expect(out.find((a) => a.key === 'forkyard.example')).toMatchObject({ nMsgs: 1, flags: { bulkOnly: false } });
    expect(out.find((a) => a.key === 'pagewell.example')).toMatchObject({ section: 'maybe', flags: { bulkOnly: true } });
    expect(out.find((a) => a.key === 'phish.example')).toMatchObject({ section: 'ignored', flags: { suspiciousIgnored: 1 } });
  });

  it('flags health without ranking on it', () => {
    const [a] = run([[{ from: from('a@clinic.example'), subject: 'Appointment reminder' }, body('')]]);
    expect(a.flags.health).toBe(true);
  });
});
