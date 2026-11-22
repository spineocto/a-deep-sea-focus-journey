/**
 * Hand-drawn line work for the live companion. Shapes in index.html carry a
 * data-ink spec; at start-up we replace their geometry with a slightly
 * uneven, smoothed outline and add two ink strokes of different width and
 * jitter on top (a doubled, wobbly pencil-and-ink line). Static after init,
 * so there is no per-frame cost.
 */
import { mulberry32 } from './ambient.js';

export type Pt = [number, number];

export function circlePoints(cx: number, cy: number, r: number, n = 30): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function jitterPoints(pts: Pt[], amp: number, seed: number): Pt[] {
  const rnd = mulberry32(seed);
  return pts.map(([x, y]) => [x + (rnd() - 0.5) * 2 * amp, y + (rnd() - 0.5) * 2 * amp] as Pt);
}

/** Closed Catmull-Rom spline through pts, as an SVG path string. */
export function smoothClosedPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return '';
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Parse "circle:cx,cy,r" or "poly:x,y x,y x,y". Returns null if malformed. */
export function parseInkSpec(spec: string): Pt[] | null {
  const [kind, rest] = spec.split(':');
  if (!kind || !rest) return null;
  const nums = rest.split(/[\s,]+/).map(Number);
  if (nums.some((v) => !Number.isFinite(v))) return null;
  if (kind === 'circle' && nums.length === 3) return circlePoints(nums[0]!, nums[1]!, nums[2]!);
  if (kind === 'poly' && nums.length >= 6 && nums.length % 2 === 0) {
    const pts: Pt[] = [];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
    return pts;
  }
  return null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function applyInk(root: ParentNode): void {
  const els = root.querySelectorAll<SVGPathElement>('[data-ink]');
  let seed = 11;
  els.forEach((el) => {
    const base = parseInkSpec(el.getAttribute('data-ink') ?? '');
    if (!base) return;
    seed += 7;
    el.setAttribute('d', smoothClosedPath(jitterPoints(base, 1.6, seed)));
    const widths = [3.4, 1.4];
    widths.forEach((w, k) => {
      const stroke = document.createElementNS(SVG_NS, 'path');
      stroke.setAttribute('d', smoothClosedPath(jitterPoints(base, 2.6, seed * 3 + k)));
      stroke.setAttribute('fill', 'none');
      stroke.setAttribute('stroke', '#2a1620');
      stroke.setAttribute('stroke-opacity', k === 0 ? '0.55' : '0.8');
      stroke.setAttribute('stroke-width', String(w));
      stroke.setAttribute('stroke-linejoin', 'round');
      stroke.setAttribute('stroke-linecap', 'round');
      stroke.setAttribute('class', 'co-ink');
      el.after(stroke);
    });
  });
}
