import { Fit, Layout, useRive } from '@rive-app/react-webgl2';
import type { Rive } from '@rive-app/webgl2';
import { useEffect, useRef, useState } from 'react';
import { RIVE_SRC, RIVE_STATE_MACHINE } from '../config';
import type { SceneArtboard } from '../lib/artboard';
import { afterFrames } from '../lib/frames';
import { greet, isAtGreetStop } from '../lib/greeting';
import { PHASE_TIME_VALUE, isLampOnPhase, type Phase } from '../lib/phase';
import { MAX_ADAPT_STEPS, medianFrameMs, nextPixelRatio, renderPixelRatio } from '../lib/renderScale';
import { INITIAL_WALKER, isSettled, stepWalker, type WalkerState } from '../lib/walker';
import './riveRuntime';

/**
 * Long enough for the file's 500 ms phase blends, and for the lamp to finish switching on
 * (about 0.35 s after load in Chrome), while the scene is otherwise paused.
 */
export const PHASE_BLEND_MS = 700;

/** Adaptive resolution timing: wait out the load, then measure this many frames per verdict. */
const ADAPT_START_MS = 2500;
const ADAPT_SETTLE_MS = 700;
const ADAPT_FRAMES = 90;

// Stable instance: a new Layout on every render would be re-applied to the runtime each time.
const SCENE_LAYOUT = new Layout({ fit: Fit.Layout });

export type RiveSceneProps = {
  artboard: SceneArtboard;
  phase: Phase;
  paused: boolean;
  onLoadError: () => void;
  /** Where the reader is along the world, in stops. Omitted, the world stays on the hero. */
  readProgress?: () => number;
  /** Where the penguin has actually walked to, in stops, reported on every frame it moves. */
  onWalk?: (shown: number) => void;
  /** Called once the scene has drawn the right phase and starts to fade in. */
  onReady?: () => void;
};

/** Returns false when the view model didn't bind, which makes every write a silent no-op. */
function writeTime(rive: Rive, phase: Phase): boolean {
  const time = rive.viewModelInstance?.number('time');
  if (!time) return false;
  time.value = PHASE_TIME_VALUE[phase];
  return true;
}

/** The ratio to draw this canvas at: its size-aware cap, or lower once frame timing has stepped down. */
function drawRatio(canvas: HTMLCanvasElement, adapted: number): number {
  const cssPixels = canvas.clientWidth * canvas.clientHeight;
  return Math.min(renderPixelRatio(window.devicePixelRatio, cssPixels), adapted);
}

function fireLamp(rive: Rive, trigger: 'lampOn' | 'lampOff') {
  rive.viewModelInstance?.trigger(trigger)?.trigger();
}

