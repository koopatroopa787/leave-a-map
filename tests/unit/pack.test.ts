import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyPack, makePack, type HandLinksFile, type PackFile } from '../../packages/core/pack.ts';
import { isHonest } from '../../packages/core/evidence.ts';
import { outboxFor } from '../../packages/core/outbox.ts';
import type { RankedAccount } from '../../packages/core/types.ts';

const none = { tier: null, source: 'rules', signal: '' } as const;
const acct = (key: string, exists: RankedAccount['exists']['tier'] = 'seen', extra: Partial<RankedAccount> = {}): RankedAccount => ({
  key, name: key, link: 'seen', exists: { ...none, tier: exists }, sso: none, work: none, reset: none, money: none, discount: none,
  flags: { schoolRun: false, forwardedIn: null, suspiciousOnly: false, bulkOnly: false, suspiciousIgnored: 0, health: false },
  lastDate: 0, nMsgs: 1, nLinked: 1, nAll: 1, section: 'main', bucket: 'rest', primaryTier: 'seen', alsoCount: 0, ...extra,
} as RankedAccount);

const file: PackFile = {
  snapshot: { taken: '2026-11-21' }, count: 4,
  entries: {
    'codehub.test': { n: 'Codehub', c: 'work', h: 'documents', p: 1, d: 'https://codehub.test/settings/delete', dd: 'easy' },
    'chatty.test': { n: 'Chatty', c: 'social', h: 'nothing-seen' },
    'homeonly.test': { n: 'Homeonly', d: 'javascript:alert(1)' },
    'forkyard.example': { n: 'Should not be used', c: 'money' },
  },
};
const hand: HandLinksFile = {
  entries: [
    { domain: 'chatty.test', name: 'Chatty', category: 'work', usuallyHolds: ['documents'], loginEmailChange: 'https://help.chatty.test/change-email', example: false, checked: '2026-11-21' },
    { domain: 'forkyard.example', name: 'Forkyard', category: 'work', usuallyHolds: ['documents'], loginEmailChange: 'https://forkyard.example/settings/emails', example: true, checked: null },
    { domain: 'liar.example', name: 'Liar', category: 'work', loginEmailChange: 'https://real-site.test/phish', example: true, checked: null },
  ],
};
const pack = makePack(file, hand);

describe('move pack lookup (T28)', () => {
  it('merges the lists with hand-checked links, and hand entries win', () => {
    expect(pack.lookup('codehub.test')).toMatchObject({ name: 'Codehub', category: 'work', holds: ['documents'], passkeys: true, from: 'list',
      deleteAccount: { url: 'https://codehub.test/settings/delete', difficulty: 'easy', example: false } });
    expect(pack.lookup('chatty.test')).toMatchObject({ category: 'work', from: 'hand',
      changeEmail: { url: 'https://help.chatty.test/change-email', checked: '2026-11-21', example: false } });
    expect(pack.lookup('CODEHUB.test')?.name).toBe('Codehub');
    expect(pack.lookup('nobody.test')).toBeUndefined();
    expect(pack.lookup('__proto__')).toBeUndefined();
  });
  it('drops unsafe links and keeps example links on .example hosts only', () => {
    expect(pack.lookup('homeonly.test')?.deleteAccount).toBeUndefined();
    expect(pack.lookup('forkyard.example')?.changeEmail).toEqual({ url: 'https://forkyard.example/settings/emails', example: true, checked: null });
    expect(pack.lookup('liar.example')?.changeEmail).toBeUndefined();
  });
  it('counts a service as known only when it has a category', () => {
    expect(pack.known('codehub.test')).toBe(true);
    expect(pack.known('homeonly.test')).toBe(false);
    expect(pack.known('nobody.test')).toBe(false);
  });
});

describe('applyPack (T28)', () => {
  it('raises to Likely when the mail shows the account, never to Seen, and never creates one', () => {
    const [seen, possible] = applyPack([acct('codehub.test'), acct('codehub.test', 'possible')], pack);
    expect(seen.work).toMatchObject({ tier: 'likely', source: 'pack', signal: 'listed as a place where people keep work' });
    expect(isHonest(seen.work)).toBe(true);
    expect(possible.work.tier).toBeNull();
    expect(seen.exists).toEqual(acct('codehub.test').exists);
  });
  it('leaves stronger evidence, unknown services and connected apps alone', () => {
    const strong = acct('codehub.test', 'seen', { work: { tier: 'seen', source: 'rules', signal: 'repo' } });
    const others = [acct('nobody.test'), acct('app:codehub.test'), acct('homeonly.test')];
    const out = applyPack([strong, ...others], pack);
    expect(out[0]).toBe(strong);
    out.slice(1).forEach((a, i) => expect(a).toBe(others[i]));
    expect(applyPack(others, null)).toBe(others);
  });
  it('says what raised each condition, and marks hand and sample entries', () => {
    const shop = makePack({ snapshot: { taken: '' }, count: 0, entries: {} }, { entries: [
      { domain: 'shop.example', name: 'Shop', category: 'shopping', usuallyHolds: ['purchases', 'payment'], example: true, checked: null },
      { domain: 'chat.test', name: 'Chat', category: 'work', example: false, checked: '2026-11-21' },
    ] });
    const [s, c] = applyPack([acct('shop.example'), acct('chat.test')], shop);
    expect(s.money.signal).toBe('listed as usually holding payment details (sample entry)');
    expect(c.work.signal).toBe('listed as a place where people keep work (written by hand)');
  });
  it('lets a bucket category win over what the service usually holds', () => {
    const bank = makePack({ snapshot: { taken: '' }, count: 0, entries: {} }, { entries: [
      { domain: 'bank.example', name: 'Bank', category: 'money', usuallyHolds: ['payment', 'documents'], example: true, checked: null },
      { domain: 'vault.example', name: 'Vault', category: 'identity', usuallyHolds: ['login-for-others', 'payment'], example: true, checked: null },
    ] });
    const [b, v] = applyPack([acct('bank.example'), acct('vault.example')], bank);
    expect([b.money.tier, b.work.tier]).toEqual(['likely', null]);
    expect([v.reset.tier, v.money.tier]).toEqual(['likely', null]);
  });
  it('keeps known services out of the cloud lookup', () => {
    const items = outboxFor([acct('codehub.test'), acct('mystery.test')], pack.known).items;
    expect(items.map((i) => i.senderDomain)).toEqual(['mystery.test']);
  });
});

describe('the committed pack files', () => {
  const real = makePack(
    JSON.parse(readFileSync('data/pack.generated.json', 'utf8')),
    JSON.parse(readFileSync('data/hand-links.json', 'utf8')),
  );
  const handFile = JSON.parse(readFileSync('data/hand-links.json', 'utf8')) as HandLinksFile;
  it('has a dated snapshot and every hand link survives the safety checks', () => {
    expect(real.taken).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const h of handFile.entries) {
      const f = real.lookup(h.domain);
      expect(f?.changeEmail, h.domain).toBeDefined();
      expect(h.example).toBe(h.domain.endsWith('.example'));
      expect(h.example ? h.checked === null : /^\d{4}-\d{2}-\d{2}$/.test(String(h.checked))).toBe(true);
    }
    expect(handFile.entries.filter((h) => !h.example).length).toBeGreaterThanOrEqual(12);
  });
  it('leaves the sample\'s lookup-only services out, so the cloud step still has work', () => {
    for (const d of ['learnridge.example', 'citewell.example', 'chirpline.example', 'mendwise.example',
      'openscholar.example', 'datavault.example', 'loanhub.example']) expect(real.known(d), d).toBe(false);
  });
});
