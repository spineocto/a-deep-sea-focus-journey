/**
 * Ambient motion layer unit tests.
 *
 * Only the pure, DOM-free helpers are tested here: zone lookup,
 * crossfade math, and deterministic particle motion. The DOM layer
 * is exercised by the build + a manual browser check.
 */

import { describe, it, expect } from 'vitest';
import {
  AMBIENT_CONFIG,
  crossfadeForDepth,
  zoneIndexForDepth,
  createParticles,
  snowPositionAt,
  bubblePositionAt,
  sonarProgressAt,
  smoothstep,
  mulberry32,
} from '../ambient';

describe('zoneIndexForDepth', () => {
  it('maps the Config zone boundaries', () => {
    expect(zoneIndexForDepth(0)).toBe(0);
    expect(zoneIndexForDepth(199)).toBe(0);
    expect(zoneIndexForDepth(200)).toBe(1);
    expect(zoneIndexForDepth(999)).toBe(1);
    expect(zoneIndexForDepth(1000)).toBe(2);
    expect(zoneIndexForDepth(3999)).toBe(2);
    expect(zoneIndexForDepth(4000)).toBe(3);
    expect(zoneIndexForDepth(5999)).toBe(3);
    expect(zoneIndexForDepth(6000)).toBe(4);
    expect(zoneIndexForDepth(10900)).toBe(4);
  });

  it('clamps negative depths to Sunlit', () => {
    expect(zoneIndexForDepth(-50)).toBe(0);
  });
});

describe('crossfadeForDepth', () => {
  it('shows only the current zone before the blend window', () => {
    // Sunlit is 0-200 m; blending starts at 75% = 150 m.
    expect(crossfadeForDepth(0)).toEqual({ fromIndex: 0, toIndex: 1, progress: 0 });
    expect(crossfadeForDepth(100)).toEqual({ fromIndex: 0, toIndex: 1, progress: 0 });
  });

  it('blends to the next zone across the last quarter of a zone', () => {
    const mid = crossfadeForDepth(175); // halfway through 150-200 m
    expect(mid.fromIndex).toBe(0);
    expect(mid.toIndex).toBe(1);
    expect(mid.progress).toBeGreaterThan(0);
    expect(mid.progress).toBeLessThan(1);
    // Just before the boundary the next zone is (almost) fully in;
    // at the boundary the handoff swaps: Twilight becomes the base
    // image and blending toward Midnight restarts at 0.
    expect(crossfadeForDepth(199).progress).toBeGreaterThan(0.95);
    expect(crossfadeForDepth(200)).toEqual({ fromIndex: 1, toIndex: 2, progress: 0 });
  });

  it('never blends past Hadal', () => {
    expect(crossfadeForDepth(10900)).toEqual({ fromIndex: 4, toIndex: 4, progress: 0 });
  });

  it('progress is monotonic within a blend window', () => {
    let prev = -1;
    for (let d = 150; d <= 195; d += 5) {
      const p = crossfadeForDepth(d).progress;
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });
});

describe('smoothstep', () => {
  it('clamps outside the edges and is 0.5 in the middle', () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 10);
  });
});

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('particles', () => {
  it('creates deterministic particles', () => {
    expect(createParticles(10, 7)).toEqual(createParticles(10, 7));
    expect(createParticles(10, 7)).not.toEqual(createParticles(10, 8));
  });

  it('snow falls over time and wraps', () => {
    const [p] = createParticles(1, 7);
    const at0 = snowPositionAt(p, 0);
    const later = snowPositionAt(p, 60_000);
    expect(later.y).not.toBe(at0.y);
    expect(later.y).toBeGreaterThanOrEqual(0);
    expect(later.y).toBeLessThan(1);
    expect(later.x).toBeGreaterThanOrEqual(-0.05);
    expect(later.x).toBeLessThanOrEqual(1.05);
  });

  it('bubbles rise over time', () => {
    const [p] = createParticles(1, 21);
    const at0 = bubblePositionAt(p, 0);
    const later = bubblePositionAt(p, 10_000);
    // Rising means y decreases (or wraps to the bottom, still in range).
    expect(later.y).toBeGreaterThanOrEqual(0);
    expect(later.y).toBeLessThan(1);
    expect(later.y === at0.y).toBe(false);
  });

  it('bubbles rise faster with a speed multiplier', () => {
    const [p] = createParticles(1, 21);
    const slow = bubblePositionAt(p, 5000, 1);
    const fast = bubblePositionAt(p, 5000, 3);
    expect(fast.y).not.toBe(slow.y);
  });
});

describe('sonarProgressAt', () => {
  it('restarts every interval and stays in 0-1', () => {
    expect(sonarProgressAt(0)).toBe(0);
    expect(sonarProgressAt(AMBIENT_CONFIG.sonarIntervalMs)).toBe(0);
    const mid = sonarProgressAt(AMBIENT_CONFIG.sonarIntervalMs / 2);
    expect(mid).toBeCloseTo(0.5, 10);
  });
});
