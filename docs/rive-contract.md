# Rive contract

The single source of truth for how this site talks to the Rive scene. If anything else in the
repo disagrees about names, inputs or fit mode, **this document wins**.

These names are referenced as literal strings in `src/config.ts` and `src/components/RiveScene.tsx`.
A mismatch does not throw. The scene keeps animating and silently stops responding to the clock,
which is the failure mode every rule below exists to prevent.

- **File:** `assets/rive/ewenn-scene.riv`, exported from the Rive editor file `scene-singlesection`
  (file id 2569346). Served at `/rive/ewenn-scene.riv`.
- **Runtime:** `@rive-app/react-webgl2`. The Rive Renderer is **required**, not a preference: the
  near snowflakes are feathered and the snowfall is drawn by an embedded Luau script. The
  `react-canvas`, `canvas-lite` and `webgl` runtimes either drop the effect or cannot run the file.
- Re-exporting? Run `npm run sync:assets`, then `npm run screenshots`.

## Artboards

| Artboard | Used when | Design size |
|---|---|---|
| `site-desktop` | `innerWidth / innerHeight >= 0.75` | 2243 × 1205 |
| `site-mobile` | `innerWidth / innerHeight < 0.75` | 1080 × 2340 |

Both use state machine **`State Machine 1`** and bind view model **`PenguinControls`**, instance
**`Default`** — so the runtime is given `autoBind: true`.

Every other artboard in the file is a component nested inside these two. **Never load one
directly.** Layout is `new Layout({ fit: Fit.Layout })` at the default scale factor; both
artboards reflow correctly at every viewport shape in the screenshot matrix.

Switching artboard remounts the runtime (`useRive` reads its parameters only at mount), so the
resize that triggers it is debounced by 150 ms in `src/hooks/useViewportArtboard.ts`.

## What the site writes — and it is only these six

| Property | Type | Contract |
|---|---|---|
| `time` | number | `0` night, `1` day, `2` noon, `3` evening. Entry transitions are 0 ms, so a value written in `onRiveReady` lands on frame 1. Later changes blend over 500 ms. |
| `lampOn` | trigger | Fire when the phase becomes evening or night, and once shortly after load if it starts in one. Idempotent. |
| `lampOff` | trigger | Fire when the phase becomes day or noon. Idempotent. |
| `scroll` | number | Reader progress along the world, in stops: `0` on the hero, `1` at the first stop, fractional in between. Written at most once a frame; rounded to whole stops under reduced motion. On `home` it drives `world` (`0 - {Input} * 1920`), `world-far` (`0 - {Input} * 960`) and counter-moves the walker; on `home-mobile` the same with a 1400-unit stop. `board-stats` also reads it: its reveal plays above `0.9` and resets below `0.4`. |
| `walkPose` | number | `0` facing the viewer, `1` standing sideways, `2` walking. Drives `penguin-walker`'s state machine; the turn between front and side (15 frames) plays inside the file. Written by `src/lib/walker.ts`. |
| `walkFacing` | number | `0` right (down the page), `1` left (back up it). Mirrors the walker through `facingToScaleX` (`1 - {Input} * 2`, a raw scale, not a percentage). |

Written imperatively: `rive.viewModelInstance.number('time').value = n` and
`rive.viewModelInstance.trigger('lampOn').trigger()`. No `useStateMachineInput`, no Rive Events.

Because both triggers are idempotent, the lamp is **reasserted on every phase change** rather
than only on transitions into evening. `src/components/RiveScene.test.tsx` locks that in.

## What the site must never touch

`vw`, `vh`, `section`, `nav` and everything under it, every `navTest*`, `tap`, `jump`,
`lampTapped`, `snow`, `flagTapped`, `goalCompleted`, `appStoreClicked`, `playStoreClicked`,
`hoverAppStore`, `hoverPlayStore`, `treeTapFrontLeft`, `treeTapFrontRight`, `treeTapBackLeft`,
`treeTapBackLeft2`, `treeTapBackRight`.

