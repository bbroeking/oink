# Barn entrance placement + door-swing build plan

Status: **implemented** (2026-09-12; proposed 2026-09-11). Painted art landed the same day: `assets/images/barn/exterior/` (body + two leaves + `barn_layers.json`, sliced by `scripts/habitat/slice_barn.py` from the ChatGPT image in `docs/openai-barn-structure.md`); motion moved to Rosie's squash-and-spring recipe. Verified on an iPhone 17 Pro simulator: tap → leaves part → threshold closes → room opens; Home → room closes → threshold opens → leaves shut. Deviations from the proposal: the ground offset measured on device is 54pt with the painted body (48 with the code-drawn one), not the paper 28 (Rosie's feet sit higher in her stage than the math said); the one-time Spotlight was **not** shipped — the home tab has no `SpotlightProvider` and its overlays are arbitrated through `usePopupSlot`, so discoverability rests on the beckon state for now; the truffle shovel returned to the committed in-flow corner row rather than staying alone inside the notice-board card. Tap-target note: the pig's pressable is her whole 300pt stage (51–351pt on a 17 Pro), so only the barn's left ≈33pt column and its roof/wall above her stage are barn-only touch; taps on the overlapped door area tickle Rosie by design. Decides where the tappable barn structure lives on the Exterior and how the open/close motion is built. Implements Phase 3 of `docs/habitat.md` ("Exterior barn structure") and honours ADR-0003 decision #1 ("Interior reached by tapping the barn structure") and #3 ("door-swing transition on enter and exit").

Pillar: **Connect** (the barn is the home friends visit) and **Collect** (the barn is where the furnishings live; the structure is the thing that beckons when there is something new). Craft lens: the barn is game, a gold button is SaaS.

---

## 1. Where things stand today (verified in code + a 17 Pro simulator shot)

| Surface | What exists | Problem |
| --- | --- | --- |
| Exterior (`components/Barn.tsx`) | Two entries: the gold **Enter Barn** `HabitatEntry compact` button in the action row, and a 64×56 ghost-opacity SVG barn silhouette at `bottom:160,left:22` (`styles.barnSilhouette`) that only renders when **no cosmetic background is equipped**, sits at `zIndex:0` behind Rosie, and is disabled when the `habitat` flag is off | The silhouette is the right idea drawn as a placeholder; on the default background Rosie's left ear covers most of it. 46 of 47 backgrounds hide it entirely. Audit finding A row 7/43: "same destination, different look". |
| Interior (`app/barn-interior.tsx`) | Wrapped in `HabitatDoorTransition`: two full-screen panels (`barn_door.png`, each 51% wide) slide ±105pt and fade after 35% travel, content crossfades with progress. 450ms (`MOTION_DURATION.celebration`); Reduce Motion → 150ms crossfade, zero travel. `Stack.Screen animation:"none"`, so the doors **are** the route transition. Exit: **Home** ghost button → `leaving` → exit direction → `onClosed` → `router.back()` | Works, tested (`__tests__/HabitatDoorTransition.test.tsx`), motion-policy clean. But it has no continuity with the thing you tapped: the exterior cuts straight to closed doors. |
| Friend visit (`components/BarnVisitModal.tsx`) | An **Inside / Outside** ghost `Button` toggles `HabitatFriendRoom`, which reuses `HabitatDoorTransition` | Same generic-control problem; out of scope for this pass, but the structure built here should be reusable there. |
| Art | `assets/images/habitat/barn_door.png` (+ `source/barn_door.svg`): the door pair. `assets/images/glyphs/barn.png`: a front-facing red barn with X-doors, the style reference. `homestead_barn.jpg` paints a tiny barn on the horizon that ends up behind Rosie's right ear on a 17 Pro and moves with every device's cover-crop | No exterior barn sprite yet. Painted-background barns cannot be the entrance: 46 backgrounds have none and cover-cropping moves it per device. |

