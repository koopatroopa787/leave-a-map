// A dot-matrix picture drawn on a canvas: small squares in the accent colour, densest along three
// route lines and their stops, thinning out at the edges. It flickers a little, changes shape as
// you scroll (the routes gather into one big stop), and can grow out from the centre as `grow` goes
// from 0 to 1 (the scan screen). Decorative only: aria-hidden, and with motion off it draws one
// still frame. Text never sits on top of it.
import { useEffect, useRef } from 'preact/hooks';

type Props = { grow?: number; morph?: boolean; class?: string };

const CELL = 9;   // grid pitch in CSS px
const DOT = 6;    // square size in CSS px

// Route lines in a 0..1 box (x, y pairs), the same three lines as the old route art.
const ROUTES: number[][] = [
  [0, .88, .32, .88, .4, .78, .4, .3, .48, .2, 1, .2],
  [.1, .06, .3, .06, .4, .18, .4, .8, .48, .9, .72, .9, .8, .8, .8, .52],
  [0, .54, 1, .54],
];
const STOPS = [[.4, .54], [.4, .2], [.8, .54], [.4, .88]];

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Density 0..1 for the route picture (a) and the single big stop (b), at a point in the box. */
function density(u: number, v: number, aspect: number): [number, number] {
  let d = 9;
  for (const r of ROUTES) for (let i = 0; i + 3 < r.length; i += 2) d = Math.min(d, segDist(u * aspect, v, r[i] * aspect, r[i + 1], r[i + 2] * aspect, r[i + 3]));
  for (const [x, y] of STOPS) d = Math.min(d, Math.max(0, Math.hypot((u - x) * aspect, v - y) - .05));
  const a = Math.max(0, 1 - d / .16) ** 1.6;
  const ring = Math.abs(Math.hypot((u - .5) * aspect, v - .5) - .3);
  const b = Math.max(0, 1 - ring / .14) ** 1.4;
  return [a, b];
}

// Stable per-cell noise, so the picture doesn't jump between frames.
const hash = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

export function PixelField({ grow = 1, morph = false, class: cls = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const growRef = useRef(grow);
  growRef.current = grow;

  useEffect(() => {
    const cv = ref.current!;
    const cx = cv.getContext('2d');
    if (!cx) return;
    let cols = 0, rows = 0, A = new Float32Array(0), B = new Float32Array(0), N = new Float32Array(0);
    let colour = '#f97316', raf = 0, last = 0;
    const moving = () => document.documentElement.classList.contains('motion-ok');

    const layout = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.floor(r.width / CELL); rows = Math.floor(r.height / CELL);
      const aspect = r.width / Math.max(1, r.height);
      A = new Float32Array(cols * rows); B = new Float32Array(cols * rows); N = new Float32Array(cols * rows);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i, [a, b] = density((i + .5) / cols, (j + .5) / rows, aspect);
        A[k] = a; B[k] = b; N[k] = hash(i, j);
      }
      colour = getComputedStyle(cv).color || colour;
    };

    const draw = (t: number) => {
      const w = cols * CELL, h = rows * CELL, g = growRef.current, live = moving();
      const box = cv.getBoundingClientRect();
      // Scroll morph: 0 while the field is in view, 1 once it has scrolled most of the way out.
      const m = morph && live ? Math.max(0, Math.min(1, -box.top / Math.max(1, box.height * .8))) : 0;
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.fillStyle = colour;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i, n = N[k];
        let d = A[k] + (B[k] - A[k]) * m;
        if (g < 1) { const r = Math.hypot((i + .5) / cols - .5, ((j + .5) / rows - .5) * h / Math.max(1, w)); d *= Math.max(0, Math.min(1, (g * .75 - r) / .06)); }
        if (d <= 0) continue;   // flicker never lights a cell outside the shape
        const flicker = live ? .07 * Math.sin(t / 380 + n * 40) : 0;
        if (n > d + flicker) continue;
        cx.globalAlpha = Math.min(1, .3 + d * .8);
        cx.fillRect(i * CELL, j * CELL, DOT, DOT);
      }
      cx.globalAlpha = 1;
    };

    // ponytail: ~12 frames a second is enough for a dot-matrix flicker and keeps the CPU quiet.
    const loop = (t: number) => { if (t - last > 80) { last = t; draw(t); } raf = requestAnimationFrame(loop); };
    const start = () => { cancelAnimationFrame(raf); layout(); if (moving()) raf = requestAnimationFrame(loop); else draw(0); };
    start();
    const redraw = () => draw(0);
    cv.addEventListener('lam-redraw', redraw);
    const ro = new ResizeObserver(start); ro.observe(cv);
    // Redraw when the Display menu changes the theme or motion.
    const mo = new MutationObserver(start); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-contrast'] });
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('lam-redraw', redraw); ro.disconnect(); mo.disconnect(); };
  }, [morph]);

  // With motion off there is no loop, so redraw when `grow` changes.
  useEffect(() => { if (!document.documentElement.classList.contains('motion-ok')) ref.current?.dispatchEvent(new Event('lam-redraw')); }, [grow]);

  return <canvas ref={ref} class={`pixel-field ${cls}`} aria-hidden="true" />;
}
