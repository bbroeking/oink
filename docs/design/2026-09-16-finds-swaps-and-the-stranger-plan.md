# Finds, Swaps and the Stranger — implementation plan (2026-09-16)

Companion to the spec `2026-09-16-finds-swaps-and-the-stranger.md`. The spec
says *what*; this says *in what order, by whom, and what could go wrong*.
Built by grilling the spec against the codebase — the questions and what they
changed are in §1, because those answers are the plan's foundation.

---

## 1 · The grill — what the codebase said back

| question we asked | what we found | consequence |
|---|---|---|
| Where do swap / Stranger tickles show up in the breakdown? | `tickle_breakdown` has **no ledger table**: each lane sums its own source table, `home_taps` is the residual, latest def is `20260803010000`. Delivery and dig-find tickles already fall into the residual today. | The swap and sale rows *are* the ledger. Two new lanes carried from the latest def; client `utils/tickleBreakdown.ts` + its test grow two slices. Spec corrected. |
| Can the sheep be a seventh `PigId`? | `PigId` is a six-member union bound by `Record<PigId,…>` in the Rive contract, `PigPortrait`, `pigFrames.generated`, and read by the Pen / companion picker. | **No.** Own frame map + own cycler in `StrangerAtHedge.tsx`; never through `PigStage`. Spec corrected. |
| Does the dig receipt carry the layer reached, for the rarity bias? | `rooting_receipts.receipt` does not; only the RPC's return does. Adding it means opening the 470-line submit core. | Layer bias **cut from v1** (deferred in spec §12). The trigger stays a BEFORE INSERT on `rooting_receipts` and the core stays untouched. |
| Is there a push preference / quiet-hours layer to honour? | `send_push_to_user(uuid,title,body,data)` is a bare pg_net post used by 32 migrations; only the feeding push has an opt-in. | Ask pushes: once per `(ask_no, holder)`, ≤5 holders, **≤2 per holder per day**. No preference UI in v1. Spec corrected. |
| Where does the while-away line go? | `system_announcements` INSERT, **inlined** in the RPC (the admin-gated `send_system_announcement` footgun). | Same pattern for the swap line. |
| How big is the visit screen we're adding a tray to? | `components/BarnVisitModal.tsx` is **2,070 lines**; `visit/SatchelStrip.tsx` is 119 and already owns the lift. | The tray is its own component + hook; `BarnVisitModal` gets one mount point and one callback. |
| What does the yard already do for a conditional element? | `components/BuriedMound.tsx` (167 lines) mounts on state, lives on Rosie's ground plane, `box-none` layer. | `StrangerAtHedge.tsx` copies its mount/pointer pattern exactly. |
| How is a migration validated? | `scripts/db-harness/run.sh` on plain Postgres (local `db reset` dies at pg_cron); prep + numbered smokes; `90_satchel_smoke.sql` is the template. | Steps S1–S3 end in a green harness run, not a push. Push waits for "go". |
| How much shelf / bag data exists to migrate? | Prod 2026-09-16: 1 shelf item, 1 delivery, 6 bag items, 3 owners. | Data migration is trivial; no ceremony. |
| How do we test a two-player flow without two phones? | `db query --linked` with `set_config(request.jwt.claims)` as `demo2` / `demohelper1..3`; 16 Pro Max sim + `idb` taps. | C3 uses demohelper1 as the asker, the sim as the filler. |
| Does anything on the Board read deliveries? | `Leaderboard.tsx:319` renders *N delivered* via `satchel_deliveries_for`. | Rename to *N swapped*, RPC `satchel_swaps_for`, keep the old name as a thin alias for one build so a stale client doesn't blank. |
| Which tests already lock these surfaces? | `satchel.test.ts`, `BarnVisitSatchel.test.tsx`, `tickleBreakdown.test.ts`, `fieldGuide*.test.ts`, `pigFrames.test.ts`, `VisitActionBar.test.tsx`. | Each step lists which of these it must keep green and which it extends. |

---

## 2 · Roles

Single-developer repo; the "team" is the founder plus agent lanes. Names are
roles so the plan survives whoever sits in the seat.

