import type { CSSProperties, ReactElement, ReactNode } from 'react';

export type BlurTextProps = {
  /** The full text to animate. */
  text: string;
  /** Initial delay before the animation starts in milliseconds. Defaults to 100ms. */
  delay?: number;
  /** Stagger step duration between words in milliseconds. Defaults to 80ms. */
  stepDuration?: number;
  /** Additional CSS class for the container. */
  className?: string;
  /** Slide direction: 'bottom' (default) slides up into view; 'top' slides down. */
  direction?: 'top' | 'bottom';
  /** Optional substring within text to wrap inside a dedicated container element. */
  phrase?: string;
  /** CSS class name applied to the phrase wrapper. */
  phraseClassName?: string;
  /**
   * Phrases underlined with a pen stroke, each wrapped in a `<mark>`. Matched word for word, in
   * order; one that is not in the text, or that would straddle the phrase's edge, is ignored.
   */
  marks?: readonly string[];
  /**
   * 'entrance' (default) plays once on mount. 'scrubbed' plays nothing by itself: the words wait,
   * as plain text, for a caller to set their focus frame by frame (HomePage keys it to the walk).
   */
  mode?: 'entrance' | 'scrubbed';
};

/** Marks a word whose blur is written from outside. HomePage finds a title's words by it. */
export const SCRUBBED_WORD_CLASS = 'blur-text-word--scrub';
/** Marks a pen stroke drawn from outside, the same way. */
export const SCRUBBED_MARK_CLASS = 'blur-text-mark--scrub';

type Range = { start: number; end: number };

/** Where `phrase` first occurs in `words` at or after `from`, as a word range. */
function findRange(words: readonly string[], phrase: string, from = 0): Range | undefined {
  const target = phrase.trim().split(/\s+/);
  for (let i = from; i + target.length <= words.length; i++) {
    if (target.every((word, j) => words[i + j] === word)) return { start: i, end: i + target.length };
  }
  return undefined;
}

/**
 * The pen stroke under a marked phrase: one curved, round-capped line, as if drawn by hand, that
 * rises a little from left to right. A non-scaling stroke keeps it the same weight however long
 * the phrase is; CSS draws it by uncovering it from the left.
 */
function PenStroke(): ReactElement {
  return (
    <svg
      className="blur-text-mark__stroke"
      viewBox="0 0 100 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path vectorEffect="non-scaling-stroke" d="M2 8.5C22 4.5 55 3 98 5.5" />
    </svg>
  );
}

/**
 * BlurText entry animation adapted from React Bits (https://reactbits.dev/text-animations/blur-text).
 * Animates text with a smooth blur-to-crisp focus, staggered translation, and scale reveal.
 */
export function BlurText({
  text,
  delay = 100,
  stepDuration = 80,
  className = '',
  direction = 'bottom',
  phrase,
  phraseClassName,
  marks = [],
  mode = 'entrance',
}: BlurTextProps): ReactElement {
  const words = text.trim().split(/\s+/);
  const scrubbed = mode === 'scrubbed';
  const phraseRange = phrase ? findRange(words, phrase) : undefined;

  const markRanges: Range[] = [];
  for (const mark of marks) {
    const range = findRange(words, mark, markRanges.at(-1)?.end ?? 0);
    // A mark has to sit wholly inside the phrase or wholly outside it: one element cannot be
    // split across the phrase's own wrapper.
    const straddles =
      range && phraseRange && range.start < phraseRange.end && range.end > phraseRange.start &&
      (range.start < phraseRange.start || range.end > phraseRange.end);
    if (range && !straddles) markRanges.push(range);
  }

  let wordIndex = 0;
  const renderWord = (word: string) => {
    const index = wordIndex++;
    const animStyle: CSSProperties | undefined = scrubbed
      ? undefined
      : { animationDelay: `${delay + index * stepDuration}ms` };
    const modifier = scrubbed ? SCRUBBED_WORD_CLASS : direction === 'top' ? 'blur-text-word--top' : '';
    return (
      <span key={`w${index}`} className={`blur-text-word ${modifier}`.trim()} style={animStyle}>
        {word}
      </span>
    );
  };

  /** Words and marks in [start, end), one space between each and none after the last. */
  const renderRun = (start: number, end: number): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let i = start;
    while (i < end) {
      if (nodes.length > 0) nodes.push(' ');
      const markIndex = markRanges.findIndex((range) => range.start === i && range.end <= end);
      if (markIndex === -1) {
        nodes.push(renderWord(words[i]));
        i += 1;
        continue;
      }
      const range = markRanges[markIndex];
      const inner: ReactNode[] = [];
      for (let j = range.start; j < range.end; j++) {
        if (j > range.start) inner.push(' ');
        inner.push(renderWord(words[j]));
      }
      nodes.push(
        <mark
          key={`m${markIndex}`}
          className={`blur-text-mark ${scrubbed ? SCRUBBED_MARK_CLASS : 'blur-text-mark--entrance'}`}
          style={{ '--mark-index': markIndex } as CSSProperties}
        >
          {inner}
          <PenStroke />
        </mark>,
      );
      i = range.end;
    }
    return nodes;
  };

  const parts: ReactNode[] = [];
  if (phraseRange) {
    const lead = renderRun(0, phraseRange.start);
    const tail = renderRun(phraseRange.end, words.length);
    parts.push(...lead);
    if (lead.length > 0) parts.push(' ');
    parts.push(
      <span key="phrase" className={phraseClassName}>
        {renderRun(phraseRange.start, phraseRange.end)}
      </span>,
    );
    if (tail.length > 0) parts.push(' ', ...tail);
  } else {
    parts.push(...renderRun(0, words.length));
  }

  return <span className={`blur-text ${className}`.trim()}>{parts}</span>;
}
