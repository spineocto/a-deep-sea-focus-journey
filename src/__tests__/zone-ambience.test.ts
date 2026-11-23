import { describe, it, expect } from 'vitest';
import {
  AUDIBLE, CHIME_NOTES_HZ, LAYERS, ZONE_MIX, clampZone, heartbeatIntervalMs,
  layerGains, nextChimeDelayMs, pickChimeFreq,
} from '../zone-ambience.js';

describe('zone ambience mix', () => {
  it('has one mix per zone with every gain in 0..1', () => {
    expect(ZONE_MIX).toHaveLength(5);
    for (const mix of ZONE_MIX) for (const l of LAYERS) {
      expect(mix[l]).toBeGreaterThanOrEqual(0);
      expect(mix[l]).toBeLessThanOrEqual(1);
    }
  });
  it('gives each zone its own character', () => {
    expect(layerGains(0).flow).toBeGreaterThan(AUDIBLE);
    expect(layerGains(1).drone).toBeGreaterThan(layerGains(1).flow);
    expect(layerGains(2).chimes).toBeGreaterThan(AUDIBLE);
    expect(layerGains(3).hum).toBeGreaterThan(AUDIBLE);
    expect(layerGains(3).heart).toBe(0);
    expect(layerGains(4).hum).toBeGreaterThan(AUDIBLE);
    expect(layerGains(4).heart).toBeGreaterThan(AUDIBLE);
  });
  it('keeps the heartbeat very faint and only in the last zone', () => {
    expect(layerGains(4).heart).toBeLessThan(layerGains(4).hum);
    for (const z of [0, 1, 2, 3]) expect(layerGains(z).heart).toBe(0);
  });
  it('clamps out-of-range zones', () => {
    expect(clampZone(-3)).toBe(0);
    expect(clampZone(99)).toBe(4);
    expect(clampZone(NaN)).toBe(0);
    expect(layerGains(99)).toBe(layerGains(4));
  });
  it('schedules a slow heartbeat and sparse chimes', () => {
    expect(heartbeatIntervalMs()).toBeGreaterThan(1100);
    expect(nextChimeDelayMs(0)).toBeGreaterThanOrEqual(3000);
    expect(nextChimeDelayMs(1)).toBeLessThanOrEqual(8000);
    expect(CHIME_NOTES_HZ).toContain(pickChimeFreq(0.5));
    expect(pickChimeFreq(1)).toBe(CHIME_NOTES_HZ[CHIME_NOTES_HZ.length - 1]);
  });
});
