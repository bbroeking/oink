# Pasteable implementation-loop prompt — full-page Mote Machine

Paste everything inside the block below into a Codex/ChatGPT task with access
to `/Users/bbroeking/projects/oink`, the Rive MCP, image generation/editing, and
an iOS simulator.

```text
/goal **Goal**
Implement the founder-confirmed full-page interactive Mote Machine described in
`/Users/bbroeking/projects/oink/docs/specs/22-full-page-interactive-mote-machine.md`.
Work in a persistent inspect → implement → verify → visually inspect loop until
the definition of done is genuinely satisfied. Do not stop after planning,
scaffolding, producing assets, editing only the React Native host, or getting a
single successful animation.

The intended outcome is one coherent native screen whose approved generated art
is decomposed into layered Rive components. The visible lever and primary action
are directly interactive. A tap asks React Native to request one server-
authoritative play; the server atomically spends exactly one Mote and confirms a
Tickles reward; only then does React Native pass the confirmed values to Rive and
trigger the reveal. Rive never selects, grants, rerolls, or persists rewards.

## Read first

Before changing anything, the main agent must completely read:

1. `/Users/bbroeking/projects/oink/AGENTS.md`
2. `/Users/bbroeking/projects/oink/CONTEXT.md`
3. `/Users/bbroeking/projects/oink/docs/specs/22-full-page-interactive-mote-machine.md`
4. `/Users/bbroeking/projects/oink/docs/handoffs/rive-mcp-mote-machine-goal.md`
5. `/Users/bbroeking/projects/oink/docs/rive-mote-machine-authoring.md`
6. `/Users/bbroeking/projects/oink/components/mote-machine/moteMachineRiveContract.ts`
7. `/Users/bbroeking/projects/oink/components/mote-machine/MoteMachineRive.native.tsx`
8. `/Users/bbroeking/projects/oink/app/mote-machine.tsx`
9. `/Users/bbroeking/projects/oink/utils/moteMachine.ts`
10. `/Users/bbroeking/projects/oink/scripts/rive/verify-mote-machine-rive.mjs`

Use the repository's applicable interface-design skill if it is available, but
do not reopen product discovery: Spec 22 is already founder-confirmed. Follow
all skill and repository instructions, especially the native layout, motion,
accessibility, quality-loop, database, release, and dirty-worktree rules.

## Known baseline

- The working tree is broad and dirty on `main`. Existing changes belong to the
  user. Preserve them, never reset or clean them, and do not stage or commit
  unrelated work.
- The Mote Machine database migration is already live. Do not author or push a
  database migration for this visual/runtime redesign.
- The live server already owns the Mote wallet, idempotent request receipt,
  one-Mote debit, reward selection, and Tickles grant.
- The current runtime is functional but visually wrong: a simplified SVG-based
  `390 × 844` Rive artboard is embedded inside a separate React Native page.
- The current Rive document has `Idle`, `Machine Spin`, `Machine Settle`,
  `MoteMachine`, `MoteMachineViewModel`, and the `Default` instance.
- The current `Spin request` listener observes the app's `spin` property and has
  no pointer condition or action. The visible Rive machine is not interactive.
- The current canonical `.riv` SHA-256 is
  `8cd5b7205aeae960bf0e9a81cf9ef0005e96bc32aff6c42818c6d3fcddba20fc`.
  It is the pre-redesign baseline, not the final expected hash.
- Byte-identical runtime copies currently live at:
  - `assets/rive/mote-machine.riv`
  - `ios/ttp/mote_machine.riv`
  - `android/app/src/main/res/raw/mote_machine.riv`
- The active editor source is
  `https://editor.rive.app/file/untitled/2506441`, artboard `MOTE MACHINE`.
- Current MCP tooling can inspect and author the Rive source but does not expose
  final `.riv` runtime export. Verify this rather than assuming it changed.

## Visual source of truth

These generated concepts define the shipping appearance:

- `assets/concepts/mote-machine/mote-machine-ready-reveal-v1.png`
- `assets/concepts/mote-machine/mote-machine-spin-keyframes-v1.png`
- `assets/concepts/mote-machine/animation-frames/frame-01.png` through
  `frame-09.png` as pose reference only

The simplified
`assets/concepts/mote-machine/mote-machine-rive-source.svg` is only a structural
guide. Do not let its flat cabinet, symbols, room, or lighting remain the final
visual direction.

Build the generated look as a layered hybrid Rive scene:

- one full-bleed machine-room background;
- one transparent cabinet shell with clear reel and reward openings;
- three independently clipped/translated static reel strips;
- separate lever arm and knob;
- separate Mote and reward symbols;
- editable Rive masks, hit areas, glows, lighting accents, and reward burst;
- live Rive text for title, Mote balance, action, status, and confirmed result.

