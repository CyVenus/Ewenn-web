import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DESKTOP_ARTBOARD } from '../config';
import { useCopyFit } from './useCopyFit';

/** The parts of the home page the hook reads: the header's mark, the scene, and three screens. */
function Page({ failed = false }: { failed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useCopyFit(ref, DESKTOP_ARTBOARD, failed);
  const copy = (title: string) => (
    <h2 className="stop__title">
      {title.split(' ').map((word) => (
        <span key={word} className="blur-text-word">
          {word}
        </span>
      ))}
    </h2>
  );
  return (
    <div ref={ref}>
      <header className="site-header" style={{ paddingLeft: 20, paddingRight: 20 }}>
        <a className="brand" href="/">
          Ewenn
        </a>
      </header>
      <div className="scene" />
      <div className="screen" data-screen="hero" style={{ paddingTop: 131 }}>
        <div className="screen__pin">
          <h1 className="hero__title">
            <span className="blur-text-word">Hello</span>
          </h1>
          <p className="hero__subline">Subline</p>
          <img className="store-badge__img" alt="" />
        </div>
      </div>
      {['goals', 'friends'].map((id) => (
        <section key={id} className="screen" data-screen={id} style={{ paddingTop: 131 }}>
          <div className="stop__copy">
            {copy('A short title')}
            <p className="stop__body">Body</p>
          </div>
        </section>
      ))}
      <section className="screen" data-screen="future-stop" style={{ paddingTop: 131 }}>
        <div className="stop__copy">{copy('Not measured yet')}</div>
      </section>
    </div>
  );
}

/**
 * jsdom lays nothing out, so every box is 0x0. This gives the elements the hook reads a 1440x900
 * laptop's worth of layout: a 145px mark, an 820px column, a short title and paragraph.
 */
function stubLayout() {
  const sizes = (el: HTMLElement) => {
    const is = (selector: string) => el.matches(selector);
    if (is('.scene')) return { width: 1440, height: 900, left: 0, top: 0 };
    if (is('.brand')) return { width: 145, height: 48, left: 20, top: 16 };
    if (is('.screen__pin, .stop__copy')) return { width: 820, height: 200, left: 0, top: 0 };
    if (is('.blur-text-word')) return { width: 80, height: 60, left: 300, top: 0 };
    if (is('.hero__title, .stop__title')) return { width: 820, height: 60, left: 0, top: 0 };
    if (is('.hero__subline, .stop__body')) return { width: 520, height: 44, left: 150, top: 74 };
    if (is('.store-badge__img')) return { width: 204, height: 68, left: 308, top: 150 };
    return { width: 0, height: 0, left: 0, top: 0 };
  };
  const define = (property: string, get: (el: HTMLElement) => unknown) =>
    vi.spyOn(HTMLElement.prototype, property as 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return get(this) as number;
    });
  define('offsetWidth', (el) => sizes(el).width);
  define('offsetHeight', (el) => sizes(el).height);
  define('offsetLeft', (el) => sizes(el).left);
  define('offsetTop', (el) => sizes(el).top);
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (this: HTMLElement) {
    return this.parentElement;
  });
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const screens = (container: HTMLElement) => Array.from(container.querySelectorAll<HTMLElement>('[data-screen]'));

describe('useCopyFit', () => {
  it('leaves the stylesheet to it when there is no layout to measure', () => {
    const { container } = render(<Page />);
    for (const screen of screens(container)) {
      expect(screen.style.getPropertyValue('--copy-top')).toBe('');
      expect(screen.dataset.copyMode).toBeUndefined();
    }
  });

  it('places every measured screen before the first paint', () => {
    stubLayout();
    const { container } = render(<Page />);
    const [hero, goals, friends, future] = screens(container);
    for (const screen of [hero, goals, friends]) {
      // A 1440x900 laptop is the reference design: everything fits where it was drawn.
      expect(screen.dataset.copyMode).toBe('below');
      expect(screen.style.getPropertyValue('--copy-top')).toBe('131px');
      expect(screen.style.getPropertyValue('--copy-left')).toBe('310px');
      expect(screen.style.getPropertyValue('--copy-w')).toBe('820px');
      expect(screen.style.getPropertyValue('--copy-fit')).toBe('1');
    }
    // A stop the skyline has no record of keeps the stylesheet's layout rather than a guess.
    expect(future.style.getPropertyValue('--copy-top')).toBe('');
  });

  it('places the copy against the flat fallback sky when the scene has failed', () => {
    stubLayout();
    const { container } = render(<Page failed />);
    expect(screens(container)[2].dataset.copyMode).toBe('below');
  });

  it('refits on resize, once per frame however many arrive', () => {
    stubLayout();
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
    render(<Page />);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    expect(frames).toHaveLength(1);
  });

  it('stops listening when the page goes', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Page />);
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
