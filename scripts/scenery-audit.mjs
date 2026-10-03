/**
 * Scenery audit: does any line of copy sit on the scenery, at any window shape people actually use?
 *
 * The layout audit checks boxes against boxes. This checks type against the picture. For each
 * viewport and each screen it renders the page by night and by day with the HTML layer hidden;
 * pixels the two agree on are scenery (only the sky, sun and moon change with the phase — see
 * scripts/skyline.mjs), and every line box of copy is then checked against that mask. It measures
 * the real render, so it also catches a skyline that has drifted from the .riv.
 *
 * Checks, per viewport and screen:
 *   scenery   a line of copy over a prop, a penguin or the ground
 *   offscreen a line of copy outside the viewport
 *   brand     a line of copy over the header's logo and wordmark
 *   footer    a line of copy over the footer pill
 *
 *   npm run build && npm run preview -- --port 4180
 *   npm run scenery                      # the full matrix
 *   npm run scenery -- 1454x690 390x844  # just these
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4180';
const OUT = 'screenshots/scenery';

/**
 * Browser viewports, not screens: a window loses its toolbars, and on a Mac often the dock too,
 * which is exactly what turns a 16:10 laptop into the short, wide shape the scenery climbs into.
 */
const VIEWPORTS = [
  // Laptops, with the browser's chrome and, where marked, the dock.
  ['1280x577', 'laptop 1280x720'],
  ['1280x600', 'laptop 1280x720, kiosk'],
  ['1280x680', 'laptop 1280x800'],
  ['1366x657', 'laptop 1366x768'],
  ['1440x700', 'MacBook Air 13 (1440x900), dock'],
  ['1440x789', 'MacBook Air 13 (1440x900)'],
  ['1454x690', 'reported: 14" with dock'],
  ['1470x700', 'MacBook Air 13 M2, dock'],
  ['1470x830', 'MacBook Air 13 M2'],
  ['1512x760', 'MacBook Pro 14, dock'],
  ['1512x860', 'MacBook Pro 14'],
  ['1536x730', '1920x1080 at 125%'],
  ['1600x789', '1600x900'],
  ['1710x880', 'MacBook Air 15, dock'],
  ['1710x990', 'MacBook Air 15'],
  ['1728x900', 'MacBook Pro 16, dock'],
  ['1728x990', 'MacBook Pro 16'],
  ['1920x950', '1920x1080'],
  ['2560x1300', '2560x1440'],
  ['1440x900', 'reference desktop'],
  // Ultrawide.
  ['2560x970', '21:9 2560x1080'],
  ['3440x1300', '21:9 3440x1440'],
  // Half-screen windows.
  ['720x800', 'half of a 1440 laptop'],
  ['960x950', 'half of a 1920 monitor'],
  ['1280x1300', 'half of a 2560 monitor'],
  // Tablets, in Safari.
  ['744x1062', 'iPad mini portrait'],
  ['768x954', 'iPad 9.7 portrait'],
  ['810x1010', 'iPad 10.2 portrait'],
  ['820x1110', 'iPad Air portrait'],
  ['834x1120', 'iPad Pro 11 portrait'],
  ['1024x1292', 'iPad Pro 12.9 portrait'],
  ['1024x698', 'iPad 9.7 landscape'],
  ['1180x750', 'iPad Air landscape'],
  ['1194x764', 'iPad Pro 11 landscape'],
  ['1366x954', 'iPad Pro 12.9 landscape'],
  // Phones.
  ['320x568', 'iPhone SE 1'],
  ['360x640', 'small Android'],
  ['360x780', 'Android'],
  ['375x667', 'iPhone SE'],
  ['390x844', 'iPhone 14'],
  ['393x852', 'iPhone 15'],
  ['412x915', 'Pixel'],
  ['430x932', 'iPhone Pro Max'],
  // Phones on their side.
  ['667x375', 'iPhone SE landscape'],
  ['844x390', 'iPhone 14 landscape'],
  ['932x430', 'iPhone Pro Max landscape'],
];

const SCREENS = ['hero', 'goals', 'friends'];
/** Summed channel difference below which day and night are the same pixel. */
const SAME = 6;
/** Connected scenery smaller than this is a snowflake that landed twice, not a prop. */
const MIN_BLOB = 150;
/** A line may touch this many scenery pixels — an antialiased edge — before it counts. */
const TOLERANCE = 12;

const only = process.argv.slice(2);
const viewports = only.length
  ? only.map((size) => [size, 'requested'])
  : VIEWPORTS;

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
await mkdir(OUT, { recursive: true });

/** Software rendering is slow and occasionally stalls a screenshot, so a render gets three tries. */
async function render(width, height, phase) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await renderOnce(width, height, phase);
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`  retrying ${width}x${height} ${phase}: ${error.message.split('\n')[0]}`);
    }
  }
}

