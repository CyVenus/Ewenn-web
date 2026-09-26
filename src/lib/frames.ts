/** Runs `callback` after `count` animation frames. Returns a cancel function. */
export function afterFrames(count: number, callback: () => void): () => void {
  let remaining = count;
  let handle = 0;
  const tick = () => {
    remaining -= 1;
    if (remaining <= 0) {
      callback();
    } else {
      handle = requestAnimationFrame(tick);
    }
  };
  handle = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(handle);
}

/**
 * Runs `callback` once `ms` of *visible* time has passed. The clock stops while the tab is hidden,
 * so a page opened in a background tab has not used up its wait before anyone has seen it.
 * Returns a cancel function.
 */
export function afterVisibleTime(ms: number, callback: () => void): () => void {
  let remaining = ms;
  let startedAt = 0;
  let timer = 0;
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (!timer) start();
    } else if (timer) {
      window.clearTimeout(timer);
      timer = 0;
      remaining -= performance.now() - startedAt;
    }
  };
  const cancel = () => {
    window.clearTimeout(timer);
    timer = 0;
    document.removeEventListener('visibilitychange', onVisibility);
  };
  const start = () => {
    startedAt = performance.now();
    timer = window.setTimeout(() => {
      cancel();
      callback();
    }, Math.max(0, remaining));
  };
  document.addEventListener('visibilitychange', onVisibility);
  if (document.visibilityState === 'visible') start();
  return cancel;
}
