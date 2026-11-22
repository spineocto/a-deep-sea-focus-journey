/**
 * Ambient motion layer.
 *
 * The five zone PNGs in art/out/ are the static base: they never move.
 * All motion lives here, on transparent layers above them, so a
 * 25-45 minute focus session does not stare at a frozen picture:
 *
 *   1. Zone crossfade -- as depth sinks (12 m/min) the next zone
 *      fades in over the last quarter of the current zone, so the
 *      background drifts darker instead of cutting to a new picture.
 *   2. Marine snow + bubbles -- slow, deterministic drift on a
 *      <canvas>. Positions are a pure function of time, never
 *      counted ticks, so a hidden tab resumes exactly where it
 *      should be.
 *   3. Light sway + breathing glow -- the light cone rocks slowly
 *      and the timer glow breathes on a ~5 s cycle.
 *   4. Sonar sweep -- one faint expanding ring every 30 s.
 *   5. Distraction jolt -- on DISTRACTED the frame shakes briefly
 *      and bubbles speed up, then settles.
 *
 * Everything is slow and low-contrast on purpose. Motion can be
 * switched off (button / localStorage / prefers-reduced-motion);
 * with motion off the layer is a static crossfaded background.
 */

import { Config, type Zone } from './config.js';
import { AppState } from './state-machine.js';

import sunlitUrl from '../art/out/zone-1-sunlit.webp';
import twilightUrl from '../art/out/zone-2-twilight.webp';
import midnightUrl from '../art/out/zone-3-midnight.webp';
import abyssalUrl from '../art/out/zone-4-abyssal.webp';
import hadalUrl from '../art/out/zone-5-hadal.webp';

// ---------------------------------------------------------------------------
// All tunable values -- change only here.
// ---------------------------------------------------------------------------

export const AMBIENT_CONFIG = {
  // Crossfade: blending starts this far into the current zone (0-1).
  crossfadeStart: 0.75,
  // Light cone sway: period (ms) and max angle (deg).
  swayPeriodMs: 14000,
  swayDegrees: 2.5,
  // Light cone opacity per zone (Sunlit -> Hadal): the sun is gone by zone 3.
  lightOpacity: [0.5, 0.35, 0.04, 0.05, 0],
  // Breathing glow on the timer: one full breath per period.
  breathPeriodMs: 5200,
  // Sonar: one expanding ring per interval, centred where the bell sits.
  sonarIntervalMs: 30000,
  sonarCenterX: 0.42,
  sonarCenterY: 0.55,
  sonarMaxAlpha: 0.35,
  // Marine snow count per zone.
  snowCount: [70, 110, 90, 70, 45],
  // Snow fall speed (fraction of screen height per second).
  snowFallSpeed: 0.008,
  // Bubbles: count, rise speed, and how much faster they rise on distraction.
  bubbleCount: 10,
  bubbleRiseSpeed: 0.03,
  bubbleDistractionMultiplier: 3,
  // Distraction shake: duration (ms) and max offset (px).
  shakeDurationMs: 900,
  shakeMaxPx: 6,
  // Motion preference key in localStorage.
  motionStorageKey: 'ambient-motion',
} as const;

export const ZONE_IMAGES: readonly string[] = [
  sunlitUrl,
  twilightUrl,
  midnightUrl,
  abyssalUrl,
  hadalUrl,
];

export const ZONE_NAMES: readonly Zone[] = [
  'Sunlit',
  'Twilight',
  'Midnight',
  'Abyssal',
  'Hadal',
];

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested, no DOM).
// ---------------------------------------------------------------------------

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Deterministic PRNG so particles are identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function zoneIndexForDepth(depth: number): number {
  const d = Math.max(0, depth);
  for (let i = 0; i < Config.zones.length; i++) {
    const zone = Config.zones[i];
    if (zone && d >= zone.min && d < zone.max) return i;
  }
  return Config.zones.length - 1;
}

export interface Crossfade {
  fromIndex: number;
  toIndex: number;
  /** 0 = fully on `from`, 1 = fully on `to`. */
  progress: number;
}

/**
 * Which two zone images to show at a depth, and how far the blend is.
 * Blending runs over the last quarter of the current zone; the last
 * zone (Hadal) has nowhere to blend to.
 */
export function crossfadeForDepth(depth: number): Crossfade {
  const idx = zoneIndexForDepth(depth);
  if (idx >= Config.zones.length - 1) {
    return { fromIndex: idx, toIndex: idx, progress: 0 };
  }
  const zone = Config.zones[idx];
  if (!zone) return { fromIndex: idx, toIndex: idx, progress: 0 };
  const width = zone.max - zone.min;
  const blendStart = zone.min + width * AMBIENT_CONFIG.crossfadeStart;
  const progress = smoothstep(blendStart, zone.max, depth);
  return { fromIndex: idx, toIndex: idx + 1, progress };
}

