import { describe, expect, it } from 'vitest';
import { draftMessage, mailtoHref } from '../../packages/core/draft.ts';

describe('ready-made messages', () => {
  it('after a loss, asks a bank to stop payments and never includes a password', () => {
    const d = draftMessage({ mode: 'loss', bucket: 'money', company: 'Harbourline Bank', address: 'robin@x.example' });
    expect(d.body).toContain('Dear Harbourline Bank team');
    expect(d.body).toContain('robin@x.example');
    expect(d.body).toContain('stop any further payments');
    expect(d.body).not.toMatch(/password/i);
  });
  it('for a closing address, asks to change the email', () => {
    expect(draftMessage({ mode: 'school', bucket: 'rest', company: 'Shop', address: 'me@uni.example' }).body).toContain('[new email address]');
  });
  it('builds a mailto link with the text encoded', () => {
    const h = mailtoHref('help@bank.example', { subject: 'A & B', body: 'x\ny' });
    expect(h).toBe('mailto:help@bank.example?subject=A%20%26%20B&body=x%0Ay');
  });
});

describe('closing date in the change-of-email letter', () => {
  const base = { mode: 'school' as const, bucket: 'rest' as const, company: 'Quillpad', address: 'me@uni.example' };
  it('fills in the date from the start screen', () => {
    const d = draftMessage({ ...base, closing: { date: '31 March 2027', past: false } });
    expect(d.body).toContain('me@uni.example is closing on 31 March 2027.');
    expect(d.body).not.toContain('[date it shuts off]');
  });
  it('says "closed" once the date has passed', () => {
    expect(draftMessage({ ...base, closing: { date: '1 January 2026', past: true } }).body).toContain('closed on 1 January 2026.');
  });
  it('leaves the blank when there is no date', () => {
    expect(draftMessage(base).body).toContain('[date it shuts off]');
  });
});
