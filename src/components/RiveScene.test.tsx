import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Phase } from '../lib/phase';

/**
 * The startup sequence in onRiveReady is load-bearing and entirely invisible from the DOM, so it
 * is asserted against a mocked runtime. What it has to get right:
 *
 *   - `time` is written BEFORE the first frame, or the scene paints the wrong sky and blends out
 *     of it, which reads as a flicker on every load.
 *   - the machine is played even on a paused start, because a paused state machine never advances
 *     and so never reflows layout or switches the lamp.
 *   - the lamp is reasserted on every phase change rather than only on transitions into evening,
 *     since both triggers are idempotent in the file and a missed one leaves the lamp wrong.
 */

const wasmUrl = 'rive.wasm';
vi.mock('@rive-app/webgl2/rive.wasm?url', () => ({ default: wasmUrl }));
vi.mock('@rive-app/webgl2/rive_fallback.wasm?url', () => ({ default: 'rive_fallback.wasm' }));

const setWasmUrl = vi.fn();
const setWasmFallbackUrl = vi.fn();
const awaitInstance = vi.fn(() => Promise.resolve());

type NumberProperty = { value: number };
type TriggerProperty = { trigger: () => void };

let numberProps: Record<string, NumberProperty>;
let triggers: Record<string, TriggerProperty>;
let fired: string[];
let riveInstance: Record<string, unknown>;
let capturedOnReady: ((instance: unknown) => void) | undefined;
let capturedOptions: Record<string, unknown> | undefined;
let bindViewModel: boolean;

vi.mock('@rive-app/react-webgl2', () => ({
  Fit: { Layout: 'layout' },
  Layout: class {
    constructor(public options: unknown) {}
  },
  RuntimeLoader: {
    setWasmUrl: (...args: unknown[]) => setWasmUrl(...args),
    setWasmFallbackUrl: (...args: unknown[]) => setWasmFallbackUrl(...args),
    awaitInstance: () => awaitInstance(),
  },
  useRive: (options: Record<string, unknown>) => {
    capturedOptions = options;
    capturedOnReady = options.onRiveReady as (instance: unknown) => void;
    return { rive: riveInstance, RiveComponent: (props: object) => <canvas {...props} /> };
  },
}));

function makeInstance() {
  numberProps = { time: { value: -1 } };
  triggers = {
    lampOn: { trigger: () => fired.push('lampOn') },
    lampOff: { trigger: () => fired.push('lampOff') },
  };
  return {
    play: vi.fn(),
    pause: vi.fn(),
    viewModelInstance: bindViewModel
      ? {
          number: (name: string) => numberProps[name],
          trigger: (name: string) => triggers[name],
        }
      : null,
  };
}

/** Frames are driven by the test, so startup order is observable rather than timing-dependent. */
let frameQueue: (() => void)[];

