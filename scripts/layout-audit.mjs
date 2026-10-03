/**
 * Responsive and zoom audit.
 *
 * Browser zoom does not add a separate mode to test: zooming to 400% on a 1600px window gives the
 * page a 400px CSS viewport, so a small viewport here reproduces a high zoom there. What high zoom
 * adds is SHORT viewports, because the window's height shrinks by the same factor — that is the
 * case ordinary responsive testing misses, and it is where this site's fixed-height hero stack
 * runs out of room.
 *
 * Checks, per shape:
 *   overflowX   horizontal scrolling — a WCAG 1.4.10 reflow failure, never acceptable
 *   overflowY   content taller than the viewport, measured so it can be judged, not banned
 *   overlap     the header's mark, the hero and the footer intersecting each other
 *   offscreen   any hero element whose box leaves the viewport
 *   titleLines  how the headline wrapped
 *
 *   node scripts/layout-audit.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4180';

/** Real shapes, plus the ones 200–400% zoom produces on a laptop. */
const SHAPES = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'laptop-1280x694', width: 1280, height: 694 },
  { name: 'tablet-820x1180', width: 820, height: 1180 },
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'phone-360x640', width: 360, height: 640 },
  { name: 'phone-320x568', width: 320, height: 568 },
  { name: 'reflow-320x256', width: 320, height: 256 },
  { name: 'zoom200-720x450', width: 720, height: 450 },
  { name: 'zoom250-576x360', width: 576, height: 360 },
  { name: 'zoom300-480x300', width: 480, height: 300 },
  { name: 'zoom400-360x225', width: 360, height: 225 },
  { name: 'zoom400-tall-500x400', width: 500, height: 400 },
  { name: 'landscape-844x390', width: 844, height: 390 },
  // A phone that is itself zoomed: portrait, but short in absolute terms.
  { name: 'phone-zoom200-195x422', width: 195, height: 422 },
  { name: 'phone-zoom150-260x563', width: 260, height: 563 },
  { name: 'portrait-short-320x400', width: 320, height: 400 },
  // What a 1440x900 laptop actually produces at the zoom steps Chrome offers.
  { name: 'zoom125-1152x720', width: 1152, height: 720 },
  { name: 'zoom150-960x600', width: 960, height: 600 },
  { name: 'zoom175-823x514', width: 823, height: 514 },
  { name: 'zoom500-288x180', width: 288, height: 180 },
  { name: 'ultrawide-3440x1440', width: 3440, height: 1440 },
  // A desktop window dragged narrow but left tall — portrait proportions at desktop scale.
  { name: 'narrow-tall-500x900', width: 500, height: 900 },
];

/** Pages to audit. The documents are a different layout and deserve the same treatment. */
const PAGES = [
  { name: 'home', path: '/?phase=day' },
  { name: 'privacy', path: '/privacy/?phase=day' },
];

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

await mkdir('screenshots/layout', { recursive: true });
const rows = [];

