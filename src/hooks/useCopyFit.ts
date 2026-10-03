import { useLayoutEffect, type RefObject } from 'react';
import type { SceneArtboard } from '../lib/artboard';
import { placeCopy, placeStops, type Box, type CopyFitInput, type CopyMode, type CopyPlacement, type CopyRow } from '../lib/copyFit';
import { fallbackSkyline, sceneSkyline, type SceneScreen } from '../lib/sceneGeometry';
import { designViewport } from '../lib/zoomLock';

const SCREENS = new Set<string>(['hero', 'goals', 'friends'] satisfies SceneScreen[]);
const PROPERTIES = ['--copy-top', '--copy-left', '--copy-w', '--copy-fit'] as const;

/**
 * Where an element sits inside one of its ancestors, from layout alone.
 *
 * Offsets rather than getBoundingClientRect, because the copy is almost always mid-animation when
 * this runs — its entrance holds every word 10px low under the loader, and the walk writes a
 * transform on each title word as it focuses — and a rect would measure the animation, not the
 * layout. The ancestor has to be positioned for the chain to reach it; global.css makes sure.
 */
function offsetIn(element: HTMLElement, ancestor: HTMLElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let node: Element | null = element;
  while (node instanceof HTMLElement && node !== ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return { left, top };
}

/** The block's title, paragraph and badge, as the solver needs them. */
function rowsOf(block: HTMLElement): CopyRow[] {
  const rows: CopyRow[] = [];
  const title = block.querySelector<HTMLElement>('.hero__title, .stop__title');
  if (title) {
    const at = offsetIn(title, block);
    // The words, not the heading's box: the box is the full column wide and the ink rarely is.
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const word of title.querySelectorAll<HTMLElement>('.blur-text-word')) {
      const offset = offsetIn(word, block);
      left = Math.min(left, offset.left);
      right = Math.max(right, offset.left + word.offsetWidth);
    }
    if (!Number.isFinite(left)) {
      left = at.left;
      right = at.left + title.offsetWidth;
    }
    // The pen stroke under a marked phrase hangs 0.12em below the line box (global.css).
    const stroke = (parseFloat(getComputedStyle(title).fontSize) || 0) * 0.12;
    rows.push({ bottom: at.top + title.offsetHeight + stroke, left, right });
  }
  for (const paragraph of block.querySelectorAll<HTMLElement>('.hero__subline, .stop__body')) {
    const at = offsetIn(paragraph, block);
    rows.push({ bottom: at.top + paragraph.offsetHeight, left: at.left, right: at.left + paragraph.offsetWidth });
  }
  const badge = block.querySelector<HTMLElement>('.store-badge__img');
  if (badge) {
    const at = offsetIn(badge, block);
    rows.push({ bottom: at.top + badge.offsetHeight, left: at.left, right: at.left + badge.offsetWidth });
  }
  return rows;
}

function clear(screen: HTMLElement) {
  for (const property of PROPERTIES) screen.style.removeProperty(property);
  delete screen.dataset.copyMode;
}

function apply(screen: HTMLElement, placement: CopyPlacement) {
  screen.style.setProperty('--copy-top', `${placement.top}px`);
  screen.style.setProperty('--copy-left', `${placement.left}px`);
  screen.style.setProperty('--copy-w', `${placement.width}px`);
  screen.style.setProperty('--copy-fit', String(placement.fit));
  screen.dataset.copyMode = placement.mode;
}

