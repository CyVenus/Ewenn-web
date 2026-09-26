/**
 * How visible a screen's copy is, given where the penguin actually is.
 *
 * The page scroll jumps to a stop the instant the gesture lands, but the penguin takes a whole
 * walk to get there — so anything keyed to the scroll position (a `view()` timeline, an
 * IntersectionObserver) announces the next chapter while the reader is still looking at the
 * previous one. Two flicks and "Better with a friend." is on screen over the set-a-goal scenery.
 * Keying it to the walk instead means the words arrive with the scenery they describe.
 *
 * `shown` is the walker's position in stops (lib/walker.ts), `index` the screen's own stop.
 */

/** Distance, in stops, at which a screen's copy starts to appear. */
export const FADE_IN = 0.38;
/** Distance at which it is fully opaque: a little before the walk ends, so it settles with it. */
export const FADE_FULL = 0.08;

export function copyOpacity(shown: number, index: number): number {
  const distance = Math.abs(shown - index);
  if (distance >= FADE_IN) return 0;
  if (distance <= FADE_FULL) return 1;
  return (FADE_IN - distance) / (FADE_IN - FADE_FULL);
}

/**
 * Takes a faded-out block's links away from the pointer and the keyboard, or gives them back.
 *
 * Pinned, the blocks are stacked on one another, so a faded one is still there under the one
 * showing. `data-faded` takes its taps away (global.css — its links opt back in to taps on their
 * own, so nothing set on the block itself reaches them), and its links leave the Tab order so
 * the keyboard cannot land on a badge nobody can see. They stay in the accessibility tree: a
 * screen reader reads the page in order, not by where the penguin is standing.
 *
 * Returns early when nothing has changed: this runs on every frame of the walk.
 */
export function setFaded(node: HTMLElement, faded: boolean): void {
  if (node.hasAttribute('data-faded') === faded) return;
  node.toggleAttribute('data-faded', faded);
  node.querySelectorAll<HTMLElement>('a, button').forEach((control) => {
    if (faded) control.tabIndex = -1;
    else control.removeAttribute('tabindex');
  });
  // Focus left on a link as its block fades would have Enter open something that is not on screen.
  const focused = document.activeElement;
  if (faded && focused instanceof HTMLElement && node.contains(focused)) focused.blur();
}

/**
 * The share of a block's fade over which its title's words set off. The rest is each word's own
 * window, so at 0.35 neighbouring words overlap into one wave instead of stepping one at a time.
 */
export const WORD_SPREAD = 0.35;

/**
 * How sharp one word of a title is, 0 (fully blurred) to 1 (plain text), given the block's
 * `copyOpacity`. Keyed to the same walk as the fade, so the words come into focus as the penguin
 * arrives, and walking away plays it backwards — the last word is the first to go.
 */
export function wordFocus(progress: number, word: number, words: number): number {
  const start = words > 1 ? (WORD_SPREAD * word) / (words - 1) : 0;
  const t = Math.min(1, Math.max(0, (progress - start) / (1 - WORD_SPREAD)));
  return 1 - (1 - t) ** 3;
}

/** Blur and rise at focus 0, in px. The hero's entrance keyframes start from the same place. */
const MAX_BLUR = 10;
const MAX_RISE = 12;

/**
 * The inline style for a word at a given focus. A sharp word gets empty strings, which clear the
 * properties: a settled title should carry no filter at all, not a `blur(0px)` that keeps it on
 * its own layer.
 */
export function focusStyle(focus: number): { filter: string; transform: string } {
  if (focus >= 1) return { filter: '', transform: '' };
  const blur = (1 - focus) * MAX_BLUR;
  const rise = (1 - focus) * MAX_RISE;
  const scale = 0.98 + 0.02 * focus;
  return {
    filter: `blur(${blur.toFixed(2)}px)`,
    transform: `translateY(${rise.toFixed(2)}px) scale(${scale.toFixed(4)})`,
  };
}

/**
 * How far through the block's fade the highlighter starts: late enough that the words are mostly
 * in focus when the stroke passes under them, early enough to finish as the penguin arrives.
 */
export const MARK_FROM = 0.4;

/**
 * How much of one highlighter stroke is drawn, 0 to 1, given the block's `copyOpacity`.
 *
 * A title's marks are drawn as one stroke in reading order — "Set a goal." fills, then "Get gentle
 * steps." — eased once across all of them rather than each on its own, so the pen does not stop
 * between them. Walking away plays it backwards: the last mark is the first to go.
 */
export function markProgress(progress: number, mark: number, marks: number): number {
  const t = Math.min(1, Math.max(0, (progress - MARK_FROM) / (1 - MARK_FROM)));
  const eased = t * t * (3 - 2 * t);
  return Math.min(1, Math.max(0, eased * marks - mark));
}

/**
 * Writes a title's focus for a given block progress, straight to the nodes: each word's blur, and
 * how much of each highlighter stroke is drawn.
 *
 * A hidden block (progress 0) is left fully blurred, never reset to sharp. The block's opacity
 * eases 120ms behind the value written to it, so at the frame its progress reaches 0 it is still
 * painted at around a fifth of its strength — a title snapped back to sharp there flashes up
 * behind the blur that just carried it out, and the exit looks like it runs twice. The strokes
 * follow the same rule: undrawn while hidden, and only cleared back to the stylesheet's full
 * stroke once the title is completely shown.
 */
export function focusTitle(
  words: readonly HTMLElement[],
  progress: number,
  marks: readonly HTMLElement[] = [],
): void {
  words.forEach((word, index) => {
    const { filter, transform } = focusStyle(wordFocus(progress, index, words.length));
    word.style.filter = filter;
    word.style.transform = transform;
  });
  marks.forEach((mark, index) => {
    const drawn = markProgress(progress, index, marks.length);
    if (drawn >= 1) mark.style.removeProperty('--mark-progress');
    else mark.style.setProperty('--mark-progress', drawn.toFixed(4));
  });
}
