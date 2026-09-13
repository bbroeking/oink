# Rive loading and Rosie animation audit

Date: 2026-09-05. Scope: loading surfaces and replacement of Rosie's current sprite/transform animations. This is an implementation plan based on the current working tree; no production renderer was switched during this audit.

Implementation progress and evidence are recorded separately in
[the Rosie implementation record](2026-09-05-rosie-rive-implementation.md).

## Recommendation

Build one reusable Rosie Rive rig, begin with the shared loading treatment and standalone character moments, and then migrate the equipped pig in Barn, Visits, and Closet. Keep the established painted Rosie silhouette. All six identities should share the skeleton and animation graph, with identity supplied by the existing coat textures.

The first integration should cover `LoadingBeat`, the signed-in profile-loading screen, and the Contraptions loading state. These surfaces need no attached cosmetics. Onboarding and the Lucky Pig celebration can then reuse the same rig. The equipped pig needs a further attachment and gameplay-parity pass.

This can improve animation continuity and remove sprite-frame timers from migrated surfaces. It does not by itself reduce network latency or prove faster startup. Until unused sprite assets can actually leave the production graph, adding Rive may increase the bundle.

## Current readiness

- The app already uses `@rive-app/react-native` 0.4.19 and `@rive-app/react-webgl2` 4.30.1. The Mote Machine demonstrates the installed runtime and platform-specific adapters.
- `PigRenderer` and `PigStage` already provide a shared renderer seam. No new renderer abstraction is needed.
- `assets/rive/prototype/rig-manifest.json` and `docs/rive-pig-rigging.md` document a July editor prototype with idle, jump, wave, and three representative cosmetics. These are recorded authoring results, not a newly verified exported animation.
- **`assets/rive/pig.riv` does not exist.** The current `.riv` assets include the machine, adventure experiments, and a generic runtime sample; none is a production Rosie rig.
- The six prepared 370×383 coat textures passed the existing dimensions and identical-alpha-field verifier on this audit date. Their combined source size is 1,010,621 bytes. This verifies geometry preparation, not rendered fidelity or animation quality.
- Rosie's sprite directory contains 54 files totaling 6,232,040 bytes. This is a source-directory inventory, not a promised download reduction; some frames are needed by other scenes and fallbacks.
- The base/web `RivePig` implementation is still a raster fallback. It needs a real web adapter before this migration works consistently across platforms.
- Earlier documents refer to Expo 52 and the legacy Rive runtime. The current app is Expo 57 / React Native 0.86; retain the authoring lessons, but use the installed runtime when implementing.

## Where to use it

| Priority | Surface | Current treatment | Proposed Rive behavior | Implementation location |
| --- | --- | --- | --- | --- |
| First | Shared section/sheet loading | Kicker text, optional glyph, spinner | Small Rosie with a quiet sniff, blink, and breathing loop; retain the contextual label | `components/ui/EmptyState.tsx`, `LoadingBeat` |
| First | Signed-in profile loading | Static Rosie plus spinner; retry on failure | Same recognizable pose, subtle waiting motion while the request runs; stop waiting motion on failure | `app/(tabs)/_layout.tsx` |
| First | Contraptions shelf loading | Bare spinner | Reuse the shared loading treatment with a shelf-specific label | `app/contraptions.tsx` |
| Next | Onboarding | Three mounted sprite loops | Wave on the active welcome page, calm idle on the feeding page, friendly wave for the herd page; inactive pages hold still | `components/Onboarding.tsx` |
| Next | Lucky Pig celebration | Happy sprite loop alongside other reveal motion | Happy reaction or short hop, followed by a happy resting pose | `components/LuckyPigModal.tsx` |
| Later | Barn tickles and resting mood | Four-frame sprite loops plus external squish/rotation and timers | Continuous mood animation, interruptible reactions, authored squish; preserve immediate haptics and game logic | `components/SwipeElement.tsx`, `components/ui/PigStage.tsx` |
| Later | Visits and Closet | Shared equipped sprite stage | Same rig, coat, mood, and reactions as Barn; Visit-only tired state | `components/BarnVisitModal.tsx`, `components/ClosetView.tsx`, `PigStage` |
| Separate experiment | Expedition Rosie | Static mood frames plus a charge-dependent wiggle | Walk, curious/surprised, happy, tired, and charged poses | `components/expedition/RosiePose.tsx` — development-only expedition today |

