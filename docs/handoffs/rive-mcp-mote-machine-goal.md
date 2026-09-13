# Rive MCP + Mote Machine: Goal and Handoff

## Summary to pass forward

We are building the **Mote Machine**, an interactive Rive-powered reward
presentation for Tickle the Pig. A player spends exactly **one Mote**, the
app/server determines the reward, and the machine visually reveals the
already-selected amount of **bonus Tickles**. The Rive file never rolls the
reward, changes the economy, or awards/displays Snout Coins.

The official Rive MCP is connected to Rive Early Access at
`http://127.0.0.1:9791/mcp`. It allows an agent to inspect and author the open
Rive document through structured operations instead of fragile screen clicks.
It can work with artboards, editable objects, transforms, animations,
keyframes, state machines, View Models, bindings, listeners, and actions. It
cannot currently perform the final `.riv` runtime export, so that remains a
manual editor action.

The document's interaction architecture, animation tracks, runtime export, and
native integration are complete. The source was repaired through MCP, exported
from the connected native editor, bundled for both platforms, and exercised in
the iOS simulator with repeated full-motion and reduced-motion rewards.

## 2026-08-13 continuation status

The MCP-connected source document has now been repaired and hardened:

- `Machine Root` and every editable SVG child were rebased to the original
  `390 x 844` source coordinates.
- All animated Y keys were shifted by their former rest offsets, preserving
  the authored motion deltas. `Machine Spin` still has independent reel
  ranges and staggered stops; `Machine Settle` remains the short path.
- `Confirmed_Reward` now reveals at the end of either motion path.
- The required numeric `tickles` and `motes` properties remain intact. Two
  app-authored string properties, `ticklesLabel` and `motesLabel`, format those
  values for Rive text runs without making Rive calculate a reward.
- The app binding sets both numeric values and presentation labels, and an
  atomic in-flight guard prevents rapid taps from spending two Motes.
- The in-app browser was connected to a stale editor session, not the
  MCP-connected live source. Its 886,161-byte export passed the name-only
  verifier but did not contain the new source names/bindings, so it was moved
  out of the repository to `/tmp/mote-machine-stale-iab.riv` and must not ship.

Final integration evidence:

- The canonical export is `886,139` bytes with SHA-256
  `8cd5b7205aeae960bf0e9a81cf9ef0005e96bc32aff6c42818c6d3fcddba20fc`.
- Identical bytes are stored at `assets/rive/mote-machine.riv`,
  `ios/ttp/mote_machine.riv`, and
  `android/app/src/main/res/raw/mote_machine.riv`.
- The unchanged `verify:rive-mote-machine` gate passes all ten required names;
  `motesLabel` and `ticklesLabel` were also checked directly in the binary.
- React Native now manipulates the `Default` View Model instance bound inside
  the native Rive view. This fixed live Mote/result updates and spin triggers.
- Idle explicitly holds the result/action panel at full opacity after either
  one-shot animation, so a confirmed result remains visible and replay is
  reliable.
- Simulator full-motion runs spent Motes `3 -> 2 -> 1` and visibly revealed
  `+3 TICKLES`, then `+25 TICKLES`, in the same mounted machine.
- A Reduced Motion run spent `1 -> 0` and visibly revealed `+10 TICKLES` through
  the short `Machine Settle` route.
- TypeScript, the unchanged Rive verifier, `quality:loop`, and
  `quality:check` pass. The quality run covered 159 layout files and 280 Jest
  tests.

## 2026-08-13 production acceptance

- With explicit founder approval, `20260813010000_mote_machine.sql` was pushed
  as the only pending migration. The linked migration list and database lint
  both confirm it is live and clean.
- The signed-in simulator account was backfilled to two spendable Motes from
  its submitted Shimmer history. The private receipt ledger recorded two real
  plays: `+5 Tickles` at `2 -> 1 Mote` and `+3 Tickles` at `1 -> 0 Motes`;
  the spendable Tickle bank moved to `97`, then `100`.
