// Recapture the preview screenshots in docs/preview/ (round 5 set).
//
//   npm run previews
//
// Needs Chrome and puppeteer-core (not a project dependency):
//   npm i --no-save puppeteer-core
//   CHROME_PATH="/path/to/chrome" npm run previews     # optional override
// Set COPY_TO=/some/dir to also copy the PNGs there.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is not installed. Run: npm i --no-save puppeteer-core');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'preview');
const copyTo = process.env.COPY_TO;
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(outDir, { recursive: true });
if (copyTo) fs.mkdirSync(copyTo, { recursive: true });

const server = await createServer({ root, server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = `http://localhost:${server.config.server.port}`;
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 900 },
});

async function shot(page, name) {
  await page.evaluate(() => document.getElementById('debug-panel')?.classList.add('hidden'));
  const file = `round5-${name}.png`;
  await page.screenshot({ path: path.join(outDir, file) });
  if (copyTo) fs.copyFileSync(path.join(outDir, file), path.join(copyTo, file));
  console.log('wrote', file);
}

const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
const open = async (query, settle = 1500) => {
  await page.goto(`${base}/?${query}`, { waitUntil: 'domcontentloaded' });
  await sleep(settle);
};

// Cover: closed, then the board mid-swing.
await open('debug=1&cover=1', 900);
await shot(page, 'cover-closed');
// Freeze the swing at a fixed point (0.9 s in, about 60 degrees) so the frame
// does not depend on screenshot timing.
await page.waitForSelector('.cover.opening');
await page.evaluate(() => {
  const front = document.querySelector('.cover-front');
  front.style.animationPlayState = 'paused';
  front.style.animationDelay = '-0.9s';
});
await sleep(150);
await shot(page, 'cover-opening');

// Focus goal slip.
await open('debug=1&zone=2');
await page.type('#goal-input', 'Finish the quarterly report draft');
await shot(page, 'focus-goal');

// Escalating eye.
for (const level of [1, 2, 3]) {
  await open(`debug=1&zone=3&eye=${level}`, 1800);
  await shot(page, `eye-${level}`);
}

// Return reaction (ink recedes, octopus peeks, line appears).
await open('debug=1&zone=3&eye=2&return=1', 6800);
await shot(page, 'return');

// Dive log page and the Log tab.
await open('debug=1&log=1', 2200);
await shot(page, 'dive-log');
await open('debug=1&log=tab', 2200);
await shot(page, 'log-tab');

await browser.close();
await server.close();
