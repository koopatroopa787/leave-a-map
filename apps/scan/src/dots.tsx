// One dot-matrix canvas, fixed to the window behind the page (the page sits on top, so text and
// cards are never covered). Sections ask for a shape with a data-dots attribute:
//   hero    the big picture: an envelope, a key, a padlock, a map pin and our route mark, in turn,
//           dissolving into each other; it shrinks into a ball as the hero scrolls away
//   side    the same picture, small, in the empty space beside the content (wide screens only)
//   loader  the picture at the centre, growing with data-progress (0..1)
//   word    "LEAVE A MAP" spelled in dots across the window
// Shapes are drawn into a tiny canvas (one pixel per dot), blurred, then read back: brightness
// becomes dot strength. Each visible section is weighted by how much of it is on screen, so
// scrolling morphs one shape into the next. A row of ruler ticks on the right shows the scroll
// position. Decorative only: aria-hidden. With motion off the shapes hold still and only redraw
// when the page scrolls or changes.
import { useEffect, useRef } from 'preact/hooks';

const CELL = 6;   // grid pitch, CSS px
const DOT = 4;    // dot size, CSS px
const HOLD = 4200, FADE = 1100;   // each picture shows for HOLD ms, then dissolves over FADE ms

type Ctx = CanvasRenderingContext2D;
type Pic = (c: Ctx, x: number, y: number, s: number) => void;

/** A soft light from the top left, so the shapes read as objects rather than flat stamps. */
const light = (c: Ctx, x: number, y: number, s: number) => {
  const g = c.createRadialGradient(x - s * .25, y - s * .3, s * .05, x, y, s * .75);
  g.addColorStop(0, '#fff'); g.addColorStop(.55, '#9a9a9a'); g.addColorStop(1, '#2e2e2e');
  return g;
};
const cut = (c: Ctx, w: number) => { c.strokeStyle = '#000'; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; };

const PICS: Pic[] = [
  // Envelope
  (c, x, y, s) => {
    const w = s * .95, h = s * .62;
    c.fillStyle = light(c, x, y, s); c.fillRect(x - w / 2, y - h / 2, w, h);
    cut(c, s * .045); c.beginPath(); c.moveTo(x - w / 2, y - h / 2); c.lineTo(x, y + h * .08); c.lineTo(x + w / 2, y - h / 2); c.stroke();
  },
  // Key
  (c, x, y, s) => {
    c.fillStyle = light(c, x, y, s);
    c.beginPath(); c.arc(x - s * .26, y, s * .24, 0, 7); c.fill();
    c.fillRect(x - s * .1, y - s * .06, s * .58, s * .12);
    c.fillRect(x + s * .3, y + s * .06, s * .07, s * .14); c.fillRect(x + s * .42, y + s * .06, s * .06, s * .1);
    c.fillStyle = '#000'; c.beginPath(); c.arc(x - s * .3, y, s * .08, 0, 7); c.fill();
  },
  // Padlock
  (c, x, y, s) => {
    c.strokeStyle = '#c8c8c8'; c.lineWidth = s * .1; c.beginPath(); c.arc(x, y - s * .12, s * .22, Math.PI, 0); c.lineTo(x + s * .22, y + s * .02); c.moveTo(x - s * .22, y - s * .12); c.lineTo(x - s * .22, y + s * .02); c.stroke();
    c.fillStyle = light(c, x, y + s * .15, s); c.fillRect(x - s * .36, y, s * .72, s * .52);
    c.fillStyle = '#000'; c.beginPath(); c.arc(x, y + s * .2, s * .07, 0, 7); c.fill(); c.fillRect(x - s * .025, y + s * .2, s * .05, s * .16);
  },
  // Map pin
  (c, x, y, s) => {
    c.fillStyle = light(c, x, y - s * .1, s);
    c.beginPath(); c.arc(x, y - s * .12, s * .3, Math.PI * .8, Math.PI * .2); c.lineTo(x, y + s * .48); c.closePath(); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(x, y - s * .12, s * .12, 0, 7); c.fill();
  },
  // The route mark from the wordmark
  (c, x, y, s) => {
    const u = s / 32, X = (v: number) => x + (v - 16) * u, Y = (v: number) => y + (v - 16) * u;
    c.strokeStyle = light(c, x, y, s); c.lineWidth = s * .14; c.lineCap = 'round';
    c.beginPath(); c.moveTo(X(4), Y(26)); c.bezierCurveTo(X(12), Y(26), X(10), Y(6), X(18), Y(6)); c.bezierCurveTo(X(26), Y(6), X(28), Y(14), X(28), Y(6)); c.stroke();
    c.fillStyle = '#fff'; for (const [a, b] of [[4, 26], [28, 6]]) { c.beginPath(); c.arc(X(a), Y(b), s * .13, 0, 7); c.fill(); }
  },
];

