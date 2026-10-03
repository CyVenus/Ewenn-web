/**
 * Screenshot matrix: every viewport shape the safe zones call out, in every phase.
 *
 * The page is driven by `?phase=`, which pins the phase and stops the 60s tick, so a shot can
 * never land mid-transition. Each run asserts that `<html data-phase>` actually matches what was
 * asked for — a silently ignored override would otherwise produce 24 identical day shots.
 *
 * Headless Chromium has no real GPU, so WebGL2 comes from SwiftShader. Without those flags the
 * scene takes the no-WebGL2 fallback path and the matrix measures the wrong page.
 *
 *   node scripts/screenshots.mjs            # the 24-shot matrix
 *   node scripts/screenshots.mjs fallback   # asserts the page survives with WebGL disabled
 *
 * BASE_URL overrides the target; HEADED=1 runs with a visible window.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4180';
const OUT = 'screenshots';
const MODE = process.argv[2] ?? 'matrix';
const HEADED = process.env.HEADED === '1';

/**
 * `titleLines` is the headline's expected line count at that shape, and it is an assertion, not
 * a note: the reference design sets "Your new self-care partner." on one line, and the two
 * places it legitimately wraps are a portrait phone and the narrow landscape corridor. Encoding
 * it per viewport rather than deriving it from the width keeps the corridor's own rules honest.
 */
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900, titleLines: 1 },
  { name: 'desktop-1920x1080', width: 1920, height: 1080, titleLines: 1 },
  { name: 'ultrawide-2560x1080', width: 2560, height: 1080, titleLines: 1 },
  { name: 'phone-390x844', width: 390, height: 844, titleLines: 2 },
  { name: 'phone-landscape-844x390', width: 844, height: 390, titleLines: 2 },
  { name: 'tablet-820x1180', width: 820, height: 1180, titleLines: 1 },
  // Short-but-wide laptop shapes, either side of the corridor threshold. These are the shapes
  // that catch a regression in that media query.
  { name: 'laptop-1280x694', width: 1280, height: 694, titleLines: 1 },
  { name: 'laptop-1366x768', width: 1366, height: 768, titleLines: 1 },
];

const PHASES = ['night', 'day', 'noon', 'evening'];

const GPU_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
];

/** Waits for the scene to report ready, or for the page to admit it fell back. */
async function settle(page) {
  await page.waitForSelector('.scene.is-ready, .page--scene-failed', { timeout: 20_000 });
  // The loading animation holds the page until its intro has played; measure what it reveals.
  await page.waitForSelector('.loader', { state: 'detached', timeout: 20_000 });
  // The hero's entrance finishes ~1.75s after render, its highlighter stroke last. Without a
  // scene, "ready" comes almost at once, so the wait has to cover the whole entrance by itself.
  await page.waitForTimeout(2000);
}

async function run() {
  await mkdir(OUT, { recursive: true });

  const launch = { headless: !HEADED, channel: 'chrome', args: MODE === 'fallback' ? [] : GPU_ARGS };
  if (MODE === 'fallback') launch.args = ['--disable-webgl', '--disable-3d-apis'];

  const browser = await chromium.launch(launch);
  const results = [];

  if (MODE === 'fallback') {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/?phase=day`, { waitUntil: 'load' });
    await settle(page);
    const failed = await page.evaluate(() => Boolean(document.querySelector('.page--scene-failed')));
    // The point of this mode: no WebGL2 must produce the static sky, not a broken page.
    const ok = failed && errors.length === 0;
    await page.screenshot({ path: `${OUT}/fallback-no-webgl.png` });
    results.push({ shot: 'fallback-no-webgl', ok, failedClass: failed, errors });
    await browser.close();
    await report(results);
    return;
  }

  for (const viewport of VIEWPORTS) {
    for (const phase of PHASES) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      await page.goto(`${BASE}/?phase=${phase}`, { waitUntil: 'load' });
      await settle(page);

      const state = await page.evaluate(() => {
        const title = document.querySelector('.hero__title');
        return {
          phase: document.documentElement.dataset.phase,
          sceneReady: Boolean(document.querySelector('.scene.is-ready')),
          sceneFailed: Boolean(document.querySelector('.page--scene-failed')),
          // Height over line-height. NOT getClientRects().length: the h1 is a block, so that
          // returns a single border box however many lines of text are inside it.
          titleLines: title
            ? Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight))
            : 0,
          // A break at the hyphen would put "care partner." at the start of a line; the phrase
          // is wrapped in an inline-block precisely to make that impossible.
          brokeAtHyphen: Boolean(
            title && getComputedStyle(title.querySelector('.hero__title-phrase')).display !== 'inline-block',
          ),
        };
      });

      const shot = `${viewport.name}-${phase}`;
      await page.screenshot({ path: `${OUT}/${shot}.png` });
      const expectedLines = viewport.titleLines;
      const layoutOk = state.titleLines === expectedLines && !state.brokeAtHyphen;
      const ok =
        state.phase === phase && state.sceneReady && !state.sceneFailed && layoutOk && errors.length === 0;
      if (!layoutOk) {
        errors.push(`headline is ${state.titleLines} line(s), expected ${expectedLines}`);
      }
      results.push({ shot, ok, ...state, errors });
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${shot}  phase=${state.phase} ready=${state.sceneReady} errors=${errors.length}`);
      await page.close();
    }
  }

  await browser.close();
  await report(results);
}

async function report(results) {
  await writeFile(`${OUT}/report.json`, JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} ok`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL ${f.shot}: ${JSON.stringify(f.errors ?? [])}`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
