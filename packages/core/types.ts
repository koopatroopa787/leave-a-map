// packages/core/types.ts: shared types for every lane. Frozen once T01 and T20 merge:
// changes need a PR labelled `contract-change` and both humans' approval (BUILD-PLAN rule 3).

/** One message found in an .mbox file. Only headers are read here; the body is read later by offset. */
export type MessageRecord = {
  index: number;
  /** Byte offset of the `From ` separator line. */
  start: number;
  /** Byte offset of the first body byte (after the blank line), or `end` if there is no body. */
  bodyStart: number;
  /** Byte offset just past the message. */
  end: number;
  from: Address | null;
  to: string[];
  cc: string[];
  deliveredTo: string[];
  xOriginalTo: string[];
  /** Raw `X-Forwarded-For` values, e.g. "original@x.example destination@y.example". */
  xForwardedFor: string[];
  returnPath: string | null;
  resentFrom: string[];
  listId: string | null;
  subject: string;
  /** Milliseconds since the epoch, or null when the Date header is missing or unreadable. */
  date: number | null;
  /** Precedence: bulk, list or junk, or a Takeout "Category Promotions" label. Always bulk. */
  bulk: boolean;
  /** Has List-Unsubscribe. Bulk only when no service-mail signal fires (analyst.md 1.4). */
  listUnsubscribe: boolean;
  /** Topmost Authentication-Results value, added by the person's own mail provider. */
  authResults: string | null;
  /** The `i=1` ARC-Authentication-Results value, for forwarded mail. */
  arcResults: string | null;
};

export type Address = { name: string; address: string };

export type Tier = 'seen' | 'likely' | 'possible' | null;
export type Source = 'rules' | 'user' | 'pack' | 'on_device' | 'in_cloud';
/** One piece of evidence: how sure, where from, which rule, and the exact quote and date when there is one. */
export type Cond = { tier: Tier; source: Source; signal: string; msgId?: string; quote?: string; date?: number };

/** How a message is tied to the school address (analyst.md 1.1). */
export type SchoolLink =
  | { kind: 'school'; tier: Exclude<Tier, null>; rule: string }
  | { kind: 'forwarded-from-school'; tier: Exclude<Tier, null>; rule: string }
  | { kind: 'other-address'; address: string; rule: string }
  | { kind: 'none' };

export type Section = 'main' | 'maybe' | 'ends-anyway' | 'elsewhere' | 'ignored';
export type Bucket = 'sso' | 'work' | 'reset' | 'money' | 'rest';

/** One account (a registrable sender domain) after aggregation. Shape from analyst.md 2.1. */
export interface Account {
  key: string;
  name: string;
  link: Tier;
  exists: Cond;
  sso: Cond;
  work: Cond;
  reset: Cond;
  money: Cond;
  discount: Cond;
  flags: {
    schoolRun: boolean;
    forwardedIn: string | null;
    suspiciousOnly: boolean;
    bulkOnly: boolean;
    suspiciousIgnored: number;
    /** A health pattern fired. Used only for the lane 3 consent default (health rows need their own tick). */
    health: boolean;
  };
  /** Newest school-linked message date (ms), or 0. */
  lastDate: number;
  /** School-linked, non-bulk messages from this account (analyst.md 2.1). */
  nMsgs: number;
  /** School-linked messages from this account, bulk included. */
  nLinked: number;
  /** All messages from this account, linked or not. */
  nAll: number;
}

export type RankedAccount = Account & { section: Section; bucket: Bucket; primaryTier: Tier; alsoCount: number };

/** What the user types on the start screen. Never leaves the scan site. */
export type ScanSettings = {
  schoolDomain: string;
  ownAddresses: string[];
  /** ISO date (yyyy-mm-dd) the school address shuts off. */
  shutoffDate: string;
};

export type ScanStats = {
  bytes: number;
  messages: number;
  schoolLinked: number;
  skipped: { forwardedManually: number; personSender: number; noFrom: number };
};

/** One email chosen for Nano to label, already prepared by prompt prep (T16). Stays on the device. */
export type NanoItem = { key: string; msgId: string; date?: number; senderDomain: string; text: string };

/** Messages between the scan page and its Worker. */
export type ToWorker = { type: 'scan'; file: File; settings: ScanSettings };
export type FromWorker =
  | { type: 'progress'; bytesRead: number; totalBytes: number; messages: number }
  | { type: 'done'; accounts: RankedAccount[]; stats: ScanStats; ms: number; nanoItems: NanoItem[] }
  | { type: 'error'; message: string };
