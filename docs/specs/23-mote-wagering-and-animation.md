# Mote wagering and the complete machine experience

Written: 2026-09-06. Status: proposed implementation spec for a new build chat.
Companion: [animation production spec](23a-mote-animation-suite.md).
Execution: [build goal](../goals/mote-wagering-build-goal.md).

## Product decision and scope

Make the Mote Machine a complete, playable slot game: choose a stake, commit
earned Motes, watch authored reels settle, and receive an exact result that
can be a loss, a returned stake, or a larger win. Build the entire animation,
sound, haptic, wallet, history, and recovery experience around that loop.

The user asked for “gambling fully” and a full animation suite. This draft
interprets that as **simulated wagering with earned Motes and possible losses**.
The clarification offered during planning had no alternative supplied at the
time of writing. The quantities, paytable, and mode structure below are
**proposed build defaults**, not previously approved economy settings.

V1 adds an explicit **Wager** mode beside the existing **Reveal** mode. Reveal
keeps its guaranteed Acorn result and is the initial selection. Wager is an
intentional choice with the cost, possible zero result, and paytable visible.
Both use the same cabinet and wallet. This preserves the value of players'
existing Motes and the current way to unlock the Auto-Tickler while introducing
actual stakes and losses. Remember mode only after the player selects it;
opening the machine from a reward never places a wager.

This spec introduces no Mote purchases, cash prizes, cash-out, tradable wins,
player-to-player pots, borrowed stakes, or negative balances. It does not
introduce automatic betting, multi-line bets, progressive jackpots, or
double-or-nothing. These exclusions keep one complete game buildable. Paid
stakes or real prizes are a different product decision, not an implied part
of this draft.

This spec supersedes spec 22's no-wagering/no-empty-result rule **only inside
the new Wager mode**. Existing Reveal receipts and behavior retain their
original contract. Update the domain glossary when implementation lands; do
not describe this proposed behavior as already live.

## Verified starting point

