import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterFrames, afterVisibleTime } from './frames';

/** A controllable rAF: frames only advance when the test says so. */
let queue: (() => void)[] = [];

beforeEach(() => {
  queue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const tick = () => {
  const next = queue.shift();
  next?.();
};

describe('afterFrames', () => {
  it('waits the requested number of frames before firing', () => {
    const spy = vi.fn();
    afterFrames(2, spy);
    expect(spy).not.toHaveBeenCalled();
    tick();
    expect(spy).not.toHaveBeenCalled();
    tick();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('fires on the first frame when asked for one', () => {
    const spy = vi.fn();
    afterFrames(1, spy);
    tick();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('returns a cancel function that stops the pending frame', () => {
    const spy = vi.fn();
    const cancel = afterFrames(2, spy);
    cancel();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('never fires more than once', () => {
    const spy = vi.fn();
    afterFrames(1, spy);
    tick();
    tick();
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('afterVisibleTime', () => {
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const setVisibility = (next: DocumentVisibilityState) => {
    visibility = next;
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('fires once the time has passed on a visible page', () => {
    const spy = vi.fn();
    afterVisibleTime(1000, spy);
    vi.advanceTimersByTime(999);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('does not start counting until a hidden page is shown', () => {
    visibility = 'hidden';
    const spy = vi.fn();
    afterVisibleTime(1000, spy);
    vi.advanceTimersByTime(60_000);
    expect(spy).not.toHaveBeenCalled();
    setVisibility('visible');
    vi.advanceTimersByTime(1000);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('stops the clock while hidden and resumes with what was left', () => {
    const spy = vi.fn();
    afterVisibleTime(1000, spy);
    vi.advanceTimersByTime(600);
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    expect(spy).not.toHaveBeenCalled();
    setVisibility('visible');
    vi.advanceTimersByTime(399);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('never fires once cancelled, and never fires twice', () => {
    const cancelled = vi.fn();
    afterVisibleTime(1000, cancelled)();
    const once = vi.fn();
    afterVisibleTime(1000, once);
    vi.advanceTimersByTime(1000);
    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(5000);
    expect(cancelled).not.toHaveBeenCalled();
    expect(once).toHaveBeenCalledOnce();
  });
});
