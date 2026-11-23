/**
 * Dive-log pages: the data for a handwritten logbook page produced at the end
 * of each completed round, plus the pure helpers that build one. Rendering to
 * the DOM / to a PNG lives in main.ts and dive-log-render.ts; this file is
 * pure so it can be unit-tested and persisted.
 */

export interface DiveLogPage {
  /** Unique-ish id (timestamp ms) used as a key and for the filename. */
  id: number;
  /** Local date the page was written (ms epoch). */
  at: number;
  /** The focus goal for that dive, or '' if none was set. */
  goal: string;
  /** Focus length in minutes (the chosen duration). */
  durationMin: number;
  /** Total depth reached at the end of the round (m). */
  depth: number;
  /** Zone name reached (English). */
  zone: string;
  /** Chapter number for that zone (1..5). */
  chapter: number;
  /** Common names (English) of creatures logged this dive. */
  creatures: string[];
  /** Distractions during the round. */
  distractions: number;
  /** Closest eye level reached in the session up to this page (0..3). */
  eyePeak: number;
  /** Which creature id to use for the tiny ink sketch (or '' for none). */
  sketchCardId: string;
}

export interface DiveLogInput {
  at: number;
  goal: string;
  durationMin: number;
  depth: number;
  zone: string;
  chapter: number;
  creatures: string[];
  distractions: number;
  eyePeak: number;
  sketchCardId: string;
}

export function makeDiveLogPage(input: DiveLogInput): DiveLogPage {
  return {
    id: input.at,
    at: input.at,
    goal: input.goal,
    durationMin: input.durationMin,
    depth: Math.max(0, Math.round(input.depth)),
    zone: input.zone,
    chapter: input.chapter,
    creatures: [...input.creatures],
    distractions: Math.max(0, Math.floor(input.distractions)),
    eyePeak: Math.max(0, Math.min(3, Math.floor(input.eyePeak))),
    sketchCardId: input.sketchCardId,
  };
}

/** Append a page and keep the newest `max` pages (most-recent first). */
export function addPage(pages: readonly DiveLogPage[], page: DiveLogPage, max = 50): DiveLogPage[] {
  return [page, ...pages].slice(0, max);
}

/** A short phrase describing how close the eye came, for the log. */
export function eyePeakPhrase(level: number): string {
  switch (Math.max(0, Math.min(3, Math.floor(level)))) {
    case 0:
      return 'never surfaced';
    case 1:
      return 'watched from afar';
    case 2:
      return 'drew closer';
    default:
      return 'pressed to the glass';
  }
}

/** Format the date line of a page in a plain, journal-ish way. */
export function formatLogDate(at: number): string {
  const d = new Date(at);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

/** A safe PNG filename for a page. */
export function logFilename(page: DiveLogPage): string {
  const d = new Date(page.at);
  const p = (n: number): string => n.toString().padStart(2, '0');
  return `dive-log-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
}
