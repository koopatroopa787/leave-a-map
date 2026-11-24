// apps/scan/src/sample.ts: "Try the sample". The mailboxes are bundled into this lazily loaded chunk,
// because the scan page can't fetch anything (connect-src 'none'). Loaded only on click.
import raw from '../../../fixtures/sample.example.mbox?raw';
import estate from '../../../fixtures/estate.example.mbox?raw';
import type { ScanSettings } from '../../../packages/core/types.ts';
import type { Mode } from './mode.ts';
import { SAMPLE_SETTINGS } from '../../../packages/core/sample.ts';

// A fictional person who has died; see tools/make-estate-mbox.mjs. No date is needed in this mode.
const ESTATE_SETTINGS: ScanSettings = { schoolDomain: 'mailbox.example', ownAddresses: ['robin.hale@mailbox.example'], shutoffDate: '' };

export const sample = (mode: Mode): [File, ScanSettings] => mode === 'loss'
  ? [new File([estate], 'estate.example.mbox', { type: 'application/mbox' }), ESTATE_SETTINGS]
  : [new File([raw], 'sample.example.mbox', { type: 'application/mbox' }), SAMPLE_SETTINGS];