const ball: Pic = (c, x, y, s) => { c.fillStyle = light(c, x, y, s); c.beginPath(); c.arc(x, y, s * .42, 0, 7); c.fill(); };

/** The current picture, dissolving into the next near the end of its turn. */
function picture(c: Ctx, t: number, x: number, y: number, s: number) {
  const k = Math.floor(t / HOLD), f = Math.max(0, (t % HOLD - (HOLD - FADE)) / FADE);
  c.globalAlpha = 1 - f; PICS[k % PICS.length](c, x, y, s);
  if (f > 0) { c.globalAlpha = f; PICS[(k + 1) % PICS.length](c, x, y, s); }
  c.globalAlpha = 1;
}

const hash = (i: number, j: number) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => v * v * (3 - 2 * v);

export function Dots() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!, cx = cv.getContext('2d')!;
    const grid = document.createElement('canvas'), gx = grid.getContext('2d', { willReadFrequently: true })!;
    const one = document.createElement('canvas'), ox = one.getContext('2d')!;
    let W = 0, H = 0, cols = 0, rows = 0, N = new Float32Array(0), L = new Float32Array(0), raf = 0, last = 0, sig = '';
    let dot = '#f97316', tick = '#888';
    const live = () => document.documentElement.classList.contains('motion-ok');

    const layout = () => {
      W = innerWidth; H = innerHeight;
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
      grid.width = one.width = cols; grid.height = one.height = rows;
      N = new Float32Array(cols * rows); L = new Float32Array(cols * rows);
      // N: per-dot noise for the threshold. L: a slow, blotchy field so shapes look grown, not stamped.
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        N[j * cols + i] = hash(i, j);
        L[j * cols + i] = .5 + .25 * Math.sin(i * .23 + Math.sin(j * .11) * 2.2) + .25 * Math.cos(j * .19 + Math.sin(i * .09) * 2.6);
      }
      const cs = getComputedStyle(cv);
      dot = cs.color || dot; tick = cs.getPropertyValue('--line-strong').trim() || tick;
      sig = '';
    };

    // Draw one section's shape into `one` (grid scale), then add it to the grid, weighted.
    const add = (w: number, draw: (c: Ctx) => void) => {
      if (w <= 0.01) return;
      ox.setTransform(1, 0, 0, 1, 0, 0); ox.clearRect(0, 0, cols, rows);
      ox.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0); draw(ox);
      gx.globalAlpha = w; gx.drawImage(one, 0, 0); gx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      if (!cols || !rows) return; // zero-size window (e.g. a hidden iframe): nothing to draw
      const moving = live(), t = moving ? now : 0;
      const els = [...document.querySelectorAll<HTMLElement>('[data-dots]')];
      const rects = els.map((e) => e.getBoundingClientRect());
      const key = `${W}x${H}:${scrollY}:${els.map((e, i) => `${e.dataset.dots}${e.dataset.progress ?? ''}@${Math.round(rects[i].top)},${Math.round(rects[i].height)}`).join('|')}`;
      if (!moving && key === sig) return;   // nothing moved, nothing to redraw
      sig = key;

      gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalCompositeOperation = 'source-over'; gx.clearRect(0, 0, cols, rows);
      gx.filter = 'blur(2px)'; gx.globalCompositeOperation = 'lighter';
      const seen = (r: DOMRect) => clamp((Math.min(r.bottom, H) - Math.max(r.top, 0)) / Math.max(1, Math.min(r.height, H)));
      // Only the 'side' section nearest the middle of the window gets the small shape.
      let side = -1, best = 0;
      els.forEach((e, i) => { if (e.dataset.dots === 'side') { const v = seen(rects[i]); if (v > best) { best = v; side = i; } } });

      // During the opening only the loader shows.
      const intro = document.documentElement.classList.contains('is-intro');
      els.forEach((e, i) => {
        const r = rects[i], v = ease(seen(r)), kind = e.dataset.dots;
        if (intro && kind !== 'loader') return;
        if (kind === 'hero') {
          // As the hero scrolls up, the picture shrinks and rounds into a ball.
          const p = clamp(-r.top / Math.max(1, r.height * .7)), wide = W >= 900;
          // On wide screens the pictures fit the band between the labels and the lede, so they never sit
          // behind text. One picture is capped by the band's height and left most of its width empty, so
          // the band holds two or three pictures side by side instead, each on its own beat.
          const tt = e.querySelector('.hero-text')?.getBoundingClientRect().top ?? r.bottom, top = r.top + 56, band = tt - 32 - top;
          const n = wide ? (r.width >= 1100 ? 3 : 2) : 1;
          const y = (wide ? top + band / 2 : r.top + r.height * .36) + p * r.height * .25;
          const s = (wide ? Math.min((r.width / n) * .9, band) : Math.min(r.width * .9, r.height * .5)) * (1 - p * .55);
          for (let q = 0; q < n; q++) {
            const x = r.left + r.width * (q + .5) / n;
            // Offsets of 4/3 of a turn keep neighbours on different pictures and stagger their fades.
            const tq = t + q * HOLD * 4 / 3;
            add(v * (1 - p * .6), (c) => picture(c, tq, x, y, s));
            add(v * p * .9, (c) => ball(c, x, y, s));
          }
        } else if (kind === 'side' && i === side) {
          // Room to the right of the 46rem column; skip it when there isn't any.
          const col = r.left + Math.min(r.width, 736);
          const room = W - col - 48;
          if (room < 170) return;
          const s = Math.min(room * .8, 340);
          add(v, (c) => picture(c, t, col + room / 2, Math.max(r.top + s * .7, Math.min(H * .45, r.bottom - s * .7)), s));
        } else if (kind === 'loader') {
          const g = clamp(Number(e.dataset.progress ?? 0));
          add(1, (c) => picture(c, t, r.left + r.width / 2, r.top + r.height / 2, Math.min(r.width, r.height * 1.4) * (.2 + .8 * g)));
        } else if (kind === 'word') {
          add(v, (c) => {
            const font = (px: number) => `800 ${px}px "Plus Jakarta Sans Variable", system-ui, sans-serif`;
            const lines = W < 760 ? ['LEAVE', 'A MAP'] : ['LEAVE A MAP'];
            c.font = font(100);
            const m = Math.max(...lines.map((l) => c.measureText(l).width));
            const size = Math.min(100 * W * .92 / m, r.height / lines.length);
            c.font = font(size); c.textAlign = 'center'; c.textBaseline = 'middle';
            const g = c.createLinearGradient(0, r.top, 0, r.bottom); g.addColorStop(0, '#fff'); g.addColorStop(1, '#777'); c.fillStyle = g;
            lines.forEach((l, q) => c.fillText(l, W / 2, r.top + r.height / 2 + (q - (lines.length - 1) / 2) * size * .92));
          });
        }
      });

      const px = gx.getImageData(0, 0, cols, rows).data;
      cx.clearRect(0, 0, W, H);
      cx.fillStyle = dot;
      const flick = moving ? t / 420 : 0;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = j * cols + i, d = (px[k * 4] * px[k * 4 + 3] / 65025) * (.45 + .55 * L[k]);   // brightness x coverage
        if (d < .03) continue;
        const n = N[k], f = moving ? .08 * Math.sin(flick + n * 50) : 0;
        if (n > d * 1.6 - .1 + f) continue;
        cx.globalAlpha = .22 + .78 * Math.min(1, d * 1.3);
        cx.fillRect(i * CELL, j * CELL, DOT, DOT);
      }
      cx.globalAlpha = 1;

      // Ruler: ticks on the right edge, the ones near the scroll position longer and orange.
      if (W >= 700) {
        const max = Math.max(1, document.documentElement.scrollHeight - H), at = scrollY / max;
        const n = 40, top = H * .3, gap = (H * .4) / (n - 1), x = W - 14;
        for (let q = 0; q < n; q++) {
          const near = Math.max(0, 1 - Math.abs(q / (n - 1) - at) * 12);
          cx.fillStyle = near > .5 ? dot : tick; cx.globalAlpha = .5 + .5 * near;
          const len = 6 + 12 * near; cx.fillRect(x - len, top + q * gap, len, 1);
        }
        cx.globalAlpha = 1;
      }
    };

    // ponytail: ~12 frames a second is plenty for a flickering dot matrix and keeps the CPU quiet.
    const loop = (now: number) => { raf = requestAnimationFrame(loop); if (now - last >= 80) { last = now; frame(now); } };
    layout(); raf = requestAnimationFrame(loop);
    const resize = () => layout();
    addEventListener('resize', resize);
    // The Display menu can change the theme (dot colour) or the motion setting.
    const mo = new MutationObserver(layout); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-contrast'] });
    document.fonts?.ready.then(() => { sig = ''; });
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); mo.disconnect(); };
  }, []);

  return <canvas ref={ref} class="dots" aria-hidden="true" />;
}
