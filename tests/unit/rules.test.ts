import { describe, expect, it } from 'vitest';
import { accountKey, cleanName, registrableDomain } from '../../packages/core/rules/account-key.ts';
import { isPersonSender, makeLinkContext, schoolLink } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { rank } from '../../packages/core/rank.ts';
import type { MessageRecord } from '../../packages/core/types.ts';

let n = 0;
const msg = (p: Partial<MessageRecord>): MessageRecord => ({
  index: n++, start: 0, bodyStart: 0, end: 0, from: null, to: [], cc: [], deliveredTo: [], xOriginalTo: [],
  xForwardedFor: [], returnPath: null, resentFrom: [], listId: null, subject: '', date: null, bulk: false, ...p,
});
const ctx = makeLinkContext('alderbrook.example', ['jreyes@alderbrook.example']);

describe('account key', () => {
  it('uses the registrable domain, including unknown test TLDs', () => {
    expect(registrableDomain('mail.forkyard.example')).toBe('forkyard.example');
    expect(accountKey('No-Reply@Mail.Forkyard.Example')).toBe('forkyard.example');
    expect(accountKey('a@news.bbc.co.uk')).toBe('bbc.co.uk');
  });
  it('cleans display names', () => {
    expect(cleanName('"Forkyard No-Reply"')).toBe('Forkyard');
  });
});

describe('school link', () => {
  it('D1: own address is Seen, another school address is Likely', () => {
    expect(schoolLink(msg({ deliveredTo: ['jreyes@alderbrook.example'] }), ctx)).toMatchObject({ kind: 'school', tier: 'seen' });
    expect(schoolLink(msg({ deliveredTo: ['j.reyes@mail.alderbrook.example'] }), ctx)).toMatchObject({ kind: 'school', tier: 'likely' });
  });
  it('D3: To/Cc only when nothing earlier fires', () => {
    expect(schoolLink(msg({ cc: ['jreyes@alderbrook.example'] }), ctx)).toMatchObject({ kind: 'school', rule: 'D3 To/Cc' });
    expect(schoolLink(msg({ to: ['me@elsewhere.example'] }), ctx)).toEqual({ kind: 'none' });
  });
  it('F1/F2: X-Forwarded-For decides forwarded mail', () => {
    expect(schoolLink(msg({ xForwardedFor: ['me@personal.example jreyes@alderbrook.example'] }), ctx))
      .toMatchObject({ kind: 'other-address', address: 'me@personal.example' });
    expect(schoolLink(msg({ xForwardedFor: ['jreyes@alderbrook.example me@personal.example'] }), ctx))
      .toMatchObject({ kind: 'forwarded-from-school', tier: 'seen' });
  });
  it('F3: the +caf_= forward envelope', () => {
    expect(schoolLink(msg({ returnPath: '<jreyes+caf_=me=personal.example@alderbrook.example>' }), ctx))
      .toMatchObject({ kind: 'forwarded-from-school' });
  });
  it('escapes the school domain', () => {
    const c = makeLinkContext('a.b', []);
    expect(c.isSchool('x@axb')).toBe(false);
    expect(c.isSchool('x@a.b')).toBe(true);
  });
  it('T2: people at mailbox providers are not accounts, robots are', () => {
    expect(isPersonSender('friend@gmail.com')).toBe(true);
    expect(isPersonSender('no-reply@accounts.gmail.com')).toBe(false);
    expect(isPersonSender('hello@forkyard.example')).toBe(false);
  });
});

describe('aggregate and rank v1', () => {
  it('puts each account in the right section', () => {
    const agg = new Aggregator(ctx);
    const to = { deliveredTo: ['jreyes@alderbrook.example'] };
    agg.add(msg({ ...to, from: { name: 'Forkyard', address: 'a@mail.forkyard.example' }, date: 2 }));
    agg.add(msg({ ...to, from: { name: 'Forkyard', address: 'b@forkyard.example' }, date: 5 }));
    agg.add(msg({ ...to, from: { name: 'Quillbase', address: 'q@quillbase.example' }, date: 9 }));
    agg.add(msg({ ...to, from: { name: 'Pagewell', address: 'n@pagewell.example' }, bulk: true }));
    agg.add(msg({ ...to, from: { name: 'Registrar', address: 'r@alderbrook.example' } }));
    agg.add(msg({ xForwardedFor: ['me@personal.example jreyes@alderbrook.example'], from: { name: 'Bank', address: 'x@bank.example' } }));
    agg.add(msg({ to: ['someone@else.example'], from: { name: 'Shop', address: 's@shop.example' } }));
    agg.add(msg({ ...to, from: { name: 'Friend', address: 'pal@gmail.com' } }));
    const out = rank(agg.accountsOut());
    expect(out.map((a) => [a.key, a.section])).toEqual([
      ['forkyard.example', 'main'],
      ['quillbase.example', 'maybe'],
      ['pagewell.example', 'maybe'],
      ['alderbrook.example', 'ends-anyway'],
      ['bank.example', 'elsewhere'],
    ]);
    expect(out[0]).toMatchObject({ name: 'Forkyard', nMsgs: 2, lastDate: 5, link: 'seen', bucket: 'rest' });
    expect(agg.stats).toMatchObject({ messages: 8, skipped: { personSender: 1 } });
  });
});
