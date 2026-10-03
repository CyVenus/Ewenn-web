import { DESKTOP_ARTBOARD, MOBILE_ARTBOARD } from '../config';
import skylineData from '../scene-skyline.json' with { type: 'json' };
import type { SceneArtboard } from './artboard';

/**
 * Where the scene's scenery is, in whatever window the page is in.
 *
 * Neither artboard reflows its world. Each draws one fixed picture, cover-fitted to the canvas:
 * scaled until it fills both dimensions, with the overflow cropped. So the flag, the board and the
 * banner are always the same fraction of the picture, and what moves them on screen is the shape
 * of the window — on a 16:10 laptop the banner starts 31% of the way down, on a 2:1 window with
 * the dock showing it starts at 22%, and on a 21:9 monitor it is at the top edge. The copy is laid
 * out from the top, so a layout that only looks at the width or the height walks straight into it.
 *
 * The page cannot ask the runtime where a prop is. scripts/skyline.mjs measures it instead, once,
 * at each artboard's design size, and records the top of the scenery in narrow columns across the
 * picture. This maps that record onto a viewport.
 *
 * Measured, not assumed: the penguin's size and position across a dozen viewports fit these two
 * rules to the pixel, and nothing else. Setting `layoutScaleFactor` changes neither.
 */

export type SceneScreen = 'hero' | 'goals' | 'friends';

type ArtboardSkyline = {
  width: number;
  height: number;
  screens: Record<SceneScreen, readonly number[]>;
};

type SkylineFile = { bucket: number; artboards: Record<SceneArtboard, ArtboardSkyline> };

const SKYLINE = skylineData as SkylineFile;

/**
 * Where the cropped picture sits vertically: 1 anchors its bottom edge to the canvas's (the desktop
 * world, which loses sky off the top on a wide window), 0.5 centres it (the portrait world, which
 * loses a little off each end on a squat one). Both are centred across.
 */
export const SCENE_ALIGN_Y: Record<SceneArtboard, number> = {
  [DESKTOP_ARTBOARD]: 1,
  [MOBILE_ARTBOARD]: 0.5,
};

export type SceneTransform = {
  /** CSS pixels per design unit. */
  scale: number;
  /** Where the picture's top-left corner lands, in CSS pixels from the canvas's. */
  x: number;
  y: number;
};

export function sceneTransform(artboard: SceneArtboard, width: number, height: number): SceneTransform {
  const design = SKYLINE.artboards[artboard];
  const scale = Math.max(width / design.width, height / design.height);
  return {
    scale,
    x: (width - design.width * scale) / 2,
    y: (height - design.height * scale) * SCENE_ALIGN_Y[artboard],
  };
}

/**
 * The top of the scenery anywhere under a horizontal span of the viewport, in CSS pixels from the
 * top. Copy that ends above this line, across its own width, is on sky.
 */
export type Skyline = (x0: number, x1: number) => number;

export function sceneSkyline(artboard: SceneArtboard, screen: SceneScreen, width: number, height: number): Skyline {
  const design = SKYLINE.artboards[artboard];
  const tops = design.screens[screen];
  const { scale, x, y } = sceneTransform(artboard, width, height);
  const bucket = SKYLINE.bucket * scale;
  return (x0, x1) => {
    const first = Math.max(0, Math.floor((Math.min(x0, x1) - x) / bucket));
    const last = Math.min(tops.length - 1, Math.floor((Math.max(x0, x1) - x) / bucket));
    let top = design.height;
    for (let i = first; i <= last; i++) top = Math.min(top, tops[i]);
    return y + top * scale;
  };
}

/**
 * The no-WebGL stand-in: a flat sky over a snow bank, drawn by .page--scene-failed in global.css
 * as an ellipse 45.6% of the width across and 22.8% of the height tall, sitting on the bottom edge.
 * Keep the two in step.
 */
export const FALLBACK_BANK = { rx: 1.2 * 0.38, ry: 0.6 * 0.38 } as const;

export function fallbackSkyline(width: number, height: number): Skyline {
  const rx = width * FALLBACK_BANK.rx;
  const ry = height * FALLBACK_BANK.ry;
  const centre = width / 2;
  return (x0, x1) => {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    const dx = lo <= centre && hi >= centre ? 0 : Math.min(Math.abs(lo - centre), Math.abs(hi - centre));
    if (dx >= rx) return height;
    return height - ry * Math.sqrt(1 - (dx / rx) ** 2);
  };
}
