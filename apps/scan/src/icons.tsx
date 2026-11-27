// Small inline SVGs. Built as elements by Preact (no HTML strings), so they pass Trusted Types.
// All decorative: aria-hidden, the text next to them carries the meaning.

const svg = { 'aria-hidden': 'true' as const, focusable: 'false' as const, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const, viewBox: '0 0 24 24' };

export const Mark = () => (
  <svg {...svg} viewBox="0 0 32 32" stroke-width={4}>
    <path class="m-line" d="M4 26 C 12 26, 10 6, 18 6 S 28 14, 28 6" />
    <circle cx="4" cy="26" r="3" class="m-stn" stroke-width={2.5} />
    <circle cx="28" cy="6" r="3" class="m-stn" stroke-width={2.5} />
  </svg>
);
export const Lock = () => <svg {...svg}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
export const Upload = () => <svg {...svg}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>;
export const Sliders = () => <svg {...svg}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
export const Check = () => <svg {...svg} stroke-width={3.5}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
