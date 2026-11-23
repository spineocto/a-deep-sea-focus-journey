import { describe, it, expect } from 'vitest';
import {
  makeDiveLogPage,
  addPage,
  eyePeakPhrase,
  formatLogDate,
  logFilename,
  wrapText,
  explorerLine,
  type DiveLogInput,
} from '../dive-log.js';

const base: DiveLogInput = {
  at: new Date(2026, 10, 22, 9, 5).getTime(),
  goal: 'finish the chapter',
  durationMin: 25,
  depth: 2512.7,
  zone: 'Midnight',
  chapter: 3,
  creatures: ['Barreleye'],
  distractions: 2,
  eyePeak: 2,
  sketchCardId: 'barreleye',
};

describe('makeDiveLogPage', () => {
  it('rounds depth, clamps counters, and copies creatures', () => {
    const p = makeDiveLogPage(base);
    expect(p.depth).toBe(2513);
    expect(p.distractions).toBe(2);
    expect(p.eyePeak).toBe(2);
    expect(p.creatures).toEqual(['Barreleye']);
    expect(p.id).toBe(base.at);
  });

  it('clamps eye peak into 0..3', () => {
    expect(makeDiveLogPage({ ...base, eyePeak: 9 }).eyePeak).toBe(3);
    expect(makeDiveLogPage({ ...base, eyePeak: -2 }).eyePeak).toBe(0);
  });
});

describe('addPage', () => {
  it('keeps newest first and respects the cap', () => {
    let pages = [] as ReturnType<typeof makeDiveLogPage>[];
    for (let i = 0; i < 5; i++) {
      pages = addPage(pages, makeDiveLogPage({ ...base, at: base.at + i }), 3);
    }
    expect(pages.length).toBe(3);
    // Most recent (largest at) first.
    expect(pages[0]!.at).toBe(base.at + 4);
    expect(pages[2]!.at).toBe(base.at + 2);
  });
});

describe('phrases + formatting', () => {
  it('describes how close the eye came', () => {
    expect(eyePeakPhrase(0)).toMatch(/never/);
    expect(eyePeakPhrase(3)).toMatch(/glass/);
  });

  it('formats a stable date line and filename', () => {
    expect(formatLogDate(base.at)).toBe('22 Nov 2026 · 09:05');
    expect(logFilename(makeDiveLogPage(base))).toBe('dive-log-20261122-0905.png');
  });
});

// 10 px per character: easy to reason about widths.
const measure = (s: string): number => s.length * 10;

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText(measure, 'finish the chapter', 300, 2)).toEqual(['finish the chapter']);
  });

  it('wraps at word boundaries and never splits a word', () => {
    const lines = wrapText(measure, 'Finish the quarterly report draft', 200, 2);
    expect(lines).toEqual(['Finish the quarterly', 'report draft']);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(200);
  });

  it('ends line 2 with an ellipsis, on a word boundary, when still too long', () => {
    const lines = wrapText(measure, 'one two three four five six seven eight nine', 120, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('\u2026')).toBe(true);
    expect(measure(lines[1] as string)).toBeLessThanOrEqual(120);
    const words = 'one two three four five six seven eight nine'.split(' ');
    for (const w of (lines[1] as string).replace('\u2026', '').split(' ')) {
      expect(words).toContain(w);
    }
  });

  it('returns nothing for empty text or no lines', () => {
    expect(wrapText(measure, '   ', 100, 2)).toEqual([]);
    expect(wrapText(measure, 'hello', 100, 0)).toEqual([]);
  });

  it('does not add an ellipsis when the text exactly fits', () => {
    expect(wrapText(measure, 'aaaa bbbb cccc dddd', 90, 2)).toEqual(['aaaa bbbb', 'cccc dddd']);
  });
});

describe('explorerLine', () => {
  const page = makeDiveLogPage(base);
  it('is deterministic for a page', () => {
    expect(explorerLine(page)).toBe(explorerLine({ ...page }));
  });
  it('speaks of a new zone first', () => {
    const l = explorerLine({ ...page, newZone: true, distractions: 0, eyePeak: 0 });
    expect(['A new colour of dark began here.', 'The water changed its mind about us.', 'We crossed a line I could not see.']).toContain(l);
  });
  it('has a line for a following eye and a distant one, and they differ in kind', () => {
    const near = explorerLine({ ...page, newZone: false, distractions: 2, eyePeak: 3 });
    const far = explorerLine({ ...page, newZone: false, distractions: 1, eyePeak: 1 });
    expect(near).not.toBe(far);
  });
  it('is gentle after a clean round, with or without a creature', () => {
    const clean = { ...page, newZone: false, distractions: 0, eyePeak: 0 };
    expect(explorerLine({ ...clean, creatures: [] })).toMatch(/water was kind|Nothing watched|quiet descent/);
    expect(explorerLine({ ...clean, creatures: ['Barreleye'] })).toMatch(/Something small|introduce itself/);
  });
  it('always returns a short non-empty line', () => {
    for (let id = 0; id < 12; id++) {
      for (const p of [
        { ...page, id, newZone: true },
        { ...page, id, distractions: 3, eyePeak: 3 },
        { ...page, id, distractions: 1, eyePeak: 1 },
        { ...page, id, distractions: 0, creatures: [] },
        { ...page, id, distractions: 0 },
      ]) {
        const l = explorerLine(p);
        expect(l.length).toBeGreaterThan(5);
        expect(l.length).toBeLessThan(50);
      }
    }
  });
});
