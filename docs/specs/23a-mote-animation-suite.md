# Mote Machine animation suite and opt-in Wager mode

- Status: production specification for a future build chat
- Written: 2026-09-06
- Scope: art, motion, presentation integration, and the server/client contract
  required by that presentation
- Product/settlement authority: [spec 23](23-mote-wagering-and-animation.md).
  This companion specifies animation production and presentation.
- Baseline references: `docs/specs/22-full-page-interactive-mote-machine.md`
  and `docs/rive-mote-machine-authoring.md`.

## Product decision and compatibility rule

The locally implemented Mote Machine becomes the mode named **Reveal**. It
spends one earned Mote and guarantees 1, 2, 3, or 5 Clockwork Acorns. The
current server receipt, client types, recovery behavior, Rive binary, and three
runtime copies must remain usable while the new work is built and reviewed.

The new product direction is an additional, explicitly selected **Wager** mode.
It uses earned Motes only. A player chooses a stake of 1, 3, or 5 Motes, sees
the complete proposed paytable before committing, and can lose the stake. It
does not introduce purchased stakes, paid spins, cash value, cash-out, trading,
credit, debt, or a purchase/refill offer on the wagering screen.

This is the default interpretation of “gambling fully” for this specification.
The paytable and even the decision to permit losses are **proposed product
values**, not current behavior. Use them for local development unless revised;
record product/economy and audience-rating decisions and apply the new server
migration before public Wager enablement. Until that happens, Reveal
and its guaranteed result are canonical, and loss/stake animation remains
unreachable production content.

## Proposed Wager paytable

The server applies the selected multiplier to the whole stake. “Total Motes
returned” includes the staked Motes; “net” is returned minus stake.

| Outcome        | Weight | Total Motes returned |    Net Motes | Clockwork Acorns |
| -------------- | -----: | -------------------: | -----------: | ---------------: |
| Loss           |    50% |                    0 | `-1 × stake` |                0 |
| Stake returned |    25% |          `1 × stake` |            0 |                0 |
| Small          |    18% |          `2 × stake` | `+1 × stake` |                0 |
| Big            |     6% |          `3 × stake` | `+2 × stake` |      `1 × stake` |
| Jackpot        |     1% |         `10 × stake` | `+9 × stake` |      `5 × stake` |

At these weights, expected gross Mote return is 0.89 Motes per Mote staked and
expected Clockwork Acorn return is 0.11 per Mote staked. These are internal
virtual-resource expectations, not cash RTP. Product copy must not describe a
stake return as a win: the balance is unchanged, and its motion, sound, haptic,
and announcement all stay neutral.

Wager availability rules:

- Reveal is the default on first entry and remains one tap from the machine.
- The player must opt into Wager before stake controls appear.
- Only 1, 3, and 5 are valid stakes. Options above the confirmed Mote balance
  are disabled rather than silently reduced.
- The commit action names the exact stake, for example `WAGER 3 MOTES`.
- The paytable is readable from the same screen before commitment and does not
  disappear behind animation.
- Switching modes or changing stake does not spend anything.
- A pending or uncertain receipt locks mode and stake until that exact request
  is resolved.

## Existing implementation baseline

The future build starts from these facts and must not reconstruct them from
memory:

- Route/orchestrator: `app/mote-machine.tsx`.
- Typed RPC boundary: `utils/moteMachine.ts`.
- Shared Rive contract: `components/mote-machine/moteMachineRiveContract.ts`.
- Native/web adapters:
  `components/mote-machine/MoteMachineRive.native.tsx` and
  `components/mote-machine/MoteMachineRive.web.tsx`.
- True load/failure fallback:
  `components/mote-machine/MoteMachineFallback.tsx`.
- Server source:
  `supabase/migrations/20260829000000_contraptions_and_streaks.sql`.
- Current artboard/state machine/View Model/instance:
  `MOTE MACHINE` / `MoteMachine` / `MoteMachineViewModel` / `Default`.
- Current full and reduced clips: `Machine Spin` at 258 frames / 60 fps
  (4.300 seconds) and `Machine Settle` at 28 frames / 60 fps (467 ms), followed
  by `Result Hold`.
- Current receipt path atomically spends one Mote and grants 1/2/3/5 Acorns at
  weights 50/30/15/5. It stores an idempotent receipt and returns legacy visual
  selectors 3/5/10/25.
- Current route persists `mote_machine_pending_request_v3` before calling the
  server, latches concurrent controls, and reuses the same request ID after an
  uncertain response.
