import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlurText, SCRUBBED_MARK_CLASS, SCRUBBED_WORD_CLASS } from './BlurText';

describe('BlurText component', () => {
  it('renders all words of the text', () => {
    const { container } = render(<BlurText text="Hello beautiful world" />);
    expect(container).toHaveTextContent('Hello beautiful world');
  });

  it('applies staggered animation delays to words', () => {
    const { container } = render(<BlurText text="One two three" delay={100} stepDuration={50} />);
    const words = container.querySelectorAll('.blur-text-word');
    expect(words).toHaveLength(3);
    expect(words[0]).toHaveStyle({ animationDelay: '100ms' });
    expect(words[1]).toHaveStyle({ animationDelay: '150ms' });
    expect(words[2]).toHaveStyle({ animationDelay: '200ms' });
  });

  it('wraps specified phrase inside phraseClassName element', () => {
    const { container } = render(
      <BlurText
        text="Your new self-care partner."
        phrase="self-care partner."
        phraseClassName="custom-phrase"
      />,
    );
    const phraseEl = container.querySelector('.custom-phrase');
    expect(phraseEl).toBeInTheDocument();
    expect(phraseEl).toHaveTextContent('self-care partner.');
    expect(container).toHaveTextContent('Your new self-care partner.');
  });

  it('supports top direction modifier', () => {
    const { container } = render(<BlurText text="Test" direction="top" />);
    const word = container.querySelector('.blur-text-word');
    expect(word).toHaveClass('blur-text-word--top');
  });

  it('leaves scrubbed words for the caller to drive', () => {
    const { container } = render(<BlurText text="Better with a friend." mode="scrubbed" />);
    const words = container.querySelectorAll<HTMLElement>('.blur-text-word');
    expect(words).toHaveLength(4);
    words.forEach((word) => {
      expect(word).toHaveClass(SCRUBBED_WORD_CLASS);
      expect(word.style.animationDelay).toBe('');
    });
    expect(container).toHaveTextContent('Better with a friend.');
  });

  it('keeps exactly one space between the lead words and the phrase', () => {
    const { container } = render(
      <BlurText text="Set a goal. Get gentle steps." phrase="Get gentle steps." phraseClassName="p" />,
    );
    // toHaveTextContent collapses whitespace, which is how a doubled space went unnoticed.
    expect(container.textContent).toBe('Set a goal. Get gentle steps.');
  });

  it('wraps each highlighted phrase in a mark, leaving the text untouched', () => {
    const { container } = render(
      <BlurText text="Set a goal. Get gentle steps." marks={['Set a goal.', 'Get gentle steps.']} />,
    );
    const marks = container.querySelectorAll('mark');
    expect(Array.from(marks, (mark) => mark.textContent)).toEqual(['Set a goal.', 'Get gentle steps.']);
    expect(container.textContent).toBe('Set a goal. Get gentle steps.');
  });

  it('nests a mark inside the phrase wrapper', () => {
    const { container } = render(
      <BlurText
        text="Your little goal buddy."
        phrase="Your little goal buddy."
        phraseClassName="p"
        marks={['goal buddy.']}
      />,
    );
    expect(container.querySelector('.p mark')).toHaveTextContent('goal buddy.');
    expect(container.textContent).toBe('Your little goal buddy.');
  });

  it('ignores a mark that is not in the text or would straddle the phrase', () => {
    const { container } = render(
      <BlurText
        text="Set a goal. Get gentle steps."
        phrase="Get gentle steps."
        phraseClassName="p"
        marks={['goal. Get', 'not here']}
      />,
    );
    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Set a goal. Get gentle steps.');
  });

  it('keeps the words after the phrase', () => {
    const { container } = render(<BlurText text="one two three four" phrase="two three" phraseClassName="p" />);
    expect(container.textContent).toBe('one two three four');
    expect(container.querySelector('.p')).toHaveTextContent('two three');
  });

  it('marks scrubbed highlights for the caller to draw', () => {
    const { container } = render(<BlurText text="Better with a friend." marks={['a friend.']} mode="scrubbed" />);
    expect(container.querySelector('mark')).toHaveClass(SCRUBBED_MARK_CLASS);
  });

  it('staggers words in reading order through a mark', () => {
    const { container } = render(
      <BlurText text="Your little goal buddy." marks={['goal buddy.']} delay={100} stepDuration={140} />,
    );
    const delays = Array.from(container.querySelectorAll<HTMLElement>('.blur-text-word'), (w) => w.style.animationDelay);
    expect(delays).toEqual(['100ms', '240ms', '380ms', '520ms']);
  });
});
