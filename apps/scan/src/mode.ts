// apps/scan/src/mode.ts: the two things Leave a Map can map. The scan itself (packages/core) is the
// same for both; only the words, the order of the lines and the steps change.
//   school: an email address I use (school, work or an old provider) is closing, so move each
//           account to an address I'll keep. The id stays 'school' because saved checklists use it.
//   loss:   after a loss: I'm sorting out the accounts of someone who has passed away.
import type { Bucket, Section } from '../../../packages/core/types.ts';

export type Mode = 'school' | 'loss';

type Copy = {
  title: Record<Bucket, string>;
  why: Record<Bucket, string>;
  also: Record<Exclude<Bucket, 'rest'>, string>;
  order: Bucket[];
  other: { section: Exclude<Section, 'main'>; title: string; note: string }[];
  done: string;
  appKey: string;
  /** Rewrites rule wording that speaks to the mailbox owner ("your old address"). */
  say: (s: string) => string;
};

export const COPY: Record<Mode, Copy> = {
  school: {
    title: {
      sso: 'You sign in with your school or work account',
      work: 'Holds your work',
      reset: 'Can reset your other accounts',
      money: 'Money: banks, bills and subscriptions',
      rest: 'Other accounts: shopping, social and more',
    },
    why: {
      sso: 'These have no password of their own. They stop working the day the address does.',
      work: 'Files, code or documents you may lose access to.',
      reset: 'Password managers, phone and mail accounts that can recover everything else.',
      money: 'Banks, cards and subscriptions that bill you.',
      rest: 'Accounts where your old address is the login or contact email.',
    },
    also: { sso: 'school or work login', work: 'holds work', reset: 'resets others', money: 'money' },
    order: ['sso', 'work', 'reset', 'money', 'rest'],
    other: [
      { section: 'maybe', title: 'Maybe accounts', note: 'Only newsletters or a single email so far. Check these if you have time.' },
      { section: 'ends-anyway', title: 'Ends with your address anyway', note: 'Run by your school or employer. Nothing to move.' },
      { section: 'elsewhere', title: 'Tied to another address', note: 'Mail forwarded in from another address. Not affected by the shutoff.' },
      { section: 'ignored', title: 'Looks fake', note: 'Mail that failed sender checks or imitates a known service. Ignored.' },
    ],
    done: 'Moved',
    appKey: 'connected with your school or work login',
    say: (s) => s,
  },
  loss: {
    title: {
      money: 'Money: banks, pensions, insurance, bills',
      work: 'Holds their photos and files',
      sso: 'Signs in through another of their accounts',
      rest: 'Other accounts: shopping, social, memberships',
      reset: 'Their email, phone and passwords',
    },
    why: {
      money: 'Places that may hold money, pay out a claim, or keep taking payments. Contact each one first.',
      work: 'Photos, documents and messages you may want to keep before an account closes.',
      sso: 'These log in through another account of theirs. Deal with them before that account closes.',
      rest: 'Shops, memberships and sites. Cancel anything that bills, then close or memorialise the account.',
      reset: 'Letters, codes and notices from everything else arrive here. Keep these open and paid until the end.',
    },
    also: { sso: 'signs in through another account', work: 'holds files', reset: 'opens other accounts', money: 'money' },
    order: ['money', 'work', 'sso', 'rest', 'reset'],
    other: [
      { section: 'maybe', title: 'Maybe accounts', note: 'Only newsletters or a single email so far. Worth a look for anything that still bills.' },
      { section: 'ends-anyway', title: 'Their email provider', note: 'Mail from the provider of their address itself. Close the email account last.' },
      { section: 'elsewhere', title: 'Tied to another address', note: 'Mail forwarded in from another of their addresses. That mailbox may show more.' },
      { section: 'ignored', title: 'Looks fake', note: 'Mail that failed sender checks or imitates a known service. Ignored.' },
    ],
    done: 'Done',
    appKey: 'signs in through another of their accounts',
    say: (s) => s
      .replace(/your (?:old|school) address/g, 'their address')
      .replace(/your school(?: or work)? account/g, 'another of their accounts')
      .replace(/\byour\b/g, 'their').replace(/\bYou\b/g, 'They'),
  },
};

/** Where the checklist is kept, per mode, so the two never share ticks. */
export const listKey = (mode: Mode, schoolDomain: string, address: string) =>
  mode === 'loss' ? `loss.${address}` : schoolDomain;