Full-screen concept frames must never be mounted or sequenced at runtime. Static
generated component images are allowed; Rive must own their composition,
clipping, transforms, state, and motion.

## Persistent work loop

Maintain a current plan with at most one in-progress step. Repeat this loop:

1. Inspect the current code, Rive source, generated assets, simulator state, and
   relevant tests before editing.
2. Select the smallest end-to-end missing slice that moves the real production
   screen toward Spec 22.
3. Implement that slice in the actual source—not only in a prototype.
4. Read the edited Rive structures back through MCP. Never trust a successful
   write without querying the hierarchy, properties, bindings, listeners,
   transitions, and keyframes it should have changed.
5. Run the narrowest relevant automated test and the unchanged Rive verifier
   whenever a runtime export exists.
6. Bring the production `/mote-machine` route up in the iOS simulator and inspect
   a screenshot or recording at native resolution whenever the slice is
   visible there.
7. Compare visual results against the generated ready/reveal concept, not just
   against the previous simplified machine.
8. Record concrete evidence and remaining gaps in the existing Mote handoff or a
   dedicated implementation log.
9. Continue immediately to the next missing slice. Do not yield merely because
   one test, one reward, or one viewport works.

Send concise commentary updates at meaningful milestones and at least once per
minute during long-running work.

## Milestone A — registered generated-art layer pack

Create `assets/concepts/mote-machine/runtime-layers/` and a manifest recording
the shared logical `390 × 844` canvas plus each asset's filename, source,
dimensions, x/y registration, pivot, intended Rive parent, alpha requirement,
and runtime role.

Derive or regenerate clean isolated layers from the approved concept. Preserve
the exact camera, carved pig cabinet, warm wood/gold materials, nighttime room,
purple Mote glow, symbol language, and lighting. Do not bake changing text,
balance values, reward amounts, button labels, back controls, reel blur, or a
particular reward into static layers.

Use image editing/generation where the composite does not contain enough clean
pixels behind an occluded part. Hold the approved concept constant; do not
redesign the room or cabinet while separating it.

Prefer one background and one cabinet-scale image over overlapping full-screen
rasters. Keep individual textures at or below 2048 px unless profiling proves a
larger texture necessary. Target a final `.riv` no larger than 4 MB; pause for an
explicit quality/performance decision above 6 MB.

Visually composite the isolated layers before Rive import and compare them to
the concept. Fix halos, damaged edges, missing material, inconsistent light,
and registration drift before moving on.

## Milestone B — full-page interactive Rive source

Before editing the live source, save a new `.rev` backup and retain the current
artboard as a non-exported reference.

Use the Rive MCP to:

- upload and instantiate the optimized layer assets;
- create one responsive Rive Layout composition for `MOTE MACHINE`;
- prepare it for the React Native host's `Fit.Layout` mode;
- remove the duplicate Rive back control;
- keep title, balance, cabinet, reward window, prize shelf, and primary action in
  one coherent full-page hierarchy;
- create vector reel-window masks and three independently moving reel strips;
- register the lever pivots and Mote/reward component origins;
- create `Play Hit Area` and `Lever Hit Area`, each at least 44 × 44 pt;
- add Pointer Down/Up/Exit feedback and a Click action that fires a new
  `requestPlay` View Model trigger;
- keep `spin` as a separate app-to-Rive trigger that begins only after server
  confirmation;
- preserve `Machine Spin` as the full 2.2-second baseline and `Machine Settle`
  as the 0.2-second Reduced Motion path;
- preserve independent reel braking, staggered stops, overshoot, cabinet wiggle,
  and persistent result display;
- add visual states for Ready, Empty, Confirming, Revealing, Settled, Uncertain,
  and Safe Error.

Extend `MoteMachineViewModel` and `Default` with the exact Spec 22 v2 contract:

- `requestPlay` trigger, Rive → app
- `spin` trigger, app → Rive
- `tickles` number
- `motes` number
- `reduceMotion` boolean
- `busy` boolean
- `canPlay` boolean
- `hasError` boolean
- `motesLabel` string
- `ticklesLabel` string
- `actionLabel` string
- `statusLabel` string

Use app-authored strings for changing copy. Rive may contain editor-private
pressed/hover properties, clearly named and excluded from the app contract.

Do not use random values, reward-selection conditions, Snout Coins, odds, paid
play language, or `frame-*` image instances.

## Milestone C — native full-page integration

Update the real production integration:

- `components/mote-machine/moteMachineRiveContract.ts`
- `components/mote-machine/MoteMachineRive.native.tsx`
- `components/mote-machine/MoteMachineRive.web.tsx` only as needed for a clear
  fallback
