// apps/scan/src/translate.ts: shows the page in another language with the browser's built-in,
// on-device translator (Chrome's Translator API). The language model is downloaded by the browser
// itself, once; this page never makes a request (its CSP still says connect-src 'none'), and no
// text leaves the device. The page is written in English; each visible text node is translated in
// place, and new or changed text (Preact re-rendering) is translated as it appears. English puts
// every original back. Names, web addresses, quotes from emails, file names and anything marked
// translate="no" stay as they are.
type TranslatorLike = { translate(s: string): Promise<string>; destroy?(): void };
type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<TranslatorLike>;
};

/** Languages the on-device translator offers, by their own names. Left-to-right scripts only for now. */
export const LANGUAGES: [code: string, name: string][] = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['mr', 'मराठी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['kn', 'ಕನ್ನಡ'],
  ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['zh', '中文'], ['ja', '日本語'],
];
const CODES = new Set(LANGUAGES.map(([c]) => c));
const KEY = 'leave-a-map:language';

const api = (): TranslatorApi | null => (globalThis as { Translator?: TranslatorApi }).Translator ?? null;
export const canTranslate = () => api() !== null;

export function savedLanguage(): string {
  try { const v = localStorage.getItem(KEY) ?? 'en'; return CODES.has(v) ? v : 'en'; } catch { return 'en'; }
}

const SKIP = 'script,style,textarea,input,select,option,code,q,svg,[translate="no"],.keep-words,.domain,.drop-file,.wordmark,.hand-pct,.lang-pick';
const ATTRS = ['aria-label', 'placeholder', 'title'] as const;

let current = 'en';
let translator: TranslatorLike | null = null;
const cache = new Map<string, string>();
/** Each translated text node's English, and the translation we put there (to tell our writes from Preact's). */
const texts = new Map<Text, { en: string; shown: string }>();
const attrs = new Map<Element, Map<string, { en: string; shown: string }>>();
let observer: MutationObserver | null = null;

const worth = (s: string) => /\p{L}{2,}/u.test(s) && !/^[\w.+-]+@[\w.-]+$/.test(s.trim()) && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s.trim());
const skipped = (n: Node) => !!(n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest(SKIP);

async function tr(en: string): Promise<string> {
  const lead = en.match(/^\s*/)![0], trail = en.match(/\s*$/)![0], core = en.trim();
  let out = cache.get(core);
  if (out === undefined) { out = await translator!.translate(core); cache.set(core, out); }
  return lead + out + trail;
}

/** The first text node of a run of neighbouring text nodes (JSX splits "Contact {name}'s team" into three). */
function head(n: Text): Text {
  let h = n;
  while (h.previousSibling?.nodeType === 3) h = h.previousSibling as Text;
  return h;
}

/**
 * Translate a whole run of neighbouring text nodes as one sentence: the translation goes in the
 * first node and the others are emptied, so word order can change between languages.
 */
async function doText(n: Text) {
  const first = head(n);
  if (skipped(first)) return;
  const run: Text[] = [];
  for (let x: Node | null = first; x?.nodeType === 3; x = x.nextSibling) run.push(x as Text);
  // Each node's English: what's there now, unless it's what we put there.
  const en = run.map((t) => { const k = texts.get(t); return k && t.data === k.shown ? k.en : t.data; });
  if (run.every((t, i) => texts.get(t)?.shown === t.data && texts.get(t)?.en === en[i])) return;
  const whole = en.join('');
  if (!worth(whole)) return;
  const lang = current;
  const shown = await tr(whole);
  if (lang !== current || run.some((t, i) => t.data !== en[i] && t.data !== texts.get(t)?.shown)) return; // changed meanwhile
  run.forEach((t, i) => {
    const out = i === 0 ? shown : '';
    texts.set(t, { en: en[i], shown: out });
    t.data = out;
  });
}

async function doAttrs(el: Element) {
  if (skipped(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !worth(v)) continue;
    const m = attrs.get(el) ?? new Map();
    if (m.get(a)?.shown === v) continue;
    const lang = current;
    const shown = await tr(v);
    if (lang !== current || el.getAttribute(a) !== v) continue;
    m.set(a, { en: v, shown }); attrs.set(el, m);
    el.setAttribute(a, shown);
  }
}

function collect(root: Node, out: { t: Text[]; e: Element[] }) {
  if (root.nodeType === 3) { out.t.push(root as Text); return; }
  if (root.nodeType !== 1 || skipped(root)) return;
  out.e.push(root as Element);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) out.t.push(n as Text); else out.e.push(n as Element);
  }
}

async function run(nodes: { t: Text[]; e: Element[] }, onProgress?: (done: number, of: number) => void) {
  const jobs: (() => Promise<void>)[] = [...nodes.t.map((t) => () => doText(t)), ...nodes.e.map((e) => () => doAttrs(e))];
  let done = 0;
  const total = jobs.length;
  const worker = async () => { for (let j = jobs.shift(); j; j = jobs.shift()) { try { await j(); } catch { /* leave it in English */ } onProgress?.(++done, total); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

function restore() {
  for (const [n, { en, shown }] of texts) if (n.isConnected && n.data === shown) n.data = en;
  for (const [el, m] of attrs) for (const [a, { en, shown }] of m) if (el.getAttribute(a) === shown) el.setAttribute(a, en);
  texts.clear(); attrs.clear();
}

export type LangResult = 'done' | 'unsupported' | 'unavailable' | 'failed';

/** Some browsers have the API but never answer. Give up after `ms` instead of waiting forever. */
const within = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);

/** Call from the picker's change event: a first download needs that click. */
/** onProgress gets how far along it is, 0 to 100, or nothing while it's getting started. */
export async function setLanguage(code: string, onProgress?: (pct?: number) => void): Promise<LangResult> {
  if (!CODES.has(code)) code = 'en';
  observer?.disconnect(); observer = null;
  restore(); translator?.destroy?.(); translator = null; cache.clear();
  current = code;
  try { localStorage.setItem(KEY, code); } catch { /* not saved */ }
  document.documentElement.lang = code;
  if (code === 'en') return 'done';
  const T = api();
  const back = () => { current = 'en'; document.documentElement.lang = 'en'; try { localStorage.setItem(KEY, 'en'); } catch { /* not saved */ } };
  if (!T) { back(); return 'unsupported'; }
  try {
    const opts = { sourceLanguage: 'en', targetLanguage: code };
    if (await within(T.availability(opts), 10_000) === 'unavailable') { back(); return 'unavailable'; }
    onProgress?.();
    translator = await within(T.create({ ...opts, monitor: (m) => m.addEventListener('downloadprogress', (e) => {
      const loaded = (e as Event & { loaded?: number }).loaded ?? 0;
      onProgress?.(Math.round(loaded * 50)); // the download is the first half
    }) }), 5 * 60_000);
    if (current !== code) return 'done';
    // Watch first, so text that appears while the page is being translated isn't missed.
    observer = new MutationObserver((list) => {
      const n = { t: [] as Text[], e: [] as Element[] };
      for (const r of list) {
        if (r.type === 'characterData') n.t.push(r.target as Text);
        else if (r.type === 'attributes') n.e.push(r.target as Element);
        else r.addedNodes.forEach((x) => collect(x, n));
      }
      void run(n);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    const nodes = { t: [] as Text[], e: [] as Element[] };
    collect(document.body, nodes);
    await run(nodes, (d, of) => onProgress?.(50 + Math.round((d / Math.max(of, 1)) * 50)));
    return 'done';
  } catch {
    observer?.disconnect(); observer = null;
    restore(); back();
    return 'failed';
  }
}
