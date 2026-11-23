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
  /** True when this dive reached a deeper chapter than any earlier page. */
  newZone?: boolean;
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
  newZone?: boolean;
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
    newZone: input.newZone ?? false,
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

/**
 * Greedy word wrap that never breaks inside a word. `measure` returns the
 * width of a string (canvas measureText in the browser, a fake in tests).
 * If the text needs more than `maxLines`, the last line is cut at a word
 * boundary and ends with an ellipsis. A single word wider than the line is
 * only shortened (with an ellipsis) when it is the last line.
 */
export function wrapText(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w !== '');
  if (words.length === 0 || maxLines < 1) return [];
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    const isLast = lines.length === maxLines - 1;
    let line = words[i] as string;
    i++;
    while (i < words.length && measure(`${line} ${words[i]}`) <= maxWidth) {
      line = `${line} ${words[i]}`;
      i++;
    }
    if (isLast && i < words.length) {
      // More text remains than fits: end the last line with an ellipsis.
      let parts = line.split(' ');
      while (parts.length > 1 && measure(`${parts.join(' ')}\u2026`) > maxWidth) parts = parts.slice(0, -1);
      let last = parts.join(' ');
      while (last.length > 1 && measure(`${last}\u2026`) > maxWidth) last = last.slice(0, -1);
      line = `${last}\u2026`;
      i = words.length;
    }
    lines.push(line);
  }
  return lines;
}

const LINES_NEW_ZONE = [
  'A new colour of dark began here.',
  'The water changed its mind about us.',
  'We crossed a line I could not see.',
];
const LINES_FOLLOWED = [
  'Something followed the lamp down.',
  'The glass was not empty for long.',
  'It knew when I looked away.',
];
const LINES_WATCHED = [
  'I felt the far dark take notice.',
  'Something turned, a long way off.',
  'The lamp was looked at, once.',
];
const LINES_CLEAN_MET = [
  'Something small came to see the lamp.',
  'The dark was kind enough to introduce itself.',
];
const LINES_CLEAN = [
  'The water was kind today.',
  'Nothing watched. Nothing minded.',
  'A quiet descent, all the way down.',
];

/**
 * One short explorer's line for the bottom of a page, chosen by what the dive
 * was like. Deterministic: the same page always gets the same line, so the
 * on-screen page and the exported PNG agree.
 */
export function explorerLine(page: DiveLogPage): string {
  const pick = (options: readonly string[]): string =>
    options[Math.abs(Math.floor(page.id)) % options.length] as string;
  if (page.newZone) return pick(LINES_NEW_ZONE);
  if (page.distractions > 0) return pick(page.eyePeak >= 2 ? LINES_FOLLOWED : LINES_WATCHED);
  return pick(page.creatures.length > 0 ? LINES_CLEAN_MET : LINES_CLEAN);
}
