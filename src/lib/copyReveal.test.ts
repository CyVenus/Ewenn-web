import { describe, expect, it } from 'vitest';
import { FADE_FULL, FADE_IN, MARK_FROM, copyOpacity, focusStyle, focusTitle, markProgress, setFaded, wordFocus } from './copyReveal';

describe('copyOpacity', () => {
  it('is fully opaque at the stop', () => {
    expect(copyOpacity(1, 1)).toBe(1);
  });

  it('is invisible a whole stop away', () => {
    expect(copyOpacity(0, 1)).toBe(0);
    expect(copyOpacity(2, 1)).toBe(0);
  });

  it('stays hidden for the first half of the walk', () => {
    // Two flicks from the hero used to put stop 2's copy on screen over stop 1's scenery.
    expect(copyOpacity(1.5, 2)).toBe(0);
  });

  it('ramps in over the last stretch of the approach', () => {
    const early = copyOpacity(1 - FADE_IN + 0.01, 1);
    const late = copyOpacity(1 - FADE_FULL - 0.01, 1);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(late);
    expect(late).toBeLessThan(1);
  });

  it('reads the same walking either way', () => {
    expect(copyOpacity(0.8, 1)).toBeCloseTo(copyOpacity(1.2, 1));
  });

  it('never leaves the 0..1 range', () => {
    for (let shown = -1; shown <= 3; shown += 0.05) {
      const opacity = copyOpacity(shown, 1);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });
});

describe('setFaded', () => {
  function block() {
    const node = document.createElement('div');
    const badge = document.createElement('a');
    badge.href = 'https://apps.apple.com/';
    node.append(badge);
    document.body.append(node);
    return { node, badge };
  }

  it("takes a faded block's links out of the Tab order, and puts them back", () => {
    const { node, badge } = block();
    setFaded(node, true);
    expect(node.hasAttribute('data-faded')).toBe(true);
    expect(badge.tabIndex).toBe(-1);
    setFaded(node, false);
    expect(node.hasAttribute('data-faded')).toBe(false);
    expect(badge.hasAttribute('tabindex')).toBe(false);
    node.remove();
  });

  it('lets go of focus left on a link as its block fades', () => {
    // Otherwise Enter on the next stop opens the App Store from a badge that is not on screen.
    const { node, badge } = block();
    badge.focus();
    expect(document.activeElement).toBe(badge);
    setFaded(node, true);
    expect(document.activeElement).not.toBe(badge);
    node.remove();
  });
});

describe('wordFocus', () => {
  it('is sharp for every word once the block is fully shown', () => {
    for (let word = 0; word < 6; word++) expect(wordFocus(1, word, 6)).toBe(1);
  });

  it('is fully blurred for every word before the block appears', () => {
    for (let word = 0; word < 6; word++) expect(wordFocus(0, word, 6)).toBe(0);
  });

  it('brings the first word into focus ahead of the last', () => {
    expect(wordFocus(0.5, 0, 4)).toBeGreaterThan(wordFocus(0.5, 3, 4));
  });

  it('only ever sharpens as the block comes in', () => {
    for (let word = 0; word < 4; word++) {
      let previous = -1;
      for (let progress = 0; progress <= 1; progress += 0.02) {
        const focus = wordFocus(progress, word, 4);
        expect(focus).toBeGreaterThanOrEqual(previous);
        previous = focus;
      }
    }
  });

  it('handles a one-word title', () => {
    expect(wordFocus(0, 0, 1)).toBe(0);
    expect(wordFocus(1, 0, 1)).toBe(1);
  });

  it('never leaves the 0..1 range', () => {
    for (let progress = -0.5; progress <= 1.5; progress += 0.05) {
      for (let word = 0; word < 6; word++) {
        const focus = wordFocus(progress, word, 6);
        expect(focus).toBeGreaterThanOrEqual(0);
        expect(focus).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('focusStyle', () => {
  it('clears both properties on a sharp word', () => {
    expect(focusStyle(1)).toEqual({ filter: '', transform: '' });
  });

  it('starts from a full blur and rise', () => {
    expect(focusStyle(0)).toEqual({
      filter: 'blur(10.00px)',
      transform: 'translateY(12.00px) scale(0.9800)',
    });
  });
});

describe('focusTitle', () => {
  const title = () => ['Better', 'with', 'a', 'friend.'].map(() => document.createElement('span'));

  it('leaves a hidden title fully blurred rather than snapping it back to sharp', () => {
    // The block's opacity eases in behind the value written to it, so a title cleared at
    // progress 0 is still on screen for a moment, sharp: the exit appeared to run twice.
    const words = title();
    focusTitle(words, 0.5);
    focusTitle(words, 0);
    words.forEach((word) => expect(word.style.filter).toBe(focusStyle(0).filter));
  });

  it('clears every word once the title is fully shown', () => {
    const words = title();
    focusTitle(words, 0.5);
    focusTitle(words, 1);
    words.forEach((word) => {
      expect(word.style.filter).toBe('');
      expect(word.style.transform).toBe('');
    });
  });
});

describe('markProgress', () => {
  it('draws nothing until the words are well into focus', () => {
    expect(markProgress(MARK_FROM, 0, 2)).toBe(0);
    expect(markProgress(0.2, 0, 1)).toBe(0);
  });

  it('draws every stroke by the time the block is fully shown', () => {
    expect(markProgress(1, 0, 2)).toBe(1);
    expect(markProgress(1, 1, 2)).toBe(1);
  });

  it('draws the marks in reading order, as one stroke', () => {
    const mid = MARK_FROM + (1 - MARK_FROM) / 2;
    expect(markProgress(mid, 0, 2)).toBeCloseTo(1);
    expect(markProgress(mid, 1, 2)).toBeCloseTo(0);
    // The second only starts once the first is complete: no gap, no overlap.
    for (let p = 0; p <= 1; p += 0.01) {
      if (markProgress(p, 1, 2) > 0) expect(markProgress(p, 0, 2)).toBe(1);
    }
  });

  it('only ever draws forward as the block comes in', () => {
    let previous = -1;
    for (let p = 0; p <= 1; p += 0.01) {
      const drawn = markProgress(p, 0, 1);
      expect(drawn).toBeGreaterThanOrEqual(previous);
      previous = drawn;
    }
  });
});

describe('focusTitle strokes', () => {
  it('leaves the strokes of a hidden title undrawn, and clears them once it is fully shown', () => {
    const marks = [document.createElement('mark'), document.createElement('mark')];
    focusTitle([], 0, marks);
    marks.forEach((mark) => expect(mark.style.getPropertyValue('--mark-progress')).toBe('0.0000'));
    focusTitle([], 1, marks);
    marks.forEach((mark) => expect(mark.style.getPropertyValue('--mark-progress')).toBe(''));
  });
});
