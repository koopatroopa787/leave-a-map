// apps/scan/src/gmail-source.ts: the extension's "Read from Gmail". Only in the extension build
// (VITE_SCAN_EXTENSION=1). It injects apps/extension/gmail-reader.js into the Gmail tab the person
// already has open, receives the raw emails over a local port, and turns them into an .mbox File for
// the same scan as an exported mailbox. This page still makes no network request of its own.
export const IN_EXTENSION = import.meta.env.VITE_SCAN_EXTENSION === '1';

// ponytail: the few chrome.* calls used here, typed by hand instead of adding @types/chrome.
type Port = { postMessage(m: unknown): void; disconnect(): void; onMessage: { addListener(f: (m: any) => void): void }; onDisconnect: { addListener(f: () => void): void } };
type Chrome = {
  tabs: { query(q: object): Promise<{ id?: number; active: boolean; lastAccessed?: number }[]>; connect(id: number, o: { name: string }): Port };
  scripting: { executeScript(o: { target: { tabId: number }; files: string[] }): Promise<unknown> };
};
const chromeApi = () => (globalThis as { chrome?: Chrome }).chrome;

export type GmailProgress = { stage: 'list'; found: number } | { stage: 'fetch'; done: number; of: number; senders: number; listed: number };
export type GmailResult = { file: File; address: string; listed: number; fetched: number; failed: number; senders: number };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');
const asctime = (d: Date) => `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} ${d.getUTCFullYear()}`;

/** One raw email as an mboxrd entry: a "From " line, then the message with "From " lines escaped. */
export function mboxEntry(raw: string): string {
  const text = raw.replace(/\r\n?/g, '\n');
  const head = text.slice(0, Math.max(0, text.indexOf('\n\n')) || text.length);
  const dateLine = /^Date:[ \t]*(.+)$/im.exec(head)?.[1];
  const when = dateLine && !Number.isNaN(Date.parse(dateLine)) ? new Date(Date.parse(dateLine)) : new Date(0);
  return `From gmail-reader ${asctime(when)}\n${text.replace(/^(>*From )/gm, '>$1').replace(/\n*$/, '')}\n\n`;
}

/** Why reading Gmail failed, in words for the start screen. */
export const GMAIL_ERROR: Record<string, string> = {
  'no-tab': 'Open Gmail in a tab of this browser, signed in to the mailbox you want to read, then try again.',
  'no-key': 'Gmail didn’t finish loading in that tab. Reload Gmail, wait for the inbox, then try again.',
  'nothing': 'No account emails were found in that Gmail. Check it’s the right mailbox.',
  'stopped': 'Reading stopped. The Gmail tab was closed or reloaded.',
};

export async function readGmail(onProgress: (p: GmailProgress) => void, signal?: AbortSignal): Promise<GmailResult> {
  const c = chromeApi();
  if (!c) throw new Error('no-tab');
  const tabs = await c.tabs.query({ url: 'https://mail.google.com/*' });
  const tab = tabs.filter((t) => t.id !== undefined).sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
  if (!tab?.id) throw new Error('no-tab');
  await c.scripting.executeScript({ target: { tabId: tab.id }, files: ['gmail-reader.js'] });
  const port = c.tabs.connect(tab.id, { name: 'leave-a-map-gmail' });
  const parts: string[] = [];
  return new Promise<GmailResult>((resolve, reject) => {
    let over = false;
    const fail = (why: string) => { if (!over) { over = true; port.disconnect(); reject(new Error(why)); } };
    signal?.addEventListener('abort', () => fail('stopped'));
    port.onDisconnect.addListener(() => fail('stopped'));
    port.onMessage.addListener((m) => {
      if (m.type === 'progress') onProgress(m as GmailProgress);
      else if (m.type === 'message') parts.push(mboxEntry(String(m.raw)));
      else if (m.type === 'error') fail(m.message in GMAIL_ERROR ? m.message : `Gmail: ${m.message}`);
      else if (m.type === 'done') {
        if (parts.length === 0) return fail('nothing');
        over = true; port.disconnect();
        const address = String(m.address || '');
        resolve({ file: new File(parts, `gmail-${address || 'mailbox'}.mbox`, { type: 'application/mbox' }), address, listed: m.listed, fetched: m.fetched, failed: m.failed, senders: m.senders });
      }
    });
    port.postMessage({ type: 'read', maxThreads: 3000 });
  });
}
