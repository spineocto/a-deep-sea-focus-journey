import { describe, it, expect } from 'vitest';
import {
  MAX_EYE_LEVEL,
  clampEyeLevel,
  raiseEyeLevel,
  decayEyeLevel,
  eyeCaption,
  createInitialSessionState,
  sanitizeFocusGoal,
  FOCUS_GOAL_MAX,
  registerDistraction,
  completeRound,
} from '../session.js';

describe('eye level clamping', () => {
  it('clamps out-of-range and non-finite values', () => {
    expect(clampEyeLevel(-5)).toBe(0);
    expect(clampEyeLevel(99)).toBe(MAX_EYE_LEVEL);
    expect(clampEyeLevel(NaN)).toBe(0);
    expect(clampEyeLevel(2.9)).toBe(2);
  });

  it('raises by one up to the cap', () => {
    expect(raiseEyeLevel(0)).toBe(1);
    expect(raiseEyeLevel(2)).toBe(3);
    expect(raiseEyeLevel(3)).toBe(3);
  });

  it('decays by one down to zero', () => {
    expect(decayEyeLevel(3)).toBe(2);
    expect(decayEyeLevel(1)).toBe(0);
    expect(decayEyeLevel(0)).toBe(0);
  });
});

describe('eye captions', () => {
  it('varies per level and keeps the WARNING prefix', () => {
    expect(eyeCaption(1)).toContain('WATCHING');
    expect(eyeCaption(2)).toContain('CLOSER');
    expect(eyeCaption(3)).toContain('KNOWS YOU LEFT');
    expect(eyeCaption(1).startsWith('WARNING')).toBe(true);
    // Out of range falls back to the most intense line.
    expect(eyeCaption(9)).toBe(eyeCaption(3));
  });
});

describe('focus goal sanitising', () => {
  it('collapses whitespace, trims, and caps length', () => {
    expect(sanitizeFocusGoal('  write\tthe   essay\n ')).toBe('write the essay');
    expect(sanitizeFocusGoal('x'.repeat(100)).length).toBe(FOCUS_GOAL_MAX);
    expect(sanitizeFocusGoal('')).toBe('');
  });
});

describe('distraction + round lifecycle', () => {
  it('each distraction raises the eye and tracks the peak', () => {
    let s = createInitialSessionState();
    s = registerDistraction(s);
    expect(s.eyeLevel).toBe(1);
    s = registerDistraction(s);
    s = registerDistraction(s);
    s = registerDistraction(s); // capped
    expect(s.eyeLevel).toBe(3);
    expect(s.eyePeak).toBe(3);
    expect(s.roundDistractions).toBe(4);
    expect(s.sessionDistractions).toBe(4);
  });

  it('a clean round decays the eye and resets the round counter', () => {
    let s = createInitialSessionState();
    s = registerDistraction(s); // level 1, round=1
    const after = completeRound(s);
    // Not clean: eye stays, round counter resets, distractions reported.
    expect(after.wasClean).toBe(false);
    expect(after.session.eyeLevel).toBe(1);
    expect(after.session.roundDistractions).toBe(0);
    expect(after.distractionsThisRound).toBe(1);

    // Next round is clean: eye eases back.
    const clean = completeRound(after.session);
    expect(clean.wasClean).toBe(true);
    expect(clean.session.eyeLevel).toBe(0);
  });

  it('peak is retained even after decay', () => {
    let s = createInitialSessionState();
    s = registerDistraction(s);
    s = registerDistraction(s); // peak 2
    const r = completeRound({ ...s, roundDistractions: 0 });
    expect(r.session.eyeLevel).toBe(1); // decayed
    expect(r.session.eyePeak).toBe(2); // peak kept
  });
});
