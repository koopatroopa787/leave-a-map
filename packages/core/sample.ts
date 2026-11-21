// packages/core/sample.ts: settings for the bundled sample mailbox (fixtures/sample.example.mbox).
// A fictional student; used by "Try the sample" and by the golden test.
import type { ScanSettings } from './types.ts';

export const SAMPLE_SETTINGS: ScanSettings = {
  schoolDomain: 'alderbrook.example',
  ownAddresses: ['jordan.reyes@alderbrook.example', 'jreyes@alderbrook.example'],
  shutoffDate: '2027-03-31',
};
