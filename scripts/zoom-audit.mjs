/**
 * Zoom lock audit.
 *
 * Zoom is not a viewport size you can just open a window at: the lock only engages when
 * devicePixelRatio MOVES while the page is live, because a level the browser saved before load is
 * indistinguishable from the display's own scale. So each shape here loads at 100% and is then
 * zoomed through CDP — `Emulation.setDeviceMetricsOverride` shrinks the CSS viewport and raises
 * the ratio together, which is precisely what a visitor pressing ctrl+plus does to the page.
 *
 * Everything is measured in DEVICE pixels, because that is the only frame of reference a zoom
 * does not move. The promise under test is that nothing grows: at 300% the headline must occupy
 * the same physical space on the glass as it did at 100%, not three times it.
 *
 *   overflow   the document wider than the window - a zoom lock that overflows is worse than none
 *   scene      the canvas still covering the window, which is what --vp-h-large is for
 *   magnified  any element whose physical size grew with the zoom
 *
 *   node scripts/zoom-audit.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4180';

/** The window the baseline is taken at. Every step below is this window, zoomed. */
const WINDOW = { width: 1440, height: 900 };

/** Chrome's own ladder, from a step out to the far end of it. */
const STEPS = [0.5, 1.1, 1.25, 1.5, 2, 3, 5];

const PAGES = [
  { name: 'home', path: '/?phase=day', parts: ['.brand__icon', '.hero__title', '.hero__subline', '.store-badge__img', '.site-footer'] },
  { name: 'privacy', path: '/privacy/?phase=day', parts: ['.brand__icon', '.doc__article h1', '.doc__article p'] },
];

/**
 * Physical geometry: CSS pixels are what a zoom changes, so every figure is multiplied back out
 * by the ratio. Everything this needs is declared inside it — page.evaluate ships the function,
 * not the scope it was written in.
 */
function measure(selectors) {
  const dpr = window.devicePixelRatio;
  const of = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      width: +(rect.width * dpr).toFixed(1),
      height: +(rect.height * dpr).toFixed(1),
      font: +(parseFloat(getComputedStyle(el).fontSize) * dpr).toFixed(1),
    };
  };
  const scene = document.querySelector('.scene')?.getBoundingClientRect();
  const body = document.body.getBoundingClientRect();
  return {
    dpr,
    css: window.innerWidth + 'x' + window.innerHeight,
    applied: document.documentElement.style.zoom || '(none)',
    // Both sides in real CSS pixels, so this is a true overflow and not a units mismatch.
    overflow: +(body.right - window.innerWidth).toFixed(1),
    scene: scene
      ? {
          covers:
            Math.abs(scene.width - window.innerWidth) <= 1 &&
            Math.abs(scene.height - window.innerHeight) <= 1,
        }
      : null,
    parts: Object.fromEntries(selectors.map((selector) => [selector, of(selector)])),
  };
}

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

await mkdir('screenshots/zoom', { recursive: true });
const rows = [];

for (const pageDef of PAGES) {
  const page = await browser.newPage({ viewport: WINDOW, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`${BASE}${pageDef.path}`, { waitUntil: 'load' });
  if (pageDef.name === 'home') {
    await page.waitForSelector('.scene.is-ready, .page--scene-failed', { timeout: 20_000 });
    // The loading animation holds the page until its intro has played; measure what it reveals.
    await page.waitForSelector('.loader', { state: 'detached', timeout: 20_000 });
  }
  await page.waitForTimeout(pageDef.name === 'home' ? 1200 : 300);

  const baseline = await page.evaluate(measure, pageDef.parts);
  await page.screenshot({ path: `screenshots/zoom/${pageDef.name}-100.png` });
  console.log(`\n${pageDef.name} @ 100%  ${baseline.css}  dpr=${baseline.dpr}`);

  for (const zoom of STEPS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: Math.round(WINDOW.width / zoom),
      height: Math.round(WINDOW.height / zoom),
      deviceScaleFactor: zoom,
      mobile: false,
    });
    // The lock settles synchronously on resize; the Rive artboard swap is debounced behind it.
    await page.waitForTimeout(pageDef.name === 'home' ? 900 : 250);

    const now = await page.evaluate(measure, pageDef.parts);
    await page.screenshot({ path: `screenshots/zoom/${pageDef.name}-${zoom * 100}.png` });

    const fail = [];
    if (now.overflow > 1) fail.push(`overflows ${now.overflow}px`);
    if (now.scene && !now.scene.covers) fail.push('scene no longer covers the window');
    // 2% of slack for the rounding a fractional step leaves in a whole-pixel viewport.
    for (const [selector, part] of Object.entries(now.parts)) {
      const was = baseline.parts[selector];
      if (!was || !part) continue;
      if (part.width > was.width * 1.02) fail.push(`${selector} ${was.width}→${part.width}dp wide`);
      if (part.font > was.font * 1.02) fail.push(`${selector} type ${was.font}→${part.font}dp`);
    }

    rows.push({ page: pageDef.name, zoom, ...now, fail });
    console.log(
      `${fail.length ? 'FAIL' : 'ok  '} ${String(zoom * 100 + '%').padStart(5)}` +
        ` css=${now.css.padEnd(10)} dpr=${String(now.dpr).padEnd(4)} zoom=${String(now.applied).padEnd(20)}` +
        (fail.length ? `  << ${fail.join('; ')}` : ''),
    );
  }

  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.close();
}

await browser.close();
await writeFile('screenshots/zoom/report.json', JSON.stringify(rows, null, 2));
const failed = rows.filter((row) => row.fail.length);
console.log(`\n${rows.length - failed.length}/${rows.length} zoom steps clean`);
if (failed.length) process.exitCode = 1;