Layout on the 17 Pro (402×874pt): tickets row + action card end at ≈312pt; Rosie's stage (300×300, bottom-anchored, `marginBottom −3% screen`) spans ≈443–710pt; tab bar starts ≈727pt. Free ground plane left of Rosie at foot height: x 0–≈85pt (SE: ≈71pt). Free band above Rosie: ≈312–443pt, but that band is the in-flow chip column (`BarnBountyChip`, Sounder chip) and the toast's landing zone.

---

## 2. Placement decision

### Chosen: bottom-left, on Rosie's ground plane, behind her

The barn structure stands on the same baseline as Rosie's feet, left of her, drawn **behind** her in z-order so she partially overlaps it. That overlap is the storybook read ("Rosie in front of her barn"), and it is the depth cue the scene currently lacks.

Why here and not elsewhere:

- **Layout.** It is the only region of the screen that is empty on every device and on all 47 backgrounds. The horizon band above Rosie is already the chip column and the toast lane; the action card is chrome, not scene.
- **Visibility.** The eye lands on Rosie; the barn sits inside that gaze, at the edge of her silhouette, not in a corner. It shows on every background (drop the `!stats.activeBackground` gate: the barn is the player's home, not scenery that a cosmetic replaces). A 2px ink outline and the hard sticker shadow carry it on dark backgrounds (cosmic drift, moonlit ballroom).
- **Interaction flow.** Tap barn → its own doors part → the scene closes into doors → doors open onto the room. The object you tap is the object that becomes the transition. Rosie stays where she is; she is bridged into the room by `useHabitatPigBridge` anyway, so the story is "you walk in, she is already there".
- **Precedent.** The ghost silhouette already lives here; this promotes it rather than moving the idea.

Geometry (all values are ART dimensions with their own names, not `SPACE` steps):

| Property | Value | Reason |
| --- | --- | --- |
| Sprite box | ≈118w × 108h pt | Roofline stays below Rosie's ear line (≈520pt on 17 Pro) so the roof is never the occluded part |
| Anchor | Absolute inside `styles.swipeContainer`, `left: PAGE_PAD`, `bottom` = Rosie's foot line (stage bottom + the sprite's baked ground margin) | Shares the pig's baseline on every device; moves with the −3% margin |
| z-order | Below `pigContent` | Rosie overlaps the right 35–45% of the sprite; the left leaf, roof peak and ≥60pt of body stay clear on SE, ≥73pt on 17 Pro (both > `TAP_MIN`) |
| Hit target | Whole sprite `Pressable` + `hitSlop: 12` | The pig's `Pressable` wins where they overlap, which is correct: a tap on Rosie is a tickle |
| Tilt | `TILT.card` | Sticker DNA, same as the tickets |

Fallbacks considered and rejected: bottom-right (mirror image; 72–97pt free, no precedent, and the truffle/updates controls already weight the right); horizon band (reads as scenery, collides with chips and toast, no horizon on abstract backgrounds); nudging the pig stage right to clear the barn (re-frames the hero on every background for a 30pt gain).

### What happens to the two existing entries

- **Ghost silhouette:** replaced by the structure (delete `barnSilhouette`, `SILHOUETTE_W/H`, the inline `Svg`).
- **Enter Barn button:** removed from the action row in the same build. The structure becomes the single exterior entry (audit A rows 7/43 close). The action row keeps the Truffle button; `HabitatEntry` stays for its `collection` variant. Discoverability is covered by (a) the structure's **beckon** state when the acquisition journal holds a New item, and (b) a one-time `Spotlight` on the barn for players who had the button before (persist the dismissal in AsyncStorage like the lucky-pig state). If `habitat_opened` analytics show entry via the structure collapsing versus the button's baseline, the button can return; keep that reversible by leaving `HabitatEntry compact` intact for one build.

---

## 3. The door-swing: what moves, states, triggers

### Principle

One motion language, two scales. The full-screen panels already **slide** apart (they do not rotate). The barn sprite's own door leaves slide the same way, at sprite scale, so the small doors and the big doors read as the same doors. The exterior gains the same `HabitatDoorTransition` the interior uses, run at a faster tempo, so entering is "the doors come up to meet you" and the cut to the interior route happens behind closed doors where it is invisible.

### Parts that move

