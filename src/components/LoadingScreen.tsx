import { Fit, Layout, useRive } from '@rive-app/react-webgl2';
import { useCallback, useEffect, useRef, useState } from 'react';
import logoUrl from '../assets/app-logo.svg';
import { LOADER_ARTBOARD, LOADER_INTRO_SECONDS, LOADER_MAX_MS, LOADER_SRC, LOADER_STATE_MACHINE } from '../config';
import { afterVisibleTime } from '../lib/frames';
import './riveRuntime';

/** How long the loader takes to fade off the page. .loader's transition in global.css matches it. */
export const LOADER_FADE_MS = 500;

/*
 * Cover, not Contain: the artboard is 628 x 627, and the pixel Contain would leave along one edge
 * shows as a hairline inside the rounded tile.
 */
const LOADER_LAYOUT = new Layout({ fit: Fit.Cover });

/** Keys that would scroll the page — useStopScroll's, and the browser's own. */
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

export type LoadingScreenProps = {
  /** The scene is ready to be seen, or has failed and never will be. */
  sceneSettled: boolean;
  reducedMotion: boolean;
  /** Called once, as the loader starts to fade: the page's own entrance can begin under it. */
  onLift: () => void;
};

/**
 * Plays the intro and reports when it has finished.
 *
 * Finished is measured in time the runtime has actually advanced, not time on the clock. Rive
 * advances on animation frames, so a tab opened in the background plays the intro when it is
 * first shown instead of having it run out unseen. The file has no end-of-intro signal of its
 * own; see LOADER_INTRO_SECONDS.
 */
function LoaderIntro({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  const playedRef = useRef(0);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const { RiveComponent } = useRive({
    src: LOADER_SRC,
    artboard: LOADER_ARTBOARD,
    stateMachine: LOADER_STATE_MACHINE,
    autoplay: true,
    layout: LOADER_LAYOUT,
    // A context of its own, as the scene has. The shared offscreen one only pays for itself when
    // several canvases draw at once, and this one is gone a few seconds after the page loads.
    useOffscreenRenderer: false,
    onAdvance: (event) => {
      if (playedRef.current >= LOADER_INTRO_SECONDS || typeof event.data !== 'number') return;
      playedRef.current += event.data;
      if (playedRef.current >= LOADER_INTRO_SECONDS) onDoneRef.current();
    },
    // No intro to wait for. The loader still holds until the scene is ready, over a plain tile.
    onLoadError: () => onDoneRef.current(),
  });

  return <RiveComponent className="loader__canvas" />;
}

/**
 * The app icon, full screen, while the scene loads: the penguin peeks up out of the tile, waves
 * and winks, and the page fades in once both that intro and the scene are done.
 *
 * Until the runtime is ready the tile is plain blue, which is also the intro's first frame, so
 * the animation starting is never a jump. Under reduced motion the tile shows the still logo
 * instead and lifts as soon as the scene is ready.
 *
 * It lifts after LOADER_MAX_MS of visible time whatever the scene is doing: the page is complete
 * without the scene, which fades in on its own once it arrives.
 */
export function LoadingScreen({ sceneSettled, reducedMotion, onLift }: LoadingScreenProps) {
  // Read once. A preference changed mid-load should not swap the tile's contents out from under
  // the visitor.
  const [still] = useState(reducedMotion);
  const [introDone, setIntroDone] = useState(still);
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);
  const onLiftRef = useRef(onLift);
  const onIntroDone = useCallback(() => setIntroDone(true), []);

  useEffect(() => {
    onLiftRef.current = onLift;
  });

  useEffect(() => afterVisibleTime(LOADER_MAX_MS, () => setTimedOut(true)), []);

  // Every input to this only ever turns true, so once the loader starts leaving it never comes back.
  const leaving = timedOut || (introDone && sceneSettled);

  useEffect(() => {
    if (!leaving) return;
    onLiftRef.current();
    // Unmounted once faded, which is what frees its WebGL context.
    const timer = window.setTimeout(() => setGone(true), still ? 0 : LOADER_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, still]);

  // Nothing underneath moves while the loader is up. Without this a swipe during the intro scrolls
  // the page and sends the penguin walking, and the loader lifts onto the next stop. Captured at
  // the window, so the event never reaches useStopScroll's listeners there. touchstart only has its
  // propagation stopped: useStopScroll steps on touchend, and a swipe it never saw start is ignored.
  useEffect(() => {
    if (leaving) return;
    const block = (event: Event) => {
      if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) return;
      if (event.type !== 'touchstart') event.preventDefault();
      event.stopPropagation();
    };
    const options: AddEventListenerOptions = { capture: true, passive: false };
    const types = ['wheel', 'touchstart', 'touchmove', 'keydown'] as const;
    types.forEach((type) => window.addEventListener(type, block, options));
    return () => types.forEach((type) => window.removeEventListener(type, block, options));
  }, [leaving]);

  if (gone) return null;

  return (
    <div className={leaving ? 'loader loader--leaving' : 'loader'} aria-hidden="true">
      <div className="loader__tile">
        {still ? <img className="loader__still" src={logoUrl} alt="" /> : <LoaderIntro onDone={onIntroDone} />}
      </div>
    </div>
  );
}