- Current Rive stage is 390 × 844, uses three independent continuous vertical
  reel strips and a single center payline, and receives a confirmed result only
  after the server commits it.
- Current Rive runtime is 2,726,539 bytes, SHA-256
  `ae891be3c9b79235c5ae19e8718ade07d5f5b0799bd14a1288f5bc4b5ebac52a`.
  `assets/rive/mote-machine.riv`, `ios/ttp/mote_machine.riv`, and
  `android/app/src/main/res/raw/mote_machine.riv` are byte-identical.
- The existing screen already supplies deposit/spin/brake/reveal phase copy,
  safe-area controls, Mote and Acorn balances, one announcement/toast per
  `spin_id`, Reduced Motion, several timed haptics, empty state, and receipt
  recovery.
- There are no Mote Machine sound assets or sound calls today.
- There is no Rosie actor or Rosie reaction choreography on this screen today.

The current View Model surface is exactly:

| Name                          | Type    | Current use                                                |
| ----------------------------- | ------- | ---------------------------------------------------------- |
| `requestPlay`                 | trigger | Rive lever asks native code to start the guarded request   |
| `spin`                        | trigger | Native starts motion after a confirmed receipt             |
| `tickles`                     | number  | Legacy visual selector 3/5/10/25; never a Tickle grant     |
| `motes`                       | number  | Confirmed Mote balance                                     |
| `reduceMotion`                | boolean | Selects `Machine Settle`                                   |
| `presenting`                  | boolean | Display state only; never initiates motion                 |
| `busy`, `canPlay`, `hasError` | boolean | Interaction/recovery presentation                          |
| `motesLabel`, `ticklesLabel`  | string  | Bound balance/reward copy; `ticklesLabel` is a legacy name |
| `actionLabel`, `statusLabel`  | string  | Native-authored action and status copy                     |

No build should describe a proposed binding below as already implemented.

## Experience contract

The machine is theatrical after commitment, factual before commitment, and
calm after a loss. The animation may build anticipation, but it must not imply
that player timing, lever force, tapping, Rosie, sound, haptics, or a near miss
can alter the result.

The server chooses and stores the outcome and the three canonical reel stops
before Rive receives them. Each reel stop identifies the symbol centered on the
same single payline. The client binds the complete confirmed receipt, then
fires one receipt-bound trigger. Rive only presents those values.

The visual order is always:

1. player reviews mode, stake, and paytable;
2. native persists a request ID and commits the request;
3. server atomically stores the outcome and balance effects;
4. native binds outcome, stake, return, Acorns, unlock state, and reel stops;
5. Rive plays the matching authored sequence;
6. native exposes and announces the exact receipt once.

If the server rejects, no deposit or reel spin plays. If the response is
uncertain, the screen offers `CHECK LAST PLAY`, looks up the same request ID,
and retries only the original saved command if no receipt exists.
If a recovered receipt is found, the machine plays the short Receipt Replay
sequence for that stored result; it never performs another draw.

Recovered receipts suppress win/unlock sounds, celebration haptics and award
toasts; only a quiet recovery cue and any not-yet-delivered exact-result
announcement are allowed. **Next Play Reset** clears transient art before a
newly requested play and is a different state; neither operation starts a
wager automatically.

## Authored scene inventory

The approved Rosie/Barn V3 composition remains the visual foundation. Preserve
the quiet open Barn, broad rose/cream paint, dark warm outlines, and restrained
glow. Do not return to the retired alchemy cabinet or introduce neon, coins,
fruit symbols, casino chrome, payout trays full of cash, flashing urgency, or
“almost won” choreography.

The production artboard remains 390 × 844 and contains these independently
addressable groups:

```text
MOTE MACHINE
├─ background
│  ├─ openBarnPlate
│  ├─ daylightDepth
│  ├─ grassAndDustAmbient
│  └─ lowMotionBackground
├─ rosieStage
│  ├─ placementGuide
│  └─ reactionSafeArea
├─ machine
│  ├─ cabinetShell
│  ├─ lampsAndWakePath
│  ├─ feedWell
│  │  ├─ aperture
│  │  ├─ mask
│  │  └─ moteInstances[1…5]
│  ├─ reelWindows
│  │  ├─ leftStrip + leftMask + leftBezel
│  │  ├─ centerStrip + centerMask + centerBezel
│  │  └─ rightStrip + rightMask + rightBezel
│  ├─ singlePayline
│  ├─ lever
│  │  ├─ pivot
│  │  ├─ shaft
│  │  ├─ knob
│  │  └─ pullSign
│  ├─ rewardTray
│  │  ├─ cavity
│  │  ├─ moteReturnInstances[1…5]
│  │  ├─ clockworkAcorn
│  │  └─ trayLip
│  └─ effects
│     ├─ depositGlow
│     ├─ dustPuffs
│     ├─ resultRays
│     ├─ paperConfetti
│     └─ jackpotBurst
└─ fixedAuthoredText
   ├─ MOTE MACHINE
   └─ PULL
```

