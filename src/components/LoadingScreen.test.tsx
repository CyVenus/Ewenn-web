import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOADER_INTRO_SECONDS, LOADER_MAX_MS } from '../config';

/**
 * The loader decides when the visitor first sees the site, from three signals that arrive in any
 * order: the intro finishing, the scene becoming ready, and a cap. It is asserted against a mocked
 * runtime, with the intro advanced by hand, so every ordering is reachable.
 */

vi.mock('@rive-app/webgl2/rive.wasm?url', () => ({ default: 'rive.wasm' }));
vi.mock('@rive-app/webgl2/rive_fallback.wasm?url', () => ({ default: 'rive_fallback.wasm' }));

type Options = {
  onAdvance?: (event: { data?: unknown }) => void;
  onLoadError?: () => void;
} & Record<string, unknown>;

let capturedOptions: Options | undefined;

vi.mock('@rive-app/react-webgl2', () => ({
  Fit: { Cover: 'cover' },
  Layout: class {
    constructor(public options: unknown) {}
  },
  RuntimeLoader: {
    setWasmUrl: vi.fn(),
    setWasmFallbackUrl: vi.fn(),
    awaitInstance: () => Promise.resolve(),
  },
  useRive: (options: Options) => {
    capturedOptions = options;
    return { rive: null, RiveComponent: (props: object) => <canvas {...props} /> };
  },
}));

beforeEach(() => {
  capturedOptions = undefined;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/**
 * Advances the intro by at least `seconds` of animation time, as the runtime reports it: one
 * elapsed time per frame. Frames of 1/64 s rather than 1/60 because they sum exactly, so the
 * boundary is tested at the boundary and not a rounding error either side of it.
 */
function advanceIntro(seconds: number) {
  act(() => {
    for (let frame = 0; frame < Math.ceil(seconds * 64); frame += 1) {
      capturedOptions?.onAdvance?.({ data: 1 / 64 });
    }
  });
}

async function renderLoader(props: { sceneSettled?: boolean; reducedMotion?: boolean } = {}) {
  const { LoadingScreen } = await import('./LoadingScreen');
  const onLift = vi.fn();
  const view = (sceneSettled: boolean) => (
    <LoadingScreen sceneSettled={sceneSettled} reducedMotion={props.reducedMotion ?? false} onLift={onLift} />
  );
  const result = render(view(props.sceneSettled ?? false));
  const settle = () => act(() => result.rerender(view(true)));
  const loader = () => result.container.querySelector('.loader');
  return { ...result, onLift, settle, loader };
}

describe('LoadingScreen', () => {
  it('plays the app icon intro from the loader file', async () => {
    await renderLoader();
    expect(capturedOptions).toMatchObject({
      src: '/rive/loading-anim.riv',
      artboard: 'app_logo',
      stateMachine: 'State Machine 1',
      autoplay: true,
    });
  });

  it('knows the intro is 2.5 s long', () => {
    expect(LOADER_INTRO_SECONDS).toBe(2.5);
  });

  it('holds while the intro is still playing, even with the scene ready', async () => {
    const { onLift, loader } = await renderLoader({ sceneSettled: true });
    advanceIntro(LOADER_INTRO_SECONDS - 0.1);
    expect(onLift).not.toHaveBeenCalled();
    expect(loader()).not.toHaveClass('loader--leaving');
  });

  it('holds after the intro until the scene is ready', async () => {
    const { onLift, settle, loader } = await renderLoader();
    advanceIntro(LOADER_INTRO_SECONDS);
    expect(onLift).not.toHaveBeenCalled();
    settle();
    expect(onLift).toHaveBeenCalledOnce();
    expect(loader()).toHaveClass('loader--leaving');
  });

  it('lifts the moment the intro ends when the scene is already ready', async () => {
    const { onLift } = await renderLoader({ sceneSettled: true });
    advanceIntro(LOADER_INTRO_SECONDS);
    expect(onLift).toHaveBeenCalledOnce();
  });

  it('counts played animation time, not the clock, so a hidden tab has not used up the intro', async () => {
    const { onLift } = await renderLoader({ sceneSettled: true });
    act(() => vi.advanceTimersByTime(LOADER_INTRO_SECONDS * 1000 + 1000));
    expect(onLift).not.toHaveBeenCalled();
  });

  it('is removed once it has faded, freeing its canvas', async () => {
    const { LOADER_FADE_MS } = await import('./LoadingScreen');
    const { loader } = await renderLoader({ sceneSettled: true });
    advanceIntro(LOADER_INTRO_SECONDS);
    act(() => vi.advanceTimersByTime(LOADER_FADE_MS - 1));
    expect(loader()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(loader()).toBeNull();
  });

  it('does not wait on an intro that failed to load', async () => {
    const { onLift } = await renderLoader({ sceneSettled: true });
    act(() => capturedOptions?.onLoadError?.());
    expect(onLift).toHaveBeenCalledOnce();
  });

  it('gives up after the cap however slow the scene is', async () => {
    const { onLift } = await renderLoader();
    advanceIntro(LOADER_INTRO_SECONDS);
    act(() => vi.advanceTimersByTime(LOADER_MAX_MS - 1));
    expect(onLift).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLift).toHaveBeenCalledOnce();
  });

  it('shows the still logo under reduced motion, and lifts as soon as the scene is ready', async () => {
    const { onLift, settle, container } = await renderLoader({ reducedMotion: true });
    expect(capturedOptions).toBeUndefined();
    expect(container.querySelector('img.loader__still')).not.toBeNull();
    expect(onLift).not.toHaveBeenCalled();
    settle();
    expect(onLift).toHaveBeenCalledOnce();
    // No fade to wait out.
    act(() => vi.advanceTimersByTime(0));
    expect(container.querySelector('.loader')).toBeNull();
  });

  it('keeps wheel, swipes and scroll keys from reaching the page while up, and lets them through after', async () => {
    const pageWheel = vi.fn();
    window.addEventListener('wheel', pageWheel);
    const { settle } = await renderLoader();

    const wheel = new WheelEvent('wheel', { cancelable: true, deltaY: 100 });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(pageWheel).not.toHaveBeenCalled();

    const pageDown = new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true });
    window.dispatchEvent(pageDown);
    expect(pageDown.defaultPrevented).toBe(true);

    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    window.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);

    advanceIntro(LOADER_INTRO_SECONDS);
    settle();
    window.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaY: 100 }));
    expect(pageWheel).toHaveBeenCalledOnce();
    window.removeEventListener('wheel', pageWheel);
  });
});
