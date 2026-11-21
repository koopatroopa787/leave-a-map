import { describe, expect, it } from 'vitest';
import type { MessageRecord, NanoItem } from '../../packages/core/types.ts';
import { makeLinkContext } from '../../packages/core/rules/school-link.ts';
import { Aggregator } from '../../packages/core/rules/aggregate.ts';
import { rank } from '../../packages/core/rank.ts';
import { labelAccounts, median, type Timing } from '../../apps/scan/src/nano-run.ts';

const ME = 'jane.reyes@alderbrook.example';
let n = 0;
const msg = (p: Partial<MessageRecord>): MessageRecord => ({
  index: n++, start: 0, bodyStart: 0, end: 0, from: null, to: [ME], cc: [], deliveredTo: [ME], xOriginalTo: [], xForwardedFor: [],
  returnPath: null, resentFrom: [], listId: null, subject: '', date: 1, bulk: false, listUnsubscribe: false, authResults: null, arcResults: null, ...p,
});

function scan() {
  const agg = new Aggregator(makeLinkContext('alderbrook.example', [ME]));
  const add = (p: Partial<MessageRecord>, text: string) => agg.add(msg(p), { text, orderMarkup: false });
  add({ from: { name: 'Quillbase', address: 'a@quillbase.example' }, subject: 'Old note', date: 5 }, 'old');
  add({ from: { name: 'Quillbase', address: 'a@quillbase.example' }, subject: 'Hi Jane, your draft was saved', date: 9 }, 'See https://q.example/d/1 now');
  add({ from: { name: 'Pagewell', address: 'n@pagewell.example' }, subject: 'Top stories', listUnsubscribe: true, date: 3 }, 'News');
  add({ from: { name: 'Registrar', address: 'r@alderbrook.example' }, subject: 'Enrol', date: 4 }, 'x');
  add({ from: { name: 'Fwd', address: 'f@forwarded.example' }, subject: 'Fwd: Welcome', date: 8 }, 'x');
  const ranked = rank(agg.accountsOut());
  return { ranked, items: agg.nanoItems(ranked) };
}

describe('choosing emails for Nano (T18)', () => {
  it('takes the newest non-bulk email per account, prepared, and skips accounts that end anyway', () => {
    const { items } = scan();
    expect(items.map((i) => i.key)).toEqual(['quillbase.example', 'pagewell.example']);
    expect(items[0]).toMatchObject({ msgId: '1', date: 9, text: 'Subject: Hi [you], your draft was saved\nSee [link] now' });
  });

  it('respects the cap', () => {
    const { ranked } = scan();
    const agg = new Aggregator(makeLinkContext('alderbrook.example', [ME]));
    for (let i = 0; i < 30; i++) agg.add(msg({ from: { name: `S${i}`, address: `a@s${i}.example` }, subject: 'Welcome to S' }), { text: '', orderMarkup: false });
    expect(agg.nanoItems(rank(agg.accountsOut()), 10)).toHaveLength(10);
    expect(ranked.length).toBeGreaterThan(0);
  });
});

describe('labelling a scan (T18)', () => {
  const fakeNano = (answer: (id: string, text: string) => string | Error, timings: Timing[]) => ({
    async classify(id: string, _d: string, text: string) {
      const a = answer(id, text);
      if (a instanceof Error) throw a;
      const { parseLabel } = await import('../../packages/core/contract.ts');
      const label = parseLabel(a, text);
      timings.push({ id, ms: 100 + timings.length, valid: label !== null });
      return label;
    },
  });

  it('promotes a maybe account with a quoted on-device label, and records U2 numbers', async () => {
    const { ranked, items } = scan();
    expect(ranked.find((a) => a.key === 'quillbase.example')?.section).toBe('main');
    expect(ranked.find((a) => a.key === 'pagewell.example')?.section).toBe('maybe');
    const timings: Timing[] = [];
    const nano = fakeNano((_id, text) => JSON.stringify(text.includes('draft')
      ? { isAccount: true, type: 'work', holds: 'documents', quote: 'your draft was saved' }
      : { isAccount: true, type: 'subscription', holds: 'nothing-seen', quote: 'Top stories' }), timings);
    let last: Parameters<Parameters<typeof labelAccounts>[4]>[1] | null = null;
    const out = await labelAccounts(items, ranked, nano, timings, (_a, s) => { last = s; });
    const q = out.find((a) => a.key === 'quillbase.example')!;
    expect(q.bucket).toBe('work');
    expect(q.work).toMatchObject({ tier: 'likely', source: 'on_device', quote: 'your draft was saved', date: 9 });
    expect(out.find((a) => a.key === 'pagewell.example')).toMatchObject({ section: 'main', exists: { source: 'on_device', tier: 'likely' } });
    expect(last).toMatchObject({ total: 2, done: 2, labelled: 2, invalid: 0, errors: 0, stopped: null, first50: { n: 2, medianMs: 101, invalidPct: 0 } });
  });

  it('stops everything if an answer left the device, and counts other errors', async () => {
    const { ranked, items } = scan();
    const timings: Timing[] = [];
    let stats: { stopped: string | null; errors: number } | null = null;
    await labelAccounts(items, ranked, fakeNano(() => new Error('left the device: in_cloud'), timings), timings, (_a, s) => { stats = s; });
    expect(stats).toMatchObject({ stopped: 'left the device: in_cloud' });
    await labelAccounts(items, ranked, fakeNano(() => new Error('aborted'), timings), timings, (_a, s) => { stats = s; });
    expect(stats).toMatchObject({ stopped: null, errors: 2 });
  });

  it('computes a median', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(3);
    expect(median([])).toBe(0);
  });
});
