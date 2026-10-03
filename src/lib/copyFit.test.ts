import { describe, expect, it } from 'vitest';
import {
  BRAND_GAP,
  MIN_BREATH,
  MIN_FIT,
  SHARED_FIT_SLACK,
  clearance,
  placeCopy,
  placeStops,
  type CopyFitInput,
  type CopyMeasure,
  type CopyPlacement,
} from './copyFit';
import type { Skyline } from './sceneGeometry';

/**
 * A stand-in for the real block: a 400px title over a paragraph that wraps inside a 520px
 * measure, both scaling with `fit` — so it is 132px tall at full size in a wide column, and it
 * gets taller as the column narrows, the way the real copy does.
 */
function block({ title = 400, text = 900 } = {}): CopyMeasure {
  return (width, fit, mode) => {
    const flush = mode === 'left' || mode === 'right';
    const at = (ink: number) => (flush ? 0 : (width - ink) / 2);
    const titleInk = Math.min(width, title * fit);
    const titleBottom = 60 * fit * Math.ceil((title * fit) / width);
    const measure = Math.min(width, 520 * fit);
    const bodyBottom = titleBottom + 14 * fit + 29 * fit * Math.ceil((text * fit) / measure);
    return [
      { bottom: titleBottom, left: at(titleInk), right: at(titleInk) + titleInk },
      { bottom: bodyBottom, left: at(measure), right: at(measure) + measure },
    ];
  };
}

const flat = (y: number): Skyline => () => y;

const laptop = (skyline: Skyline, overrides: Partial<CopyFitInput> = {}): CopyFitInput => ({
  viewport: { width: 1440, height: 900 },
  brand: { left: 20, top: 16, right: 165, bottom: 64 },
  gutters: { left: 20, right: 20 },
  preferred: { top: 131, width: 820 },
  skyline,
  measure: block(),
  ...overrides,
});

/** Every row's bottom, where the placement puts it, against the skyline under it. */
function clearsScenery(placement: CopyPlacement, input: CopyFitInput): boolean {
  const gap = clearance(input.viewport.height);
  return input.measure(placement.width, placement.fit, placement.mode).every((row) => {
    const line = input.skyline(placement.left + row.left, placement.left + row.right);
    return placement.top + row.bottom <= line - gap + 0.5;
  });
}

