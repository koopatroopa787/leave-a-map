import { describe, expect, it, vi } from 'vitest';

// The classifier only needs these two names from the SDK; the stub keeps the test offline.
vi.mock('firebase/app', () => ({ initializeApp: vi.fn() }));
vi.mock('firebase/ai', () => ({ InferenceSource: { ON_DEVICE: 'on_device', IN_CLOUD: 'in_cloud' }, getAI: vi.fn(),
  getGenerativeModel: vi.fn(), GoogleAIBackend: class {}, InferenceMode: { ONLY_ON_DEVICE: 'only_on_device' } }));

const { NanoClassifier, probeNano, startNano } = await import('../../apps/scan/src/nano.ts');

const reply = (text: string, inferenceSource = 'on_device', ms = 0) => () =>
  new Promise<{ response: { text(): string; inferenceSource: string } }>((r) => setTimeout(() => r({ response: { text: () => text, inferenceSource } }), ms));

describe('Nano classifier (T17)', () => {
  it('refuses to start without the Prompt API (guard for firebase-js-sdk#10635)', async () => {
    expect(await probeNano()).toBe('unavailable');
    await expect(startNano(() => {}, () => {})).rejects.toThrow('nano-unavailable');
  });

  it('throws if an answer did not come from the device', async () => {
    const c = new NanoClassifier({ generateContent: reply('{}', 'in_cloud') }, () => {});
    await expect(c.classify('a', 'x.example', 'text')).rejects.toThrow('left the device: in_cloud');
  });

  it('returns null for an off-schema answer and logs it as invalid', async () => {
    const logs: { valid: boolean }[] = [];
    const c = new NanoClassifier({ generateContent: reply('{"isAccount":true,"type":"bank","holds":"payment","quote":""}') }, (e) => logs.push(e));
    expect(await c.classify('a', 'x.example', 'text')).toBeNull();
    expect(logs[0]).toMatchObject({ id: 'a', source: 'on_device', valid: false });
  });

  it('runs one prompt at a time, in order, even if one fails', async () => {
    const order: string[] = [];
    let n = 0;
    const model = { generateContent: (p: string) => {
      const i = n++;
      order.push(`start ${i}`);
      return new Promise<{ response: { text(): string; inferenceSource: string } }>((resolve, reject) => setTimeout(() => {
        order.push(`end ${i}`);
        if (i === 1) reject(new Error('boom'));
        else resolve({ response: { text: () => JSON.stringify({ isAccount: true, type: 'work', holds: 'documents', quote: p.includes('saved') ? 'saved' : '' }), inferenceSource: 'on_device' } });
      }, 5 - i));
    } };
    const c = new NanoClassifier(model, () => {});
    const results = await Promise.allSettled([c.classify('a', 'x.example', 'saved'), c.classify('b', 'x.example', 'x'), c.classify('c', 'x.example', 'y')]);
    expect(order).toEqual(['start 0', 'end 0', 'start 1', 'end 1', 'start 2', 'end 2']);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect((results[0] as PromiseFulfilledResult<{ quote: string }>).value.quote).toBe('saved');
  });
});
