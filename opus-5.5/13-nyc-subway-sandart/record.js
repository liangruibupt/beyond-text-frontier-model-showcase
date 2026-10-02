// Deterministic frame capture, paced by narration durations (durations.json).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIR = __dirname;
const FRAMES = path.join(DIR, 'frames');
const CHROME = '/home/ubuntu/.cache/ms-playwright/chromium-1208/chrome-linux/chrome';
const FPS = 25;

(async () => {
  const durations = JSON.parse(fs.readFileSync(path.join(DIR, 'durations.json'), 'utf8'));
  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  // inject DURATIONS BEFORE any page script runs so the timeline uses it
  await page.addInitScript((d) => { window.DURATIONS = d; }, durations);
  await page.goto('file://' + path.join(DIR, 'index.html'));

  const total = await page.evaluate(() => window.__animState().TOTAL);
  const nFrames = Math.ceil((total / 1000) * FPS) + Math.round(FPS * 1.0); // + small tail
  console.log('TOTAL_MS', total, 'FRAMES', nFrames);

  await page.evaluate(() => { window.__cap = true; window.__resetT(); });

  for (let i = 0; i < nFrames; i++) {
    await page.evaluate(() => window.__animStep());
    const name = 'f_' + String(i + 1).padStart(6, '0') + '.png';
    await page.screenshot({ path: path.join(FRAMES, name) });
  }
  console.log('CAPTURED', nFrames, 'frames');
  await browser.close();
})().catch(e => { console.error('REC_FAIL', e); process.exit(1); });