- Replaying the second request returned the same `+3` receipt with
  `replayed: true`; the wallet remained `0` and the receipt count remained
  exactly two.
- One live response was lost after the server had committed. Native acceptance
  exposed that the client could otherwise remain in its confirming state.
  Plays now have an eight-second response timeout and persist the pending
  request ID across restarts, so the player can check the same durable receipt
  without a second debit. A regression test covers the timeout path.
- Player-facing reward percentages were removed from both machine hosts. The
  prize shelf names the possible Tickles bundles without presenting odds.
- The production Rive machine visibly ran its full-motion path and displayed
  the server-confirmed `+3 TICKLES` result while the surrounding native receipt
  showed the same reward and a zero-Mote balance.
- The final unchanged Rive verifier passed all ten authored names. The full
  project gate passed 135 suites / 1,319 tests, TypeScript, production lint,
  iOS Metro export, the database harness, and linked database lint.

## Product goal

Create a polished, replayable slot-machine-style use for Motes:

1. The player has at least one Mote.
2. The player presses Spin.
3. The game spends exactly one Mote.
4. The app/server selects and records the Tickles reward.
5. React Native supplies the confirmed result to the Rive View Model.
6. Rive spins, slows down, overshoots, wiggles, and settles on a visual result.
7. The player sees the confirmed bonus Tickles.

The economy is authoritative outside Rive. Animation failure, interruption, or
replay must never create, remove, or change a reward.

## System boundary

```text
Player input
    -> React Native game logic
    -> server-authoritative Mote spend and Tickles result
    -> Rive View Model values and spin trigger
    -> Rive state machine and animation
    -> visual presentation of the confirmed result
```

There are three separate tools/artifacts:

| Layer | Responsibility |
| --- | --- |
| Rive MCP | Gives the agent structured read/write access to the open Rive source document. |
| Rive Early Access | Holds the editable source file and provides visual authoring, playback, and export UI. |
| Exported `.riv` | Binary runtime asset loaded by the React Native Rive runtime on iOS and Android. |

The MCP is an authoring bridge. It does not ship in the game.

## What the Rive MCP allows

Capabilities verified against the open Mote Machine document include:

- List artboards and inspect their dimensions and export state.
- Traverse the editable object hierarchy.
- Find objects and query property names and values.
- Inspect and change transforms, names, and other editor properties.
- List, create, rename, and edit animations.
- Add, update, and delete keyframes.
- Configure interpolation and easing.
- Inspect and edit state machines, states, transitions, and conditions.
- Create and edit View Models, typed properties, and instances.
- Bind a View Model and default instance to an artboard.
- Create listeners and actions that connect data to state-machine behavior.
- Read the resulting structure back from the editor for verification.

This makes agent-driven Rive work deterministic and auditable compared with
operating the canvas through browser or screen coordinates.

## Current MCP limitations

- No MCP command currently exposes the final `.riv` download/export action.
- Visual quality still requires human-visible playback and judgment; valid
  keyframes do not automatically mean the motion looks good.
- Some specialized editor operations are not exposed cleanly. In particular,
  the current source does not yet provide a verified MCP path for building true
  clipped, continuously scrolling reel strips.
- Rive Early Access occasionally cancels editor queries. Retrying or using
  generic object queries has worked, but the integration should be treated as
  beta software.
- The editor's visible `Problems 1` warning has not yet been identified through
  an MCP validation API.

## Exact runtime contract

The source and React Native integration must use these names exactly:

| Kind | Required name/type |
| --- | --- |
| Artboard | `MOTE MACHINE` |
| State machine | `MoteMachine` |
| View Model | `MoteMachineViewModel` |
| View Model instance | `Default` |
| Main animation | `Machine Spin` |
| Reduced-motion animation | `Machine Settle` |
| View Model property | `spin` — trigger |
| View Model property | `tickles` — number |
| View Model property | `motes` — number |
| View Model property | `reduceMotion` — boolean |

Property meanings:

| Property | Owner | Meaning |
| --- | --- | --- |
| `spin` | App | Starts a new visual presentation. |
| `tickles` | App/server | Confirmed reward Rive must display, never calculate. |
| `motes` | App/server | Current spendable Mote balance. |
| `reduceMotion` | App/accessibility state | Chooses the full spin or short settle path. |

Do not recreate legacy state-machine inputs with the same names. Use View Model
data binding.

## Authoritative files

- Rive editor cloud file: <https://editor.rive.app/file/untitled/2506441>
- Authoring specification:
  `docs/rive-mote-machine-authoring.md`
- Existing implementation handoff:
  `docs/handoffs/mote-machine-rive-export.md`
- Runtime contract:
  `components/mote-machine/moteMachineRiveContract.ts`
- React Native binding:
  `components/mote-machine/MoteMachineRive.native.tsx`
- Production player screen:
  `app/mote-machine.tsx`
- Authoritative client/server wrapper:
  `utils/moteMachine.ts`
- Wallet, shimmer-credit trigger, spin receipt, and reward RPC:
  `supabase/migrations/20260813010000_mote_machine.sql`
- Prototype host and reward presentation:
  `app/mote-machine-prototype.tsx`
- Export verifier:
  `scripts/rive/verify-mote-machine-rive.mjs`
- Vector source:
  `assets/concepts/mote-machine/mote-machine-rive-source.svg`
- Local authoring backup:
  `assets/rive/mote-machine.rev`
- Required runtime export:
  `assets/rive/mote-machine.riv`

## Current verified state

The official Rive MCP is registered and callable against the active Rive Early
Access document.

Completed and read back through MCP:

- `MOTE MACHINE` is the intended runtime/export artboard.
- `MoteMachineViewModel` exists and is bound to that artboard.
- The `Default` instance exists.
- `spin`, `tickles`, `motes`, and `reduceMotion` have the required types.
- `MoteMachine` routes the `spin` trigger according to `reduceMotion`.
- Both motion paths return to Idle so subsequent spins can replay.
- `Machine Spin` is 132 frames with 114 cubic keys.
- `Machine Settle` is 12 frames with 20 cubic keys.
- Reel stop timing is staggered at frames 96, 108, and 120.
- Old crude `600 -> 916px` reel jumps were removed.
- No legacy state-machine inputs remain.
- No `frame-*` image layers or Snout references are present on the shipping
  artboard.
- `motes` is bound to the machine header.

Completed after that MCP readback:

- The imported SVG transform basis was rebased and the complete machine is
  centered inside the runtime artboard.
- `ticklesLabel` visibly presents the app-confirmed result inside Rive.
- The native editor Problems panel reports `No problems detected`.
- The final runtime export is bundled and its runtime gate is enabled.
- Full motion, repeated rewards, exact Mote debits, and Reduced Motion were
  verified in the iOS simulator.

## Historical visual blocker (resolved)

The runtime artboard is `[0, 0 -> 390, 844]`.

The measured rest/animation union of imported content is approximately:

```text
[274.640, 494.831 -> 664.640, 2129.112]
```

This was a `390 x 1634.281` union outside the `390 x 844` artboard. The imported
SVG was originally authored to fit exactly `[0, 0 -> 390, 844]`, but Rive
retained large child coordinates and also offset their root group. That double
coordinate basis displaced the cabinet down and right. The continuation rebased
those transforms and preserved each animation delta.

Simply scaling the root to fit would reduce the machine to roughly half-width.
That is technically contained but visually unacceptable. The correct repair is
to rebase the imported nested transforms while preserving animation deltas and
the exact resting positions.

The previous interrupted repair did not begin. A read-only MCP check confirmed
that the root and its 11 direct children still match the recorded pre-rebase
values. The file is in a known, safe, off-artboard state—not a partially
corrupted intermediate.

## Historical execution plan (completed)

### 1. Repair the composition through MCP

- Rebase the duplicated imported coordinate system.
- Keep the full-size machine centered in `390 x 844`.
- Preserve the completed View Model, state machine, and animation tracks.
- Verify all drawable geometry stays in bounds at rest and throughout both
  animations.