| role | who | owns |
|---|---|---|
| **Founder** | Brian | ratifies the spec + log entry, every product call, the DB push "go", Apple-side clicks (Transporter, TestFlight), art approval |
| **Planner / reviewer** | a Fable session | sequencing, spec-vs-code review of each PR, the charter lens, the grill |
| **Server implementer** | an Opus subagent (memory: *Fable plans, Opus implements*) | migration, RPCs, harness prep + smoke, tuning rows |
| **Client implementer** | an Opus subagent (one per PR) | hooks, components, tests, fail-soft contracts |
| **Art lane** | Codex ImageGen + `regen_studio` / `placement_studio`; founder reviews every image | the Stranger sheet, 18 glyphs, family watermarks |
| **QA lane** | sim screenshot pipeline (`idb`), the DB harness, the demo accounts | every checkpoint's evidence |

---

## 3 · Execution plan

Three tracks that can run in parallel after C0; steps are numbered inside
each track. **Deps** name what must be *green*, not merely started.

### Track S — server (one migration, one harness run)

| step | does | deps | owner | done when |
|---|---|---|---|---|
| **S0** ratify | Founder reads spec §0 + §"Resolved", says yes/no to the two amendments; Planner appends the decision-log entry to `SKILL.md` and the glossary rows to `CONTEXT.md` (Ask, Swap, the Stranger; retire Wish / Delivery). | — | Founder, Planner | log entry committed |
| **S1** schema + data | `2026091712xxxx_finds_swaps_stranger.sql` part 1: catalog `ALTER` + 18 inserts + families; `pig_asks`; `satchel_swaps`; `trader_days`, `trader_sales`; `satchel_stacks` view; the three data moves (wishes→asks, deliveries→swaps, shelf→bag); `DROP` `pig_wishes`, `satchel_deliveries`, `pig_shelf`; tuning rows. | S0 | Server impl. | harness applies it after the existing chain (`00u_satchel_prep` + `90_satchel_smoke` still pass **before** the drop, then the new prep takes over) |
| **S2** RPCs | Part 2: `my_satchel` (rewritten), `set_my_ask`, `clear_my_ask`, `reroll_my_wish` (retargeted), `friend_asks`, `my_matches`, `swap_with_host`, `trader_today` + `_trader_today()` lazy insert, `trade_with_stranger`, `satchel_swaps_for` (+ `satchel_deliveries_for` alias), the rewritten `rooting_receipts_roll_satchel` trigger, `_ask_options()` as **one SQL function** the client never reimplements. Every refusal reason from spec §6 as a named string. | S1 | Server impl. | `95_finds_swaps_stranger_smoke.sql` green: partial stack, option gone, ask changed, two fillers (two sessions in the harness via `set_config`), nonce replay, day-cap rollover, gift to full bag, unfriended, retired find |
| **S3** breakdown + pushes | Carry `tickle_breakdown` from `20260803010000` and add `swaps` + `stranger` lanes; ask push fan-out (`send_push_to_user`, once per `(ask_no, holder)`, ≤5, ≤2/holder/day, table `ask_push_log`); swap while-away line inlined. | S2 | Server impl. | breakdown smoke: residual unchanged for a user with no swaps; a user with one paid swap shows 3 in `swaps` and `home_taps` unchanged |
| **S4** review + push | Planner reviews the migration against spec §4–§6 line by line (the carry-latest-def check on `tickle_breakdown` and on `my_satchel`'s callers); Founder says "go"; `npx supabase db push`; prod read-back (`db query --linked`: counts, one `trader_today()`, one `my_satchel()` as demo2). | S3, C1 | Planner, Founder | prod answers; app on the store still works (every read fail-soft is the guarantee — verify by opening build 190 against the pushed DB) |

### Track A — art (parallel from S0)

| step | does | deps | owner | done when |
|---|---|---|---|---|
| **A1** the Stranger sheet | Prompt with Rosie `idle_1.png` as style/camera anchor, sheep body in her proportions, hood hiding the eyes, palette hexes in the prompt, 4×N magenta grid; families idle(12) · walk · take · shake · face. Slice (`slice_sheet.py`), strip discs/specks, `normalize_body_cream.py` (new, sibling of `normalize_body_pink.py`). Three ImageGen runs in parallel (~10 min), one review pass. | S0 | Art lane, Founder approves | frames in `assets/images/sprites/stranger/`, `constants/strangerFrames.ts`, counts locked by a new `strangerFrames.test.ts` |
| **A2** 18 find glyphs + 5 family watermarks | Same lane and placement as the first twelve (`assets/images/glyphs/finds/`); `regen_studio` for redo/decline; founder reviews the sheet of 18 at once. | S0 | Art lane, Founder | `FindArt.tsx` map covers all 30 ids; a test asserts every catalog id has art |
| **A3** copy | The Stranger's rotating lines (server list in `app_settings.trader_lines`), receipt strings for every refusal reason, the Field Guide entries (whimsy line + honest line, numbers from tuning). | S0 | Planner drafts, Founder edits | strings in one `constants/strangerCopy.ts` + `fieldGuide.ts` rows, no inline literals |

### Track C — client (three PRs, each fail-soft against a server without the next)

| step | does | deps | owner | done when |
|---|---|---|---|---|
| **C1** catalog + bag + Ask | `constants/satchel.ts` → 30 ids + families; `utils/satchel.ts` tuning cell grows (cap 12, odds 1/2/3, caps); `hooks/useSatchel.ts` parses stacks + ask + stranger fields (all optional); `SatchelSheet.tsx` → segments Bag · Swaps · Every find, stacks with counts, set-ready tag; new `AskSheet.tsx` (chip grid, ×1–3, anything/pick); Barn fan row *7 of 12*; dig receipt line for 1–3 finds. Tests: `satchel.test.ts` (parsers, stack aggregate, set-ready), `askSheet.test.tsx`. | S2 (for the contract; builds against the harness DB), A2 for art | Client impl. | sim: dig → receipt shows 2 finds → bag shows stacks → set an ask ×2 offering "anything" → bubble reads back. `npm run lint` scorecard stays 0. |
| **C2** the swap | `components/visit/OfferTray.tsx` + `hooks/useSwap.ts` (calls `swap_with_host`, handles every reason → copy); `SatchelStrip` tap opens the tray instead of firing; the bubble shows ×N; nap-card *Swap*; Swaps segment rows → `router.push` into the visit with `swap=1`; Inbox row; Board *N swapped*; `tickleBreakdown.ts` slices `swaps` + `stranger`; friend-row mark reads `friend_asks`. Tests: `BarnVisitSatchel.test.tsx` (tray opens, option tap calls with `ask_no` + nonce, `option_gone` redraws), `tickleBreakdown.test.ts`, `offerTray.test.tsx` (copy per reason). | C1, S3 | Client impl. | **two-account run** (C3 checkpoint): demohelper1 sets an ask via `db query --linked` as that user; the sim (demo account) sees *you have it*, visits, sees three options, swaps; helper's bag shows the taken find; both breakdowns show +3 |
| **C3** the Stranger | `components/StrangerAtHedge.tsx` (mount on `set_ready ∧ sets_left`, walk-in/out, `box-none` layer — the `BuriedMound` pattern); `StrangerSheet.tsx` (line, stacks lifted at ≥3, confirm pill, coin count-up via the dig-tally component); `hooks/useStranger.ts`; Field Guide entries (silhouette until `met`); Satchel-sheet "fancies" line once met. Tests: `strangerAtHedge.test.tsx` (mount/unmount rules), `strangerFrames.test.ts`, `fieldGuide.test.ts`. | C1, S2, A1, A3 | Client impl. | sim: hold three pebbles → sheep walks in → sell → coin ticks 38→43 → third sale → sheep leaves; Field Guide entry lifted |
| **C4** polish + build | Design-taste pass (`docs/design/taste-standard.md` two questions on the tray, the Ask sheet, the Stranger sheet); scorecard 0; changelog `docs/builds/YYYY-MM-DD-build-N.md` **before** the build; `eas build --local` with the Sentry token sourced and the 16 GB heap; Transporter. | C1–C3, S4 | Client impl., Founder | TestFlight build N installed on the founder's phone; one real swap with a real friend |

---

## 4 · Dependencies at a glance

```
S0 ─┬─ S1 ─ S2 ─ S3 ─ S4 (push, needs "go") ─┐
    ├─ A1 ──────────────┐                     │
    ├─ A2 ─┐            │                     │
    └─ A3 ─┤            │                     │
           C1 ── C2 ────┼─────────────────────┤
                 C3 ◄───┘                     │
                        C4 (build) ◄──────────┘
```

C1 starts against the harness DB as soon as S2 is green; C2/C3 are
client-complete before S4, but the **two-account checkpoint (C3) needs prod
or a staging DB with two real users** — the harness has no auth users. Order
therefore: S4 push first, then the two-account run, then build.

---

## 5 · Risks and de-risking

| # | risk | likelihood / impact | what we do |
|---|---|---|---|
| R1 | **Carry-latest-def regression** — a `CREATE OR REPLACE` of `tickle_breakdown` or `my_satchel` from a stale base silently drops a later feature (the build-93 referral-gate lesson). | med / high | Server impl. must `grep -l` the latest def of every function it replaces and diff against it in the PR description; Planner's S4 review checks that diff, not the migration alone. |
| R2 | **Dropping `pig_wishes` / `satchel_deliveries` breaks the shipped client** (build 190 in the wild calls `fulfil_pig_wish`, `friend_wishes`, `satchel_deliveries_for`). | high / med | Keep those three names as **thin aliases** over the new tables for one release (`fulfil_pig_wish` = gift; `friend_wishes` = asks projected to the old shape; `satchel_deliveries_for` = swaps given). Drop the aliases in the migration after the build that follows. Every client read is already fail-soft; verify by running build 190 against the pushed DB (S4). |
| R3 | **Two fillers of one ask race** (or one filler double-taps) and a find is duplicated or lost. | low / high | Advisory lock per asker, `FOR UPDATE` on both item rows, unit uniqueness, nonce replay — and a harness smoke that runs two sessions in one transaction stream (`set_config` swap mid-file). No SKIP LOCKED anywhere. |
| R4 | **The options rule diverges** between the SQL that validates and the client that displays, so a filler taps something the server refuses. | med / med | One SQL function `_ask_options(asker, ask_no)`; the client renders what `friend_asks` returns and never recomputes; `not_offered` is a bug-report reason, logged to Sentry as an error, not a toast. |
| R5 | **A sheep in the pig pickers** if the Stranger becomes a `PigId`. | — (now) | Decided: own frame map, own component, never `PigStage`. `strangerFrames.test.ts` asserts `"stranger"` ∉ `PIG_IDS`. |
| R6 | **Exterior regression** — the yard's `box-none` overlay and z-order (the build-99 dead-Barn footgun); a sheep sprite that eats taps on Rosie or the Barn button. | med / high | Copy `BuriedMound`'s pointer setup verbatim; the sim checkpoint taps Rosie, the button and the mound *with the sheep present*. |
| R7 | **Metro stale watcher** makes a screenshot lie about a new component. | high / low | Restart Metro per edit batch; verify the entry bundle contains `StrangerAtHedge` before trusting a screenshot (memory). |
| R8 | **Art drift** — the sheep reads as a different game (baked ground disc, wrong palette, eyes showing). | med / med | Hexes in the prompt; disc/speck strip scripts; the founder rejects any frame where an eye is visible; `normalize_body_cream.py --check` ΔE ≤ 2. |
| R9 | **Tuning is wrong on day one** (sets too rare or too common; the Stranger reads as a faucet). | med / low | Everything is `app_settings` — cap, odds, prices, day cap, pair caps — with compiled fallbacks; `tools/balance_finds.py` is rerun with the live numbers after week one; no build needed to retune. |
| R10 | **Push fatigue** — no preference layer exists; ask pushes could feel like spam. | med / med | ≤2 ask pushes per holder per day, Sounder-mates first, never for a `rolled` ask (only `set` ones — a pig's own fancy is not a friend's obligation). Watch the ask→swap conversion in week one; if < 10 %, cut the push. |
| R11 | **Breakdown residual shifts** and a player's home-tap number appears to drop. | low / low | The new lanes are additive from the migration timestamp forward; nothing retroactive. State it in the changelog. |
| R12 | **The Ask picker leaks the catalog** before a player has met a find (Collect's silhouette ceremony). | low / low | Chips for unmet finds render as silhouettes; picking one is allowed (spec §3.1), the reveal still fires on first carry. |
| R13 | **Scope creep** — "three different for one up", Sounder asks, layer bias. | med / med | All three named in spec §12 with a trigger; the Planner rejects them in review by pointing at the section. |

---

## 6 · Timeline and checkpoints

Founder time is the constraint, not agent time. Working days, starting the
day after S0.

| day | checkpoint | evidence |
|---|---|---|
| 0 | **C0 · ratified** | log entry in `SKILL.md`, glossary rows in `CONTEXT.md` |
| 1–2 | **C1 · migration green in the harness** | `run.sh` exit 0 through `95_…_smoke`; the S3 breakdown smoke; PR with the carry-latest diffs attached. Art A1/A2 prompts fired day 1; founder reviews the sheet + glyphs day 2. |
| 3–4 | **C2 · Ask on the sim** | screenshots: receipt with 2 finds, stacks, the Ask sheet, the bubble reading back; scorecard 0; tests green |
| 5 | **S4 · prod push** (founder "go") | prod read-back; build 190 opened against the new DB with no blank surfaces |
| 6–7 | **C3 · a swap between two accounts** | demohelper1 asks (via `db query --linked`), the sim fills; both bags, both breakdowns, the while-away line, the Inbox row, *1 swapped* on the Board |
| 8–9 | **C4 · the Stranger on the sim** | walk-in on the third pebble, sale tally, walk-out at cap, Field Guide lifted; Rosie / button / mound still tappable with the sheep present |
| 10 | **C5 · build N on TestFlight** | changelog written before the build; Transporter; founder does one real swap with a real friend |
| 17 | **C6 · week-one tuning review** | `balance_finds.py` rerun with live numbers; ask→swap conversion; sets/day; decide on the ask push (R10) and whether to drop the R2 aliases in the next migration |

Ten working days to TestFlight if the founder reviews art on day 2 and pushes
on day 5; each checkpoint is a place to stop without half a feature in the
wild, because every client read is fail-soft and the server ships first.

---

## 7 · End-to-end checklist

Tick every line before C5. Grouped by the five things the spec promised.

**Data models**
- [ ] `satchel_finds`: 30 rows, `family`, `retired`, `flavor`; marble → common; `constants/satchel.ts` mirrors ids + families (test)
- [ ] `satchel_items.source` ∈ dig / swap / gift / migrated_shelf; `satchel_stacks` view
- [ ] `pig_asks` with `ask_no`, `qty_wanted/filled`, `give_mode`, `give_find_ids`, `source`, the want-not-offered CHECK
- [ ] `satchel_swaps` with `nonce` UNIQUE, per-unit uniqueness, both tickle columns
- [ ] `trader_days` (lazy, seeded, ON CONFLICT DO NOTHING) + `trader_sales`
- [ ] `ask_push_log` (ask_no, holder, day)
- [ ] data moves: wishes → asks, deliveries → swaps, shelf → bag; old tables dropped; aliases kept (R2)
- [ ] tuning rows `satchel_tuning` (extended) + `trader_tuning` + `trader_lines`; compiled fallbacks in `constants/satchel.ts`, `constants/trader.ts`

**Server rules**
- [ ] every mutation: auth, nonce replay returns the original receipt, tuning read inside the tx
- [ ] `swap_with_host` checks in spec §6.2 order; every reason string has a client string
- [ ] `_ask_options` is one SQL function; client never recomputes
- [ ] advisory locks: `ask:<host>` and `trader:<uid>`
- [ ] paid-swap caps per pair and per pig; unpaid swaps still move
- [ ] gift: generous tick + `host_bag_full`; swap: no cap check, no generous tick
- [ ] `trade_with_stranger`: exact three oldest, day cap on tx `now()`, want ×2 only when `find = trader_days.want_find_id`
- [ ] `tickle_breakdown` carried from `20260803010000` + `swaps` + `stranger` lanes; residual unchanged for untouched users
- [ ] pushes: ask (once per ask_no per holder, ≤5, ≤2/holder/day, `set` asks only) and swap-received
- [ ] while-away `system_announcements` INSERT inlined (never `send_system_announcement`)
- [ ] dig trigger: 1/2/3, cap 12, `found` + `lost` on the receipt, core untouched
- [ ] harness: prep + `95_…_smoke` cover partial stack · option gone · ask changed · two fillers · nonce replay · cap rollover · gift to full bag · unfriended · retired find · breakdown lanes

**UI / UX**
- [ ] dig receipt line lists 1–3 finds and what stayed in the mud
- [ ] Barn fan: *Satchel · N of 12*, dot on set-ready or match
- [ ] Satchel sheet: Bag · Swaps · Every find; bubble pinned; stacks with counts; set-ready tag; hold-to-Toss; the Stranger line once met
- [ ] Ask sheet: chip grid (silhouettes pickable), ×1–3 (defaults to what completes a set), anything / pick, *Let Rosie pick*
- [ ] friend row: *you have it* mark from `friend_asks`
- [ ] visit: bubble with ×N; strip lifts matches; **offer tray** with ≤3 options + *just give it*; receipt sheet; nap card *Swap*; swap-only visit when the window is spent
- [ ] Inbox row per swap received; Board *N swapped*; breakdown slices *swaps* and *the Stranger*
- [ ] Exterior: `StrangerAtHedge` mounts on `set_ready ∧ sets_left`, walk-in/out, `box-none`, Rosie / button / mound still tappable
- [ ] Stranger sheet: line, lifted stacks, confirm pill, coin count-up, cap state
- [ ] Field Guide: *the Satchel* (updated), *the Stranger*, *a swap* — silhouettes until met; numbers from tuning
- [ ] no emoji, no inline hex/size/radius; tokens + primitives; scorecard 0; `lint:web` green
- [ ] copy for every refusal reason (`ask_changed`, `ask_filled`, `option_gone`, `not_offered`, `host_bag_full`, `wrong_find`, `not_friends`, `blocked`, `short_stack`, `enough_for_today`, `unknown_find`, `retired_find`)

**Edge cases (each has a test or a smoke)**
- [ ] partial stack at the Stranger · partial ask (×3, one filled, same `ask_no`)
- [ ] option gone → fresh options, nothing moved · ask changed → live ask · ask filled → next fancy
- [ ] two fillers · nonce replay · gift to full bag · unfriended / blocked mid-visit
- [ ] UTC midnight during a sale · want rolled that nobody holds · cap lowered below a bag
- [ ] retired find still swappable/sellable, never rolled/asked/wanted
- [ ] stale client catalog → unknown-find glyph · stale Stranger presence → `short_stack` / `enough_for_today` and walk-off
- [ ] alt-account and ask-flipping bounded by the pair/pig caps and once-per-`ask_no` pushes; tray shuffling impossible (pure function of `ask_no` + bag)
- [ ] server without the feature: no bubble, no tray, no sheep, no receipt line

**Art**
- [ ] Stranger sheet: idle 12 · walk 4 · take 4 · shake 4 · face 4; no eyes visible in any frame; no ground disc; cream band ΔE ≤ 2; counts locked by test; `"stranger"` ∉ `PIG_IDS`
- [ ] 18 glyphs + 5 family watermarks through the finds lane; every catalog id has art (test)
- [ ] founder has seen every generated image (memory: always show generated images)

**Ship**
- [ ] `SKILL.md` log entry + `CONTEXT.md` glossary (Ask, Swap, Options, the Stranger; Wish/Delivery/shelf retired)
- [ ] spec §11 harness scripts committed; `tools/balance_finds.py` rerun with live tuning after week one
- [ ] changelog before build; local build; Transporter; TestFlight; one real swap
- [ ] follow-up migration scheduled to drop the R2 aliases after the next build
