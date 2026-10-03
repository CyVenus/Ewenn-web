import { describe, expect, it } from 'vitest';
import { DESKTOP_ARTBOARD, MOBILE_ARTBOARD } from '../config';
import skyline from '../scene-skyline.json' with { type: 'json' };
import { FALLBACK_BANK, fallbackSkyline, sceneSkyline, sceneTransform } from './sceneGeometry';

const desktop = skyline.artboards[DESKTOP_ARTBOARD];
const mobile = skyline.artboards[MOBILE_ARTBOARD];

describe('sceneTransform', () => {
  it('is the identity at the design size', () => {
    expect(sceneTransform(DESKTOP_ARTBOARD, desktop.width, desktop.height)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(sceneTransform(MOBILE_ARTBOARD, mobile.width, mobile.height)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('covers a window narrower than the picture by cropping both sides equally', () => {
    const t = sceneTransform(DESKTOP_ARTBOARD, 1440, 900);
    expect(t.scale).toBeCloseTo(900 / desktop.height);
    expect(t.y).toBeCloseTo(0);
    expect(t.x).toBeCloseTo((1440 - desktop.width * t.scale) / 2);
    expect(t.x).toBeLessThan(0);
  });

  /** The whole reason the copy has to move: a wider window loses sky off the top, not snow. */
  it('anchors the desktop picture to the bottom when the window is wider than it', () => {
    const t = sceneTransform(DESKTOP_ARTBOARD, 1454, 690);
    expect(t.scale).toBeCloseTo(1454 / desktop.width);
    expect(t.x).toBeCloseTo(0);
    expect(t.y + desktop.height * t.scale).toBeCloseTo(690);
  });

  it('centres the portrait picture when the window is squatter than it', () => {
    const t = sceneTransform(MOBILE_ARTBOARD, 820, 1180);
    expect(t.scale).toBeCloseTo(820 / mobile.width);
    expect(t.y).toBeCloseTo((1180 - mobile.height * t.scale) / 2);
  });
});

/*
 * Pinned to the render. Each expectation is where the scenery measured in a real browser at that
 * viewport (scripts/scenery-audit.mjs does the same at 46 shapes); the tolerance is one bucket.
 */
describe('sceneSkyline', () => {
  it('finds the friends banner 153px down a 1454x690 window, where the copy used to run into it', () => {
    const line = sceneSkyline(DESKTOP_ARTBOARD, 'friends', 1454, 690);
    expect(line(0, 1454)).toBeGreaterThan(143);
    expect(line(0, 1454)).toBeLessThan(163);
  });

  it('finds the goals board at 318px on a 1440x900 window', () => {
    const line = sceneSkyline(DESKTOP_ARTBOARD, 'goals', 1440, 900);
    expect(line(0, 1440)).toBeGreaterThan(308);
    expect(line(0, 1440)).toBeLessThan(328);
  });

  it('puts the phone stops just under 380px on a 390x844 iPhone', () => {
    expect(sceneSkyline(MOBILE_ARTBOARD, 'goals', 390, 844)(0, 390)).toBeCloseTo(372, -1);
    expect(sceneSkyline(MOBILE_ARTBOARD, 'friends', 390, 844)(0, 390)).toBeCloseTo(383, -1);
  });

  it('only looks at the span it is asked about', () => {
    const line = sceneSkyline(DESKTOP_ARTBOARD, 'friends', 2243, 1205);
    // The banner's posts are the highest thing on the friends stop; the sky beside them is open.
    expect(line(0, 2243)).toBe(Math.min(...desktop.screens.friends));
    expect(line(0, 300)).toBeGreaterThan(line(0, 2243) + 100);
  });

  it('reads a span given right to left the same as left to right', () => {
    const line = sceneSkyline(DESKTOP_ARTBOARD, 'goals', 1440, 900);
    expect(line(900, 300)).toBe(line(300, 900));
  });

  it('never reads outside the picture', () => {
    const line = sceneSkyline(DESKTOP_ARTBOARD, 'hero', 1440, 900);
    expect(Number.isFinite(line(-500, 5000))).toBe(true);
  });
});

describe('fallbackSkyline', () => {
  it('peaks at the centre of the snow bank', () => {
    expect(fallbackSkyline(1000, 800)(400, 600)).toBeCloseTo(800 * (1 - FALLBACK_BANK.ry));
  });

  it('falls away towards the edges, and is open sky past the bank', () => {
    const line = fallbackSkyline(1000, 800);
    expect(line(900, 950)).toBeGreaterThan(line(400, 600));
    expect(line(0, 10)).toBe(800);
  });
});
