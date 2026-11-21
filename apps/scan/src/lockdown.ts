// apps/scan/src/lockdown.ts: must be the first import in main.tsx.
// CSP did not stop WebRTC in our test, so the constructors are removed before other code runs.
// T25 found that a same-origin about:blank frame brings a fresh RTCPeerConnection (frame-src
// 'none' doesn't cover about:blank, and Chrome ignores CSP `webrtc 'block'`), so this page also
// refuses to create frames, and only opens windows on other sites. The CSP's Trusted Types rule
// (`trusted-types 'none'`) closes the HTML-string routes (innerHTML, DOMParser, document.write).
for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel']) {
  try { delete (globalThis as any)[name]; } catch { /* non-configurable: the capture test (T25) still applies */ }
}

/**
 * The page's own record of everything that could leave it, for the privacy receipt (T26).
 * Outbound kinds: `resource` (something loaded from another origin) and `blocked` (an attempt the
 * CSP or lockdown stopped). `handoff` and `answers` are the consent-window exchange. `local` notes
 * work that stayed on this device. The log itself never leaves the page.
 */
export type EgressEvent = { at: string; kind: 'blocked' | 'resource' | 'handoff' | 'answers' | 'local'; detail: string; domains?: string[] };
export const egressLog: EgressEvent[] = [];
const listeners = new Set<() => void>();
export const onEgress = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const add = (kind: EgressEvent['kind'], detail: string, domains?: string[]) => {
  egressLog.push({ at: new Date().toISOString(), kind, detail, ...(domains ? { domains } : {}) });
  for (const fn of listeners) fn();
};
/** Outbound attempts only (U4 counts these). */
export const outboundCount = () => egressLog.filter((e) => e.kind === 'blocked' || e.kind === 'resource').length;

// Stays local. Never add report-uri or report-to: the browser would send those reports out.
addEventListener('securitypolicyviolation', (e) => add('blocked', `${e.effectiveDirective} ${e.blockedURI}`));

new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (new URL(entry.name).origin !== location.origin) add('resource', entry.name);
  }
}).observe({ type: 'resource', buffered: true });

// No frames of any kind: each would be a fresh window with its own WebRTC.
const FRAME_TAGS = new Set(['iframe', 'frame', 'frameset', 'object', 'embed', 'portal', 'fencedframe']);
const refuse = (what: string) => {
  add('blocked', what);
  throw new DOMException(`${what} is disabled on this page`, 'NotSupportedError');
};
const createElement = Document.prototype.createElement;
Document.prototype.createElement = function (this: Document, tag: string, options?: ElementCreationOptions) {
  if (FRAME_TAGS.has(String(tag).toLowerCase())) refuse(`createElement(${tag})`);
  return createElement.call(this, tag, options);
} as typeof Document.prototype.createElement;
const createElementNS = Document.prototype.createElementNS;
Document.prototype.createElementNS = function (this: Document, ns: string | null, name: string, options?: ElementCreationOptions) {
  if (FRAME_TAGS.has(String(name).split(':').pop()!.toLowerCase())) refuse(`createElementNS(${name})`);
  return createElementNS.call(this, ns, name, options as never);
} as typeof Document.prototype.createElementNS;

// window.open only for other sites (the consent window). A same-origin or about:blank window
// would hand back a fresh window with WebRTC in it.
const open = window.open;
window.open = function (url?: string | URL, target?: string, features?: string) {
  let u: URL | null = null;
  try { u = new URL(String(url ?? ''), location.href); } catch { /* refused below */ }
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:') || u.origin === location.origin) refuse(`window.open(${String(url ?? '')})`);
  return open.call(window, url, target, features);
};

// Trusted Types (CSP: require-trusted-types-for 'script'; trusted-types default). The only policy
// allows same-origin script URLs (the scan worker) and defines nothing for HTML or script text, so
// innerHTML, DOMParser, document.write and srcdoc stay blocked.
const tt = (globalThis as { trustedTypes?: { createPolicy(n: string, r: object): unknown } }).trustedTypes;
try {
  tt?.createPolicy('default', {
    createScriptURL: (url: string) => {
      const u = new URL(url, location.href);
      if (u.origin === location.origin) return u.href;
      add('blocked', `script URL ${u.origin}`);
      return null;
    },
  });
} catch { /* already created */ }

export const logHandoff = (domains: string[]) =>
  add('handoff', `${domains.length} web address${domains.length === 1 ? '' : 'es'} shown in the consent window`, [...domains]);
export const logAnswers = (detail: string, domains?: string[]) => add('answers', detail, domains);
export const logLocal = (detail: string) => add('local', detail);
