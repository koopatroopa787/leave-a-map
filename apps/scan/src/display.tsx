// The Display menu: text size, colours, contrast, animation and letter spacing, chosen by the person
// and kept in this browser only (localStorage, like the checklist). "Match device" follows the
// operating system's own settings. Styles read the data-* attributes and .motion-ok on <html>.
import { useEffect, useState } from 'preact/hooks';
import { canTranslate, LANGUAGES, savedLanguage, setLanguage } from './translate.ts';
import { noteWords, type NoteState } from './language-notes.ts';
import { Mark, Sliders } from './icons.tsx';

import { cleanDisplay, DEFAULT, type Display } from './display-values.ts';

export type { Display };
const KEY = 'leave-a-map:display';
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export function loadDisplay(): Display {
  try { return cleanDisplay(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return DEFAULT; }
}

export function applyDisplay(d: Display) {
  const root = document.documentElement;
  root.dataset.text = d.text; root.dataset.theme = d.theme; root.dataset.contrast = d.contrast; root.dataset.spacing = d.spacing;
  root.classList.toggle('motion-ok', d.motion === 'on' || (d.motion === 'system' && !reduce.matches));
}
reduce.addEventListener('change', () => applyDisplay(loadDisplay()));

type Opt<K extends keyof Display> = [Display[K], string][];
const GROUPS: { [K in keyof Display]: { legend: string; opts: Opt<K> } } = {
  text: { legend: 'Text size', opts: [['m', 'Normal'], ['l', 'Large'], ['xl', 'Larger']] },
  theme: { legend: 'Colours', opts: [['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']] },
  contrast: { legend: 'Contrast', opts: [['normal', 'Normal'], ['more', 'High']] },
  motion: { legend: 'Animation', opts: [['system', 'Match device'], ['on', 'On'], ['off', 'Off']] },
  spacing: { legend: 'Letter spacing', opts: [['normal', 'Normal'], ['wide', 'Wider']] },
};

export function DisplayMenu() {
  const [d, setD] = useState(loadDisplay);
  const set = <K extends keyof Display>(k: K, v: Display[K]) => {
    // From the latest state, not this render's copy, so two changes in one tick both stick.
    setD((prev) => {
      const next = { ...prev, [k]: v };
      applyDisplay(next);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: still applies until reload */ }
      return next;
    });
  };
  return (
    <>
      <button type="button" class="display-btn secondary" popovertarget="display-panel"><Sliders /> Display</button>
      <div id="display-panel" class="display-panel" popover="auto" role="dialog" aria-labelledby="display-title">
        <h2 id="display-title">Display</h2>
        <p>Make the page easier to read. Saved in this browser only.</p>
        {(Object.keys(GROUPS) as (keyof Display)[]).map((k) => (
          <fieldset class="seg" key={k}>
            <legend>{GROUPS[k].legend}</legend>
            <div class="seg-row">
              {(GROUPS[k].opts as [string, string][]).map(([v, label]) => (
                <label key={v}>
                  <input type="radio" name={`display-${k}`} checked={d[k] === v} onChange={() => set(k, v as never)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="button" popovertarget="display-panel" popovertargetaction="hide">Done</button>
      </div>
    </>
  );
}

/** The note that opens under the picker, in the picked language (language-notes.ts). */
type Note = { code: string; state: NoteState; pct?: number } | null;

/** Language: the page translated on this device by the browser's built-in AI (translate.ts). */
export function LanguagePicker() {
  const [lang, setLang] = useState(savedLanguage);
  const [note, setNote] = useState<Note>(null);
  // A language picked earlier comes back on its own when the browser already has it.
  useEffect(() => {
    if (lang === 'en') return;
    void setLanguage(lang).then((r) => { if (r !== 'done') setLang('en'); });
  }, []);
  const pick = async (code: string) => {
    setLang(code);
    if (code === 'en') { setNote(null); await setLanguage('en'); return; }
    if (!canTranslate()) { setNote({ code, state: 'unsupported' }); setLang('en'); return; }
    setNote({ code, state: 'working' });
    const r = await setLanguage(code, (pct) => setNote((n) => n?.code === code ? { code, state: 'working', pct } : n));
    if (r !== 'done') setLang('en');
    setNote((n) => n?.code === code ? { code, state: r === 'done' ? 'done' : r } : n);
  };
  const w = note && noteWords(note.code);
  return (
    <div class="lang-pick">
      <select id="lang-select" aria-label="Language" value={lang} onChange={(e) => void pick(e.currentTarget.value)} aria-describedby="lang-note">
        {LANGUAGES.map(([c, name]) => <option key={c} value={c} lang={c}>{name}</option>)}
      </select>
      <div id="lang-note" class="lang-note" role="status" lang={note?.code} hidden={!note}>
        {note && w && <>
          <p>{w.about}</p>
          <p>{w.privacy}</p>
          <p class="lang-state">{w[note.state]}{note.state === 'working' && note.pct !== undefined ? ` ${note.pct}%` : ''}</p>
          <button type="button" class="lang-ok" onClick={() => setNote(null)}>{w.ok}</button>
        </>}
      </div>
    </div>
  );
}

/** Wordmark, language and the Display menu, at the top of every main screen. */
export const TopBar = () => (
  <div class="topbar"><p class="wordmark"><Mark /> Leave a Map</p><div class="topbar-tools"><LanguagePicker /><DisplayMenu /></div></div>
);

/** Page footer: how it works, where the Display menu is, and the name spelled in dots (dots.tsx). */
export const SiteFoot = () => (
  <footer class="site-foot">
    <div class="foot-cols">
      <div>
        <p class="label">How it works</p>
        <ul class="plain-list"><li>Reads the .mbox file on this device</li><li>Can't send anything over the network</li><li>Keeps your ticks in this browser only</li></ul>
      </div>
      <div>
        <p class="label">Easier to read</p>
        <p>Display, at the top of the page: bigger text, light colours, more contrast, no animation.</p>
      </div>
    </div>
    <div class="foot-dots" data-dots="word" aria-hidden="true" />
    <p class="foot-row"><span>Leave a Map</span><span>Runs in your browser</span></p>
  </footer>
);
