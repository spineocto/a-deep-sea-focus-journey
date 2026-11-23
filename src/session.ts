/**
 * Session state: the things that live alongside a dive run but are not part
 * of the timer/depth core — the escalating eye, the current focus goal, and
 * the dive-log pages. Pure logic here (no DOM, no storage); main.ts and the
 * controller wire it to persistence and the UI.
 *
 * "Eye level" is how close the watcher has come this session:
 *   0  gone / resting
 *   1  far and small in the dark      (1st distraction)
 *   2  closer, larger                 (2nd)
 *   3  pressed against the porthole   (3rd and beyond)
 * A distraction raises the level by one (capped at 3). A clean, completed
 * round — one finished with no distraction during it — lowers it by one.
 */

export const MAX_EYE_LEVEL = 3;

/** WARNING captions, indexed by eye level (1..3). Level 0 never shows one. */
export const EYE_CAPTIONS: Readonly<Record<number, string>> = {
  1: 'WARNING: SOMETHING IS WATCHING YOU',
  2: 'WARNING: IT IS CLOSER NOW',
  3: 'WARNING: IT KNOWS YOU LEFT',
};

export function eyeCaption(level: number): string {
  const l = clampEyeLevel(level);
  return EYE_CAPTIONS[l] ?? EYE_CAPTIONS[3]!;
}

export function clampEyeLevel(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(MAX_EYE_LEVEL, Math.floor(level)));
}

/** A distraction brings the watcher one step closer (capped at MAX). */
export function raiseEyeLevel(level: number): number {
  return clampEyeLevel(clampEyeLevel(level) + 1);
}

/** A clean completed round lets it drift one step back into the dark. */
export function decayEyeLevel(level: number): number {
  return clampEyeLevel(clampEyeLevel(level) - 1);
}

export interface SessionState {
  /** How close the eye is now, 0..3. */
  eyeLevel: number;
  /** Highest eye level reached this session (for the dive log). */
  eyePeak: number;
  /** Distractions counted in the current/just-finished round. */
  roundDistractions: number;
  /** Distractions counted across the whole session. */
  sessionDistractions: number;
  /** The one-line focus goal for this dive, or '' if none. */
  focusGoal: string;
}

export function createInitialSessionState(): SessionState {
  return {
    eyeLevel: 0,
    eyePeak: 0,
    roundDistractions: 0,
    sessionDistractions: 0,
    focusGoal: '',
  };
}

/** Clamp/clean a focus goal: single line, trimmed, max 60 chars. */
export const FOCUS_GOAL_MAX = 60;
export function sanitizeFocusGoal(raw: string): string {
  return raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FOCUS_GOAL_MAX);
}

/** Apply a distraction: counts rise, the eye comes closer, peak tracked. */
export function registerDistraction(s: SessionState): SessionState {
  const eyeLevel = raiseEyeLevel(s.eyeLevel);
  return {
    ...s,
    eyeLevel,
    eyePeak: Math.max(s.eyePeak, eyeLevel),
    roundDistractions: s.roundDistractions + 1,
    sessionDistractions: s.sessionDistractions + 1,
  };
}

export interface RoundCompletion {
  /** Session state after the round is committed. */
  session: SessionState;
  /** Distractions that happened during the round just completed. */
  distractionsThisRound: number;
  /** Whether the round was clean (no distraction) and so the eye eased back. */
  wasClean: boolean;
}

/**
 * Commit a completed round: if it was clean, the eye eases back one step;
 * either way the per-round distraction counter resets for the next dive.
 */
export function completeRound(s: SessionState): RoundCompletion {
  const wasClean = s.roundDistractions === 0;
  const eyeLevel = wasClean ? decayEyeLevel(s.eyeLevel) : s.eyeLevel;
  return {
    session: { ...s, eyeLevel, roundDistractions: 0 },
    distractionsThisRound: s.roundDistractions,
    wasClean,
  };
}
