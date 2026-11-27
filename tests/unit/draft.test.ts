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