| Part | Motion | Driver |
| --- | --- | --- |
| Barn body (sprite) | Sticker press: shadow-collapse offset on press-in (the `Sticker` press DNA), spring back with `MOTION_SPRING.tap`; no scale bump | `Animated` native driver |
| Left / right door leaves (sprite) | Slide apart ±`LEAF_TRAVEL` (≈14pt at sprite scale, i.e. the 105pt full-screen travel scaled), fade after 35% like the big panels | Same interpolation shape as `HabitatDoorTransition` |
| Doorway glow (sprite) | Warm lamp fill (`WHIMSY.sun` at `TINT` alpha) fades 0→1 behind the leaves as they part | Opacity, native driver |
| Exterior threshold panels | The existing two full-screen `barn_door.png` panels close **over** the exterior (direction `exit`) at the **threshold tempo** (`MOTION_DURATION.state`, 220ms), exterior content fades with progress | `HabitatDoorTransition` with a new `tempo` prop |
| Interior room panels | Existing: open at `celebration` tempo (450ms) | Unchanged |
| Rosie | Does not move. She is the constant across both scenes | — |
| Optional, decorative | Scene scale 1→1.03 toward the barn's anchor during the threshold close; beckon idle (leaf ajar + glow pulse) when the journal has New items | Gated by `policy.allowDecorativeMotion`; rest pose otherwise |

### States

**Barn structure** (`components/BarnStructure.tsx`, a pure component driven by props):

| State | Leaves | Glow | Notes |
| --- | --- | --- | --- |
| `closed` | together | off | Rest |
| `beckon` | ajar (≈30%) | pulsing | Journal has unacknowledged New items; static ajar + steady glow under Reduce Motion |
| `opening` | sliding apart | in | Immediately after tap |
| `open` | apart, faded | on | Held while the threshold closes and the route is pushed |
| `closing` | sliding together | out | On return focus |
| `disabled` | together | off | `habitat` flag off: locked look (mute the fill, keep the ink outline), `accessible` false |

**Exterior threshold** (state in `Barn.tsx`): `open` (rest, panels off-frame) · `closing` (entering) · `closed` (route pushed) · `opening` (returned). Defaults to `open` so cold starts, deep links, and shop hand-offs into the interior never leave the exterior shut.

### Trigger sequence

Enter, full motion (≈0.8s end to end):

1. `t0` — tap on the structure. `Haptics.selectionAsync()`. Structure → `opening`. Second taps ignored while threshold ≠ `open`.
2. `t0+120ms` — threshold → `closing` (220ms). Exterior fades with progress.
3. `t0+340ms` — `onClosed` → `router.push("/barn-interior")` with `animation:"none"`. Interior mounts with its panels closed: identical art, invisible cut. Structure → `open`.
4. `t0+340→790ms` — interior panels open (existing enter path, 450ms). `habitat_opened` fires with `entry: "structure"`.

Exit:

1. Interior **Home** tap → existing exit (450ms) → `onClosed` → `router.back()`.
2. Exterior regains focus (`useFocusEffect`): if threshold is `closed` → `opening` (220ms) and structure → `closing`. Both end at rest.

Reduce Motion: every step already resolves through `habitatDoorMotion(reduceMotion, …)`: zero travel, 150ms crossfades, leaves and glow snap to their rest pose. Total ≈0.3s.

Other entries into the interior (shop purchase hand-off `purchasedItemId`, friend visit, deep link) skip the exterior stage entirely and only run the interior's own opening. No exterior state is touched.

Gesture and hardware back on the interior: set `gestureEnabled: false` on that `Stack.Screen` so the doors always close through `setLeaving(true)`; verify the Android `BackHandler` routes to the same setter (not confirmed in this pass).

---

## 4. Build steps