| Existing seam                                            | What to preserve and extend                                                                                                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/mote-machine.tsx`, `components/mote-machine/`       | Full-page Rosie/Barn machine, native/web adapters, pending-request storage, receipt-first presentation, failure handling.                                                                           |
| `utils/moteMachine.ts`, `utils/moteMachineAcceptance.ts` | Typed current RPCs and development-only acceptance fixtures.                                                                                                                                        |
| `20260829000000_contraptions_and_streaks.sql`            | One Mote guarantees 1/2/3/5 Acorns, weighted 50/30/15/5%; first Acorn unlocks Auto-Tickler. Existing one-argument spin must retain this meaning.                                                    |
| `20260905174000_prestige_mote_rewards.sql`               | Locally implemented five Motes per prestige lap at tiers 3/8/13/18/23, permanent rank 3+, reached current-lap catch-up. Last handoff says unapplied; inspect actual linked history before using it. |
| `docs/rive-mote-machine-authoring.md`                    | Bundled Rive, legacy numeric selectors, source provenance and repair gates. September 5 runtime passed 4.3-second full motion and repeated reduced-motion selectors.                                |
| `app/contraptions.tsx`                                   | Existing Acorn inventory and one-day/one-week Auto-Tickler activation. Wager wins that contain Acorns use this same inventory.                                                                      |

The last implementation handoff records passing local checks, not a public
release. A fresh editable `.rev` and current installed-device acceptance
remain open. Recheck the working tree, server migration state, and asset
hashes before editing; there is substantial unrelated work in this checkout.

## Player experience

1. Enter from Season's Mote card, an earned-Mote confirmation, or the Barn's
   machine entry if housing exists. Confirmed wallet and inventory are visible.
2. Choose Reveal or Wager. Reveal states its guaranteed Acorn reward. Wager
   explains that a play can lose its entire stake and shows **Paytable**.
3. Wager stakes are **1, 3, or 5 Motes**; default to 1, retain only within the
   visit, and disable unaffordable options. Changing stake changes displayed
   amounts, not odds. No hidden default to the largest stake.
4. The accessible action reads **Wager N Motes**. The authored lever invokes
   the same command. One press persists the request and freezes mode/stake.
5. Show only **Commit Pending** while obtaining the authoritative receipt:
   a pressed control and quiet lamp hold, with no disappearing Motes or reel
   movement. Confirmation starts Deposit and the full authored spin. No result can be rerolled
   by a gesture, closing the page, changing motion preference, or disconnecting.
6. Present exact total returned, net Mote change, any Acorns, and wallet. A
   returned stake is neutral; it must not look or sound like a profitable win.
7. Hold the result until the player chooses the next action. Offer another
   explicit wager, Paytable, History, Inventory when relevant, and Back. An
   Acorn unlock receives one extra Auto-Tickler introduction, not another roll.
8. At insufficient balance, show earning routes (Shimmer Pockets and eligible
   prestige tiers), preserve the result, and let the player leave normally.

History lists the caller's recent plays, mode, stake, total return, net change,
resources, timestamp and rules version. Show 20 initially with cursor paging;
keep durable receipts independently of this display limit. No public loss
feed, spending leaderboard, loss-recovery prompts, or urgency countdowns.
These are product decisions for a calm game experience, not assertions about
store approval.

## Proposed Wager paytable v1

One center payline, one weighted outcome per play. Multiply both reward
columns by the selected stake. **Total Motes returned includes any returned
stake**; net Motes equals returned minus staked. Acorns are a separate resource.

| Outcome key      | Probability | Total Motes returned per Mote staked | Acorns per Mote staked | Presentation                                             |
| ---------------- | ----------: | -----------------------------------: | ---------------------: | -------------------------------------------------------- |
| `loss`           |         50% |                                    0 |                      0 | Nonmatching payline; brief neutral loss, no win fanfare. |
| `returned_stake` |         25% |                                    1 |                      0 | Neutral return pattern; “Stake returned.”                |
| `small`          |         18% |                                    2 |                      0 | Matching low-value symbols; modest win.                  |
| `big`            |          6% |                                    3 |                      1 | Matching Acorns; larger win and real resource transfer.  |
| `jackpot`        |          1% |                                   10 |                      5 | Matching Rosie crests; full jackpot suite.               |

Examples: stake 3 and lose → debit 3, return 0, net −3. Stake 3 and get
`returned_stake` → debit 3, return 3, net 0. Stake 3 and get `big` → debit 3,
return 9, net +6, plus 3 Acorns. Acorns are granted even when the Auto-Tickler
is already unlocked.

Use integer weights **5000/2500/1800/600/100**, total 10,000. Expected gross
Mote return is `0.25 + 0.18×2 + 0.06×3 + 0.01×10 = 0.89` per Mote staked.
Expected net Mote change is **−0.11**; expected Acorns are
`0.06×1 + 0.01×5 = 0.11` per Mote staked. The 89% figure concerns Motes only;
it is not cash RTP and does not value Acorns. Existing Reveal has expected
**1.8 Acorns** for a spent Mote. Keep both calculations in a checked economy
report so changes in one mode cannot silently undermine the other.

Freeze these proposed Wager symbol IDs in the v4 manifest before authoring:
`clover=0`, `mote=1`, `acorn=2`, `rosie_crest=3`. Returned stake uses `[0,0,0]`,
Small `[1,1,1]`, Big `[2,2,2]`, and Jackpot `[3,3,3]`. Loss selects uniformly
among `[0,1,2]`, `[1,2,3]`, `[2,3,0]`, `[3,0,1]` **after** the loss outcome
is drawn; all three symbols differ. Thus there are no authored two-match
near-miss losses. These are outcome-conditioned reel presentations, not three
independently sampled reels. The table describes the real game probabilities.
The Rosie crest is new art, not an existing V3 symbol. Preserve the legacy
Reveal strip/mapping as a distinct manifest bank; share decoded image assets
between strip instances rather than duplicating image payloads.

These odds are a starting configuration for playtesting. Before enabling,
simulate short sessions and wallet depletion for representative starting
balances, report distribution and variance, and evaluate whether five earned
prestige Motes feel worthwhile. Tune by publishing a new immutable rules
version; do not silently alter a table the player already agreed to use.
No personalized odds, loss-streak adjustments, undisclosed pity system, or
outcomes influenced by spend history. The displayed paytable uses the same
versioned configuration as settlement.

## Game authority and persistence

Use a new versioned play endpoint; do not reinterpret
`spin_mote_machine(p_request_id)` as a wager. Illustrative interfaces:

- `mote_game_state()` returns supported modes, allowed stakes, current rules
  version/paytable, confirmed wallet and wallet revision, inventory summary,
  and server feature availability.
- `play_mote_game(request_id, mode, stake, expected_rules_version)` commits
  exactly one play. No client-supplied user, outcome, amount, odds, or reel seed.
- `mote_play_receipt(request_id)` performs an owner-only lookup for recovery;
  checking it never creates a new play.
- `mote_play_history(cursor, limit)` returns only caller-owned receipts with a
  bounded server limit. Exact SQL names may change before integration.

Store immutable rules rows and append-only play receipts with user, request,
mode, stake, rules version, outcome key, exact reel stops, total Motes returned,
net change, resource grants, unlock facts, settled wallet balance/revision,
timestamp and presentation-contract version. Enforce unique `(user, request)`.
Represent zero rewards explicitly; old positive-only `resource_amount` checks
cannot express Wager losses. Prefer a dedicated v2 receipt table and an
adapter for history over rewriting the meaning of historical v1 columns.

Settlement runs in one transaction:

1. Authenticate, validate bounded inputs, lock the caller's profile, and
   recheck the receipt. Existing matching receipt wins over current flags,
   funds, or table changes. Same ID with different payload is
   `request_conflict`, never a second play.
2. For a new play, verify mode availability, exact immutable rules version,
   allowed stake, balance, and reward catalog before a debit. A table change
   returns `rules_changed` with no mutation; refresh the visible paytable.
3. Draw from the server-only integer-weighted outcome table. Use a tested
   uniform random source and unbiased mapping to the 10,000 buckets. Freeze
   a canonical permitted reel-stop combination for that outcome in the receipt.
4. Debit stake and credit total Mote return atomically. Zero-return losses
   still produce successful settlement receipts. Upsert Acorns/unlocks only
   for positive grants, respecting the current Contraption ownership model.
5. Record the complete immutable receipt and return it with a separate current
   wallet snapshot. Any exception rolls back debit, returns, grants and receipt.

Keep profile-first lock order compatible with prestige claims, Reveal and
spending. Document and test the complete order when inventory rows are involved.
Do not introduce a second writable Mote balance. Protect catalog and receipt
tables with RLS, revoke client mutation, and grant only the intended RPCs.
Amounts must be bounded safe integers, with overflow rejected before mutation.

Add a monotonic Mote-wallet revision updated centrally for **every** balance
change, including Shimmers, prestige claims and legacy Reveal. Do not overwrite
a new wallet with a replayed receipt's historical balance. Historical receipt
facts remain unchanged; the response envelope can separately carry the current
balance/revision. Preserve old response fields for existing clients.

No-spin-progress rule: Wager settlement adds no XP, Streak credit, season tier
credit, visit credit, or new Motes outside the explicit paytable. Resource
service subsequently follows its existing rules. Preserve outstanding v1
requests using their original endpoint and payload; never retry them as v2.

## Runtime and animation boundary

The [animation suite](23a-mote-animation-suite.md) is a required deliverable,
not a later polish ticket. It covers authored idle, entry, stake/deposit,
lever, spin, three brakes, every outcome, wallet/resource transfer, unlock,
result hold, replay reset, loading/error recovery and reduced-motion variants,
with coordinated Rosie reactions, audio and haptic cue calls. Cue authoring and
integration are required; disabled, unsupported or failed audio/haptic output
is a safe no-op. Rive-owned rows require actual clips; true loading/render
failure rows require native fallback art and code because Rive cannot render
its own load failure.

Implement one presentation adapter from either v1 or v2 receipts to that
versioned Rive contract. Keep exact outcome/reel symbols independent from
celebration intensity. The current `tickles` selector is a legacy visual
mapping, not a payout. New loss/break-even values must not accidentally map to
the old positive-result fallback. Verify runtime version compatibility before
allowing a new wager; an old cached asset must not present the wrong result.

The handshake is explicit: game state/rules return
`required_presentation_version`; the bundled manifest declares its version and
`.riv` hash; the adapter reports ready only after the required V4 bindings load.
Wager commits are enabled only when these agree. A stale/failed runtime exposes
Reload and preserved receipt recovery. Bundle native assets with the client;
serve web assets at a content-hashed URL. Never let an unversioned browser cache
silently satisfy a newer manifest. Server validation still governs settlement;
the presentation check is a client correctness guard, not an authorization
secret.

The bespoke Rosie reactions in the animation suite are required for final
acceptance. Add them to the shared versioned pig rig through its existing
renderer seam; existing reaction mappings are a development fallback only.
Reuse the existing coat/equipment handling and coordinate shared-source edits.

Add machine-local **Sound** and **Haptics** switches in a compact sensory
settings sheet, both on by default and persisted on the device under
`mote_machine_sensory_v1`. Honor hardware silent mode and any existing global
disable if one exists at implementation time. Each switch has native semantics
and current state; toggling it affects the current visit immediately. Reduced
Motion remains independent and also shortens the cue choreography. No new
app-wide sound-settings refactor is required for this feature.

Persist the entire pending command before sending it: user scope, request ID,
mode, stake, rules and protocol versions. While uncertain, disable new plays
and recover the same command. On app restart reconcile receipt state; if no
receipt exists, retry that saved command rather than minting a new ID. Never
delete a pending command because of a timeout. On logout isolate pending data
by account. Handle confirmed results even if the renderer fails after commit.
No repeated award, unlock sound, or wallet increment when resuming a receipt.

Distinguish **Receipt Replay** (recover a committed play) from **Next Play
Reset** (clear the old pose before a newly requested play). Recovery settles
directly to the stored result with at most a quiet recovery cue; it suppresses
win/unlock fanfare, award toasts and celebration haptics. Announce the recovered
result once if not yet announced. Reset grants nothing and never starts the
next command automatically.

Use normal quiet recovery text for network uncertainty. The result remains
readable if animation, audio, haptics, or accessibility announcement fails.
Backgrounding pauses presentation/audio; returning reconciles and settles to
the receipt. Reduced Motion reveals the same exact result without long reel
travel or flashing. Native semantics remain outside opaque canvas graphics.

## Modules and integration boundaries

| Module               | Responsibility and independently testable interface                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Rules and settlement | Versioned paytable, input policy, transactional wallet/resource grants, immutable receipt.                  |
| Play session         | One pending command, recovery, current wallet reconciliation, view-independent state transitions.           |
| Machine presentation | Receipt-to-Rive adapter, clip sequencing, result text, audio/haptics, accessibility and motion preferences. |
| Machine screen       | Mode/stake/paytable/history UI, game navigation and existing inventory handoff.                             |
| Economy verification | Exact paytable arithmetic, deterministic outcome fixtures, seeded simulations and short-session reports.    |

Reuse project RPC, popup, motion, feature-flag, and styling primitives. Extend
focused machine fixtures rather than building a second fake game. Development
controls must be impossible to invoke as production reward-authority inputs.

Housing is optional integration: if its capability exists, its fixed cabinet
hotspot opens this route and its Auto-Tickler display opens existing inventory.
The machine does not read/write housing layouts. Random furniture prizes are
out of this V1 table. A later item grant uses housing's idempotent server-owned
grant API; neither build must wait for the other to complete.

## Verification and acceptance

- Exact table arithmetic, integer weight coverage, mode/stake validation, all
  five outcomes and net/total wording at every stake. Test outcomes through
  controlled harness fixtures, not probabilistic production assertions.
- Transaction rollback, replay after spending winnings, stale rules, same ID
  with altered payload, distinct simultaneous requests, zero wallet,
  concurrent prestige/Shimmer grants and both machine modes. No negative
  wallet, duplicate payout or deadlock. All supported clients retain v1 behavior.
- A lost response, restart, background/resume, account switch, stale wallet
  read, asset mismatch and renderer failure before/after commit. History and
  inventory must match the receipt exactly.
- Every row of the animation manifest captured on current native iOS, plus
  supported web/Android checks. Include small/large phones, large type,
  VoiceOver, Reduced Motion, muted sound, disabled haptics, and repeated plays.
- Archive editable source, reproducible exports, hashes, state-machine tests,
  bindings manifest and full-motion/reduced-motion recordings. Mark missing
  assets/device evidence as open instead of declaring the suite complete.
- Run quality loop during layout/API changes and the required once/full gates
  and Rive gates. Enqueue economy/runtime release follow-ups when implementing.

Local completion means a real end-to-end game on the development client with
every authored state and meaningful database/recovery evidence. Public release
requires the normal explicit database go and release checklist, not just a
passing web fixture or a set of animation names.

## Distribution decision

Changing a cozy game's feature into recurring simulated gambling can change
its audience rating. Apple's current global definitions include frequent
simulated gambling at **18+**; region and OS-specific ratings vary. Complete
the questionnaire for the actual implementation and record the resulting
rating and availability before enabling Wager in a public build. A mode
toggle alone is not evidence of a lower app rating.
[Apple age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/).

The earned-only proposal is a product boundary, not a determination of legal
classification or store acceptance. Audit existing acquisition paths,
including paid energy, XP skips and bundles, before representing all stakes
as disconnected from purchases. Apple's rules address purchased randomized
items and prohibit IAP currency for real-money gaming; Google treats
real-money gambling as a restricted program. If paid stakes or real prizes
are intended, revise that scope and its distribution requirements explicitly.
[Apple review guidelines, 3.1.1 and 5.3](https://developer.apple.com/app-store/review/guidelines/),
[Google Play real-money policy](https://support.google.com/googleplay/android-developer/answer/9877032?hl=en).

Sources checked 2026-09-06. These notes inform the feature's rollout decision;
they do not block independent local animation, data-model, or fixture work.