Mode, stake, paytable, balances, returned amounts, net change, error copy, and
receipt copy remain native text. The authored scene may show one to five Mote
objects moving through the machine, but it must not bake a numeric payout into
pixels.

Rosie occupies a reserved side/foreground zone without covering the lever,
reels, single payline, reward tray, top balance tickets, bottom receipt panel,
or 44-point controls at 320 × 568. Her coat, mood, and equipped look should come
through the existing `PigRenderer` seam when that renderer can represent them;
unsupported equipment must retain its existing raster fallback. Do not bake a
second canonical Rosie into the cabinet asset.

## Clip and state inventory

All durations are targets for review, not server timeouts. Clips may share
keyframes, but each named beat must be independently inspectable in the editor
and capture matrix.

| Clip/state                            |              Target duration | Required behavior                                                                                                                                             |
| ------------------------------------- | ---------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Entry`                               |              700–900 ms once | Fade/settle the Barn depth and cabinet into place; lever rises; Rosie notices the machine. Never auto-start a play.                                           |
| `Ready`                               |          3–5 s seamless loop | One Mote floats over an empty well in Reveal, or the selected 1/3/5 Motes gather in Wager. Reels and tray stay still. Lamps breathe once, without urgency.    |
| `Ready Empty`                         |          3–5 s seamless loop | No Mote at the well; cabinet rests; Rosie glances toward the earning hint. No fake reward or disabled lever bounce.                                           |
| `Commit Pending`                      |         network-bounded loop | Very small lever/contact response and a quiet lamp hold. No Mote disappears and reels do not move before confirmation.                                        |
| `Deposit 1`, `Deposit 3`, `Deposit 5` |                   300–450 ms | Compress and seat the exact stake, then mask every Mote through the feed well. Multi-Mote stakes travel as one readable bundle, not five long serial inserts. |
| `Lever Pull`                          | 350–500 ms, overlaps deposit | Pivot, shaft, knob, and PULL sign move as one mechanism with anticipation, downstroke, spring return, and no origin jump.                                     |
| `Reel Accelerate`                     |                   350–500 ms | All strips accelerate from rest after the lever downstroke.                                                                                                   |
| `Reel Cruise`                         |                    1.5–1.9 s | Continuous vertical motion using periodic strips. No blank seam, cyclic teleport, or symbol swap.                                                             |
| `Stop Left`                           |                   350–500 ms | Brake to the server-selected center symbol, overshoot slightly, return, and register a cabinet impulse.                                                       |
| `Stop Center`                         |                   350–500 ms | Begin 180–260 ms after left; same physical rules with distinct phase.                                                                                         |
| `Stop Right`                          |                   350–500 ms | Begin 180–260 ms after center; complete before any result object appears.                                                                                     |
| `Outcome Loss`                        |                   500–700 ms | Lights exhale; tray stays empty; one soft dust puff. No near-miss rewind, red alarm, shame pose, or success flourish.                                         |
| `Outcome Stake Returned`              |                   550–750 ms | The exact staked Motes return to the tray with a restrained neutral pulse. No win fanfare or success haptic.                                                  |
| `Outcome Small`                       |                   700–900 ms | Returned Motes emerge with one warm light pulse. Keep particles sparse.                                                                                       |
| `Outcome Medium`                      |                 800–1,000 ms | Reveal-mode tier for the middle guaranteed Acorn result. It remains authored even though the proposed Wager table has no medium row.                          |
| `Outcome Big`                         |                    1.0–1.3 s | Returned Motes arrive, then Acorns appear as a distinct second beat; wider rays and a cabinet bounce.                                                         |
| `Outcome Jackpot`                     |                    1.6–2.2 s | Ten-times Mote return reads first, then the Acorn award; Rosie and cabinet crest together; one short paper-confetti burst settles quickly.                    |
| `First Unlock`                        |        700–1,000 ms additive | After any first positive Acorn grant in Reveal or Wager, reveal the Auto-Tickler unlock as a secondary event. Keep the primary receipt visible.               |
| `Legacy Resource Small`               |                   600–800 ms | Current guaranteed one-Acorn Reveal treatment.                                                                                                                |
| `Legacy Resource Medium`              |                   700–900 ms | Current guaranteed two-Acorn Reveal treatment.                                                                                                                |
| `Legacy Resource Big`                 |                 900–1,100 ms | Current guaranteed three-Acorn Reveal treatment.                                                                                                              |
| `Legacy Resource Jackpot`             |                    1.2–1.6 s | Current guaranteed five-Acorn Reveal treatment. It may celebrate strongly without using Wager return copy.                                                    |
| `Result Hold`                         |                   indefinite | Final payline, tray objects, lever-up pose, and Rosie’s settled reaction persist until next play, mode change, navigation, or explicit reset.                 |
| `Receipt Replay`                      |                   450–800 ms | A short “machine remembers” lamp sweep goes directly to stored stops and result. It never depicts a new deposit or full randomized spin.                      |
| `Recovery Pending`                    |         network-bounded loop | If Rive is healthy, a slow reverse gear/lamp pulse supports `CHECKING LAST PLAY…`; no reels travel and no balance changes locally.                            |
| `Recoverable Error`                   |                   indefinite | For a known server rejection after Rive loaded: cabinet returns to the truthful pre-play state and holds without spectacle.                                   |
| `Background Ambient`                  |         8–12 s seamless loop | Sparse grass, dust, cloud/light drift; no large parallax behind reel motion and no continuous expensive particle emission.                                    |
| `Low Motion Entry`                    |                   150–250 ms | Opacity and small positional settle only.                                                                                                                     |
| `Low Motion Deposit`                  |                   100–160 ms | Stake crossfades from well to committed state; no repeated travel.                                                                                            |
| `Low Motion Result`                   |                   250–450 ms | Crossfade final payline and returned resources, then hold. No spinning, strobing, camera shake, confetti shower, or repeated bounce.                          |

The full-motion shared mechanical sequence should keep the current reliable
rhythm: deposit begins at confirmation, reels accelerate near 550 ms, left
brakes near 2.5 seconds, center and right follow 180–260 ms apart, and the right
settles near 3.7 seconds. Outcome clips extend the total confirmed-to-readable
time according to tier. Target no more than 4.5 seconds for loss/stake-return,
5.0 seconds for Small/Medium, 5.4 seconds for Big, and 6.2 seconds for Jackpot.

True runtime loading and renderer failure cannot be Rive states because the
Rive file is unavailable in those conditions. Preserve the native fallback and
produce matching static art for:

- `Loading`: waking card/silhouette with no interactive lever;
- `Failure before confirmation`: “machine resting,” Motes untouched;
- `Failure after confirmation`: exact stored result and inventory route;
- `Uncertain receipt`: check the same play, with no second commit action;
- `Recovery failed`: keep the request ID and exact mode/stake locked.

## Rosie reaction suite

Rosie is a companion to the result, not a source of luck. Her timing follows
the confirmed machine state and cannot respond early enough to imply she knows
the outcome before the final stop.

| Machine beat            | Rosie performance                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Entry                   | Walk or peek in, notice the lever, settle into current mood.                                   |
| Ready                   | Current mood idle with an occasional ear turn toward the floating Mote.                        |
| Deposit                 | `surprise`/attention beat toward the feed well.                                                |
| Spin                    | Short brace/bounce; eyes track the reel bank as a whole.                                       |
| Left/center/right stops | Three small eye/head ticks, not three full-body jumps.                                         |
| Loss                    | Brief sympathetic wince, then return to current mood; never scold, cry, or slump indefinitely. |
| Stake returned          | Relieved exhale/nod; neutral affect.                                                           |
| Small                   | Happy hoof tap.                                                                                |
| Medium                  | Happy bounce; Reveal mode only until Wager gains a medium result.                              |
| Big                     | One authored jump followed by a proud look at the tray.                                        |
| Jackpot                 | Surprise into a two-beat jump/hoof clap; settle before Result Hold.                            |
| First unlock            | Curious lean toward the Auto-Tickler beat, then happy acknowledgement.                         |
| Empty                   | Glance toward the native earning hint, then resume mood idle.                                  |
| Recovery                | Watch the machine quietly; no anxious repeated motion.                                         |

The exact existing shared pig contract supports mood rest plus `happy`, `jump`,
`surprise`, and `wave` reactions. The full eye tracking, brace, wince, relieved
nod, hoof tap, and hoof clap above are **new authoring requirements**. Add them
to the shared pig rig only with a versioned pig contract and regression coverage
for all six coats and supported equipment. Until those clips pass, the Mote
screen may map to existing reactions as follows: attention=`surprise`, spin=
`bounce`, loss=current mood, returned stake=`surprise`, small/medium=`happy`,
big/jackpot=`jump` then `happy`. A reaction ID must prevent remounts or ordinary
rerenders from replaying a reaction.

Those mappings are development fallbacks only. Source-complete acceptance
requires the new authored reactions on the shared, versioned pig rig. The
integration owner coordinates these shared files with existing Rosie work.

Reduced Motion keeps Rosie in her current mood, permits one pose change at the
result, and suppresses bouncing, jumping, tracking ticks, and confetti.

## Sound and haptic direction

There is no current Mote Machine sound implementation. Author a dedicated,
cozy mechanical set under `assets/sounds/mote-machine/`; do not reuse the
current `utils/sound.ts` blindly because that module is scoped to the Dig and
its Deeproot assets are documented as silent placeholders.

Required sound deliverables:

| Cue                                 | Sound direction                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `room_tone`                         | Very low open-Barn air/wood bed; optional and loop-safe.                      |
| `mote_ready`                        | Rare soft shimmer, never a repeating attention alarm.                         |
| `deposit_1`, `deposit_bundle`       | Soft glassy seed/chime into painted wood.                                     |
| `lever_down`, `lever_return`        | Wooden clunk plus a small spring, no casino handle bell.                      |
| `reel_start`, `reel_loop`           | Short mechanical cloth/wood roll; loop seam inaudible.                        |
| `reel_stop_1…3`                     | Three related impacts with slightly different pitch/weight.                   |
| `loss`                              | Soft air release/wooden settling sound; no buzzer.                            |
| `stake_returned`                    | Neutral Mote clink, deliberately below win cues.                              |
| `small`, `medium`, `big`, `jackpot` | Increasing warm musical signatures with shared motif and controlled loudness. |
| `acorn_award`                       | Distinct clockwork-acorn click/chime layered only when Acorns are granted.    |
| `first_unlock`                      | Short clockwork wake-up phrase after the Acorn cue.                           |
| `receipt_replay`                    | Gentle reverse/remembering flourish with no reel loop.                        |
| `recovery_ok`, `recovery_error`     | Quiet resolution cues; no repeated alarm.                                     |

Preload one-shots when the route becomes active, pause loops on blur/background,
release players on unmount, honor the hardware silent switch, and route through
one mute-aware game SFX seam. Normalize the suite so Jackpot gains complexity
rather than a large loudness jump. Sound failure must never block a play,
receipt, recovery, or result announcement.

Spec 23 owns the sensory settings: machine-local Sound and Haptics switches,
on by default, device-persisted as `mote_machine_sensory_v1`, honoring hardware
silent mode and any existing global disable. No app-wide settings refactor is
required. All cue calls are authored; switches, unsupported platforms and
runtime failures safely suppress their output.

Haptic choreography extends the current `expo-haptics` calls:

- confirmation/deposit: one medium impact;
- lever return: one light impact;
- each reel stop: one light impact aligned to the authored stop event;
- loss: no error notification haptic; the third stop is sufficient;
- stake returned: one soft/light acknowledgement, no success notification;
- Small/Medium: one success notification at readable result;
- Big: success plus one medium mechanical impact at the Acorn beat;
- Jackpot: one rigid/medium crest and one success notification, without a long
  vibration pattern;
- first unlock: one additional light clockwork tick only if it stays distinct
  from the main result;
- Reduced Motion: at most one confirmation impact and one outcome haptic.

Prefer authored Rive events for stop/result synchronization. If the selected
Rive runtime cannot surface reliable cross-platform events, keep a single
versioned timing table beside the animation manifest; do not scatter raw
timeouts through the route.

## Proposed receipt and animation contract

The existing one-argument `spin_mote_machine(p_request_id text)` contract stays
available for Reveal. Wager uses the new versioned endpoint from spec 23;
the request validates:

```text
request_id: persisted idempotency key, 8…128 characters
mode: "reveal" | "wager"
stake_motes: 1 for Reveal; 1 | 3 | 5 for Wager
expected_rules_version: exact immutable version shown before commitment
```

The server must lock the caller’s Mote wallet, replay an existing request before
checking current funds, reject an unaffordable/invalid stake without spending,
draw once, debit the stake, credit all returned Motes and Acorns atomically,
unlock the Auto-Tickler on the first positive Acorn grant, record the full
receipt, and return it. A response should include at least:

```text
spin_id
request_id
mode
stake_motes
outcome: legacy_resource | loss | returned_stake | small | big | jackpot
motes_returned
net_motes
motes_remaining
contraption_id/resource_id
resource_amount
resource_balance
newly_unlocked
reel_stops: [leftSymbolId, centerSymbolId, rightSymbolId]
paytable_version
replayed
```

The receipt's settled balance is historical. A separate current wallet
snapshot and monotonic revision follow spec 23; an old receipt must never
overwrite newer earnings or spends. Same ID with altered mode/stake/version
is a request conflict. Check a pending receipt through the read-only lookup
before resubmitting its original full command when needed.

The three `reel_stops` are canonical server-selected symbols centered on one
payline. Their registered combination must correspond to `outcome`; the client
must reject/fallback on an impossible combination rather than substituting a
more favorable animation. Store the paytable version in the receipt so later
tuning does not alter replay copy or expected balances.

Use spec 23's exact Wager symbol IDs and permitted triplets. Its manifest bank
is distinct from the preserved Reveal mapping. The server-required
presentation version, bundled manifest/hash, and loaded V4 bindings must agree
before enabling Wager; web asset URLs are content-hashed. This is a correctness
handshake, not a substitute for server validation.

The outcome taxonomy deliberately includes `legacy_resource`. It adapts every
existing Reveal receipt without pretending it was a wager. Existing
`resource_amount` 1/2/3/5 and `reel_value` 3/5/10/25 continue to map to the four
legacy resource clips through a checked manifest. They must never map to loss,
stake-returned, or Mote-return clips.

The existing Rive bindings stay intact for the current binary. A future V4
contract may add these properties; they are proposals and do not exist today:

| Proposed name                         | Type    | Meaning                                             |
| ------------------------------------- | ------- | --------------------------------------------------- |
| `mode`                                | number  | `0=Reveal`, `1=Wager`                               |
| `stakeMotes`                          | number  | Exact visible stake: 1, 3, or 5                     |
| `outcomeCode`                         | number  | Checked manifest code for the receipt taxonomy      |
| `leftStop`, `centerStop`, `rightStop` | number  | Server-authored symbol IDs for the center payline   |
| `newlyUnlocked`                       | boolean | Enables the post-result first-unlock beat           |
| `replayedReceipt`                     | boolean | Selects Receipt Replay instead of deposit/full spin |

Keep `requestPlay`, `spin`, `motes`, `reduceMotion`, `presenting`, `busy`,
`canPlay`, `hasError`, and the current native-owned labels unless an adapter is
updated on native, web, tests, and verifier in the same change. Keep legacy
`tickles`/`ticklesLabel` until the V3 adapter is retired. Do not overload
`tickles=0` to mean loss; that hides a product meaning inside a legacy Acorn
selector.

## Versioning, manifests, and legacy adapter

Treat product, receipt, and animation versions separately:

- `reveal-v1`: current guaranteed server economy and receipt.
- `wager-v1`: proposed paytable above.
- `mote-animation-v3`: current accepted binary and exact hash.
- `mote-animation-v4`: new authored suite in this specification.

Build V4 beside V3. Do not overwrite `assets/rive/mote-machine.rev`, the current
`.riv`, or either native copy during authoring. Stage the new files under an
artifact directory until editor source, runtime export, manifest verification,
and visual acceptance all pass. Promotion may then copy one accepted binary to
all three runtime locations in one reviewed change, retaining the V3 source,
runtime, hash, and capture evidence in backups/audit artifacts.

Add a machine animation manifest that records:

- schema/animation version and source/export timestamps;
- `.rev` and `.riv` hashes;
- artboard, state machine, View Model, instance, property, trigger, event,
  animation, and state names;
- outcome codes and legacy `resource_amount`/`reel_value` mappings;
- reel symbol IDs, exact center-stop transforms, and valid combinations;
- clip frame ranges, fps, durations, and sound/haptic event times;
- embedded asset names, dimensions, alpha requirements, and draw order;
- full-motion and Reduced Motion routes;
- runtime size and the hashes of all three promoted copies.

Implement one pure receipt-to-animation adapter. It validates either a
Reveal-v1 receipt or Wager-v1 receipt and returns the same presentation model.
Unknown versions, outcome codes, reel stops, amounts, or combinations fail
closed into a native exact-receipt fallback. Do not let native and web carry
separate handwritten mappings.

## Required production artifacts

A complete handoff contains all of the following:

1. A current editable `.rev` exported after the last accepted visual change.
2. The matching runtime `.riv` export.
3. The machine animation manifest described above.
4. A source-layer folder for new/revised images, including original generation
   or paint sources and alpha-clean production crops.
5. A contact sheet for every named clip at key poses.
6. Full-motion captures for Reveal 1/2/3/5 and Wager loss, stake returned,
   Small, Big, Jackpot, and first unlock.
7. Stake 1/3/5 deposit captures and at least one valid server-authored reel
   combination per Wager outcome.
8. Reduced Motion captures for every distinct result family.
9. Empty, loading, known rejection, uncertain receipt, recovered receipt,
   failure-before-confirmation, and failure-after-confirmation captures.
10. Rosie capture rows for all six coats, the existing supported equipment,
    representative unsupported-equipment raster fallback, each mood, and each
    outcome reaction.
11. A sound cue manifest with filenames, lengths, loop points, peak/loudness
    checks, license/source provenance, and the animation event each cue follows.
12. A capture-matrix Markdown file linking every image/video and recording
    device/viewport, motion setting, asset hashes, receipt fixture, and result.

The `.rev`, `.riv`, manifest, and capture matrix are all release-blocking
animation artifacts. A video or concept frame cannot substitute for either
Rive file.

## Existing source-export blocker

The current editable-source chain is incomplete. The Rive cloud source at
`https://editor.rive.app/file/untitled/2506441` contains the September 5
transition and visibility corrections, but Publish → To `.riv` closed without
producing a download. The local `assets/rive/mote-machine.rev` and
`artifacts/mote-machine/mote-machine-polish-v7-source.rev` are 6,002,477-byte
pre-repair authoring exports. The shipping runtime was repaired reproducibly by
`scripts/rive/repair-mote-machine-transitions.mjs`; its hash guard is valid only
for the known binary and must not be relaxed for a new export.

