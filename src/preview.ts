/**
 * Preview + debug controls.
 *
 * None of this touches game state. It exposes a "depth override": when set,
 * the scene (background, grading, particles, readouts) renders at that depth
 * instead of the real focused depth, so any zone or the ending can be viewed
 * instantly. Used by:
 *   - the debug panel scrubber + zone-jump buttons (?debug=1 / Shift+D)
 *   - URL params ?depth=4000, ?zone=5, ?ending=1
 *   - ?preview=1 which auto-animates 0 -> 10,900 m over ~60 s
 *
 * The override is read by main.ts each frame via getDepthOverride().
 */

import { Config } from './config.js';

const PREVIEW_DURATION_MS = 60_000;

/** Display names + entry depths for the quiet zone title. */
export const ZONE_TITLES: ReadonlyArray<{ name: string; depth: number; epigraph: string }> = [
  { name: 'Epipelagic', depth: 0, epigraph: 'the sunlit shallows' },
  { name: 'Mesopelagic', depth: 200, epigraph: 'the twilight' },
  { name: 'Bathypelagic', depth: 1000, epigraph: 'the last light' },
  { name: 'Abyssopelagic', depth: 4000, epigraph: 'the abyssal plain' },
  { name: 'Hadal', depth: 6000, epigraph: 'the trench' },
];

/** How long the chapter heading stays up (it fades in and out slowly). */
const TITLE_HOLD_MS = 7600;

const CHAPTERS = ['I', 'II', 'III', 'IV', 'V'];

let depthOverride: number | null = null;
let previewStart: number | null = null;

export function getDepthOverride(): number | null {
  if (previewStart !== null) {
    const t = Math.min(1, (Date.now() - previewStart) / PREVIEW_DURATION_MS);
    // Ease-in-out so the descent starts and settles gently.
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const d = eased * Config.targetDepth;
    if (t >= 1) {
      previewStart = null;
      depthOverride = Config.targetDepth;
      return Config.targetDepth;
    }
    return d;
  }
  return depthOverride;
}

export function setDepthOverride(depth: number | null): void {
  previewStart = null;
  depthOverride = depth === null ? null : Math.max(0, Math.min(Config.targetDepth, depth));
  syncScrubber();
}

export function startPreview(): void {
  previewStart = Date.now();
}

function syncScrubber(): void {
  const scrubber = document.getElementById('depth-scrubber') as HTMLInputElement | null;
  const label = document.getElementById('debug-depth-value');
  const live = depthOverride === null && previewStart === null;
  if (scrubber && depthOverride !== null) scrubber.value = String(Math.round(depthOverride));
  if (label) {
    label.textContent = live
      ? 'live'
      : `${Math.round(getDepthOverride() ?? 0).toLocaleString('en-US')} m`;
  }
}

/** Apply ?depth / ?zone / ?ending from the URL (debug-only entry points). */
export function applyUrlOverrides(params: URLSearchParams): void {
  if (params.get('ending') === '1') {
    setDepthOverride(Config.targetDepth);
    return;
  }
  const zone = params.get('zone');
  if (zone) {
    const idx = Math.max(1, Math.min(5, parseInt(zone, 10))) - 1;
    const z = Config.zones[idx];
    if (z) {
      // Middle of the zone, or a readable depth for the open-ended Hadal zone.
      const mid = Number.isFinite(z.max) ? (z.min + z.max) / 2 : 8000;
      setDepthOverride(mid);
    }
    return;
  }
  const depth = params.get('depth');
  if (depth) {
    const n = Number(depth);
    if (Number.isFinite(n)) setDepthOverride(n);
  }
}

