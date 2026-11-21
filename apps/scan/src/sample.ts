// apps/scan/src/sample.ts: "Try the sample". The mailbox is bundled into this lazily loaded chunk,
// because the scan page can't fetch anything (connect-src 'none'). Loaded only on click.
import raw from '../../../fixtures/sample.example.mbox?raw';
export { SAMPLE_SETTINGS } from '../../../packages/core/sample.ts';

export const sampleFile = () => new File([raw], 'sample.example.mbox', { type: 'application/mbox' });
