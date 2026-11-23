import { describe, it, expect } from 'vitest';
import { escapeHtml, pageRows, pageGoalText, renderPageHtml, sampleDiveLogPage } from '../dive-log-render.js';

describe('dive-log-render', () => {
  it('escapes user text so a goal cannot inject markup', () => {
    expect(escapeHtml(`<img src=x onerror="a()">&'`)).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
    const html = renderPageHtml({ ...sampleDiveLogPage(), goal: '<b>hi</b>' }, undefined);
    expect(html).not.toContain('<b>hi</b>');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('describes an empty dive plainly', () => {
    const page = { ...sampleDiveLogPage(), goal: '', creatures: [], distractions: 0, eyePeak: 0 };
    const rows = Object.fromEntries(pageRows(page));
    expect(rows['Met']).toBe('nothing came close');
    expect(rows['Looked away']).toBe('not once');
    expect(rows['The eye']).toBe('never surfaced');
    expect(pageGoalText(page)).toContain('no goal');
  });

  it('formats depth, zone and distraction counts', () => {
    const rows = Object.fromEntries(pageRows(sampleDiveLogPage()));
    expect(rows['Depth reached']).toBe('1,240 m');
    expect(rows['Zone']).toBe('Chapter III, Bathypelagic');
    expect(rows['Looked away']).toBe('2 times');
  });
});