Before V4 art work begins, obtain and archive a fresh editable cloud `.rev` or
make a documented decision to rebuild V4 from the last local `.rev` plus the
recorded repair manifest. Before V4 can be called source-complete, prove that a
fresh editor `.riv` export passes the verifier directly, without applying the
V3 binary patch. Preserve `artifacts/audit-2026-09-05/` as provenance.

## Module and asset ownership for a parallel future build

Use disjoint ownership so multiple implementers can work without rewriting the
same files. One integration owner merges contract changes after each track
delivers its artifact.

| Track                | Exclusive ownership                                                                                      | Deliverable                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product/server       | New migration, DB harness smoke, generated DB types, `utils/moteMachine.ts` receipt types                | Versioned Wager receipt, transactional stake/paytable implementation, replay and concurrency proof. No database push without explicit user go.                                                   |
| Machine authoring    | New V4 `.rev`, staged `.riv`, machine source layers, animation manifest, Rive verification scripts       | Complete mechanical/outcome/low-motion suite and editor-readable source. Does not replace V3 runtime copies.                                                                                     |
| Rosie authoring      | Shared pig source/runtime, pig contract/verifier, reaction contact sheet                                 | New named reactions across six coats and equipment, with existing fallback preserved. Coordinate before editing shared pig files.                                                                |
| Runtime adapters     | New versioned contract/adapter modules and native/web Rive adapters                                      | One checked presentation model and equivalent native/web binding behavior. Does not own route orchestration.                                                                                     |
| Screen orchestration | `app/mote-machine.tsx`, mode/stake/paytable components, recovery storage/versioning, acceptance fixtures | Opt-in mode UI, durable request model, phase/event orchestration, exact copy and accessibility.                                                                                                  |
| Sound/haptics        | New Mote sound assets, a dedicated Mote sound module, event cue table                                    | Preload/lifecycle, mute/silent-switch behavior, outcome-aware cues and haptics. Does not edit Rive timelines.                                                                                    |
| Verification/capture | Capture matrix, evidence artifacts, and separately assigned review tests                                 | Automated authority/replay/mapping review plus native/web visual evidence. Acceptance routes and fixtures remain with screen orchestration; Rive behavior tests remain with the authoring owner. |