There are **24 production `LoadingBeat` placements across 22 files**, plus one placement in the development expedition route. The shared treatment reaches Shop, Season, Inbox, Sounder, Barn Visits, player/invite sheets, achievements, race standings/history, the Dig collection and stats, the scrapbook, trophy/ledger sheets, and camera initialization. Use a compact presentation for small cards and sheets; do not make every occurrence a large character scene.

The authentication callback (`app/auth-callback.tsx`) is another spinner, but it should remain a fast handoff. Add a compact waiting treatment only if observed waits justify it; it should never wait for a character asset before navigating.

Keep existing list-row skeletons in Leaderboard, standard pull-to-refresh, and tiny button/purchase spinners. A character canvas inside each row or button would add visual noise and runtime work without improving the action. The native OS splash remains a static launch asset; Rosie can animate once the app's rendering runtime is ready.

## Rosie state inventory

The current interface has nine animation values representing eight frame sets. The duration column records the current sprite cycle so behavior changes are explicit during implementation.

| Existing value | Current behavior | Rive treatment |
| --- | --- | --- |
| `idle` | 1,600 ms loop; content resting mood | Gentle body breathing, blink, restrained ear movement |
| `happy` | 1,000 ms loop; both a resting mood and a tickle reaction | A persistent happy rest plus a distinct short happy reaction that returns to the selected mood |
| `sad` | 1,333 ms loop; happiness-derived mood | Quiet posture and ear droop; do not use this to represent an empty Tickle bank or a network error |
| `tired` | 2,000 ms loop; Visit exhaustion | Slower breath and sleepy settling; preserve the Visit-only gameplay meaning |
| `walk` | 1,000 ms loop | Shared leg cycle; stationary waiting variant only where appropriate |
| `jump` | 667 ms one-shot | Anticipation, lift, and settle with a reliable completion signal |
| `bounce` | 1,333 ms loop using jump frames | Explicit repeating bounce behavior using the shared motion; a single jump trigger is insufficient |
| `surprise` | 667 ms one-shot | Quick perk and settle, then return to the latest resting mood |
| `wave` | 1,000 ms loop | Sustained wave when requested by a surface; one cycle when used as a reaction |

Treat **resting mood, looping activity, and a requested reaction** separately inside the rig. A reaction must be able to return to happy, sad, or tired instead of always returning to idle. A repeated tap must retrigger even if it selects the same reaction as the preceding tap; use an explicit event/sequence identity rather than relying only on a changed animation string.

Keep the public renderer interface small. Callers should supply semantic state and a reaction request, not know Rive input names, input-write ordering, animation durations, or fallback handling. Preserve the existing gameplay ownership in Barn/Visits: Rive presents a reaction and never awards Tickles, changes happiness, or decides rewards.

## Code issues to resolve as part of the replacement

1. **Loop/trigger mismatch.** `rivePigContract.ts` maps happy, walk, wave, and bounce to triggers. The prototype has only idle/jump/wave, with one-shot returns to idle. That does not match current persistent happy mood, walking, waving, or bouncing behavior.
2. **Repeated reactions.** `SwipeElement` sets an animation string after each tap. Selecting the same string can leave a renderer effect unchanged. The Rive interface needs a retrigger event, including interruption of an in-progress reaction.
3. **Reduced-motion fallback still animates.** `RivePig.native.tsx` selects `SpritePig` for Reduce Motion but supplies no frozen frame. `PigRenderer` also falls back without translating `reduceMotion` to a frozen frame. `SpritePig` has no reduced-motion handling of its own, so this branch can still start its interval. Use a meaningful static pose and preserve necessary completion behavior without animation.
4. **Readiness is coupled to animation changes.** The native readiness effect depends on the effective animation and increments the playback revision. Separate native-instance readiness from reaction requests so a state change cannot accidentally replay contract initialization or triggers.
5. **Background and off-page work.** `SpritePig` starts a frame interval without checking AppState or visibility. Onboarding mounts all three pages. The replacement must pause/hold when backgrounded or hidden, including off-page onboarding characters.
6. **Cosmetic attachment.** The prototype supports party hat, pixel glasses, and garden trowel only. Bows, masks, neck items, other hats, tint variants, and pre-baked looks need an explicit strategy. Continue falling back for unsupported loadouts until the matching Rive attachment exists. Do not attach raster images using a four-frame anchor table over continuously moving Rive bones.
7. **Old migration advice.** The comment in `SwipeElement` still recommends replacing its renderer directly and rebuilding for the legacy library. Implement through `PigRenderer`/`PigStage`, and update that comment when the actual migration lands.