export interface AmbientParticle {
  x: number; // 0-1 across the screen
  y: number; // 0-1 down the screen
  r: number; // radius in px at 1x
  speed: number; // fraction of height per second
  sway: number; // horizontal sway amplitude, 0-1
  phase: number; // 0-2PI
}

export function createParticles(count: number, seed: number): AmbientParticle[] {
  const rand = mulberry32(seed);
  const out: AmbientParticle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: rand(),
      y: rand(),
      r: 0.8 + rand() * 1.8,
      speed: 0.5 + rand(),
      sway: 0.005 + rand() * 0.015,
      phase: rand() * Math.PI * 2,
    });
  }
  return out;
}

/** Snow position at a time: falls slowly, sways, wraps to the top. */
export function snowPositionAt(
  p: AmbientParticle,
  nowMs: number,
): { x: number; y: number } {
  const tSec = nowMs / 1000;
  const y = (((p.y + tSec * AMBIENT_CONFIG.snowFallSpeed * p.speed) % 1) + 1) % 1;
  const x = p.x + Math.sin(tSec * 0.25 + p.phase) * p.sway;
  return { x, y };
}

/** Bubble position at a time: rises, wobbles, wraps to the bottom. */
export function bubblePositionAt(
  p: AmbientParticle,
  nowMs: number,
  speedMultiplier = 1,
): { x: number; y: number } {
  const tSec = nowMs / 1000;
  const y = (((p.y - tSec * AMBIENT_CONFIG.bubbleRiseSpeed * p.speed * speedMultiplier) % 1) + 1) % 1;
  const x = p.x + Math.sin(tSec * 1.2 + p.phase) * p.sway * 2;
  return { x, y };
}

/** Sonar ring progress at a time: 0 = just fired, 1 = faded out. */
export function sonarProgressAt(nowMs: number): number {
  return (nowMs % AMBIENT_CONFIG.sonarIntervalMs) / AMBIENT_CONFIG.sonarIntervalMs;
}

/**
 * Smoothly interpolated light-cone opacity between two zones, so the cone
 * dims continuously as depth increases rather than stepping per zone.
 */
export function lerpLightOpacity(fromIdx: number, toIdx: number, progress: number): number {
  const a = AMBIENT_CONFIG.lightOpacity[fromIdx] ?? 0.08;
  const b = AMBIENT_CONFIG.lightOpacity[toIdx] ?? a;
  return a + (b - a) * Math.min(1, Math.max(0, progress));
}

// ---------------------------------------------------------------------------
// DOM layer. Called once per RAF frame from main.ts; no loop of its own.
// ---------------------------------------------------------------------------

export interface AmbientLayer {
  mount(): void;
  update(depth: number, state: AppState, nowMs: number, descentRate?: number): void;
  setMotionEnabled(enabled: boolean): void;
  isMotionEnabled(): boolean;
  destroy(): void;
}

