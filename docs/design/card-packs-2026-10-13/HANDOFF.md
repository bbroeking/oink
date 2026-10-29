# Collectible cards and Hedge Run prototype handoff

Status: development-only vertical slice. It is not a production reward system, multiplayer service, or release candidate.

## Current: three-card packs, framed cards, and Pig Legend decks

The user’s latest direction supersedes the five-card/default-full-art descriptions below. New packets now contain **three** fixed outcomes: Firefly Swarm, Mud Shovel, and foil Puddle Duckling. Previously committed five-card receipts stay intact. Standard framed card faces now show identity, rank or Cheer, original art, applicable stats, Play rules, Training or favored styles, and collector information. Full-art treatments are deferred.

`CollectibleCard.tsx` is the shared face for opening, album, receipt, and deck planning. React Native renders the complete card throughout transport and settling. Rive owns the transparent waxed packet and its tear/wrapper performance. A single foil gleam is clipped to the art window; names and rules remain still. The optional old flat-art “Step inside” button has been removed from the current UI; its authored assets remain available for future work.

The new **Legends & decks** page selects any of the six existing pigs and builds a persistent constructed deck plan under the printed rules: 24 matching-style cards, at most two copies of each identity, and one copy of each Legendary identity. Unowned copies are marked missing. This is a deck planner; Hedge Run remains its separate borrowed-kit game.

Current verification and exact asset hashes are recorded in [`three-card-refinement.md`](./three-card-refinement.md). The sections below retain earlier milestone evidence, including older Rive hashes and five-card tests; they are historical, not acceptance of the current revision.

## Historical: Pocket-reference motion update