describe('placeCopy', () => {
  it('keeps the designed position when the sky is open', () => {
    const input = laptop(flat(600));
    expect(placeCopy(input)).toMatchObject({ mode: 'below', top: 131, left: 310, width: 820, fit: 1, clear: true });
  });

  it('pulls the copy up towards the header before it shrinks anything', () => {
    const input = laptop(flat(260));
    const placement = placeCopy(input);
    expect(placement).toMatchObject({ mode: 'below', fit: 1, clear: true });
    expect(placement.top).toBeLessThan(131);
    expect(placement.top).toBeGreaterThanOrEqual(64 + MIN_BREATH);
    expect(clearsScenery(placement, input)).toBe(true);
  });

  it('takes a slight shrink in the designed position over a move', () => {
    const input = laptop(flat(225));
    const placement = placeCopy(input);
    expect(placement.mode).toBe('below');
    expect(placement.fit).toBeGreaterThan(0.9);
    expect(placement.fit).toBeLessThan(1);
    expect(clearsScenery(placement, input)).toBe(true);
  });

  // The reported laptop: the banner 153px down, the header 64px tall, 89px of sky between them.
  it('moves into the header row when the band below the header is too short', () => {
    const input = laptop(flat(150));
    const placement = placeCopy(input);
    expect(placement).toMatchObject({ mode: 'beside', top: 16, clear: true });
    expect(placement.fit).toBeGreaterThan(0.8);
    expect(placement.left).toBeGreaterThanOrEqual(165 + BRAND_GAP);
    expect(clearsScenery(placement, input)).toBe(true);
  });

  it('runs off-centre beside the wordmark when the window is too narrow to clear it both sides', () => {
    const input = laptop(flat(120), {
      viewport: { width: 700, height: 390 },
      brand: { left: 20, top: 16, right: 150, bottom: 50 },
      preferred: { top: 90, width: 660 },
    });
    const placement = placeCopy(input);
    expect(placement).toMatchObject({ mode: 'beside', left: 150 + BRAND_GAP, clear: true });
    expect(placement.left + placement.width).toBeLessThanOrEqual(700 - 20);
  });

  // An ultrawide: the scenery reaches the top edge across the middle and leaves the sides open.
  it('moves to a side column when the scenery fills the middle to the top', () => {
    const blockedMiddle: Skyline = (x0, x1) => (x1 > 500 && x0 < 940 ? 10 : 400);
    const input = laptop(blockedMiddle);
    const placement = placeCopy(input);
    expect(placement.mode === 'left' || placement.mode === 'right').toBe(true);
    expect(placement).toMatchObject({ fit: 1, clear: true });
    expect(clearsScenery(placement, input)).toBe(true);
  });

  it('puts a left column under the wordmark, and never on it', () => {
    const openLeft: Skyline = (x0, x1) => (x1 > 500 && x0 < 1440 ? 10 : 400);
    const placement = placeCopy(laptop(openLeft));
    expect(placement.mode).toBe('left');
    expect(placement.top).toBeGreaterThanOrEqual(64 + MIN_BREATH);
  });

  it('shrinks no further than MIN_FIT, and says so when even that does not fit', () => {
    const placement = placeCopy(laptop(flat(20)));
    expect(placement.clear).toBe(false);
    expect(placement.fit).toBe(MIN_FIT);
  });

  it('measures nothing but the designed position when that fits', () => {
    let calls = 0;
    const measure = block();
    placeCopy(laptop(flat(600), { measure: (...args) => (calls++, measure(...args)) }));
    expect(calls).toBe(1);
  });

  it('lands every placement it calls clear on sky, across a sweep of scenery heights', () => {
    for (let y = 60; y <= 700; y += 20) {
      const input = laptop(flat(y));
      const placement = placeCopy(input);
      if (placement.clear) expect(clearsScenery(placement, input), `scenery at ${y}`).toBe(true);
      expect(placement.top, `scenery at ${y}`).toBeGreaterThanOrEqual(16);
    }
  });
});

describe('placeCopy, limited to some modes', () => {
  it('tries only the placements it is given', () => {
    expect(placeCopy(laptop(flat(600)), ['beside']).mode).toBe('beside');
  });

  it('falls back to the designed position when none of them can be laid out', () => {
    const narrow = laptop(flat(600), { viewport: { width: 300, height: 600 }, preferred: { top: 131, width: 260 } });
    expect(placeCopy(narrow, ['beside']).mode).toBe('below');
  });
});

describe('placeStops', () => {
  const landscape = (skyline: Skyline) =>
    laptop(skyline, {
      viewport: { width: 700, height: 390 },
      brand: { left: 20, top: 16, right: 150, bottom: 50 },
      preferred: { top: 90, width: 660 },
    });

  it('moves a stop into the header row with its neighbour when that costs it nothing', () => {
    const [goals, friends] = placeStops([laptop(flat(260)), laptop(flat(150))]);
    expect(friends.mode).toBe('beside');
    expect(goals).toMatchObject({ mode: 'beside', fit: 1, clear: true });
  });

  it('leaves a stop where it is when following would shrink it', () => {
    // Open sky everywhere but a prop at the right edge, which the header row's off-centre column
    // reaches and the designed one does not.
    const edge: Skyline = (_x0, x1) => (x1 > 640 ? 10 : 400);
    const [goals, friends] = placeStops([landscape(edge), landscape(flat(120))]);
    expect(friends.mode).toBe('beside');
    expect(goals).toMatchObject({ mode: 'below', fit: 1 });
    expect(placeCopy(landscape(edge), ['beside']).fit).toBeLessThan(1 - SHARED_FIT_SLACK);
  });

  it('leaves the stops alone when they already agree', () => {
    const placements = placeStops([laptop(flat(600)), laptop(flat(500))]);
    expect(placements.map((p) => p.mode)).toEqual(['below', 'below']);
  });
});
