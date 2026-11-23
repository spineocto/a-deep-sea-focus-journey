import { describe, it, expect } from 'vitest';
import {
  makeDiveLogPage,
  addPage,
  eyePeakPhrase,
  formatLogDate,
  logFilename,
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
