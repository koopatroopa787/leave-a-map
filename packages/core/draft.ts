// packages/core/draft.ts: a ready-to-edit message to a company, for the "Write to them" box on each
// card. Plain text with [brackets] where only the person can fill in the detail. Never sent from the
// page: the person copies it or opens it in their own email app.
import type { Bucket } from './types.ts';

export type Draft = { subject: string; body: string };
export type DraftInput = {
  mode: 'school' | 'loss'; bucket: Bucket; company: string; address: string;
  /** The shutoff date from the start screen, already in words ("31 March 2027"), and whether it has passed. */
  closing?: { date: string; past: boolean };
};

const ASK_LOSS: Record<Bucket, string[]> = {
  money: [
    'tell me what you need from me to deal with their account, for example a copy of the death certificate and proof that I can act for their estate',
    'let me know about any balance, policy, pension or claim, and any payments due',
    'stop any further payments, renewals or direct debits',
  ],
  work: [
    'tell me what you need from me to deal with their account',
    'let me know how the family can get a copy of their photos and files before anything is closed',
  ],
  sso: [
    'tell me what you need from me to deal with their account',
    'let me know how to close or memorialise it',
  ],
  reset: [
    'tell me what you need from me to deal with their account',
    'keep the account open for now while I deal with their other accounts, and tell me how to close it later',
  ],
  rest: [
    'tell me what you need from me to deal with their account',
    'cancel anything that is still being charged',
    'close or memorialise the account',
  ],
};

export function draftMessage({ mode, bucket, company, address, closing }: DraftInput): Draft {
  if (mode === 'loss') {
    const asks = ASK_LOSS[bucket].map((a) => `- ${a}`).join('\n');
    return {
      subject: `Notification of death: [their full name], account holder`,
      body: `Dear ${company} team,

I'm writing to let you know that [their full name], who had an account with you under the email address ${address}, passed away on [date of death].

I'm their [relationship, for example son, daughter, partner or executor]. Please could you:
${asks}

Their account or policy number, if you need it: [number, if you have it]

You can reach me by replying to this email or on [your phone number].

Thank you,
[your name]`,
    };
  }
  return {
    subject: `Please change the email address on my account`,
    body: `Dear ${company} team,

My email address ${address} ${closing ? `${closing.past ? 'closed' : 'is closing'} on ${closing.date}` : 'is closing on [date it shuts off]'}. Please change the email address on my account to [new email address].

Account name: [your full name]
Account or customer number: [number, if you have it]

If you need to check it's me first, please tell me how.

Thank you,
[your name]`,
  };
}

/** A mailto: link for the person's own email app. Nothing is sent until they press Send there. */
export function mailtoHref(to: string | undefined, d: Draft): string {
  const q = `subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  return `mailto:${to ? encodeURIComponent(to).replace(/%40/g, '@') : ''}?${q}`;
}