- Confirm no non-runtime scaffold artboard is accidentally exported.

### 2. Make the confirmed Tickles result unmistakable

- Bind `tickles` to a clear result display or result-selection presentation.
- Do not use the Tickles property to calculate or roll a reward.
- Test multiple supplied Tickles values.
- Ensure fixed prize labels cannot be mistaken for the confirmed payout.

### 3. Visually review the motion

- Play the full spin in Rive Early Access.
- Confirm rapid movement, independent deceleration, staggered stopping,
  overshoot, wiggle, and exact settlement.
- Play the reduced-motion route and confirm it avoids repeated reel travel.
- Trigger several consecutive spins and verify reliable replay.
- Determine whether contained local reel motion meets the quality bar. If not,
  author true clipped reel strips manually or through newly exposed MCP
  capabilities.
- Inspect and resolve or document `Problems 1`.

### 4. Export the runtime asset manually

Use Rive Early Access's Publish/Export action and save the file exactly as:

```text
/Users/bbroeking/projects/oink/assets/rive/mote-machine.riv
```

Do not claim an export exists until that path contains a real `.riv` file.

### 5. Verify without weakening the gate

Run:

```sh
pnpm verify:rive-mote-machine
```

The current expected result is failure because the file is missing:

```text
assets/rive/mote-machine.riv is missing; export the paid editor file first
```

The verifier must pass unchanged before native integration continues.

### 6. Integrate and test in the app

- Bundle the runtime file as native resource `mote_machine` on iOS and Android.
- Only then enable `MOTE_MACHINE_RUNTIME_BUNDLED` in
  `components/prototypes/MoteMachineRive.native.tsx`.
- Rebuild the iOS development client with the repository-required 16 GB Node
  heap.
- Open `/mote-machine-prototype` in the simulator.
- Verify full motion, reduced motion, multiple Tickles values, Mote balance,
  and repeated spin triggers.
- Run TypeScript, the Rive verifier, and `pnpm run quality:check`.

Do not create a distributable/TestFlight build without following
`docs/RELEASE_CHECKLIST.md` and receiving separate authorization.

## Definition of done

The feature is complete only when all of the following are true:

- The complete machine is visible, centered, and visually polished.
- One spin spends exactly one Mote.
- The app/server-selected Tickles result is visibly and accurately presented.
- Rive never selects, modifies, or awards the reward.
- No path displays or awards Snout Coins.
- Full motion accelerates, decelerates, overshoots, wiggles, and settles with
  independent reel timing.
- Reduced Motion uses a short, comfortable alternative.
- Repeated `spin` triggers replay reliably.
- Animation failure cannot alter reward accounting.
- The runtime export starts with a valid `RIVE` header and passes the unchanged
  verifier.
- The simulator renders the real authored machine instead of the
  export-pending placeholder.
- Native resource, TypeScript, verifier, and repository quality checks pass.

## Agent handoff prompt

Use this when passing the work to another agent:

> Read `docs/handoffs/rive-mcp-mote-machine-goal.md` and
> `docs/handoffs/mote-machine-rive-export.md` completely. Continue the active
> Mote Machine file in Rive Early Access through the official Rive MCP at
> `http://127.0.0.1:9791/mcp`. First repair the duplicated imported transform
> basis so the full editable machine fits the `390 x 844` `MOTE MACHINE`
> artboard without shrinking it to half-width. Preserve and verify the existing
> View Model, state-machine routing, 132-frame full spin, and 12-frame reduced
> settle. Make the app-supplied `tickles` result visually unmistakable, inspect
> `Problems 1`, and perform honest visual playback QA. Do not let Rive roll or
> award rewards, do not introduce Snout Coins or frame-image animation, and do
> not touch the database, release builds, broad Git state, or verifier logic.
> The final `.riv` export remains a user action; after it is saved to
> `assets/rive/mote-machine.riv`, run the unchanged verifier before native or
> simulator work.
