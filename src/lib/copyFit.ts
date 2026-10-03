import type { Skyline } from './sceneGeometry';

/**
 * Where a screen's copy goes, so that it sits on sky and never on the scenery.
 *
 * The copy used to have one position — centred, a fixed step below the header — and the scene
 * does not hold still under it: on a short, wide window the banner and the board rise into that
 * band (lib/sceneGeometry.ts). No single rule in CSS can follow them, because where they end up
 * depends on the width and the height together, and how tall the copy is depends on where its
 * lines wrap.
 *
 * So each screen tries, in order of how much it changes the design:
 *
 *   below   centred under the header, where it always was — first with the full breathing room,
 *           then pulled up towards the header
 *   beside  centred in the header's own row, clear of the wordmark (the band a wide window has
 *           the most sky in)
 *   left    a column down the left, under the wordmark    ┐ for windows so wide that the scenery
 *   right   a column down the right, level with it        ┘ fills the middle to the top
 *
 * and shrinks the type only when none of them fits at full size. Each costs a little more than
 * the last, so a slight shrink in the designed position beats a move to a new one.
 */

export type Box = { left: number; top: number; right: number; bottom: number };

/**
 * One line of the block — a title, a paragraph, the badge — as offsets from the block's top-left
 * corner: how far down it ends, and the horizontal span its ink actually covers.
 */
export type CopyRow = { bottom: number; left: number; right: number };

export type CopyMode = 'below' | 'beside' | 'left' | 'right';

/**
 * The block's rows when it is laid out `width` wide, its type scaled by `fit`, as `mode` sets it —
 * the side columns set flush left, and the header row runs its paragraph wider.
 */
export type CopyMeasure = (width: number, fit: number, mode: CopyMode) => readonly CopyRow[];

export type CopyFitInput = {
  viewport: { width: number; height: number };
  /** The header's logo and wordmark: the one thing on screen the copy must also stay clear of. */
  brand: Box;
  /** The page's side insets, safe areas included. */
  gutters: { left: number; right: number };
  /** The designed position, from the stylesheet: the top and width it has when nothing is in the way. */
  preferred: { top: number; width: number };
  skyline: Skyline;
  measure: CopyMeasure;
};

export type CopyPlacement = {
  mode: CopyMode;
  top: number;
  left: number;
  width: number;
  /** The type scale, 1 being the stylesheet's own sizes. */
  fit: number;
  /** False when nothing fit even at MIN_FIT: this is then the placement that overlaps the least. */
  clear: boolean;
};

/**
 * The smallest scale the solver will set. The stylesheet puts a floor under each size as well
 * (global.css), so on a small screen the title stops shrinking at 18px whatever this says.
 */
export const MIN_FIT = 0.5;
/** The least room between the header and copy placed under it. */
export const MIN_BREATH = 12;
/** Between the wordmark and copy set beside it. */
export const BRAND_GAP = 28;
/** Each row's span is widened by this much before the scenery under it is looked up. */
export const ROW_HALO = 12;
/** Narrower than this, a column of copy is a stack of single words. */
export const MIN_COLUMN = 260;
/** The widest a side column is allowed to be. */
export const MAX_COLUMN = 560;
/** How much a placement's fit has to beat the one before it by to be chosen instead. */
export const MODE_COST: Record<CopyMode, number> = { below: 0, beside: 0.1, left: 0.2, right: 0.2 };

/** Bisection steps for the scale: six halve the range to within 0.008, far below a visible step. */
const FIT_STEPS = 6;

/** Sky to keep between the copy and the top of the scenery. */
export function clearance(viewportHeight: number): number {
  return Math.min(22, Math.max(10, viewportHeight * 0.022));
}

type Candidate = {
  mode: CopyMode;
  width: number;
  left: number;
  /** The range the top may take. Higher up than `minTop` would collide with the header. */
  minTop: number;
  maxTop: number;
};

type Solved = { candidate: Candidate; fit: number; top: number; overflow: number };

/** The lowest the block's top can sit, at this width, scale and left edge, and still clear the scenery. */
function lowestTop(rows: readonly CopyRow[], left: number, skyline: Skyline, gap: number): number {
  let top = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const line = skyline(left + row.left - ROW_HALO, left + row.right + ROW_HALO);
    top = Math.min(top, line - gap - row.bottom);
  }
  return top;
}

function solve(candidate: Candidate, input: CopyFitInput, gap: number): Solved {
  const at = (fit: number) => lowestTop(input.measure(candidate.width, fit, candidate.mode), candidate.left, input.skyline, gap);
  const place = (fit: number, lowest: number): Solved => ({
    candidate,
    fit,
    top: Math.max(candidate.minTop, Math.min(candidate.maxTop, lowest)),
    overflow: Math.max(0, candidate.minTop - lowest),
  });

  const full = at(1);
  if (full >= candidate.minTop) return place(1, full);
  const floor = at(MIN_FIT);
  if (floor < candidate.minTop) return place(MIN_FIT, floor);

  let lo = MIN_FIT;
  let hi = 1;
  let lowest = floor;
  for (let i = 0; i < FIT_STEPS; i++) {
    const mid = (lo + hi) / 2;
    const value = at(mid);
    if (value >= candidate.minTop) {
      lo = mid;
      lowest = value;
    } else {
      hi = mid;
    }
  }
  return place(Math.floor(lo * 1000) / 1000, lowest);
}

