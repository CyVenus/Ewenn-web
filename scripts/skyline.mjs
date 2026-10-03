/**
 * Measures the scene's skyline and writes it to src/scene-skyline.json.
 *
 * The copy on the home page has to sit in the sky, above the flag, the board, the banner and the
 * penguin, and where those are depends on the viewport: both artboards cover-fit a fixed picture,
 * so a short, wide window raises the scenery towards the top edge and a tall one lowers it. The
 * page cannot ask the Rive runtime where a prop is, so this script measures it once, at each
 * artboard's own design size — the one viewport where a CSS pixel is exactly one design unit —
 * and the page maps that onto whatever window it is in (src/lib/sceneGeometry.ts).
 *
 * What counts as scenery is decided by the phase, not by colour. Only the sky, the sun and the
 * moon change between day and night (docs/rive-contract.md), so a pixel that is the same in both
 * renders is ground, a prop or a penguin, and one that differs is sky. Translucent clouds differ
 * too, which is right: type over a cloud is type over sky. Snowflakes that happen to land on the
 * same pixel in both renders are dropped as blobs too small to be anything else.
 *
 * Re-export the .riv? Run this against a preview, then `npm test`:
 *
 *   npm run build && npm run preview -- --port 4180
 *   npm run skyline
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4180';
const OUT = 'src/scene-skyline.json';

/** Column width, in design units. 16 is under 10 CSS px on every laptop, and keeps the file small. */
const BUCKET = 16;
/** Channel difference (summed) below which day and night count as the same pixel. */
const SAME = 6;
/** Connected scenery smaller than this many pixels is a stray snowflake, not a prop. */
const MIN_BLOB = 400;

/** Each artboard at its own design size. Keep in step with SCENE_DESIGN in sceneGeometry.ts. */
const ARTBOARDS = [
  { name: 'site-desktop', width: 2243, height: 1205 },
  { name: 'site-mobile', width: 1080, height: 2340 },
];
const SCREENS = ['hero', 'goals', 'friends'];

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

/** One PNG per screen, with the HTML layer hidden and the world snapped to each stop. */
async function render(artboard, phase) {
  for (let attempt = 1; ; attempt++) {
    const context = await browser.newContext({
      viewport: { width: artboard.width, height: artboard.height },
      // Reduced motion snaps the world to each stop instead of walking there, and pauses the
      // snowfall, so the two phases are drawn from the same frame.
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.goto(`${BASE}/?phase=${phase}`, { waitUntil: 'load' });
      await page.waitForSelector('.scene.is-ready', { state: 'attached', timeout: 90_000 });
      await page.waitForSelector('.loader', { state: 'detached', timeout: 90_000 });
      const active = await page.evaluate(() => document.querySelector('.scene canvas')?.width ?? 0);
      if (active !== artboard.width) throw new Error(`canvas is ${active} wide, expected ${artboard.width}`);
      await page.addStyleTag({ content: '.overlay { visibility: hidden !important; }' });
      const shots = {};
      for (const screen of SCREENS) {
        await page.evaluate((id) => {
          const el = document.querySelector(`[data-screen="${id}"]`);
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
        }, screen);
        await page.waitForTimeout(1500);
        shots[screen] = (await page.screenshot()).toString('base64');
      }
      return shots;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`  retrying ${artboard.name} ${phase}: ${error.message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }
}

const analyzer = await browser.newPage();

/** Per column bucket, the highest row of real scenery, in design units from the artboard's top. */
async function skyline(night, day, width, height) {
  return analyzer.evaluate(
    async ({ night, day, width, height, BUCKET, SAME, MIN_BLOB }) => {
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
      // Flood-fill each connected region; a region under MIN_BLOB pixels is cleared.
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
          const neighbours = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
          for (const q of neighbours) {
            if (q < 0 || q >= n || seen[q] || !mask[q]) continue;
            seen[q] = 1;
            stack[top++] = q;
          }
        }
        if (count < MIN_BLOB) for (let k = 0; k < count; k++) mask[members[k]] = 0;
      }
      const buckets = Math.ceil(width / BUCKET);
      const tops = new Array(buckets).fill(height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!mask[y * width + x]) continue;
          const bucket = Math.floor(x / BUCKET);
          if (y < tops[bucket]) tops[bucket] = y;
        }
      }
      return tops;
    },
    { night, day, width, height, BUCKET, SAME, MIN_BLOB },
  );
}

const result = { bucket: BUCKET, artboards: {} };
for (const artboard of ARTBOARDS) {
  console.log(`${artboard.name} ${artboard.width}x${artboard.height}`);
  const night = await render(artboard, 'night');
  const day = await render(artboard, 'day');
  const screens = {};
  for (const screen of SCREENS) {
    screens[screen] = await skyline(night[screen], day[screen], artboard.width, artboard.height);
    const tops = screens[screen];
    const centre = tops[Math.floor(tops.length / 2)];
    console.log(`  ${screen.padEnd(8)} highest ${Math.min(...tops)}, at the centre ${centre}`);
  }
  result.artboards[artboard.name] = { width: artboard.width, height: artboard.height, screens };
}

await browser.close();
// One bucket array per line: diffable, and still a few kilobytes.
const json = JSON.stringify(result, null, 2).replace(/\[\s+([\d,\s]+?)\s+\]/g, (_, list) => `[${list.replace(/\s+/g, '')}]`);
await writeFile(OUT, `${json}\n`);
console.log(`wrote ${OUT}`);