The integration order is server types and manifest schema, machine/Rosie art,
runtime adapters, route/sound orchestration, automated gates, then native visual
acceptance. Each track should commit or hand off only its owned files, because
this working tree already contains broad unrelated work.

## Verification and acceptance gates

### Authority and economy

- Reveal still spends exactly one Mote and grants exactly 1/2/3/5 Acorns with
  the current weights and replay behavior.
- Wager cannot be enabled without the accepted Wager-v1 migration and client
  capability check.
- Wager stakes accept only 1/3/5, reject insufficient balance without debit,
  and serialize against all other Mote grants/spends on the profile lock.
- Each Wager outcome applies exactly the proposed Mote and Acorn formula for
  all three stakes.
- At boundary draws, integer weights cover buckets 0…9999 exactly once; a deterministic harness
  proves loss/returned/small/big/jackpot and the 50/25/18/6/1 split.
- One request ID produces one immutable receipt under retry, app restart,
  response timeout, and concurrent calls.
- The receipt stores paytable version and three valid canonical reel stops.
- Rive, Rosie, sound, haptics, timers, and user taps cannot affect the draw,
  credited amounts, or recorded reel stops.

### Motion and visual truth

- Entry and Ready never auto-play a receipt or imply a pre-earned result.
- Deposit shows the exact selected stake only after confirmation.
- Three reels travel vertically and continuously, stop left-center-right at the
  receipt’s symbols on one payline, and never show a blank seam or origin jump.