## Loading and performance contract

- Bundle the Rosie runtime asset locally and keep its composition small. Do not load the 2.7 MB slot machine merely to show a loader.
- Show useful text immediately. The data becoming ready ends the loading UI immediately, regardless of animation position. No minimum display duration or forced completion ceremony.
- Consider mounting the Rive canvas only after a short wait (approximately 200 ms) so fast cache hits never initialize it. Reserve its layout space from the beginning to prevent jumping content. Validate the threshold against measured startup and common requests.
- Share file/asset decoding where the installed runtime supports it. Give separate visible instances their own state so one reaction cannot control another.
- Keep one prominent character animation per active surface. Pause backgrounded/hidden instances; unmount loaders as soon as their requests end.
- Use the app's `useMotionPolicy` and a stable Rosie pose for Reduce Motion. Keep loading labels accessible, mark the loading region busy, and avoid announcing each animation cycle.
- Failed requests must expose their existing retry or error path. A looping character must never hide an error or imply that work is still progressing.
- Measure cold/warm first usable screen, loader mount cost, UI/JS frame behavior, memory after repeated navigation, and exported asset bytes before claiming a performance win.

## Implementation order and acceptance

1. Recover the existing editable pig source and export it; verify the local `.riv` against the runtime. Preserve its source provenance. The July notes' export restriction is historical and was not re-established as a current account limitation in this audit.
2. Complete the waiting/idle, happy, sad, tired, walk, jump, surprise, and wave behavior on the approved shared mesh. Support repeating activities and return-to-current-mood explicitly.
3. Build a development acceptance screen with state selection, repeated same-reaction taps, mood changes during a reaction, reduced motion, simulated asset failure, and visible load/ready/error status. Test actual native and web Rive playback, not just mocked bindings.
4. Integrate loading and standalone Rosie through the existing renderer seam. Verify fast success, delayed success, failure/retry, foreground/background, and inactive onboarding pages.
5. Add and validate equipped cosmetics, then migrate Barn, Visit, and Closet. Keep Shop product previews frozen and preserve all six pig identities. Verify equipment at jump/wave extremes and when a player interrupts a reaction.
6. Remove duplicate animation timers and obsolete assets only after the replacement covers their actual consumers. Run the quality loop while changing layouts, the fast quality check before handoff, platform export checks, and the relevant behavior tests. Enqueue a native/runtime release follow-up when implementation is authored. Distributable builds still follow the release checklist.

The first visible deliverable should be a reviewable loading/Rosie state gallery and the shared loader integration. The final Barn cutover requires the exported rig, actual playback, cosmetic parity, and physical-device acceptance; flipping the current rollout flag alone cannot provide those.

## Checks run for this audit

- `npm run verify:rive-pig:assets`: passed all six textures, dimensions, and exact alpha geometry.
- `npm run verify:rive-pig`: failed as expected because `assets/rive/pig.riv` is missing. No production Rosie animation was claimed as exported or validated.
- Static inventory of loading call sites, animation specifications, renderer selection, native/web adapters, motion policy, and relevant current UI consumers.

No production UI changes, animation asset mutations, database pushes, or builds were performed during this audit.