export function RiveScene({ artboard, phase, paused, onLoadError, readProgress, onWalk, onReady }: RiveSceneProps) {
  const [ready, setReady] = useState(false);
  const phaseRef = useRef(phase);
  const pausedRef = useRef(paused);
  const onLoadErrorRef = useRef(onLoadError);
  const onWalkRef = useRef(onWalk);
  const onReadyRef = useRef(onReady);
  const appliedPhaseRef = useRef<Phase | null>(null);
  const cancelStartupRef = useRef<() => void>(() => undefined);
  const warnedUnboundRef = useRef(false);
  /** The resolution the frame-time check has settled on; Infinity until it steps down. */
  const adaptedRatioRef = useRef(Number.POSITIVE_INFINITY);
  /** Re-applies the current drawing-surface ratio; set by the canvas effect below. */
  const applyRatioRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    phaseRef.current = phase;
    pausedRef.current = paused;
    onLoadErrorRef.current = onLoadError;
    onWalkRef.current = onWalk;
    onReadyRef.current = onReady;
  });

  useEffect(() => () => cancelStartupRef.current(), []);

  useEffect(() => {
    if (ready) onReadyRef.current?.();
  }, [ready]);

  const { rive, canvas, RiveComponent } = useRive({
    src: RIVE_SRC,
    artboard,
    stateMachine: RIVE_STATE_MACHINE,
    autoplay: !paused,
    autoBind: true,
    layout: SCENE_LAYOUT,
    isTouchScrollEnabled: true,
    // The offscreen renderer shares one WebGL context across every Rive canvas on the page by
    // drawing into it and blitting the result out. That trade only pays when there are several
    // canvases; this page has exactly one, full-screen, so the blit is a whole extra copy of the
    // frame for nothing. Measured at 48 fps against 36 with it on, and 24 against 21 on a 2x
    // display. Turning it off is what the runtime does anyway when a GPU canvas is requested.
    useOffscreenRenderer: false,
    onRiveReady: (instance: Rive) => {
      // Runs before the first frame, so the correct phase is drawn from frame 1.
      const startPhase = phaseRef.current;
      if (!writeTime(instance, startPhase) && !warnedUnboundRef.current) {
        warnedUnboundRef.current = true;
        console.warn(
          '[ewenn] The Rive view model did not bind (expected PenguinControls/Default with a number "time"); the scene will not follow the clock.',
        );
      }
      appliedPhaseRef.current = startPhase;
      // A paused state machine never advances, so neither the layout reflow nor the lamp would show.
      // Play while the canvas is still hidden; a paused start pauses once that has settled.
      instance.play();
      // Triggers need the state machine to have settled into its entry state first.
      cancelStartupRef.current = afterFrames(2, () => {
        if (isLampOnPhase(startPhase)) fireLamp(instance, 'lampOn');
        if (!pausedRef.current) {
          setReady(true);
          return;
        }
        const timer = window.setTimeout(() => {
          // Each frame advances by the real elapsed time, so waiting for frames too keeps slow devices from pausing early.
          cancelStartupRef.current = afterFrames(2, () => {
            if (pausedRef.current) instance.pause();
            setReady(true);
          });
        }, PHASE_BLEND_MS);
        cancelStartupRef.current = () => window.clearTimeout(timer);
      });
    },
    onLoadError: () => onLoadErrorRef.current(),
  });

  // The scene is redrawn in full every frame, so the drawing surface is capped (lib/renderScale.ts)
  // rather than left at the display's own ratio: at MAX_PIXEL_RATIO for a large canvas, higher for
  // a small one such as a phone's, where the cap would blur the scene's small text.
  //
  // useRive owns the canvas: it sizes the surface at the full ratio once the layout gives the
  // element a box, and again on every container resize, from a ResizeObserver throttled through
  // setTimeout(0). Both of those land *after* this effect first runs — at that point the canvas
  // is still 0x0 — so the cap cannot simply be applied once. Watching the element's own box
  // catches the same changes the hook reacts to, and the extra pass on the next frame lands
  // after the hook's timeout has had its turn. Without it the full ratio is quietly restored.
  useEffect(() => {
    if (!rive || !canvas) return;
    const apply = () => {
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      rive.resizeDrawingSurfaceToCanvas(drawRatio(canvas, adaptedRatioRef.current));
    };
    applyRatioRef.current = apply;
    let frame = 0;
    const reapply = () => {
      apply();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    // Only the CSS box is observed, and only the width/height attributes are written, so
    // re-applying the cap cannot retrigger this.
    const observer = new ResizeObserver(reapply);
    observer.observe(canvas);
    reapply();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      applyRatioRef.current = () => undefined;
    };
  }, [rive, canvas]);

  // Adaptive resolution (lib/renderScale.ts): once the scene has settled, time a couple of
  // seconds of real frames and step the drawing surface down while they stay slower than 40fps.
  // Only ever downwards, and at most MAX_ADAPT_STEPS times, so it cannot oscillate. A paused
  // scene costs nothing and is left alone; a hidden tab reports no frames and is skipped.
  useEffect(() => {
    if (!rive || !ready || paused) return;
    let cancelled = false;
    let frame = 0;
    let timer = 0;
    let steps = 0;
    let strikes = 0;
    const sample = () => {
      if (cancelled) return;
      if (document.visibilityState !== 'visible') {
        timer = window.setTimeout(sample, ADAPT_SETTLE_MS);
        return;
      }
      const intervals: number[] = [];
      let last = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        intervals.push(now - last);
        last = now;
        if (intervals.length < ADAPT_FRAMES) {
          frame = requestAnimationFrame(tick);
          return;
        }
        const current = canvas
          ? drawRatio(canvas, adaptedRatioRef.current)
          : Math.min(renderPixelRatio(window.devicePixelRatio), adaptedRatioRef.current);
        const next = nextPixelRatio(current, medianFrameMs(intervals));
        // Smooth: nothing to give back, and no reason to keep watching.
        if (next === current) return;
        // Slow once could be the machine, not the scene — another tab, a background sync, a
        // notification animating. A step is permanent for the visit, so it waits for a second
        // slow verdict in a row before it takes one.
        strikes += 1;
        if (strikes < 2) {
          timer = window.setTimeout(sample, ADAPT_SETTLE_MS);
          return;
        }
        strikes = 0;
        adaptedRatioRef.current = next;
        applyRatioRef.current();
        steps += 1;
        if (steps < MAX_ADAPT_STEPS) timer = window.setTimeout(sample, ADAPT_SETTLE_MS);
      };
      frame = requestAnimationFrame(tick);
    };
    timer = window.setTimeout(sample, ADAPT_START_MS);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [rive, canvas, ready, paused]);

  // Declared before the phase effect: when `ready` flips on a paused start, this pause must come first,
  // so a phase change made during startup still gets its play → PHASE_BLEND_MS → pause blend below.
  useEffect(() => {
    if (!rive || !ready) return;
    if (paused) rive.pause();
    else rive.play();
  }, [rive, ready, paused]);

  useEffect(() => {
    if (!rive || !ready) return;
    const previous = appliedPhaseRef.current;
    if (previous === null || previous === phase) return;
    appliedPhaseRef.current = phase;
    writeTime(rive, phase);
    // Both triggers are idempotent in the file, so reassert the lamp on every phase change (spec §6).
    fireLamp(rive, isLampOnPhase(phase) ? 'lampOn' : 'lampOff');
    if (!pausedRef.current) return;
    rive.play();
    const timer = window.setTimeout(() => {
      if (pausedRef.current) rive.pause();
    }, PHASE_BLEND_MS);
    return () => window.clearTimeout(timer);
  }, [rive, ready, phase]);

  // The penguin walks the reader through the world: each frame the world advances toward the
  // scroll position at walking pace (lib/walker.ts) and the pose and facing follow it. Under
  // reduced motion there is no walk: the world snaps to the nearest stop with the penguin facing
  // the viewer, and the paused machine is run for two frames so the snap actually draws.
  useEffect(() => {
    if (!rive || !ready || !readProgress) return;
    const viewModel = rive.viewModelInstance;
    const scroll = viewModel?.number('scroll');
    if (!scroll) {
      console.warn('[ewenn] The Rive file has no "scroll" number; the world will not follow the page.');
      return;
    }
    const pose = viewModel?.number('walkPose');
    const facing = viewModel?.number('walkFacing');
    // The penguins greet each other when the walker reaches them, once per arrival: `write` runs
    // on every frame the reader stands there, and a flipper raised every frame is a seizure, not
    // a greeting. Skipped under reduced motion, where the machine is paused two frames at a time
    // and the wave would freeze half-raised.
    let greeted = false;
    let cancelGreeting: () => void = () => undefined;
    const fireGreeting = (trigger: string) => viewModel?.trigger(trigger)?.trigger();

    // Arriving mid-page (a reload, a fragment link) puts the world there without a walk.
    const start = pausedRef.current ? Math.round(readProgress()) : readProgress();
    let state: WalkerState = stepWalker({ ...INITIAL_WALKER, shown: start }, start, 0, 0);
    let frame = 0;
    let last = 0;
    let cancelRedraw: () => void = () => undefined;

    const write = () => {
      scroll.value = state.shown;
      if (pose) pose.value = state.pose;
      if (facing) facing.value = state.facing;
      onWalkRef.current?.(state.shown);
      if (!pausedRef.current && isAtGreetStop(state.shown)) {
        if (!greeted) {
          greeted = true;
          cancelGreeting = greet(fireGreeting);
        }
      } else if (greeted) {
        greeted = false;
        cancelGreeting();
      }
      if (!pausedRef.current) return;
      cancelRedraw();
      rive.play();
      cancelRedraw = afterFrames(2, () => {
        if (pausedRef.current) rive.pause();
      });
    };

    const tick = () => {
      frame = 0;
      const target = readProgress();
      if (pausedRef.current) {
        const stop = Math.round(target);
        if (stop === state.shown) return;
        state = { ...INITIAL_WALKER, shown: stop };
        write();
        return;
      }
      const now = performance.now();
      // Capped so a tab coming back from the background does not teleport the world.
      const dt = last ? Math.min((now - last) / 1000, 0.25) : 1 / 60;
      last = now;
      state = stepWalker(state, target, now, dt);
      write();
      if (isSettled(state, target)) {
        last = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    write();
    // Landing on the friends stop directly -- a reload, a deep link -- settles the walker there
    // without ever running the loop, so the greeting would never get a frame to start on.
    if (!pausedRef.current && isAtGreetStop(state.shown)) wake();
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake);
    return () => {
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      cancelAnimationFrame(frame);
      cancelRedraw();
      cancelGreeting();
    };
  }, [rive, ready, readProgress]);

  return (
    <div className={ready ? 'scene is-ready' : 'scene'} aria-hidden="true">
      <RiveComponent className="scene__canvas" />
    </div>
  );
}
