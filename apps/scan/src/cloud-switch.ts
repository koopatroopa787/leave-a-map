// apps/scan/src/cloud-switch.ts: whether the cloud lookup (lane 3) is switched on for this build.
// The same VITE_CLOUD_LOOKUP=paid-tier-on that turns it on in the consent window (see
// apps/cloud/src/consent.ts). While it's off, the scan page doesn't offer the lookup at all, so it
// never promises something the other site will refuse. Local development always has it on.
export const CLOUD_LOOKUP_ON: boolean = import.meta.env.DEV || import.meta.env.VITE_CLOUD_LOOKUP === 'paid-tier-on';
