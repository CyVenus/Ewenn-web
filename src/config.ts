/**
 * Ewenn's numeric App Store ID. Being set, it activates the Smart App Banner meta tag and routes
 * APP_STORE_URL to the app's own page.
 */
export const APP_STORE_ID = '6804755458';

/**
 * The badge and the `apple-itunes-app` meta tag must never disagree about whether the app is
 * live, so both ask this one predicate rather than each testing the ID themselves.
 */
export const isLiveAppStoreId = (id: string): boolean => /^\d+$/.test(id);

export const APP_STORE_LIVE = isLiveAppStoreId(APP_STORE_ID);

/** App Store URL opened when the provider badge is clicked: Ewenn's live listing. */
export const APP_STORE_URL = APP_STORE_ID
  ? `https://apps.apple.com/in/app/ewenn/id${APP_STORE_ID}`
  : 'https://apps.apple.com/in/iphone/apps';

/** The public origin. Feeds each page's canonical and og:url, and the absolute share-image URL. */
export const SITE_URL = 'https://ewenn.app';

export const COPY = {
  name: 'Ewenn',
  headline: 'Your little goal buddy.',
  /** Phrases of the headline set on a highlighter stroke. Each must appear in it word for word. */
  headlineMarks: ['goal buddy.'],
  subline: "Set a goal and Ewenn's AI turns it into small daily steps. Take them on with a friend.",
} as const;

/**
 * A guard on the headline, dormant while the current one has no hyphen in it.
 *
 * `text-wrap: balance` will break a headline at a hyphen — "Your new self-" / "care partner." —
 * whenever that split has the shorter longest line, so balance actively prefers it. A max-width
 * cannot fix it either: the half before the hyphen is narrower than the whole phrase, so any box
 * that fits the line we want also fits the break we don't. Marking the hyphenated phrase
 * unbreakable in the markup is the one fix that leaves COPY.headline byte-identical on the page
 * and in the clipboard. With no hyphen to protect, the whole headline goes in the span, which is
 * an inline-block and so wraps exactly as the bare text would.
 */
function splitAtHyphenatedPhrase(headline: string): { lead: string; phrase: string } {
  const words = headline.split(' ');
  const index = words.findIndex((word) => word.includes('-'));
  if (index <= 0) return { lead: '', phrase: headline };
  return { lead: `${words.slice(0, index).join(' ')} `, phrase: words.slice(index).join(' ') };
}

export const HEADLINE = splitAtHyphenatedPhrase(COPY.headline);

/**
 * One entry per stop in the Rive world, in scroll order after the hero. The scene is built with
 * a stop every 1920 units along `world`, so this list and the file must grow together — a stop
 * here with no scenery behind it scrolls onto empty snow.
 */
export const STOPS = [
  {
    id: 'goals',
    title: 'Set a goal. Get gentle steps.',
    marks: ['a goal.', 'gentle steps.'],
    body: 'Tell Ewenn what you want to work on and it suggests small, doable steps. Tick them off one day at a time.',
  },
  {
    id: 'friends',
    title: 'Better with a friend.',
    marks: ['a friend.'],
    body: 'Take on a challenge together, see how each other is doing, and cheer them on when the day gets hard.',
  },
] as const;

export const RIVE_SRC = '/rive/ewenn-scene.riv';
export const RIVE_STATE_MACHINE = 'State Machine 1';
export const DESKTOP_ARTBOARD = 'site-desktop';
export const MOBILE_ARTBOARD = 'site-mobile';

/** Below this width/height ratio the portrait artboard is the right composition. */
export const PORTRAIT_MAX_ASPECT = 0.75;

/**
 * The loading animation: the app icon's penguin peeking up, waving and winking. One artboard,
 * one state machine with no inputs, and a single one-shot `intro` state that holds its last frame.
 * Nothing in the file says when the intro has finished, so its length is written down here.
 */
export const LOADER_SRC = '/rive/loading-anim.riv';
export const LOADER_ARTBOARD = 'app_logo';
export const LOADER_STATE_MACHINE = 'State Machine 1';
/** `intro` is 120 frames at 60 fps, played at speed 0.8. Re-exported with a new length? Change this. */
export const LOADER_INTRO_SECONDS = 120 / 60 / 0.8;
/** The longest the loader holds the page, in visible time, however slow the scene is. */
export const LOADER_MAX_MS = 8000;
