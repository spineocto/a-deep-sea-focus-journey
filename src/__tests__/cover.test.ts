import { describe, it, expect } from 'vitest';
import { shouldShowCover, COVER_TIMELINE } from '../cover.js';

const base = { debug: false, forced: false, seenThisSession: false, idle: true };

describe('shouldShowCover', () => {
  it('shows on the first load of a session', () => {
    expect(shouldShowCover(base)).toBe(true);
  });
  it('shows only once per session', () => {
    expect(shouldShowCover({ ...base, seenThisSession: true })).toBe(false);
  });
  it('does not cover a round already in progress', () => {
    expect(shouldShowCover({ ...base, idle: false })).toBe(false);
  });
  it('stays out of the way in debug unless forced', () => {
    expect(shouldShowCover({ ...base, debug: true })).toBe(false);
    expect(shouldShowCover({ ...base, debug: true, forced: true })).toBe(true);
    expect(shouldShowCover({ ...base, debug: true, forced: true, seenThisSession: true })).toBe(true);
  });
  it('ignores ?cover=1 without debug', () => {
    expect(shouldShowCover({ ...base, forced: true, seenThisSession: true })).toBe(false);
  });
  it('has an ordered timeline', () => {
    expect(COVER_TIMELINE.openAt).toBeLessThan(COVER_TIMELINE.fadeAt);
    expect(COVER_TIMELINE.fadeAt).toBeLessThan(COVER_TIMELINE.doneAt);
  });
});
