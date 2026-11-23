/**
 * Rendering for dive-log pages: an HTML version (overlay + Log tab) and a
 * canvas version that exports to PNG. No external services; everything is
 * drawn locally with the fonts already bundled (IM Fell English, Caveat).
 */
import {
  explorerLine,
  eyePeakPhrase,
  formatLogDate,
  wrapText,
  type DiveLogPage,
} from './dive-log.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The lines of a page as plain text rows, shared by both renderers. */
export function pageRows(page: DiveLogPage): Array<[label: string, value: string]> {
  const creatures = page.creatures.length > 0 ? page.creatures.join(', ') : 'nothing came close';
  return [
    ['Time under', `${page.durationMin} min`],
    ['Depth reached', `${page.depth.toLocaleString('en-US')} m`],
    ['Zone', `Chapter ${ROMAN[page.chapter] ?? page.chapter}, ${page.zone}`],
    ['Met', creatures],
    ['Looked away', page.distractions === 0 ? 'not once' : page.distractions === 1 ? 'once' : `${page.distractions} times`],
    ['The eye', eyePeakPhrase(page.eyePeak)],
  ];
}

export function pageGoalText(page: DiveLogPage): string {
  return page.goal !== '' ? page.goal : 'no goal written, only the dark';
}

/** A tiny ink bell on its cable, used when no creature was met. */
const BELL_SVG =
  '<svg viewBox="0 0 100 100" class="log-bell" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
  '<path d="M50 0 V26" /><circle cx="50" cy="30" r="4" /><circle cx="50" cy="60" r="28" /><circle cx="50" cy="60" r="16" />' +
  '<path d="M30 48 q4 -8 12 -11" /></g></svg>';

export function renderPageHtml(page: DiveLogPage, artUrl: string | undefined): string {
  const rows = pageRows(page)
    .map(([k, v]) => `<div class="log-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`)
    .join('');
  const sketch = artUrl ? `<img class="log-sketch" src="${artUrl}" alt="" />` : BELL_SVG;
  return (
    `<article class="log-page">` +
    `<header class="log-head"><span class="log-title">Dive Log</span><span class="log-date">${escapeHtml(formatLogDate(page.at))}</span></header>` +
    `<p class="log-goal"><span class="log-goal-k">Meant to focus on</span> ${escapeHtml(pageGoalText(page))}</p>` +
    `<dl class="log-rows">${rows}</dl>` +
    `<div class="log-sketch-wrap">${sketch}</div>` +
    `<p class="log-line">${escapeHtml(explorerLine(page))}</p>` +
    `<p class="log-foot">A Deep Sea Focus Journey</p>` +
    `</article>`
  );
}

/** A believable sample page for ?debug=1&log=1. */
export function sampleDiveLogPage(): DiveLogPage {
  return {
    id: 1,
    at: new Date(2026, 10, 22, 9, 5).getTime(),
    goal: 'Finish the chapter outline',
    durationMin: 25,
    depth: 1240,
    zone: 'Bathypelagic',
    chapter: 3,
    creatures: ['Barreleye', 'Humpback Anglerfish'],
    distractions: 2,
    eyePeak: 2,
    sketchCardId: 'barreleye',
  };
}

// ---- Canvas / PNG export ------------------------------------------------

const W = 900;
const H = 1200;
const INK = '#2a2230';
const FONT_DISPLAY = "'IM Fell English', Georgia, serif";
const FONT_HAND = "Caveat, 'Bradley Hand', cursive";

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Draw the page to a canvas. Fonts are awaited first so text is never fallback. */
export async function drawPageToCanvas(
  page: DiveLogPage,
  artUrl: string | undefined,
  paperUrl: string | undefined,
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all([
      document.fonts.load(`40px ${FONT_DISPLAY}`),
      document.fonts.load(`italic 24px ${FONT_DISPLAY}`),
      document.fonts.load(`40px ${FONT_HAND}`),
    ]).catch(() => undefined);
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Paper
  ctx.fillStyle = '#e3d9ba';
  ctx.fillRect(0, 0, W, H);
  const paper = paperUrl ? await loadImage(paperUrl) : null;
  if (paper) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(paper, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(90,70,40,0)');
  vg.addColorStop(1, 'rgba(90,70,40,0.28)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const left = 90;
  const right = W - 90;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';

  // Header
  ctx.font = `46px ${FONT_DISPLAY}`;
  ctx.fillText('Dive Log', left, 130);
  ctx.font = `italic 24px ${FONT_DISPLAY}`;
  ctx.textAlign = 'right';
  ctx.fillText(formatLogDate(page.at), right, 130);
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(42,34,48,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, 152);
  ctx.lineTo(right, 152);
  ctx.stroke();

  // Goal
  ctx.font = `italic 22px ${FONT_DISPLAY}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText('Meant to focus on', left, 205);
  ctx.globalAlpha = 1;
  ctx.font = `46px ${FONT_HAND}`;
  let y = 260;
  for (const line of wrapText((t) => ctx.measureText(t).width, pageGoalText(page), right - left, 2)) {
    ctx.fillText(line, left, y);
    y += 52;
  }

  // Rows
  y += 36;
  for (const [k, v] of pageRows(page)) {
    ctx.font = `italic 22px ${FONT_DISPLAY}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(k, left, y);
    ctx.globalAlpha = 1;
    ctx.font = `38px ${FONT_HAND}`;
    const lines = wrapText((t) => ctx.measureText(t).width, v, right - left - 250, 3);
    lines.forEach((line, i) => ctx.fillText(line, left + 250, y + i * 40));
    y += Math.max(1, lines.length) * 40 + 24;
    ctx.strokeStyle = 'rgba(42,34,48,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y - 30);
    ctx.lineTo(right, y - 30);
    ctx.stroke();
  }

  // Sketch: centred in the lower area, between the rows and the explorer's line.
  const lineTop = H - 215; // the explorer's line sits above the footer
  const sketchTop = y - 10;
  const size = Math.max(160, Math.min(440, lineTop - sketchTop - 20));
  const cx = W / 2;
  const cy = sketchTop + 10 + size / 2;
  const art = artUrl ? await loadImage(artUrl) : null;
  if (art) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.85;
    // ctx.filter is unsupported in some browsers; the art still draws, just in colour.
    ctx.filter = 'grayscale(1) contrast(1.1)';
    const scale = Math.min(size / art.width, size / art.height);
    const dw = art.width * scale;
    const dh = art.height * scale;
    ctx.translate(cx, cy);
    ctx.rotate(-0.035);
    ctx.drawImage(art, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  } else {
    // A small ink bell on its cable, scaled to the sketch area.
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const k = size / 300;
    const top = cy - size / 2;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top + 90 * k);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, top + 110 * k, 14 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, top + 200 * k, 90 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, top + 200 * k, 52 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // The explorer's line, centred, a little smaller than the goal.
  ctx.textAlign = 'center';
  ctx.font = `44px ${FONT_HAND}`;
  let ly = lineTop + 36;
  for (const line of wrapText((t) => ctx.measureText(t).width, explorerLine(page), right - left, 2)) {
    ctx.fillText(line, W / 2, ly);
    ly += 48;
  }

  // Footer
  ctx.font = `italic 20px ${FONT_DISPLAY}`;
  ctx.globalAlpha = 0.55;
  ctx.fillText('A Deep Sea Focus Journey', W / 2, H - 70);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  return canvas;
}

export async function exportPagePng(
  page: DiveLogPage,
  artUrl: string | undefined,
  paperUrl: string | undefined,
): Promise<Blob | null> {
  const canvas = await drawPageToCanvas(page, artUrl, paperUrl);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