- Loss, stake returned, Small, Medium, Big, Jackpot, first unlock, result hold,
  receipt replay, empty, recovery, loading, failure, background ambient, and
  all Reduced Motion paths match the inventory above.
- Stake returned uses neutral language and presentation. Loss has no fake
  near-miss, error state, success toast, success haptic, or shaming Rosie pose.
- The result remains readable indefinitely and repeated plays reset every
  transient layer before accepting another trigger.
- Full and reduced paths work for at least four alternating plays without
  stale symbols, stuck particles, duplicated sounds, or an automatic restart.

### Native art and layout

- Test at minimum 320 × 568, current small iPhone, current large iPhone, and a
  representative Android viewport, in portrait and with safe areas.
- Back, mode, stake, paytable, lever/action, receipt, and inventory controls are
  at least 44 points and remain reachable with large text.
- Rosie never covers the lever, payline, tray, balance tickets, or receipt; her
  fallback preserves the same bounds.
- The accepted scene matches `assets/images/homepage-bg.jpg`,
  `assets/images/sprites/rosie/idle_1.png`, `constants/theme.ts`, and the V3
  READY reference more closely than any older alchemy/casino concept.
- Test all six pig coats, all moods, supported Rive equipment, unsupported
  raster fallback, app background/resume, route blur/focus, and memory pressure.

