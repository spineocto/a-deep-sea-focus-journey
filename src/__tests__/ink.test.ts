import { describe, it, expect } from 'vitest';
import { circlePoints, jitterPoints, smoothClosedPath, parseInkSpec } from '../ink.js';

describe('ink line work', () => {
  it('parses circle and poly specs and rejects junk', () => {
    expect(parseInkSpec('circle:10,20,5')?.length).toBe(30);
    expect(parseInkSpec('poly:0,0 10,0 10,10')?.length).toBe(3);
    expect(parseInkSpec('poly:0,0 10')).toBeNull();
    expect(parseInkSpec('blob:1,2')).toBeNull();
    expect(parseInkSpec('circle:a,b,c')).toBeNull();
  });

  it('jitter is deterministic and bounded', () => {
    const base = circlePoints(0, 0, 100);
    const a = jitterPoints(base, 2, 5);
    const b = jitterPoints(base, 2, 5);
    expect(a).toEqual(b);
    a.forEach((p, i) => {
      expect(Math.abs(p[0] - base[i]![0])).toBeLessThanOrEqual(2);
      expect(Math.abs(p[1] - base[i]![1])).toBeLessThanOrEqual(2);
    });
  });

  it('builds a closed cubic path', () => {
    const d = smoothClosedPath(circlePoints(0, 0, 10, 8));
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(8);
  });
});
