# Ewenn — website

Single-screen marketing site for **Ewenn**, an iOS self-care app with a penguin companion.

React 19 + Vite + TypeScript, with a full-screen interactive Rive scene that follows the
visitor's local time of day. No scrolling on a normal viewport: a header, one block of copy with
Apple's App Store badge, and a footer, over a winter scene you can poke at.

```bash
npm install
npm run dev          # http://localhost:5173
```

> **Use `localhost`, not `127.0.0.1`.** Vite binds to IPv6 here, so `127.0.0.1` refuses the
> connection while `localhost` works.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run clean` | Removes build artifacts and test screenshots (`dist/`, `screenshots/`) |
| `npm run preview` | Serve the built `dist/` |
| `npm test` | Unit and component tests (vitest + jsdom) |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint |
| `npm run screenshots` | 8 viewports × 4 phases against a running preview, with layout assertions |
| `npm run screenshots:fallback` | Asserts the page still works with WebGL disabled |
| `npm run contrast` | Measures real contrast per phase against WCAG AA: the hero, each stop's title over its own scenery, and the highlighted phrases |
| `npm run layout` | 22 viewport shapes × 2 pages: overflow, overlap and zoom reflow |
| `npm run sync:assets` | Copies `assets/` originals to `public/` and `src/assets/` |
| `npm run check:assets` | Verifies those copies have not drifted |

The four QA commands need a preview running: `npm run build && npm run preview -- --port 4180`.
Override the target with `BASE_URL`.

### Zoom is a viewport size, not a mode

Zooming to 300% on a 1440x900 window gives the page a 480x300 CSS viewport — the height shrinks
by the same factor as the width. Width-only breakpoints therefore miss zoom completely, which is
how the hero once ended up with its badge and footer pushed off the bottom and a four-word
headline set in five lines. `npm run layout` covers the shapes 125–500% zoom produces, and the
rules that matter are keyed on `max-height` and aspect ratio rather than width alone.

Horizontal scrolling is the one thing never acceptable (WCAG 1.4.10). Scrolling *down* at high
zoom is expected, and the audit budgets it rather than banning it.

## The App Store link

`APP_STORE_ID` / `APP_STORE_URL` in `src/config.ts`:

- Ewenn is live: `APP_STORE_ID` is `6804755458`, and the provider badge opens
  `https://apps.apple.com/in/app/ewenn/id6804755458` in a new tab.
- The same ID emits the matching `apple-itunes-app` Smart App Banner in `src/lib/headTags.ts`.
  Clearing the ID falls back to the generic `https://apps.apple.com/in/iphone/apps` and drops the banner.

Change it and rebuild. Nothing else changes.

Ads land on `/?utm_source=…`, and the badge swaps in the matching App Store Connect campaign link
from `APP_STORE_CAMPAIGN_URLS` (`instagram`, `x`) so App Analytics credits the download to the ad.
The source is kept in `sessionStorage` for the tab, so it survives a trip to the doc pages; any
other source, or none, gets `APP_STORE_URL`; `src/lib/campaign.ts` does the choosing. A new
campaign is one more lowercase key in `APP_STORE_CAMPAIGN_URLS`, holding the link App Store
Connect generates. The Smart App Banner is fixed at build time and is never tagged.

## How the day/night cycle works

The scene has four phases, chosen from the visitor's **local browser clock** — so time zone and
daylight saving are handled by the platform, and there is no timezone library anywhere.

| Phase | Hours | Rive `time` | Sky |
|---|---|---|---|
| `day` | 06:00–10:59 | 1 | `#81CBEE` |
| `noon` | 11:00–15:59 | 2 | `#9BDEFE` |
| `evening` | 16:00–19:59 | 3 | `#F2AD71` |
| `night` | 20:00–05:59 | 0 | `#867BFB` |

The boundaries live in `src/phase-schedule.json`, read by both the app and the build so they
cannot drift. `src/lib/prepaint.ts` emits a tiny classic script that sets `<html data-phase>`
**before first paint**, so there is no flash of the wrong sky; a test proves it agrees with
`getPhase` at every half hour. The phase is re-evaluated every 60 s and whenever a backgrounded
tab becomes visible. The lamp in the scene is lit for evening and night only.

**`?phase=night|day|noon|evening`** (or `0`–`3`) pins the phase and stops the tick. The
screenshot matrix relies on it.

## Architecture

```
src/
  config.ts          copy, Rive names, App Store + site constants
  phase-schedule.json  the four boundaries, shared with the build
  lib/               pure logic: phase, prepaint, artboard, routes, headTags, frames, webgl
  hooks/             usePhase, useReducedMotion, useViewportArtboard
  components/        RiveScene/RiveStage + the static UI
  content/           the legal documents, as JSX
  pages/             one createRoot entry per HTML document
  styles/            tokens.css (design tokens) + global.css (layout)
```