The current opening follows the physical sequence from the [official Pokémon TCG Pocket preview](https://www.youtube.com/watch?v=fE_03Hla2vU) around 0:15–0:22. The reference analysis and deliberate timing differences are in `pocket-opening-reference.md`. The same private Claude Design canvas was updated before implementation; its fullscreen stage and motion notes guided the changes.

The ceremony now occupies its own full-height screen. A retained-progress horizontal tear or accessible Open button leads to a 700 ms strip/wrapper exit and an automatic first card. A settled card tracks a horizontal swipe, springs back on cancellation, or dismisses in 210 ms; only after dismissal is the next artwork bound. Rive settles that card in 350 ms. Five progress marks and explicit fifth-card receipt navigation preserve the fixed order. Inspection uses a scrollable readable sleeve. Reduced-motion/static paths reveal and settle immediately. The shared motion policy is respected.

The current runtime is 365,921 bytes, SHA-256 `653425e8f37d3fa0832e18fcf1b0ff39c7772cb4799a32b299006b14ae601ddd`; the matching .rev SHA is `90ea44a10765a92b24a715130203a064ac5e86bc5f5f0bc512c67d1facb57d88`. It supersedes the prior runtime documented below. A cold-load flash found during visual QA was repaired by hiding the dynamic image in its base pose and explicitly revealing it in reveal/inspect timelines. The exact WASM contract verifier passes. Output triggers remain addressable but silent; the host uses a guarded 450 ms fallback and does not infer ownership from animation.

The final browser check confirms full card-frame containment for both the 1024×1536 portrait source and the 332×414 item source, using non-destructive runtime derivatives. See `verification/pocket-opening-final.jpg`. A 110 px tear moved from 6% to 54% and survived reload; swipe, rapid double-click, optional inspection, fifth-card resume and complete receipt passed. At 320×568, controls remained within the viewport with no horizontal overflow.

43 focused tests pass across the three card-domain suites, new playback lifecycle suite, and shared motion-policy suite. They include auto-first, reduced-motion completion, rapid input, background/resume, stale callbacks, and fifth-card retention. The layout/security quality gate still reports the two existing baseline failures below. The continuous watcher still fails with EMFILE, so the one-shot check was run.

New iOS gesture acceptance is pending. The installed simulator was available, but the computer-use controller could not select its iPhone 17 Pro window (repeated invalid menu-item errors; screenshots unavailable). Prior native smoke below applies only to the older export and must not be treated as validation of this update.

## Open the prototype

Browser preview:

```bash
node scripts/prototypes/card-packs/build.mjs
python3 -m http.server 4318 --bind 127.0.0.1 --directory artifacts/card-packs-preview
```

Then open `http://127.0.0.1:4318`. The browser build is a standalone React Native Web preview with local browser persistence.

Native development route:

```bash
NODE_OPTIONS="--max-old-space-size=16384 --dns-result-order=ipv4first" npx expo start --dev-client --localhost --port 8084
```

Open `/card-packs-prototype` in the installed development client. The route is guarded by `__DEV__` and redirects to Shop in production builds. No distributable build was created.

## Source references

- Claude Design source: [Tickle the Pig Card Packs · Pack Opening Prototype](https://claude.ai/design/p/aec2145f-9fe2-4416-ab82-50c0100f537d?file=Pack+Opening+Prototype.dc.html). This is the visual and interaction direction, not executable reward authority.
- Rive cloud source: [Card Packs, file 2651084](https://editor.rive.app/file/card-packs/2651084) in **Tickle the Pig → Shared Project**. The checked-in editable backup is `assets/rive/card-packs/source/card-pack-reveal.rev`; the runtime export and contract are beside it.
- Product design: `docs/design/2026-10-13-animated-card-experience.md` and `docs/design/2026-10-13-card-quick-play-rules.md`.
- Research: `docs/research/2026-10-13-card-game-references.md`, `docs/research/2026-10-13-card-pack-cadence-model.md`, `docs/research/2026-10-13-card-reward-integration-audit.md`, and `docs/research/2026-10-13-card-rive-feasibility.md`.
- Proposed backend boundary: `docs/design/card-packs-2026-10-13/reward-contract.md`. It is a specification only; no schema or RPC was added.

## What is implemented locally

- A typed catalog generated from `docs/marketing/trading-cards/base-set-84/cards.mjs`. All 88 stable slug IDs, collection numbers, original illustration paths, rarity, and printed tabletop rules remain unchanged. Rarity and finish do not alter Hedge Run power.
- Static React Native art requires for all 88 identities, a fixed five-card opening fixture, album/detail views, standard/foil/living presentation labels, retained duplicate counts, banked repeat progress, and an idempotent local foil claim.
- A persistent opening reducer with monotonic partial tear, tap-open, rapid-tap locking, five reveals in server/fixture order, voluntary fifth-card inspection, explicit receipt transition, skip, replay, interruption recovery, and validated corrupt-state fallback. Presentation callbacks never grant ownership.
- A clearly labelled local prototype authority. The fixed welcome grant supplies all six Legends and the borrowed 12-card Hedge Run kit before the tutorial packet. Tenth-opening, all-repeat, Dig, failure-before-commit, and response-loss-after-commit controls are fixed review fixtures, not random or server-backed rewards.
- Deterministic Hedge Run rules: the same seeded 12-card order and validated six-event trail, Play or Train decisions, six-round replay, Danger-before-Discovery scoring, resumable state, concealed friend result until both local runs finish, and Practice. Matches do not change currencies, inventory, rankings, Happiness, Streak, or any production state.
- Native and web Rive adapters with a static fallback. The host owns readable controls, persistence, gesture policy, audio/haptics, accessibility, and reward truth. Rive owns only the visual performance.
- One-shot sensory hooks for pickup, tear, reveal, receipt, and inspection. Sound defaults off, honors the global mute and native silent/background policy, and stops on blur/unmount. The current cues reuse existing material effects as temporary placeholders. There is no authored pig snort and no claim that one exists.

The three living showcases are lightweight flat illustration-layer studies for Firefly Swarm, Puddle Duckling, and Moon Firefly. They use transforms, opacity, masks, glow, ripple, and pivot motion over preserved art. They are not production character rigs or independently animated replacements for the original illustrations.

## Rive artifacts and limits

The integration contract is `assets/rive/card-packs/contract.json`: `CardPackReveal`, `CardPackRevealMachine`, `CardPackRevealViewModel`, and default instance `Default`. Inputs cover tear progress, reveal index, tilt, dynamic card art, finish, reduced motion, and open/reveal/inspect/reset triggers. Visual output triggers are optional checkpoints; app timeouts and static UI remain usable if they do not arrive.

The current runtime, editable backup, provenance, artwork package, and cue sheet are under `assets/rive/card-packs/`. The older RML/CLI build under this design folder is retained only as a superseded motion reference. The cloud editor source and checked-in export have been inspected. The frozen runtime is 364,139 bytes, SHA-256 `73d185aa6e430dfda1f394db435f522e47c2837e6c5c965edbc4218edc5d4d70`. Its matching editable backup SHA-256 is `20645f1f2fb169d55e87c01f59a9dea896c3667bd33bfc1b8b914a1bb985427e`.

## Verification completed

- 17 focused domain tests pass. They cover the 88-card identity boundary, fixed receipt order, retry/replay, duplicate retention, foil double-spend prevention, malformed persistence, partial tear, rapid taps, interruption recovery, seeded trails, illegal choices, Danger-before-Discovery, replay restoration, concealed friend results, and mismatched-run rejection.
- Full TypeScript checking passes at the time of this handoff. Scoped lint for the complete card prototype, catalog/domain, and runtime verifier passes.
- The standalone browser bundle builds and emits the Rive, illustration, font, and sound assets.
- The frozen export was loaded in the installed iPhone 17 Pro iOS 26.4 development client. Native smoke verified cold resume, dynamic artwork, sequential reveals through Moon Firefly at 5/5, voluntary foil inspection, complete five-card receipt, and a fresh sealed packet with no premature artwork. See `verification/native-ios-foil.png`. This is simulator smoke, not device performance acceptance.
- Exact-binary browser/WASM inspection established the expected artboard, bound view model, typed properties, dynamic image binding, and state-machine advance. Fresh runtime cases also verify reveal and inspect at index 2 without an open trigger. Output properties bind but do not emit through the browser/native hooks: the MCP trigger-keyframe surface did not persist usable trigger keys. State entry is not completion. The host uses a guarded 900 ms presentation fallback for the authored 800 ms reveal; it never grants rewards.

The broader quality gate is not green. The recorded failures are pre-existing and outside this slice: the clamp check reports `138 > 91`, and linked database lint reports the `my_drives` revocation migration issue. These failures must not be presented as card-prototype acceptance.

## Still required

- Extend iOS acceptance on a physical device: partial-gesture/background resume, VoiceOver navigation, sound off/on, silent switch, tactile haptics, memory, and frame pacing. Automated native drag could not be completed because the simulator control returned a window-position error; partial tear is covered by reducer tests, not a claimed native gesture pass.
- Test Android when an emulator or device with `adb` is available. Android native acceptance has not run because no `adb` target was available.
- Verify native/browser output callback emission. Until then, callbacks remain optional visual signals and host timeouts must continue to advance presentation safely.
- Run human Hedge Run sessions and measure the complete active experience. The intended 2–3 minute duration and decision quality have not been playtested with people.
- Implement and independently review the atomic server contract before any real grant, opening, inventory, duplicate credit, foil claim, or named-friend challenge exists. This requires migrations, RLS, concurrency/failure tests, and explicit database-push authorization.
- Resolve or formally disposition the broader quality-gate failures before release work.

There is no database migration, database push, network invitation, real card grant, production economy mutation, deployment, public share, release upload, TestFlight/App Store build, or other distributable build in this work. Requested artwork and source updates were saved privately to Claude Design and Rive. `collectible-card-prototype` is queued in `docs/release-followups.json` for the first eventual build that contains the feature.

## Final QA evidence

- Browser at 393 px: five ordered reveals, voluntary foil inspection, no sixth reveal, and complete receipt. Reload retained the current card and rendered it through the frozen Rive export without restarting the packet.
- Browser at 320 px: no document horizontal overflow; receipt, album, printed-rule sleeve, cosmetic choice and Practice remained usable. See `verification/receipt-320.png` and `verification/practice-complete-320.png`.
- Failure fixtures: before-commit failure left the packet unopened; after-commit response loss resumed the same five-card receipt. Skipping after recovery showed five repeats and credited five progress once.
- Repeat/foil path: 11 banked credits became 1 after claiming Mud Shovel foil; all four copies remained. Album showed the foil and the owned count did not change.
- Reduced motion unmounted Rive and showed static art. The receipt/unmount crash found during QA was fixed by letting `useRive` own WASM teardown.
- Practice: played and trained through six rounds, reloaded at round 3 with the same hand/trail/totals, finished at 2 Discoveries / 7 Cheer. UI recorded 27 active seconds in this automated run; this is not evidence for the human 2–3 minute target.
- Native: frozen SHA above loaded in the installed dev client; cold resume, art swaps, foil inspection, fifth-card stop, receipt and sealed packet checked. Android remains untested because no `adb` target was available.
- Exact-runtime evidence: `verification/exact-runtime.json`, including cold resume/inspection cases. All 15 typed properties bind; completion triggers remain silent and explicitly unfinished.
- Quality watcher could not run continuously because of an `EMFILE` watcher limit. One-shot `npm run quality:check` was run and still fails only the two recorded baseline contracts. No claim of a green release gate.

The final prototype intentionally leaves the player on a reviewable local demo. Complete real backend integration, emitted Rive checkpoints, physical-device acceptance, and human playtesting before production enablement.