for (const pageDef of PAGES) {
 for (const shape of SHAPES) {
  const page = await browser.newPage({ viewport: { width: shape.width, height: shape.height } });
  await page.goto(`${BASE}${pageDef.path}`, { waitUntil: 'load' });
  // The documents carry no canvas, so only the home page has a scene to wait for.
  if (pageDef.name === 'home') {
    await page.waitForSelector('.scene.is-ready, .page--scene-failed', { timeout: 20_000 });
    // The loading animation holds the page until its intro has played; measure what it reveals.
    await page.waitForSelector('.loader', { state: 'detached', timeout: 20_000 });
  }
  await page.waitForTimeout(pageDef.name === 'home' ? 1200 : 300);

  const result = await page.evaluate(() => {
    // Declared in here, not in the Node scope: page.evaluate ships the function, not its closure.
    const intersects = (a, b) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
    };
    const doc = document.documentElement;
    // The mark, not the header bar: the bar is the full width of the window and mostly empty, and
    // a short, wide window sets the copy in that row beside the mark (src/lib/copyFit.ts).
    const header = box('.brand');
    const title = box('.hero__title');
    const subline = box('.hero__subline');
    const badge = box('.store-badge');
    const footer = box('.site-footer');
    const titleEl = document.querySelector('.hero__title');

    const vw = doc.clientWidth;
    const vh = doc.clientHeight;
    const hero = [title, subline, badge].filter(Boolean);

    return {
      vw,
      vh,
      overflowX: doc.scrollWidth - doc.clientWidth,
      overflowY: doc.scrollHeight - doc.clientHeight,
      // The home page is a stack of full-height screens, one per stop, so it is MEANT to scroll
      // (screens - 1) viewports. The budget below is measured from there, not from zero.
      screens: document.querySelectorAll('[data-screen]').length,
      titleLines: titleEl
        ? Math.round(titleEl.getBoundingClientRect().height / parseFloat(getComputedStyle(titleEl).lineHeight))
        : 0,
      brandIcon: box('.brand__icon')?.w ?? 0,
      titleFont: titleEl ? parseFloat(getComputedStyle(titleEl).fontSize) : 0,
      // Header overlapping the hero, or the hero overlapping the footer, is the visible failure.
      headerOverHero: Boolean(header && title && intersects(header, title)),
      heroOverFooter: Boolean(footer && hero.some((b) => intersects(b, footer))),
      // Anything that leaves the viewport box entirely.
      offscreen: [
        title && title.bottom > vh ? 'title' : null,
        subline && subline.bottom > vh ? 'subline' : null,
        badge && badge.bottom > vh ? 'badge' : null,
        footer && footer.bottom > vh + 1 ? 'footer' : null,
        hero.some((b) => b.left < 0 || b.right > vw) ? 'hero-sideways' : null,
      ].filter(Boolean),
    };
  });

  await page.screenshot({ path: `screenshots/layout/${pageDef.name}-${shape.name}.png` });

  // WCAG 1.4.10 forbids scrolling in TWO directions; scrolling down at high zoom is expected and
  // fine. So horizontal overflow and overlaps are hard failures, and vertical scroll is judged by
  // amount: more than half a screen of it means the stack still has not been compacted enough.
  const fail = [];
  if (result.overflowX > 0) fail.push(`overflowX ${result.overflowX}px`);
  if (result.headerOverHero) fail.push('header overlaps hero');
  if (result.heroOverFooter) fail.push('hero overlaps footer');
  if (result.offscreen.includes('hero-sideways')) fail.push('hero leaves the viewport sideways');
  // A legal document is meant to scroll, so only the home page has a vertical budget — and only
  // down to WCAG 1.4.10's own target of 320x256. Below that the header, hero and footer cannot
  // physically fit whatever we do, and scrolling is the correct answer rather than a defect.
  //
  // Home is one full-height screen per stop, so its designed scroll is (screens - 1) viewports.
  // This budget used to be measured from zero, from when home was a single screen; after the
  // scroll world landed it failed every shape by exactly the screens it was built to have, and
  // a real overflow would have hidden in that noise. What is judged now is the EXCESS: a screen
  // that grew past its own height pushes everything below it down, and that is what shows here.
  const designedScroll = Math.max(0, (result.screens ?? 1) - 1) * result.vh;
  const excessScroll = result.overflowY - designedScroll;
  if (pageDef.name === 'home' && result.vh >= 256 && excessScroll > result.vh * 0.5) {
    fail.push(`scrolls ${excessScroll}px past its ${result.screens} screens (> half a screen)`);
  }

  rows.push({ page: pageDef.name, shape: shape.name, ...result, fail });
  const flag = fail.length ? 'FAIL' : 'ok  ';
  console.log(
    `${flag} ${(pageDef.name + '/' + shape.name).padEnd(31)} ${String(result.vw).padStart(4)}x${String(result.vh).padEnd(5)}` +
      ` h1=${String(Math.round(result.titleFont)).padStart(2)}px/${result.titleLines}ln` +
      ` icon=${Math.round(result.brandIcon)}px` +
      ` scrollY=+${result.overflowY}` +
      (fail.length ? `  << ${fail.join('; ')}` : ''),
  );
  await page.close();
 }
}

await browser.close();
await writeFile('screenshots/layout/report.json', JSON.stringify(rows, null, 2));
const failed = rows.filter((r) => r.fail.length);
console.log(`\n${rows.length - failed.length}/${rows.length} shapes clean`);
if (failed.length) process.exitCode = 1;