Some are inert leftovers from an earlier multi-section site. The rest belong to interactions that
run **inside** the file and need no site code.

## Interactions that live in the .riv

The site contributes no click handling whatsoever. There is not one pointer event listener in
`src/`.

- **Penguin** — pointer down makes it jump; otherwise it cycles random idle animations.
- **Streetlamp** — a click toggles the light.
- **Trees** — pointer down shakes the tapped tree (root bone about ±4.7°, settling in ~0.8 s) and
  drops nine snow clumps that fade within ~1 s. Five trees on `site-desktop`, two on
  `site-mobile`; each placement has its own view-model instance, so only the tapped one reacts.
  Tapping mid-shake restarts the shake.
- **Snowfall** — the embedded `Snowfall` Luau script, on at load: 220 flakes in three parallax
  layers, the near layer feathered.
- **Clouds** drift continuously.

**This is why `.overlay` is `pointer-events: none`,** with `auto` restored only on its own links
and the footer pill. The trap that creates is worth stating: anything added to the HTML layer that
covers the lamp or a tree leaves them *clickable while invisible*. The landscape corridor in
`global.css` exists partly for that reason.

### Known defect

**The back-left tree does not respond to taps.** Inherited from the previous build and not yet
fixed in the editor. Do not work around it in site code — it is a hit-area problem in the `.riv`.

## Safe zones for the HTML layer

**`site-desktop`** at roughly 16:9 — the penguin is horizontally centred (47–56% of the width);
its head starts at ~58% of the viewport height and its feet end at ~75%. The sun is top-left by
day, top-centre at noon and on the right in the evening; the moon is top-left at night. On aspect
ratios ≥ 2:1 or heights ≤ 500 px the bottom-anchored scene raises the penguin to 45–51%, which is
what the landscape corridor in `global.css` is for.

**`site-mobile`** (portrait) — sun and moon top-right (5–10% of the height), leaving the header
clear on the left. Tree tops reach ~48%. On phones the penguin's head starts at ~59% and its feet
end at ~77%; on iPad portrait, ~66% and ~86%. Plain snow fills from ~80% down, where the footer sits.

## Phase colours

Sky base fill per phase: day `#81CBEE`, noon `#9BDEFE`, evening `#F2AD71`, night `#867BFB`.
Mirrored in `src/styles/tokens.css` as `--sky`, which paints the static fallback sky. It is kept
off `html` and `body` and there is no `<meta name="theme-color">`, so Safari's bars stay neutral.

Only the sky, the sun and the moon change with the phase. **The ground art has no night variant**,
so night is where header and footer legibility is tightest — `npm run contrast` measures it.

## The loading animation

A second, much smaller file: `assets/rive/loading-anim.riv` (8 kB), served at
`/rive/loading-anim.riv` and played by `src/components/LoadingScreen.tsx` over the home page while
the scene loads. Same runtime, same self-hosted Wasm.

| | |
|---|---|
| Artboard | `app_logo`, 628 × 627 — the app icon, full bleed, fill `#74D6EF` |
| State machine | `State Machine 1`, no inputs; entry goes straight to `intro` |
| `intro` | One-shot, 120 frames at 60 fps, speed 0.8 — **2.5 s** — then holds the last frame (the wink) |
| View model | `ViewModel1`, no properties and not linked to the artboard, so **no `autoBind`** (it would only log a warning) |

The site writes nothing to it. The file has no end-of-intro signal either, so the length lives in
`LOADER_INTRO_SECONDS` in `src/config.ts`. **Change the intro's length, speed or fps in the
editor and that constant must change with it**: too short, and the loader lifts mid-wave; too long,
and it holds on a finished frame. `LoadingScreen.test.tsx` pins it at 2.5.

The loader lifts when the intro has played *and* the scene is ready (or has failed), or after
`LOADER_MAX_MS` of visible time, whichever comes first. Played means animation time the runtime
actually advanced, so a background tab plays the intro when it is first shown. Under reduced motion
the tile shows the still logo instead and lifts as soon as the scene is ready. Without WebGL2
there is no loader at all.
