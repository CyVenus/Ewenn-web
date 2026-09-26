/**
 * Copies the protected source artwork in `assets/` to the places the app actually loads it from,
 * and verifies the copies byte-for-byte.
 *
 * `assets/` holds the originals: the two Rive exports and the two SVGs, none of which this project
 * generates. They are needed in two other shapes — `public/` for files served by URL at runtime
 * (the `.riv` is fetched by the runtime, the favicon by the browser) and `src/assets/` for files
 * Vite fingerprints into the bundle. Nothing derives one from the other, so before this script
 * the logo existed three times and the `.riv` twice with no way to notice a re-export landing in
 * one place and not the others. A stale `.riv` is the expensive one: the site would keep running
 * and quietly draw the previous scene.
 *
 *   node scripts/sync-assets.mjs         # copy, then verify
 *   node scripts/sync-assets.mjs --check # verify only; non-zero exit if anything drifted
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const CHECK_ONLY = process.argv.includes('--check');

/** from → every place it must exist, identical. */
const COPIES = [
  ['assets/rive/ewenn-scene.riv', 'public/rive/ewenn-scene.riv'],
  ['assets/rive/loading-anim.riv', 'public/rive/loading-anim.riv'],
  ['assets/app_logo.svg', 'public/favicon.svg'],
  ['assets/app_logo.svg', 'src/assets/app-logo.svg'],
  ['assets/app-store-badge.svg', 'src/assets/app-store-badge.svg'],
];

const md5 = async (path) => createHash('md5').update(await readFile(path)).digest('hex');

let drifted = 0;

for (const [from, to] of COPIES) {
  const source = await md5(from);
  let target = null;
  try {
    target = await md5(to);
  } catch {
    target = null;
  }

  if (source === target) {
    console.log(`ok       ${to}`);
    continue;
  }

  if (CHECK_ONLY) {
    console.log(`DRIFTED  ${to}  (${target ?? 'missing'} != ${source})`);
    drifted += 1;
    continue;
  }

  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
  const after = await md5(to);
  if (after !== source) throw new Error(`copy of ${from} -> ${to} did not verify`);
  console.log(`copied   ${to}`);
}

if (drifted > 0) {
  console.log(`\n${drifted} file(s) out of sync. Run: npm run sync:assets`);
  process.exitCode = 1;
} else {
  console.log(`\n${COPIES.length}/${COPIES.length} in sync`);
}
