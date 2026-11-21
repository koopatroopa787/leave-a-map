// apps/scan/src/lockdown.ts: must be the first import in main.tsx.
// CSP did not stop WebRTC in our test, so the constructors are removed before other code runs.
for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel']) {
  try { delete (globalThis as any)[name]; } catch { /* non-configurable: the capture test (T25) still applies */ }
}

export type EgressEvent = { at: string; kind: 'blocked' | 'resource' | 'handoff'; detail: string };
export const egressLog: EgressEvent[] = [];
const add = (kind: EgressEvent['kind'], detail: string) =>
  egressLog.push({ at: new Date().toISOString(), kind, detail });

// Stays local. Never add report-uri or report-to: the browser would send those reports out.
addEventListener('securitypolicyviolation', (e) => add('blocked', `${e.effectiveDirective} ${e.blockedURI}`));

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (new URL(entry.name).origin !== location.origin) add('resource', entry.name);
  }
}).observe({ type: 'resource', buffered: true });

export const logHandoff = (count: number) => add('handoff', `${count} sender domains to the consent window`);