There is **no router**. Each page is its own HTML document with its own entry — a single screen
plus three text pages does not need one.

`assets/` holds the protected originals (the two `.riv` files and two SVGs); `public/` and `src/assets/`
hold copies the app loads by URL or bundles. `npm run check:assets` is what notices if they drift.

## Things that will bite you

- **The Rive names are a contract.** `docs/rive-contract.md` is the source of truth. A typo does
  not throw; the scene keeps animating and quietly ignores the clock.
- **Only three properties may be written**: `time`, `lampOn`, `lampOff`. Everything else in the
  file belongs to interactions that run inside it.
- **`.overlay` is `pointer-events: none`** so clicks reach the canvas. Anything added to the HTML
  layer that covers the lamp or a tree makes them *clickable while invisible*.
- **The Rive canvas must never be the LCP element.** The headline paints first and is the LCP;
  the canvas fades in when it reports ready.
- **`prefers-reduced-motion` alone governs playback.** There is deliberately no pause button.
- **The home page opens on a loading animation** (`loading-anim.riv`, the app icon's penguin
  waving). It holds the page until its 2.5 s intro has played and the scene is ready, capped at
  8 s, and the page's own entrance waits under it. Its length is a constant in `src/config.ts`
  that has to follow the file; see the contract. The QA scripts wait for it to leave.

## Fallbacks

The page is complete and correct without the scene. No WebGL2 → a flat phase-coloured sky with a
snow horizon, one console warning, no throw. A failed `.riv` load on mobile retries the desktop
artboard once, then falls back. A view model that does not bind warns once and leaves the scene
playing without the clock. `npm run screenshots:fallback` asserts the first of these.

## Deploying

This repo owns Firebase Hosting for `ewenn.app` (project `ewenn-387ed`, default site). The app
repo keeps Cloud Functions and Firestore and has no `hosting` block, so a deploy from there can
never put the old site back. `firebase.json`'s predeploy hook rebuilds `dist/` first.

```bash
firebase hosting:channel:deploy preview --expires 7d          # a throwaway URL, rewrites included
firebase hosting:clone ewenn-387ed:preview ewenn-387ed:live   # promote exactly what you checked
# or, straight to live:
firebase deploy --only hosting
```

The domain's DNS is on Cloudflare. The apex `A` record and the `hosting-site=` TXT record must
stay **DNS-only** (grey cloud), or Firebase cannot renew its certificate. `www` is a proxied
placeholder record that a Cloudflare redirect rule sends to the apex, path and query kept.

Whatever serves this must keep four things true, all of them inherited from the live domain — and
`firebase.json` is where each one is kept:

1. **`/privacy.html` and `/terms.html` must keep resolving.** App Store Connect, both Rewenn
   subscription products and the paywall inside the binary link there. The build emits each
   document at both its directory URL and its `.html` alias for exactly this reason.
2. **`cleanUrls` stays off**, or it rewrites `/.well-known/apple-app-site-association`.
3. **Serve the AASA file as `application/json`.** It has no extension, so most hosts will not
   infer it.
4. **Keep the `/challenge/**` and `/invite/**` rewrites** — universal links rendered elsewhere.
   This repo deliberately ships no static stand-in for them.

Caching: hashed `dist/assets/` (including the WASM) `public, max-age=31536000, immutable`;
`/rive/ewenn-scene.riv` and all HTML `no-cache`. Serve `.wasm` as `application/wasm`, and if you
add a CSP it must allow `'wasm-unsafe-eval'`.

**Compress the `.wasm`.** It is the single largest download on the site — 2.1MB raw, about 0.9MB
gzipped and less with Brotli — and hosts that compress by MIME type often leave
`application/wasm` off the list. Check it is served with a `Content-Encoding`; `vite preview`, for
one, does not compress it. The `.riv` has no registered type at all, so check it is compressed too
(1.9MB raw, about 1.1MB gzipped).

## Manual QA

The automated matrix cannot see the scene's interactions — they are sub-second transients inside
the `.riv`, and falling snow defeats pixel diffing. Click through these by hand:

- each tree shakes and drops snow (**known: the back-left tree does not** — see the contract)
- the penguin jumps
- the streetlamp toggles
- `?phase=` changes the sky, and the lamp is lit for evening and night
- keyboard focus is visible on every link
- with reduced motion on, the scene starts paused on the correct phase
- on load, the icon's penguin peeks up, waves and winks, then the page fades in and the headline
  blurs into focus; with reduced motion on, the still icon shows and the page follows without a fade
