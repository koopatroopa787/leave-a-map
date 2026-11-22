// apps/scan/src/cloud-switch.ts: whether the cloud lookup (lane 3) is switched on for this build.
// The same VITE_CLOUD_LOOKUP switch the consent window reads (see packages/core/cloud-tier.ts):
// paid-tier-on or free-tier-on turns it on. While it's off, the scan page doesn't offer the lookup
// at all, so it never promises something the other site will refuse. Local development always has it on.
import { cloudTier } from '../../../packages/core/cloud-tier.ts';

export const CLOUD_LOOKUP_ON: boolean = cloudTier(import.meta.env.VITE_CLOUD_LOOKUP, import.meta.env.DEV) !== 'off';