async function renderOnce(width, height, phase) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${BASE}/?phase=${phase}`, { waitUntil: 'load' });
    await page.waitForSelector('.scene.is-ready', { state: 'attached', timeout: 90_000 });
    await page.waitForSelector('.loader', { state: 'detached', timeout: 90_000 });
    await page.evaluate(() => document.fonts.ready);
    const result = {};
    for (const screen of SCREENS) {
      await page.evaluate((id) => {
        const el = document.querySelector(`[data-screen="${id}"]`);
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
      }, screen);
      await page.waitForTimeout(1200);
      const layout = await page.evaluate((id) => {
        const box = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        const screenEl = document.querySelector(`[data-screen="${id}"]`);
        const block = screenEl.querySelector(':scope > .screen__pin, :scope > .stop__copy');
        const lines = [];
        for (const el of block.querySelectorAll('.hero__title, .stop__title, .hero__subline, .stop__body')) {
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) lines.push({ what: el.className.split(' ')[0], ...box(r) });
        }
        const badge = block.querySelector('.store-badge__img');
        if (badge) lines.push({ what: 'badge', ...box(badge.getBoundingClientRect()) });
        return {
          lines,
          brand: box(document.querySelector('.brand').getBoundingClientRect()),
          footer: box(document.querySelector('.site-footer').getBoundingClientRect()),
          mode: screenEl.dataset.copyMode ?? '-',
          fit: Number(getComputedStyle(screenEl).getPropertyValue('--copy-fit') || 1),
          titleSize: parseFloat(getComputedStyle(block.querySelector('.hero__title, .stop__title')).fontSize),
        };
      }, screen);
      await page.addStyleTag({ content: '.overlay { visibility: hidden !important; }' });
      const scene = (await page.screenshot({ timeout: 90_000 })).toString('base64');
      await page.addStyleTag({ content: '.overlay { visibility: visible !important; }' });
      const shot = phase === 'night' ? await page.screenshot({ path: `${OUT}/${width}x${height}-${screen}.png`, timeout: 90_000 }) : null;
      result[screen] = { layout, scene, shot: Boolean(shot) };
    }
    return result;
  } finally {
    await context.close();
  }
}

const analyzer = await browser.newPage();

async function collisions(night, day, width, height, lines) {
  return analyzer.evaluate(
    async ({ night, day, width, height, lines, SAME, MIN_BLOB }) => {
      const decode = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = new OffscreenCanvas(width, height);
        const g = canvas.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, width, height).data;
      };
      const a = await decode(night);
      const b = await decode(day);
      const n = width * height;
      const mask = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const d = Math.abs(a[i * 4] - b[i * 4]) + Math.abs(a[i * 4 + 1] - b[i * 4 + 1]) + Math.abs(a[i * 4 + 2] - b[i * 4 + 2]);
        mask[i] = d < SAME ? 1 : 0;
      }
      const seen = new Uint8Array(n);
      const stack = new Int32Array(n);
      const members = new Int32Array(n);
      for (let start = 0; start < n; start++) {
        if (!mask[start] || seen[start]) continue;
        let top = 0;
        let count = 0;
        stack[top++] = start;
        seen[start] = 1;
        while (top) {
          const p = stack[--top];
          members[count++] = p;
          const x = p % width;
          for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
            if (q < 0 || q >= n || seen[q] || !mask[q]) continue;
            seen[q] = 1;
            stack[top++] = q;
          }
        }
        if (count < MIN_BLOB) for (let k = 0; k < count; k++) mask[members[k]] = 0;
      }
      return lines.map((line) => {
        let hits = 0;
        const x0 = Math.max(0, Math.floor(line.left));
        const x1 = Math.min(width, Math.ceil(line.right));
        const y0 = Math.max(0, Math.floor(line.top));
        const y1 = Math.min(height, Math.ceil(line.bottom));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hits += mask[y * width + x];
        return hits;
      });
    },
    { night, day, width, height, lines, SAME, MIN_BLOB },
  );
}

const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const rows = [];
let failures = 0;

for (const [size, label] of viewports) {
  const [width, height] = size.split('x').map(Number);
  const night = await render(width, height, 'night');
  const day = await render(width, height, 'day');
  for (const screen of SCREENS) {
    const { layout } = night[screen];
    const hits = await collisions(night[screen].scene, day[screen].scene, width, height, layout.lines);
    const fail = [];
    const worst = Math.max(0, ...hits);
    if (worst > TOLERANCE) {
      const what = [...new Set(layout.lines.filter((_, i) => hits[i] > TOLERANCE).map((l) => l.what))];
      fail.push(`on scenery (${worst}px, ${what.join(', ')})`);
    }
    if (layout.lines.some((l) => l.left < -0.5 || l.right > width + 0.5 || l.top < -0.5 || l.bottom > height + 0.5)) {
      fail.push('offscreen');
    }
    if (layout.lines.some((l) => intersects(l, layout.brand))) fail.push('over the wordmark');
    if (layout.lines.some((l) => intersects(l, layout.footer))) fail.push('over the footer');
    const bottom = Math.max(...layout.lines.map((l) => l.bottom));
    rows.push({ size, label, screen, mode: layout.mode, fit: layout.fit, titleSize: layout.titleSize, bottom, worst, fail });
    if (fail.length) failures += 1;
    console.log(
      `${fail.length ? 'FAIL' : 'ok  '} ${size.padEnd(10)} ${screen.padEnd(8)} ${layout.mode.padEnd(7)}` +
        ` fit=${layout.fit.toFixed(2)} h1=${Math.round(layout.titleSize)}px` +
        `  ${label}${fail.length ? `  << ${fail.join('; ')}` : ''}`,
    );
  }
}

await browser.close();
await writeFile(`${OUT}/report.json`, JSON.stringify(rows, null, 2));
console.log(`\n${rows.length - failures}/${rows.length} clear`);
if (failures) process.exitCode = 1;
