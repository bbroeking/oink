# Handoff: finish the Mote Machine Rive authoring and export

## Objective

Finish the editable Mote Machine in Rive, export the runtime `.riv`, wire it
into the native app, and prove the View Model data binding in the iOS
simulator. The finished loop is **one Mote in → bonus Tickles out**. This
feature never awards or displays Snout Coins.

## Current state

- Signed-in editor file: <https://editor.rive.app/file/untitled/2506441>
- Artboard: `MOTE MACHINE`
- Present editor animations: `Machine Spin`, `State Machine 1`, `Timeline 1`
- The editor state machine has not yet been renamed to the runtime contract.
- The required View Model and default instance have not been verified in the
  editor.
- Paid `.riv` export is available, but no valid runtime export exists at
  `assets/rive/mote-machine.riv` yet.
- Authoring backup: `assets/rive/mote-machine.rev`
- ImageGen frames and the frame-heavy `.rev` are visual reference only. Do not
  mount them, place them on the runtime artboard, or ship a frame animation.
- The current native component intentionally shows `Rive machine export
  pending`; its resource gate remains off until the export is bundled.
- Expo 57, `@rive-app/react-native`, Nitro Modules, CocoaPods, and the native
  Rive runtime already compile and render an official Rive sample.

## Exact editor contract

Create or verify these names exactly:

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

Do not create legacy state-machine inputs with the same names. Reward choice is
app/server authoritative; Rive only visualizes the already-selected tickle
result.

## Required work

1. Inspect the existing editor file before changing it.
2. Preserve and animate the editable vector/component hierarchy—cabinet,
   socket, three independently clipped reels, lever, reward burst, prize shelf,
   and action—not flattened ImageGen frames.
3. Rename/author the state machine and animations to the exact contract above.
4. Create `MoteMachineViewModel`, its `Default` instance, and all four typed
   properties. Bind them to the machine and transitions.
5. Confirm each reel spins quickly, decelerates independently, overshoots,
   wiggles, and settles. Reel two and three stop after reel one. Reduced Motion
   must use the short settle without repeated spinning.
6. Export a real runtime file to `assets/rive/mote-machine.riv`.
7. Run `pnpm verify:rive-mote-machine`. Fix the editor/export until it passes;
   do not weaken the verifier to accept a bad file.
8. Bundle the runtime file as native resource `mote_machine` on iOS and Android.
9. Only after the resource is present in both native targets, enable
   `MOTE_MACHINE_RUNTIME_BUNDLED` in
   `components/prototypes/MoteMachineRive.native.tsx`.
10. Rebuild the iOS development client with the repository-required 16 GB Node
    heap. Open `/mote-machine-prototype` and verify full and reduced motion,
    `motes`, `tickles`, and repeated `spin` trigger updates.
11. Run TypeScript, the Rive verifier, and `pnpm run quality:check`.

## Acceptance criteria

- `assets/rive/mote-machine.riv` begins with the `RIVE` header and passes the
  existing verifier without verifier relaxation.
- The runtime uses editable Rive components; no `frame-*` image layers are on
  the shipping artboard.
- One spin spends one Mote and visually lands on the Tickles amount supplied by
  React Native.
- No Rive logic rolls rewards and no path awards/displays Snout Coins.
- Multiple spin-trigger changes replay the state machine reliably.
- Reduced Motion avoids full reel travel while still showing the result.
- Missing/failed Rive motion cannot change reward accounting.
- The simulator shows the authored machine instead of the export-pending card.
- TypeScript, Rive verification, and repository quality checks pass.

## Key files

- `docs/rive-mote-machine-authoring.md` — full motion/runtime specification
- `components/prototypes/moteMachineRiveContract.ts` — canonical names
- `components/prototypes/MoteMachineRive.native.tsx` — native binding boundary
- `app/mote-machine-prototype.tsx` — prototype host and tickle reward table
- `scripts/rive/verify-mote-machine-rive.mjs` — export gate
- `assets/concepts/mote-machine/mote-machine-rive-source.svg` — vector source
- `assets/rive/mote-machine.rev` — current authoring backup

## Non-goals and safety rails

- Do not push database migrations or mutate production.
- Do not create a distributable/TestFlight build; use a development simulator
  build unless the primary agent/user separately authorizes the release lane.
- Do not commit or push the broad dirty workspace.
- Do not replace Rive with PNG, GIF, Lottie, video, or React Native frame swaps.
- Do not rename `tickles` back to `payout`.
- Do not touch unrelated backlog work.

## Report back

Return the exported artifact path and size, exact editor names, verifier output,
native bundle changes, simulator evidence, tests run, and any remaining manual
editor/export limitation. Be explicit if browser download/export cannot be
captured; never claim a `.riv` exists unless it is present and verified.