beforeEach(() => {
  fired = [];
  frameQueue = [];
  bindViewModel = true;
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    frameQueue.push(cb);
    return frameQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  riveInstance = makeInstance();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const flushFrames = (count: number) => {
  for (let i = 0; i < count; i += 1) {
    const next = frameQueue.shift();
    next?.();
  }
};

async function renderScene(phase: Phase, paused = false) {
  const { RiveScene } = await import('./RiveScene');
  const result = render(
    <RiveScene artboard="site-desktop" phase={phase} paused={paused} onLoadError={vi.fn()} />,
  );
  act(() => capturedOnReady?.(riveInstance));
  return result;
}

describe('RiveScene startup', () => {
  it('self-hosts the runtime rather than fetching it from a CDN', async () => {
    await renderScene('day');
    expect(setWasmUrl).toHaveBeenCalledWith(wasmUrl);
    expect(setWasmFallbackUrl).toHaveBeenCalledWith('rive_fallback.wasm');
  });

  it('asks for the artboard, the state machine and autoBind the file expects', async () => {
    await renderScene('day');
    expect(capturedOptions).toMatchObject({
      artboard: 'site-desktop',
      stateMachine: 'State Machine 1',
      autoBind: true,
    });
  });

  it('writes the phase before the first frame, so frame 1 is already correct', async () => {
    await renderScene('night');
    expect(numberProps.time.value).toBe(0);
  });

  it.each([
    ['night', 0],
    ['day', 1],
    ['noon', 2],
    ['evening', 3],
  ] as [Phase, number][])('writes time=%s as %i', async (phase, value) => {
    await renderScene(phase);
    expect(numberProps.time.value).toBe(value);
  });

  it('plays even when it will end up paused, so layout and the lamp settle', async () => {
    await renderScene('night', true);
    expect(riveInstance.play).toHaveBeenCalled();
  });

  it('fires lampOn a couple of frames after a night start', async () => {
    await renderScene('night');
    expect(fired).toEqual([]);
    act(() => flushFrames(2));
    expect(fired).toEqual(['lampOn']);
  });

  it('does not light the lamp on a day start', async () => {
    await renderScene('day');
    act(() => flushFrames(2));
    expect(fired).toEqual([]);
  });

  it('reports ready once the startup frames have run, and not before', async () => {
    const { RiveScene } = await import('./RiveScene');
    const onReady = vi.fn();
    render(<RiveScene artboard="site-desktop" phase="day" paused={false} onLoadError={vi.fn()} onReady={onReady} />);
    act(() => capturedOnReady?.(riveInstance));
    expect(onReady).not.toHaveBeenCalled();
    act(() => flushFrames(2));
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('reports ready on a paused start only after the phase has blended in', async () => {
    const { RiveScene, PHASE_BLEND_MS } = await import('./RiveScene');
    const onReady = vi.fn();
    render(<RiveScene artboard="site-desktop" phase="day" paused onLoadError={vi.fn()} onReady={onReady} />);
    act(() => capturedOnReady?.(riveInstance));
    act(() => flushFrames(2));
    expect(onReady).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(PHASE_BLEND_MS));
    act(() => flushFrames(2));
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('warns once, and does not throw, when the view model fails to bind', async () => {
    bindViewModel = false;
    riveInstance = makeInstance();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await renderScene('day');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('PenguinControls'));
  });
});

describe('RiveScene phase changes', () => {
  it('rewrites time and reasserts the lamp when the phase changes', async () => {
    const { rerender } = await renderScene('day');
    act(() => flushFrames(2));
    fired.length = 0;

    const { RiveScene } = await import('./RiveScene');
    act(() => {
      rerender(<RiveScene artboard="site-desktop" phase="night" paused={false} onLoadError={vi.fn()} />);
    });

    expect(numberProps.time.value).toBe(0);
    expect(fired).toEqual(['lampOn']);
  });

  it('turns the lamp off when the phase becomes day', async () => {
    const { rerender } = await renderScene('night');
    act(() => flushFrames(2));
    fired.length = 0;

    const { RiveScene } = await import('./RiveScene');
    act(() => {
      rerender(<RiveScene artboard="site-desktop" phase="noon" paused={false} onLoadError={vi.fn()} />);
    });

    expect(fired).toEqual(['lampOff']);
  });

  it('does nothing when re-rendered on the same phase', async () => {
    const { rerender } = await renderScene('day');
    act(() => flushFrames(2));
    fired.length = 0;

    const { RiveScene } = await import('./RiveScene');
    act(() => {
      rerender(<RiveScene artboard="site-desktop" phase="day" paused={false} onLoadError={vi.fn()} />);
    });

    expect(fired).toEqual([]);
  });
});

describe('RiveScene scroll', () => {
  let progress: number;

  async function renderWithProgress(paused = false) {
    const { RiveScene } = await import('./RiveScene');
    render(
      <RiveScene
        artboard="site-desktop"
        phase="day"
        paused={paused}
        onLoadError={vi.fn()}
        readProgress={() => progress}
      />,
    );
    act(() => capturedOnReady?.(riveInstance));
  }

  beforeEach(() => {
    numberProps.scroll = { value: -1 };
    numberProps.walkPose = { value: -1 };
    numberProps.walkFacing = { value: -1 };
    progress = 0.75;
  });

  it("puts the world at the reader's progress as soon as the scene is ready, without a walk", async () => {
    await renderWithProgress();
    expect(numberProps.scroll.value).toBe(-1);
    act(() => flushFrames(2));
    expect(numberProps.scroll.value).toBe(0.75);
    expect(numberProps.walkPose.value).toBe(1);
  });

  it('walks toward the page on scroll, scheduling at most one frame per burst', async () => {
    await renderWithProgress();
    act(() => flushFrames(2));
    const queued = frameQueue.length;
    progress = 1.2;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('scroll'));
    });
    expect(frameQueue.length).toBe(queued + 1);
    act(() => flushFrames(frameQueue.length));
    expect(numberProps.walkPose.value).toBe(2);
    expect(numberProps.walkFacing.value).toBe(0);
    expect(numberProps.scroll.value).toBeGreaterThan(0.75);
    expect(numberProps.scroll.value).toBeLessThan(1.2);
  });

  it('faces the viewer when the page is already sitting on a stop', async () => {
    progress = 1;
    await renderWithProgress();
    act(() => flushFrames(2));
    expect(numberProps.scroll.value).toBe(1);
    expect(numberProps.walkPose.value).toBe(0);
  });

  it('snaps to the nearest stop under reduced motion, and runs the paused machine to draw it', async () => {
    progress = 0.6;
    await renderWithProgress(true);
    act(() => flushFrames(2));
    act(() => vi.advanceTimersByTime(700));
    (riveInstance.play as ReturnType<typeof vi.fn>).mockClear();
    act(() => flushFrames(2));
    expect(numberProps.scroll.value).toBe(1);
    expect(riveInstance.play).toHaveBeenCalled();
  });

  it('warns, and leaves the page alone, when the file has no scroll number', async () => {
    delete numberProps.scroll;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await renderWithProgress();
    act(() => flushFrames(2));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"scroll"'));
  });
});