- `app/mote-machine.tsx`
- focused Mote Machine tests

The Rive binding must observe `requestPlay` with
`useRiveTrigger(..., { onTrigger })` and call a native `onRequestPlay` callback.
Retain the synchronous in-flight ref before all async work. A lever tap and an
action tap in the same frame must still produce one request ID and at most one
server debit.

Before firing `spin`, native must write the confirmed numeric reward, formatted
reward label, remaining Motes, action/status labels, and boolean state. Rive
must not reveal or move reels while the request is merely pending.

Replace the current cream `ScrollView`/card host with the full-page deep-plum
shell. Rive fills the usable safe-area surface with `Fit.Layout`. Keep one real
native 44 × 44 pt back control and preserve the iOS edge-swipe gesture. Remove
the visible duplicate native title, Mote balance, result card, prize shelf, and
CTA.

Keep native accessibility semantics and announcements even though Rive owns the
visual controls. The screen must remain operable with VoiceOver and must announce
exactly one result per receipt.

## Milestone D — export checkpoint

Do not claim the app is updated while it still loads the old `.riv`.

If the MCP still cannot export runtime `.riv` files, finish and read back all
editor work, then stop only at this unavoidable checkpoint and ask the user for
one precise action:

“In the currently open Rive editor file, export the `MOTE MACHINE` runtime as
`.riv` and save/replace it at
`/Users/bbroeking/projects/oink/assets/rive/mote-machine.riv`, then tell me when
it is done.”

After the user confirms, immediately resume the loop:

- verify the `RIVE` header and changed SHA-256;
- run the strengthened verifier without weakening it;
- copy the exact accepted bytes to the iOS and Android resource paths;
- prove all three hashes are identical;
- rebuild/relaunch the development client only if native resource bundling
  requires it.

## Milestone E — hardening and acceptance

Strengthen `scripts/rive/verify-mote-machine-rive.mjs` to require the v2 contract
and approved component/asset names while continuing to reject `frame-*` and
Snout references.

Run `pnpm run quality:loop` during player-facing layout/runtime changes and
`pnpm run quality:check` before handoff. Before treating the feature as release-
ready, run `pnpm run quality:check:full`. These checks do not authorize a
database push, distributable build, upload, or production mutation.

Use the real production route and real exported `.riv` in the iOS simulator.
Acceptance requires:

- smallest supported portrait phone and iPhone 16 Pro layouts;
- visual match to the approved generated room, carved cabinet, materials,
  lighting, symbols, prize shelf, and action hierarchy;
- no embedded rectangle, duplicate controls, crop, stretched raster, mask seam,
  halo, clipped glow, or soft low-resolution texture;
- lever and primary action both respond directly;
- Ready and zero-Mote Empty states;
- rapid alternating taps produce one receipt and one debit;
- visible `+3`, `+5`, `+10`, and `+25` confirmed rewards;
- at least three consecutive plays without remounting;
- full and Reduced Motion paths;
- response timeout after server commit, using the same durable request ID;
- background/resume during confirmation and reveal;
- safe native fallback before and after server confirmation;
- VoiceOver focus, activation, busy state, and one result announcement.

If the signed-in test account has no Motes, do not mutate production data or
backfill it without explicit user approval. Exercise all safe client/Rive paths
with a development-only deterministic seam, then clearly identify any real-
server acceptance that still needs a spendable Mote.

## Safety and release boundaries

- Do not run `npm run db:push` or `supabase db push`.
- Do not alter production balances, receipts, or profiles without explicit user
  approval for the exact mutation.
- Do not start an EAS/distributable/TestFlight build; this task uses the local
  development simulator unless the user separately invokes the release lane.
- Do not upload through Transporter or submit to a store.
- Do not stage, commit, or push the broad dirty worktree. If the user later asks
  for Git publication, isolate and review scope first.
- Do not delete or overwrite the current Rive source without a recoverable
  backup.
- Never weaken tests or the verifier to accept a bad artifact.

## Terminal definition of done

Continue looping until every item in Spec 22's Definition of Done is evidenced.
Completion means the generated visual design is recognizably preserved as
layered Rive content, the visible Rive controls are interactive, the full page
is integrated, the server boundary is intact, all rewards and repeated plays
work, Reduced Motion works, the strengthened verifier and quality gates pass,
and the real exported machine is running in the simulator.

On final completion, report:

- files and Rive structures changed;
- generated layer-pack contents and manifest;
- old and new `.riv` sizes and SHA-256 hashes;
- exact MCP readback evidence;
- tests and quality gates run;
- simulator devices, scenarios, and screenshots/recordings;
- any unchecked manual/device/release gates;
- confirmation that no database push, distributable build, store upload, or
  unrelated Git publication occurred.
```