export function createAmbientLayer(): AmbientLayer {
  let root: HTMLDivElement | null = null;
  let bgA: HTMLImageElement | null = null;
  let bgB: HTMLImageElement | null = null;
  let light: HTMLDivElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;

  let motionEnabled = true;
  let currentFrom = -1;
  let currentTo = -1;
  let lastState: AppState | null = null;
  let distractionAt = -1;
  // Camera-relative upward drift: as the bell sinks, snow appears to rise.
  // We accumulate a scroll offset (in screen-heights) from the descent rate
  // so particles move up faster the faster we descend. Three parallax
  // layers move at different fractions for depth.
  let descentScroll = 0;
  let lastScrollTime = -1;
  const PARALLAX = [0.35, 0.7, 1.15]; // far, mid, near layers
  // Only the zones actually reached are fetched (the <img> fetches when
  // its src is set). We also warm the next zone one step ahead so the
  // crossfade has it ready, but never load all five up front.
  const preloaded = new Set<number>();

  function preloadZone(index: number): void {
    const src = ZONE_IMAGES[index];
    if (!src || preloaded.has(index)) return;
    preloaded.add(index);
    const img = new Image();
    img.src = src;
  }

  // Three particle fields, one per parallax layer. Near layer is sparser
  // and larger; far layer is dense and tiny.
  const snowFar = createParticles(70, 7);
  const snowMid = createParticles(55, 19);
  const snowNear = createParticles(28, 41);
  const bubbles = createParticles(AMBIENT_CONFIG.bubbleCount, 21);
  // Zone 3 only: drifting bioluminescent motes (faded teal), the only light.
  const motes = createParticles(70, 303);

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function resizeCanvas(): void {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }

  function mount(): void {
    if (root || typeof document === 'undefined') return;

    motionEnabled =
      !prefersReducedMotion() &&
      (typeof localStorage === 'undefined' ||
        localStorage.getItem(AMBIENT_CONFIG.motionStorageKey) !== 'off');

    root = document.createElement('div');
    root.className = 'ambient';
    root.setAttribute('aria-hidden', 'true');

    bgA = document.createElement('img');
    bgA.className = 'ambient-bg';
    bgA.src = ZONE_IMAGES[0] ?? '';
    bgA.alt = '';
    bgB = document.createElement('img');
    bgB.className = 'ambient-bg';
    bgB.src = ZONE_IMAGES[0] ?? '';
    bgB.alt = '';
    bgB.style.opacity = '0';

    light = document.createElement('div');
    light.className = 'ambient-light';

    canvas = document.createElement('canvas');
    canvas.className = 'ambient-fx';
    ctx = canvas.getContext('2d');

    root.append(bgA, bgB, light, canvas);
    document.body.insertBefore(root, document.body.firstChild);
    document.body.classList.toggle('ambient-motion-off', !motionEnabled);

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function setMotionEnabled(enabled: boolean): void {
    motionEnabled = enabled;
    try {
      localStorage.setItem(
        AMBIENT_CONFIG.motionStorageKey,
        enabled ? 'on' : 'off',
      );
    } catch {
      // Private mode etc.: the toggle still works for this session.
    }
    document.body.classList.toggle('ambient-motion-off', !enabled);
    if (!enabled && ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawFx(
    zoneIdx: number,
    state: AppState,
    nowMs: number,
    w: number,
    h: number,
    moteWeight = 0,
  ): void {
    if (!ctx || !canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Marine snow drifting UPWARD relative to the camera (the bell sinks,
    // so suspended particles rise past it). Three parallax layers at
    // different speeds give the frame depth. Each layer combines a slow
    // constant baseline drift with the descent-driven scroll.
    const tSec = nowMs / 1000;
    const layers: Array<{ field: AmbientParticle[]; px: number; r: number; alpha: number }> = [
      { field: snowFar, px: PARALLAX[0] ?? 0.35, r: 0.7, alpha: 0.28 },
      { field: snowMid, px: PARALLAX[1] ?? 0.7, r: 1.0, alpha: 0.4 },
      { field: snowNear, px: PARALLAX[2] ?? 1.15, r: 1.5, alpha: 0.5 },
    ];
    // Fade particles out a touch in the deep where the water is near-black.
    // The abyssal plain (zone 4) is nearly still: very little snow.
    const depthFade = (1 - Math.min(0.45, zoneIdx * 0.11)) * (zoneIdx === 3 ? 0.45 : 1);
    for (const layer of layers) {
      ctx.fillStyle = `rgba(200, 215, 225, ${(layer.alpha * depthFade).toFixed(3)})`;
      const baseDrift = tSec * AMBIENT_CONFIG.snowFallSpeed * layer.px;
      const scroll = descentScroll * layer.px;
      for (const particle of layer.field) {
        // Subtract so particles move up; wrap into [0,1).
        let y = (particle.y - baseDrift - scroll) % 1;
        if (y < 0) y += 1;
        const x = particle.x + Math.sin(tSec * 0.25 + particle.phase) * particle.sway;
        ctx.beginPath();
        ctx.arc(x * w, y * h, particle.r * layer.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Zone 3: scattered glowing motes that drift and pulse, faded teal.
    if (moteWeight > 0.01) {
      for (const m of motes) {
        const tw = 0.5 + 0.5 * Math.sin(tSec * (0.5 + m.speed * 0.5) + m.phase * 3);
        let y = (m.y - tSec * 0.004 * m.speed) % 1;
        if (y < 0) y += 1;
        const x = m.x + Math.sin(tSec * 0.12 * m.speed + m.phase) * 0.02;
        const al = moteWeight * (0.25 + 0.75 * tw);
        ctx.fillStyle = `rgba(90, 175, 168, ${(al * 0.14).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x * w, y * h, m.r * 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(170, 220, 208, ${(al * 0.85).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x * w, y * h, m.r * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bubbles rising from the bell area, faster on distraction.
    const distracted = state === AppState.DISTRACTED;
    const mult = distracted
      ? AMBIENT_CONFIG.bubbleDistractionMultiplier
      : 1;
    ctx.strokeStyle = `rgba(170, 200, 215, ${(0.5 * depthFade).toFixed(3)})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < bubbles.length; i++) {
      const particle = bubbles[i];
      if (!particle) continue;
      const pos = bubblePositionAt(particle, nowMs, mult);
      const bx = 0.42 * w + (pos.x - 0.5) * w * 0.12;
      const by = pos.y * h;
      ctx.beginPath();
      ctx.arc(bx, by, particle.r + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sonar sweep: one faint ring every 30 s, centred on the bell.
    const progress = sonarProgressAt(nowMs);
    const maxR = Math.max(w, h) * 0.55;
    ctx.strokeStyle = `rgba(120, 200, 220, ${
      (1 - progress) * AMBIENT_CONFIG.sonarMaxAlpha * depthFade
    })`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(
      AMBIENT_CONFIG.sonarCenterX * w,
      AMBIENT_CONFIG.sonarCenterY * h,
      Math.max(1, progress * maxR),
      0,
      Math.PI * 2,
    );
    ctx.stroke();

    ctx.restore();
  }

  function update(depth: number, state: AppState, nowMs: number, descentRate = 0): void {
    if (!root || !bgA || !bgB || !light || !canvas) return;

    // Accumulate the camera-relative upward scroll from the descent rate.
    // Scaled down so a normal 12 m/min descent is a gentle drift; a debug
    // scrub or preview (fast) makes particles stream up noticeably.
    if (lastScrollTime >= 0) {
      const dt = (nowMs - lastScrollTime) / 1000;
      if (dt > 0 && dt < 1) {
        // descentRate is m/s; 0.0016 screen-heights per metre feels right.
        descentScroll += Math.max(0, descentRate) * dt * 0.0016;
      }
    }
    lastScrollTime = nowMs;

    // Zone crossfade (runs even with motion off: the background must
    // still sink as depth changes).
    const { fromIndex, toIndex, progress } = crossfadeForDepth(depth);
    if (fromIndex !== currentFrom) {
      const src = ZONE_IMAGES[fromIndex];
      if (src) bgA.src = src;
      currentFrom = fromIndex;
      preloaded.add(fromIndex);
      // Warm the next zone so the crossfade into it is ready.
      preloadZone(fromIndex + 1);
    }
    if (toIndex !== currentTo) {
      const src = ZONE_IMAGES[toIndex];
      if (src) bgB.src = src;
      currentTo = toIndex;
    }
    bgA.style.opacity = String(1 - progress);
    bgB.style.opacity = String(progress);

    // Distraction jolt: remember when it started, shake decays after it.
    if (state === AppState.DISTRACTED && lastState !== AppState.DISTRACTED) {
      distractionAt = nowMs;
    }
    lastState = state;

    if (!motionEnabled) {
      root.style.transform = '';
      light.style.opacity = String(lerpLightOpacity(fromIndex, toIndex, progress));
      return;
    }

    // Light cone sway + breathing glow.
    const sway =
      Math.sin((nowMs / AMBIENT_CONFIG.swayPeriodMs) * Math.PI * 2) *
      AMBIENT_CONFIG.swayDegrees;
    light.style.transform = `rotate(${sway.toFixed(3)}deg)`;
    light.style.opacity = String(lerpLightOpacity(fromIndex, toIndex, progress));
    const breath =
      0.5 +
      0.5 * Math.sin((nowMs / AMBIENT_CONFIG.breathPeriodMs) * Math.PI * 2);
    document.documentElement.style.setProperty(
      '--ambient-breath',
      breath.toFixed(3),
    );

    // Shake after a distraction, decaying over shakeDurationMs.
    if (distractionAt >= 0) {
      const age = nowMs - distractionAt;
      const k = Math.max(0, 1 - age / AMBIENT_CONFIG.shakeDurationMs);
      if (k > 0) {
        const dx = Math.sin(nowMs / 37) * AMBIENT_CONFIG.shakeMaxPx * k;
        const dy = Math.cos(nowMs / 53) * AMBIENT_CONFIG.shakeMaxPx * k * 0.6;
        root.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
      } else {
        root.style.transform = '';
        distractionAt = -1;
      }
    }

    const moteWeight =
      (fromIndex === 2 ? 1 - progress : 0) + (toIndex === 2 && fromIndex !== 2 ? progress : 0);
    drawFx(fromIndex, state, nowMs, window.innerWidth, window.innerHeight, moteWeight);
  }

  function destroy(): void {
    window.removeEventListener('resize', resizeCanvas);
    root?.remove();
    root = null;
    bgA = null;
    bgB = null;
    light = null;
    canvas = null;
    ctx = null;
  }

  return { mount, update, setMotionEnabled, isMotionEnabled: () => motionEnabled, destroy };
}
