/**
 * Storybook cover: when to show it, and the timeline it follows.
 * The DOM work lives in main.ts; this file is pure so it can be tested.
 */

export interface CoverContext {
  /** ?debug=1 is on. */
  debug: boolean;
  /** ?cover=1 was passed. */
  forced: boolean;
  /** The cover was already shown earlier in this browser session. */
  seenThisSession: boolean;
  /** The app is idle (not restoring a round in progress). */
  idle: boolean;
}

/**
 * Shown once per session. Debug runs skip it (so jump links and screenshots
 * stay usable) unless ?cover=1 forces it, in which case it always shows.
 */
export function shouldShowCover(c: CoverContext): boolean {
  if (c.debug && c.forced) return true;
  if (c.debug) return false;
  return c.idle && !c.seenThisSession;
}

/** Milliseconds from the start: closed hold, then the cover opens, then it fades. */
export const COVER_TIMELINE = {
  openAt: 1800,
  fadeAt: 1800 + 2600 + 1200,
  doneAt: 1800 + 2600 + 1200 + 1200,
} as const;

export const COVER_SESSION_KEY = 'dsfj-cover-seen';
