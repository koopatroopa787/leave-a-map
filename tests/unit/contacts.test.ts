import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ContactBook, extractContacts } from '../../packages/core/contacts.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { readBody, KEEP_BODY_BYTES } from '../../packages/core/mbox/body.ts';
import { splitAllMessages } from '../../packages/core/mbox/split.ts';

describe('contact details in one email', () => {
  const text = 'Your statement is ready. Order 1234567890123.\nQuestions? Call us on 01632 960 112 or email help@bank.example.\n'
    + 'Bereavement: bereavement@bank.example. Sent from no-reply@bank.example to robin@home.example.\n'
    + 'Scam help: fraud@other.example\nBank Ltd, 4 Quay Row, Eastbury ZZ99 1HB.\nPaid on 12.10.2026.';
  const c = extractContacts(text, 'bank.example', ['robin@home.example']);
  it('keeps addresses on the company\'s own domain, not no-reply, the person\'s own or other domains', () => {
    expect(c.emails).toEqual(['help@bank.example', 'bereavement@bank.example']);
  });
  it('keeps phone numbers only after a word like "call"', () => {
    expect(c.phones).toEqual(['01632 960 112']);
    expect(c.familyPhones).toEqual([]);
  });
  it('keeps postal lines that end in a postcode', () => {
    expect(c.addresses).toEqual(['Bank Ltd, 4 Quay Row, Eastbury ZZ99 1HB']);
  });
  it('reads US and Indian addresses too', () => {
    expect(extractContacts('Acme Inc, 1 Main St, Springfield, IL 62701', 'acme.example').addresses).toHaveLength(1);
    expect(extractContacts('Acme Ltd, 2 MG Road, Mumbai 400001', 'acme.example').addresses).toHaveLength(1);
  });
});

describe('the sample after a loss', async () => {
  const bytes = readFileSync('fixtures/estate.example.mbox');
  const own = ['robin.hale@mailbox.example'];
  const book = new ContactBook(own);
  const agg = new Aggregator(makeLinkContext('mailbox.example', own), { onTrusted: (k, m, b) => book.add(k, m, b) });
  for (const m of splitAllMessages(new Uint8Array(bytes), bytes.length, KEEP_BODY_BYTES)) agg.add(m.rec, await readBody(m.raw));
  const out = book.out();
  it('puts the bereavement team first for the bank', () => {
    expect(out['harbourline.example']).toEqual({
      emails: ['bereavement@harbourline.example', 'help@harbourline.example'],
      phones: ['01632 960 113', '01632 960 112'],
      addresses: ['Harbourline Bank, 4 Quay Row, Eastbury ZZ99 1HB'],
    });
  });
  it('never takes details from the fake bank email', () => {
    expect(out['harbourline-secure.example']).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('960 999');
  });
});