1. **Art** — `assets/images/barn/exterior/` with three layers on one canvas so they align by construction: `barn_body.png` (walls, roof, window, dark doorway cut-out), `door_leaf_left.png`, `door_leaf_right.png`, at 3× (≈354×324px), plus an SVG source next to them following `assets/images/habitat/source/barn_door.svg`. Style lock: `glyphs/barn.png` (front-facing, 2px ink, `WHIMSY.barnRed`), flat-sticker law (front silhouette only). Register in a `BARN_EXTERIOR_ASSETS` const in `constants/habitat.ts` beside `HABITAT_CHROME_ASSETS`. Until art lands, the component ships with the current SVG polygon upgraded to body + two leaf `Rect`s so the motion can be built and reviewed first.
2. **`HabitatDoorTransition`** — add `tempo?: "room" | "threshold"` (default `room`), map to `MOTION_DURATION.celebration` / `.state`, thread it through `habitatDoorMotion(reduceMotion, direction, tempo)`. Extend `__tests__/HabitatDoorTransition.test.tsx` with the threshold pair (220ms / 105pt; reduced 150ms / 0).
3. **`components/BarnStructure.tsx`** — new. Props `{ state, disabled, onPress }`. `Pressable` with `accessibilityRole="button"`, label "Your Barn", hint "Opens the doors to your room and furnishings", `hitSlop: 12`, `testID="barn-structure"`. All motion through `useMotionPolicy`; durations from `MOTION_DURATION`; leaf travel and glow are named art constants at the top of the file. Export a pure `barnStructurePose(state, reduceMotion)` for unit tests, mirroring `habitatDoorMotion`.
4. **`components/Barn.tsx`** —
   - Delete the silhouette block, `barnSilhouette`, `SILHOUETTE_*`, and the `react-native-svg` imports if nothing else uses them.
   - Render `<BarnStructure>` as the first child of `swipeContainer` (before `pigContent`), absolute, `left: PAGE_PAD`, `bottom: BARN_GROUND_OFFSET`; drop the background gate.
   - Add `threshold` state + `enterBarn()` sequence + `useFocusEffect` reopen. Wrap the exterior return (`<PageBackground …>`) in `<HabitatDoorTransition tempo="threshold" direction={threshold === "closing" || threshold === "closed" ? "exit" : "enter"} onClosed={…push…}>`. The tab bar lives outside the tab screen, so the panels close over the scene only.
   - Remove `<HabitatEntry compact />` from `barnActionRow`; the row keeps `TruffleButton`.
   - Beckon: derive `hasNew` from the acquisition journal hook already used by the interior (`useHabitatJournal`) or the cheaper unread count if one is exposed; pass `state="beckon"` when true and idle.
   - One-time `Spotlight` on the structure for accounts that saw the button (AsyncStorage key, same pattern as the lucky-pig persistence).
5. **`app/barn-interior.tsx`** — `Stack.Screen` gains `gestureEnabled: false`; `habitat_opened` gains `entry` from a route param (`structure` | `button` | `shop` | `visit`), defaulting to `unknown`.
6. **Tests** — `BarnStructure.test.tsx` (pose table, disabled a11y, press ignored while transitioning); update `HabitatEntry.test.tsx` if the compact variant's Barn mount is asserted anywhere; a `Barn` integration test: tap structure → no push until `onClosed` → push once → focus → threshold reopens. Keep `npm run scorecard` at 0 and `npx eslint` green (taste rules are errors).
7. **Docs on merge** — `CONTEXT.md` Exterior/Interior lines (tap the structure; the button is retired), `docs/habitat.md` Phase 3 marked done, `SKILL.md` decision log ("the barn is the door, not a button" — Connect/Collect), `docs/design/taste-standard.md` decision log (one door language at two scales; threshold tempo = `state`, room tempo = `celebration`).
8. **Device QA** — SE-width, 17 Pro, Pro Max; the five darkest backgrounds; Reduce Motion on; VoiceOver reads structure → tickets → truffle in a sensible order; tap the structure ten times fast (single push); background the app mid-transition (threshold must settle, not hang closed).

Implementation can be handed to an Opus subagent per file group (art/constants, transition + tests, Barn wiring) once the placement decision is confirmed.

---

## 5. Open questions

1. Retire the **Enter Barn** button in the same build (recommended) or keep it one build behind analytics?
2. Beckon source: the acquisition journal's New count, or also unread guestbook entries?
3. The translucent gear control on the right edge of the Exterior in the current dev build: dev-only overlay, or shipped? It sits where a right-side barn would go, so it matters only if the placement flips.