/** Wire the debug panel's depth controls. Safe to call once at startup. */
export function initDebugControls(): void {
  const scrubber = document.getElementById('depth-scrubber') as HTMLInputElement | null;
  scrubber?.addEventListener('input', () => {
    setDepthOverride(Number(scrubber.value));
  });

  document.getElementById('depth-release')?.addEventListener('click', () => {
    setDepthOverride(null);
  });

  document.querySelectorAll<HTMLElement>('[data-zone-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Math.max(1, Math.min(5, Number(btn.dataset['zoneJump']))) - 1;
      const z = Config.zones[idx];
      if (z) {
        const mid = Number.isFinite(z.max) ? (z.min + z.max) / 2 : 8000;
        setDepthOverride(mid);
      }
    });
  });

  document.getElementById('jump-ending')?.addEventListener('click', () => {
    setDepthOverride(Config.targetDepth);
  });

  document.getElementById('preview-run')?.addEventListener('click', () => {
    startPreview();
  });

  syncScrubber();
}

/**
 * The quiet zone title: fades in and out when the bell crosses into a new
 * zone. Call every frame with the current zone index; it only reacts to
 * changes. Returns nothing; drives the #zone-title element directly.
 */
let lastTitleZone = -1;
let titleTimer: number | null = null;

/**
 * Build the depth tick strip once: a tall column of faint marks every
 * 500 m with a small number every 1000 m. It is translated upward in
 * updateDepthTicks() as the bell sinks, so ticks pass up behind the scene.
 */
const TICK_SPACING_M = 500;
const TICK_PX_PER_M = 0.09; // vertical px per metre on the strip
const MAX_TICK_DEPTH = 11000;

export function buildDepthTicks(): void {
  const host = document.getElementById('depth-ticks');
  if (!host || host.childElementCount > 0) return;
  const parts: string[] = [];
  for (let d = 0; d <= MAX_TICK_DEPTH; d += TICK_SPACING_M) {
    const y = d * TICK_PX_PER_M;
    const major = d % 1000 === 0;
    parts.push(
      `<div class="depth-tick${major ? ' major' : ''}" style="top:${y.toFixed(1)}px">` +
        (major ? `<span class="depth-tick-num">${d.toLocaleString('en-US')}</span>` : '') +
        `</div>`,
    );
  }
  host.innerHTML = parts.join('');
}

/** Scroll the tick strip so the current depth sits at the bell line. */
export function updateDepthTicks(depth: number): void {
  const host = document.getElementById('depth-ticks');
  if (!host) return;
  const offset = depth * TICK_PX_PER_M;
  host.style.transform = `translateY(${(-offset).toFixed(1)}px)`;
}

export function updateZoneTitle(zoneIdx: number, firstPaint: boolean): void {
  if (zoneIdx === lastTitleZone) return;
  const previous = lastTitleZone;
  lastTitleZone = zoneIdx;
  // Don't announce the very first zone on load (no "entry" happened).
  if (firstPaint && zoneIdx === 0) return;
  if (previous === -1 && zoneIdx === 0) return;

  const el = document.getElementById('zone-title');
  const nameEl = document.getElementById('zone-title-name');
  const depthEl = document.getElementById('zone-title-depth');
  const chapterEl = document.getElementById('zone-title-chapter');
  const title = ZONE_TITLES[zoneIdx];
  if (!el || !nameEl || !depthEl || !title) return;

  nameEl.textContent = title.name;
  const epiEl = document.getElementById('zone-title-epigraph');
  if (epiEl) epiEl.textContent = title.epigraph;
  if (chapterEl) chapterEl.textContent = `Chapter ${CHAPTERS[zoneIdx] ?? ''}`;
  depthEl.textContent = title.depth === 0 ? 'SURFACE' : `${title.depth.toLocaleString('en-US')} m`;

  el.classList.remove('show');
  void el.offsetWidth; // restart the fade
  el.classList.add('show');
  if (titleTimer !== null) clearTimeout(titleTimer);
  titleTimer = window.setTimeout(() => el.classList.remove('show'), TITLE_HOLD_MS);

  // The descent moment: a brief, zone-specific light/colour shift.
  const shift = document.getElementById('zone-shift');
  if (shift) {
    shift.setAttribute('data-shift', String(zoneIdx));
    shift.classList.remove('go');
    void shift.offsetWidth;
    shift.classList.add('go');
  }
}