### Accessibility and sensory controls

- Native exposes mode, selected stake, complete paytable, exact commit action,
  back, result, recovery, inventory, and reload nodes in logical order.
- Before a Wager commit, VoiceOver reads the stake and possibility of losing
  it. Afterward it announces stake, outcome, Motes returned, net Mote change,
  Acorns awarded, balances, and first unlock once per `spin_id`.
- Color, blur, symbol art, sound, vibration, and Rosie's pose never carry the
  only copy of an outcome.
- Reduced Motion suppresses reel travel, repeated flashes, shake, parallax,
  jump/bounce reactions, and confetti while preserving exact stops and receipt.
- Hardware silent mode and game mute silence all machine audio. Haptic failure
  and audio failure are safe no-ops.

### Performance and artifact integrity

- Preserve three byte-identical promoted runtime copies.
- Keep the machine `.riv` below the existing verifier’s 6 MB hard limit and
  target 4 MB or less. Do not embed duplicate reel strips or a second full pig
  skin set in the machine asset.
- No frame-sequence, video, GIF, or React Native animated-reel fallback.
- The Rive verifier checks every required name, forbidden retired name,
  manifest mapping, file size, and all three hashes.
- The WASM behavior gate verifies no play from `presenting`, exactly one play
  per `spin`, all Reveal and Wager outcomes, all stakes, canonical stops,
  Result Hold, receipt replay, alternating/repeated plays, and Reduced Motion.
- Focused Mote tests, migration harness, `npm run quality:check`, and then
  `npm run quality:check:full` pass before release preparation.
- A native development client is rebuilt after promoting a bundled `.riv`, and
  the capture matrix is run against that exact client.

## Release boundary

This animation/economy work is a large economy and native/runtime change. The
future implementation must enqueue a release follow-up while it is authored.
Any distributable build follows `docs/RELEASE_CHECKLIST.md`; an RC also requires
exact installed-binary acceptance and explicit go/no-go. Database migration
application, distributable build, upload, and release are separate actions.
The root project rule still requires explicit user “go” before any database
push.

## Definition of done

The suite is complete only when Reveal remains backward-compatible; the
accepted Wager-v1 economy is server-authoritative and replay-safe; every state,
result, Rosie reaction, sound/haptic cue, fallback, and Reduced Motion path has
an authored or native owner; a fresh `.rev` and its matching `.riv` are archived
with a machine-readable manifest; all automated and visual gates pass; and the
exact native build has been exercised through Reveal, every Wager outcome,
empty wallet, timeout replay, renderer failure, background/resume, and
Contraption unlock/inventory reconciliation.