/** Widths to try a side column at, widest first. */
function columnWidths(viewportWidth: number, preferredWidth: number, room: number): number[] {
  const ceiling = Math.min(MAX_COLUMN, preferredWidth, room);
  const widths = [0.4, 0.33, 0.27].map((share) => Math.round(Math.min(ceiling, viewportWidth * share)));
  return [...new Set(widths)].filter((width) => width >= MIN_COLUMN);
}

function candidates(input: CopyFitInput): Candidate[] {
  const { viewport, brand, gutters, preferred } = input;
  const below: Candidate = {
    mode: 'below',
    width: preferred.width,
    left: gutters.left + (viewport.width - gutters.left - gutters.right - preferred.width) / 2,
    minTop: Math.min(preferred.top, brand.bottom + MIN_BREATH),
    maxTop: preferred.top,
  };
  const list: Candidate[] = [below];

  // Beside the wordmark: centred when the window is wide enough to clear it on both sides, and
  // otherwise run from the wordmark to the right edge.
  const clearOfBrand = brand.right + BRAND_GAP;
  const centred = Math.min(preferred.width, viewport.width - 2 * clearOfBrand);
  const offCentre = Math.min(preferred.width, viewport.width - clearOfBrand - gutters.right);
  if (centred >= 2 * MIN_COLUMN) {
    list.push({ mode: 'beside', width: centred, left: (viewport.width - centred) / 2, minTop: brand.top, maxTop: brand.top });
  } else if (offCentre >= MIN_COLUMN) {
    list.push({ mode: 'beside', width: offCentre, left: clearOfBrand, minTop: brand.top, maxTop: brand.top });
  }

  const room = viewport.width - gutters.left - gutters.right;
  for (const width of columnWidths(viewport.width, preferred.width, room)) {
    list.push({
      mode: 'left',
      width,
      left: gutters.left,
      minTop: Math.min(preferred.top, brand.bottom + MIN_BREATH),
      maxTop: preferred.top,
    });
    // The right-hand column has nothing above it, so it can start level with the wordmark.
    if (viewport.width - gutters.right - width >= clearOfBrand) {
      list.push({
        mode: 'right',
        width,
        left: viewport.width - gutters.right - width,
        minTop: brand.top,
        maxTop: brand.top,
      });
    }
  }
  return list;
}

const score = (solved: Solved) => solved.fit - MODE_COST[solved.candidate.mode];

/**
 * `modes` limits the placements tried, in the order above; left out, all of them are. A mode that
 * cannot be laid out at this window at all — a header row too narrow beside the wordmark — returns
 * the designed position instead.
 */
export function placeCopy(input: CopyFitInput, modes?: readonly CopyMode[]): CopyPlacement {
  const gap = clearance(input.viewport.height);
  const all = candidates(input);
  const allowed = modes ? all.filter((candidate) => modes.includes(candidate.mode)) : all;
  const [first, ...rest] = allowed.length ? allowed : all;
  let best = solve(first, input, gap);
  // The designed position, at full size: nothing else can do better, so nothing else is measured.
  if (!(best.overflow === 0 && best.fit === 1)) {
    for (const candidate of rest) {
      const next = solve(candidate, input, gap);
      const better =
        next.overflow === 0
          ? best.overflow > 0 || score(next) > score(best)
          : best.overflow > 0 && next.overflow < best.overflow;
      if (better) best = next;
    }
  }
  const { candidate } = best;
  return {
    mode: candidate.mode,
    top: Math.round(best.top),
    left: Math.round(candidate.left),
    width: Math.round(candidate.width),
    fit: best.fit,
    clear: best.overflow === 0,
  };
}

/**
 * How much type a stop may give up to sit where the other stops do. The walk crossfades one stop's
 * copy into the next, and a title that jumps from under the header into its row on the way reads
 * as a glitch; a title 5% smaller does not read at all.
 */
export const SHARED_FIT_SLACK = 0.05;

/**
 * Brings the stops into one placement where they can share it: each stop is placed on its own
 * first, then any that stayed closer to the design than the most displaced one tries that one's
 * mode, and takes it if it is clear and nearly as large. `inputs` and the result are in the same
 * order.
 */
export function placeStops(inputs: readonly CopyFitInput[]): CopyPlacement[] {
  const placed = inputs.map((input) => placeCopy(input));
  const cleared = placed.filter((placement) => placement.clear);
  if (cleared.length < 2) return placed;
  const target = cleared.reduce((a, b) => (MODE_COST[b.mode] > MODE_COST[a.mode] ? b : a)).mode;
  return placed.map((placement, i) => {
    if (!placement.clear || MODE_COST[placement.mode] >= MODE_COST[target]) return placement;
    const shared = placeCopy(inputs[i], [target]);
    return shared.clear && shared.mode === target && shared.fit >= placement.fit - SHARED_FIT_SLACK ? shared : placement;
  });
}