/** Lays out every screen's copy against the scenery it will stand over. */
export function fitCopy(page: HTMLElement, artboard: SceneArtboard, sceneFailed: boolean): void {
  const header = page.querySelector<HTMLElement>('.site-header');
  const mark = header?.querySelector<HTMLElement>('.brand');
  // The window the page is laid out in, which under the zoom lock is not the one it is shown in:
  // the lock scales the document back to the size it loaded at (lib/zoomLock.ts).
  const { width, height } = designViewport(window);
  if (!header || !mark || !(width > 0) || !(height > 0)) return;

  const screens = Array.from(page.querySelectorAll<HTMLElement>('[data-screen]'));
  // Back to the stylesheet's own layout first: that is what `preferred` is read from.
  screens.forEach(clear);

  const style = getComputedStyle(header);
  const gutters = { left: parseFloat(style.paddingLeft) || 0, right: parseFloat(style.paddingRight) || 0 };
  const brand: Box = {
    left: header.offsetLeft + mark.offsetLeft,
    top: header.offsetTop + mark.offsetTop,
    right: header.offsetLeft + mark.offsetLeft + mark.offsetWidth,
    bottom: header.offsetTop + mark.offsetTop + mark.offsetHeight,
  };
  // The canvas is 100lvh, which on a phone is taller than the window while its toolbars show. The
  // world is fitted to the canvas, so that is the box to map the skyline onto.
  const scene = page.querySelector<HTMLElement>('.scene');
  const sceneWidth = scene?.offsetWidth || width;
  const sceneHeight = scene?.offsetHeight || height;

  const hero: { screen: HTMLElement; input: CopyFitInput }[] = [];
  const stops: { screen: HTMLElement; input: CopyFitInput }[] = [];
  for (const screen of screens) {
    const id = screen.dataset.screen ?? '';
    const block = screen.querySelector<HTMLElement>(':scope > .screen__pin, :scope > .stop__copy');
    // A stop the skyline has not been measured for keeps the stylesheet's layout, and so does a
    // block with no layout to measure.
    if (!block || !SCREENS.has(id) || !(block.offsetWidth > 0)) continue;
    const skyline = sceneFailed
      ? fallbackSkyline(width, height)
      : sceneSkyline(artboard, id as SceneScreen, sceneWidth, sceneHeight);
    const preferred = { top: parseFloat(getComputedStyle(screen).paddingTop) || 0, width: block.offsetWidth };
    const measured = new Map<string, CopyRow[]>();
    const measure = (blockWidth: number, fit: number, mode: CopyMode) => {
      const key = `${blockWidth}|${fit}|${mode}`;
      let rows = measured.get(key);
      if (!rows) {
        screen.style.setProperty('--copy-w', `${blockWidth}px`);
        screen.style.setProperty('--copy-fit', String(fit));
        screen.dataset.copyMode = mode;
        rows = rowsOf(block);
        measured.set(key, rows);
      }
      return rows;
    };
    const entry = { screen, input: { viewport: { width, height }, brand, gutters, preferred, skyline, measure } };
    (id === 'hero' ? hero : stops).push(entry);
  }

  // The hero is placed on its own; it carries the badge and never sits beside a stop. The stops
  // are placed together, so walking from one to the next does not move the title (placeStops).
  for (const { screen, input } of hero) apply(screen, placeCopy(input));
  const placements = placeStops(stops.map(({ input }) => input));
  stops.forEach(({ screen }, i) => apply(screen, placements[i]));
}

/**
 * Keeps each screen's copy on sky (lib/copyFit.ts) as the window, the artboard and the fonts change.
 *
 * A layout effect, so the first placement is in before the first paint, and every later one lands
 * in the frame that caused it: `resize` is dispatched ahead of animation frames, so the frame it
 * schedules is the one about to be painted.
 */
export function useCopyFit(pageRef: RefObject<HTMLElement | null>, artboard: SceneArtboard, sceneFailed: boolean): void {
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    let frame = 0;
    let live = true;
    const run = () => {
      frame = 0;
      fitCopy(page, artboard, sceneFailed);
    };
    const schedule = () => {
      if (live && !frame) frame = requestAnimationFrame(run);
    };
    run();
    window.addEventListener('resize', schedule);
    // Fredoka sets narrower than the fallback font, so the first pass may wrap a line it will not need.
    const fonts = typeof document.fonts === 'undefined' ? null : document.fonts;
    fonts?.addEventListener('loadingdone', schedule);
    void fonts?.ready.then(schedule);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      fonts?.removeEventListener('loadingdone', schedule);
    };
  }, [pageRef, artboard, sceneFailed]);
}
