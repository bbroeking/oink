# Pig errands — build brief (Build 1, 2026-09-18)

**Read this first in a fresh session.** It is the complete, self-contained instruction set for building Build 1 of the scavenging pigs — the Errand. Background lives in `docs/design/scavenging-plan-2026-09-17.md` (the plan and rulings), `docs/pig-errands-spec.md` (the step spec), and the canvas `docs/design/claude-design/errand-2026-09-17/` (the boards); this brief restates what matters so nothing depends on the old conversation. House rules that bind every step: `CLAUDE.md` (no `db push` without an explicit "push it now"; Metro needs `NODE_OPTIONS="--max-old-space-size=16384"` and a restart per edit batch; local builds only; changelog before a build), `SKILL.md` (the charter lens), `docs/design/taste-standard.md` (tokens only, primitives only, no emoji).

---

## 1. Goal and deliverables

**Goal.** The Pen stops being a one-time purchase screen and becomes a daily errand board: a player sends a pig (Rosie, or a Slop Club companion) to look for one of the twelve countryside Finds — usually the one a friend's pig is wishing for — and hours later the pig comes home with it or without it. The return is a *moment* (the reward-return framework, already built), and the Find goes to the friend (the existing gift swap) or into the player's Satchel. Nothing new is minted, nothing touches the dig or the season race, and a free player's Rosie can do everything a member's companion can.

**One sentence.** Send a pig to look for a Find; hours later it comes back with it or without it; give it to the friend who wished for it, or keep it.

**Deliverables (Build 1 only — every pig is a generic worker; stats, families, sets, and the Trader's new offers are Builds 2–3 and are NOT in scope):**

1. **Server** — one additive migration: `pig_errands` table, tuning row `app_settings.errand_tuning` (flag off), RPCs `send_pig` · `pig_errands` · `claim_errand` · `recall_pig` · `dev_summon_return`, a push at return time through `send_push_to_user` with `screen = 'pen'`. Written and validated on the stubbed-Postgres harness; **not pushed** until told.
2. **Client** — `constants/errands.ts` + `utils/errands.ts` (config cell, pure rules) + `hooks/usePigErrands.ts`; the Pen rebuilt around the errand (`components/pen/*`); the homecoming hosted on `components/RewardReturn.tsx`; Home's empty yard while the greeter is out; the `pen` push route; the Friends-row door.
3. **Art** — six walk-out / walk-in strips (one per pig) from the Lounge walk sheets, wired as a render-only variant on the `walk` anchors. (If the pipeline is unavailable this session, the errand ships with the existing `walk` family and the strips are a follow-up — say so.)
4. **Tests** — harness tests for every RPC refusal and the determinism of the roll; unit tests for `utils/errands.ts`; UI tests for the send/revert, the board cap, the homecoming-once rule; the notification-routing guard test gains `pen`.
5. **Docs** — `CONTEXT.md` gains **Errand** and amends **Pig roster**; `SKILL.md` log entry on ship; the build changelog before any build; a Field Guide page `the Pen`.

**Done when:** on the 17 Pro sim with a `is_test` account and `dev_summon_return`, every board on the canvas has a matching screenshot; `npx tsc --noEmit` clean; zero lint errors; the harness suite green; the flag is `false` in the migration.

---

## 2. Rulings the build must honour (settled — do not reopen)

| # | Ruling |
| --- | --- |
| R1 | **Rosie is sendable.** While she is out, Home shows the mound and a sticker *Rosie's out looking · back by 7:40 · tap to visit the Pen*; the tickle target is absent; the Barn button's fan gains a `Rosie · out` row beside the Trader row (never replacing it). A companion is a second worker at the same rate — membership never buys a faucet. |
| R2 | **Only a Find is ever minted by a search.** A "give" is exactly one `swap_with_host` gift (`p_take_find = NULL`) with bag-row `source = 'errand'`. A "keep" is one `satchel_items` insert per result. Postcards are receipts, never items. |
| R3 | **One errand per pig per local day** (the pig's feeding time zone, the rule `_trader_visit_for` uses). **A recall spends the day** and returns empty-handed. **A failed send never spends the day.** |
| R4 | **Picker order:** friends' wishes → your own pig's wish → *anything*. Two entrances (the Pen card pig-first; the Friends row target-first), one confirm ticket. |
| R5 | Every pig has the same pips in Build 1 (`nose 1 · trot 2 · pockets 1 · glint 1`, family `null`) — stored as catalog data per pig so Build 2 is a data change. Trot 2 = 4 h. |
| R11 | **A search never touches Contend.** No Dig Finds, no dig help, no season points, no tickles of its own — a give pays through the swap lane that exists (flat 3 each, the existing per-pair and per-pig daily caps). |
| R12 | **While the greeter is out:** the Auto-Tickler skips the user (`_process_auto_tickler_user` returns 0 when their active pig is out); a visitor sees the same empty-yard sticker, can bless and wish, cannot tickle, and the visit still counts for the Visit Streak; a lapsed member's companion is `pig_resting` (not sendable) while Rosie still goes. |
| — | The Satchel is unbounded (`cap = 9999`, pushed 2026-09-18) — so `bag_full` can no longer happen on keep; keep the branch in the RPC (it is cheap and the cap is tunable) but do not design UI around it. |

---

## 3. Implementation plan (steps, in order)

1. **Tuning + fallback.** `constants/errands.ts` (`ERRAND_TUNING` fallback, `ErrandTuning` type, `ERRAND_PIGS` pips) and `utils/errands.ts` (config cell like `utils/satchel.ts`; pure helpers: `errandDuration(pig)`, `backByLabel(ends_at)`, `errandTargetLabel`, `errandResultCopy`, sanitizer with per-field fallback). Unit tests.
2. **Migration** `20260918120000_pig_errands.sql` — table, tuning row, helpers, RPCs, push, dev RPC, `_process_auto_tickler_user` carried from `20260829000000` **verbatim** plus the away check (carry-latest-def rule: copy the CURRENT body, never an older one), `unlock_field_guide_page` carried from its latest def plus `'pen'`. Validate on `scripts/db-harness/run.sh`. **Do not push.**
3. **Harness tests** for the RPC contract (§5.3) and roll determinism under `ttp.fake_now`.
4. **Push route.** `utils/notificationRouting.ts` gains `pen: "/pen"`; the guard test reads the migration and passes.
5. **Roster + away.** `utils/pigRoster.ts` / `hooks/usePigRoster.ts` learn `away: PigId | null` (from `pig_errands()`); Home's empty yard (`components/Barn.tsx`), the fan row (`components/BarnButton.tsx` `BarnMark` gains `"pen"`), the visit screen's sticker (`app/visit` / `BarnVisitModal`).
6. **The Pen.** `components/pen/{Paddock,FenceRow,PigCard,SendSheet,ErrandTicket,Corkboard,Homecoming}.tsx` + `hooks/usePigErrands.ts`; `components/PigPenView.tsx` composes them and keeps today's join / recruit / home-toggle actions for the states that need them. The Friends row's door (`components/Friends.tsx` or `components/ui/SocialRows.tsx`, wherever a wish is marked today).
7. **Homecoming on `RewardReturn`.** `Homecoming.tsx` is a thin host: maps a `back` errand row to `RewardReturn` props (`pigId`, `carry`, `items`, copy, `onGrant` = `claim_errand(give|keep)`, `target` = the Barn button's measured centre when available, `onDone`).
8. **Art.** Walk strips (see §5.6). Optional this session.
9. **Instrumentation + docs.** Events in the RPC transactions; `CONTEXT.md`; Field Guide page; changelog.
10. **Sim pass.** Metro restart, `is_test` demo account, `dev_summon_return`, screenshots for every canvas board, fix what differs.

---

## 4. Assumptions and open questions

**Assumptions (proceed on these):**
- The Pen route stays `app/pen.tsx` with its `PageHeader`; the view is rebuilt, the route is not.
- Friends' wishes come from the existing `friend_wishes(p_targets uuid[])`; the sounder + friends id list comes from whatever the Friends tab already loads. No new social RPC.
- The Barn button's fan is the flight target when the Pen is opened from Home; when it is not on screen, `RewardReturn`'s default corner target is fine.
- `errand_tuning.enabled=false` in the migration; `is_test` profiles get the feature through a per-profile override in `pig_errands()` (same gate as `dev_summon_trader`: `profiles.is_test`).
- Reduce Motion: the walk out / walk in are cuts; the rest of the Pen is the Sticker vocabulary already in use.

**Open (decide while building, note the choice in the changelog):**
1. The walk strips: build them now (one Codex ImageGen pass per pig) or ship with the front `walk` family and add the strips in the next build. Default: ship without, note it.
2. Give-from-the-board: tapping a corkboard pin opens the full homecoming (default) rather than a bare Give/Keep.
3. Copy for the push body when the result is empty: *"Back from the hedge — come and see."* (never reveals empty hands in the notification).

---

## 5. Concrete implementation

### 5.1 `constants/errands.ts` (new)

```ts
export type ErrandPigStats = { nose: 1|2|3; trot: 1|2|3; pockets: 1|2|3; glint: 1|2|3; family: "brook"|"hedge"|"meadow"|"lost"|null };
export interface ErrandTuning {
  enabled: boolean;
  durationHours: { trot1: number; trot2: number; trot3: number };   // 6 / 4 / 2
  targetOddsPts: { common: number; uncommon: number; rare: number }; // 60 / 40 / 20
  noseBonusPts: { 1: number; 2: number; 3: number };                 // 0 / 10 / 20
  anythingWeights: { glint1: [number,number,number]; glint2: …; glint3: … }; // [70,25,5] / [60,30,10] / [50,35,15]
  distractedPts: number;                                             // 10
  boardCap: number;                                                  // 3
  pigs: Record<PigId, ErrandPigStats>;                               // all 1·2·1·1·null in Build 1
}
export const ERRAND_TUNING: Readonly<ErrandTuning> = Object.freeze({ enabled: false, … });
export type ErrandStatus = "out" | "back" | "kept" | "given" | "recalled";
export interface ErrandRow { id: number; pig_id: PigId; target_find_id: SatchelFindId | null; for_user_id: string | null; for_wish_no: number | null; started_at: string; ends_at: string; status: ErrandStatus; result_find_ids: SatchelFindId[]; }
```

### 5.2 `utils/errands.ts` (new) — mirrors `utils/satchel.ts`

- `sanitizeErrandTuning(raw)` per-field fallback; `errandTuning()` via `createConfigCell("errand_tuning", …)` (see how `utils/satchel.ts` wires `app_settings`).
- `errandDurationMs(pig, tuning)`; `backByLabel(endsAtIso, now)` → *"back by 7:40pm"* / *"back tomorrow 7:40am"*; `targetLabel(row)` → *"looking for a blue feather · for Maya's Pickles"*; `homecomingCopy(row, friendName)` → `{ kicker, title, body, primaryLabel, secondaryLabel, grantedLine }` for `RewardReturn` (see §5.5 for the exact strings); `resultItems(row)` → `RewardItem[]`.
- RPC wrappers with `rpcAction`/`rpc` from `utils/rpc.ts`: `sendPig`, `fetchPigErrands`, `claimErrand`, `recallPig`, `devSummonReturn`.

### 5.3 Migration `supabase/migrations/20260918120000_pig_errands.sql`

Header comment in the house style (what/why/steps, "Authored for review; do not push without Brian's explicit go"). Steps:

1. **Tuning row** — `INSERT … ON CONFLICT (key) DO UPDATE` merging the JSON from §5.1 (with `"enabled": false`). Helper `public._errand_tuning()` returns the row merged over the fallback (copy `_satchel_tuning()`'s shape).
2. **Table**
   ```sql
   CREATE TABLE public.pig_errands (
     id bigserial PRIMARY KEY,
     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     pig_id text NOT NULL CHECK (pig_id IN ('rosie','copper','pepper','bandit','pickles','biscuit')),
     target_find_id text NULL REFERENCES public.satchel_finds(id),
     for_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
     for_wish_no bigint NULL,
     local_day date NOT NULL,
     started_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
     seed text NOT NULL,
     status text NOT NULL CHECK (status IN ('out','back','kept','given','recalled')),
     result_find_ids text[] NOT NULL DEFAULT '{}',
     resolved_at timestamptz NULL, claimed_at timestamptz NULL, notified_at timestamptz NULL,
     nonce uuid NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (user_id, pig_id, local_day),
     UNIQUE (user_id, nonce)
   );
   ```
   RLS on; owner `SELECT` policy; no direct writes.
3. `satchel_items_source_check` → add `'errand'` (carry the CHECK with the four existing values plus the new one).
4. **Helpers** (all `SECURITY DEFINER`, `REVOKE … FROM PUBLIC, anon, authenticated`):
   - `_errand_zone(uid)` — the same zone lookup `trader_status()` uses; `_errand_local_day(uid, at)` = `(at AT TIME ZONE zone)::date`.
   - `_errand_unit(text) → double precision` — reuse `_trader_unit` (hash → [0,1)).
   - `_errand_roll(seed text, target text, pig text, t jsonb) RETURNS text[]` — pure: if target: `u1 = _errand_unit(seed||':find')`; hit when `u1*100 < target_odds_pts[rarity(target)] + nose_bonus_pts[nose]` (Build 1 nose = 1 → +0) → `{target}`; else if `_errand_unit(seed||':distracted')*100 < distracted_pts` → one find by the pig's glint weights (`_wish_roll`-style weighted pick over `satchel_finds`, seed `seed||':anything'`); else `{}`. If no target: one find by glint weights. Pockets > 1 (Build 2) may append a second `':second'` roll — implement the loop now, gated by pockets.
   - `_errand_materialise(uid)` — every `out` row with `ends_at <= _patch_now()` → `result_find_ids = _errand_roll(...)`, `status='back'`, `resolved_at`.
   - `_errand_pig_away(uid) RETURNS text` — the active pig's id when it has an `out` row, else NULL (reads `pig_roster`'s active pig the way `activate_pig` stores it).
5. **RPCs** — every one fail-closed `{ok:false, reason}`; time via `_patch_now()`:
   - `send_pig(p_pig text, p_target text DEFAULT NULL, p_for uuid DEFAULT NULL, p_nonce uuid)`: refusals in order `errands_disabled` (flag false and not `is_test`), `pig_unknown`, `pig_resting` (companion of a lapsed member; Rosie never), `pig_already_out`, `errand_used_today` (UNIQUE on local day, checked before insert so the reason is named), `not_friends` (`p_for` given and not a friend — reuse the friendship check `swap_with_host` makes), `target_not_wished` (`p_for`'s live wish ≠ `p_target`; answer carries `{wish: live_find_id}`); same nonce → the original row with `replay:true`. Writes the row; `ends_at = now + duration(trot)`; `seed = md5(uid||pig||local_day||nonce)`. Returns `{ok:true, errand:{…row…}}`.
   - `pig_errands()`: `_errand_materialise(uid)` then returns `{ok:true, enabled, away: pig_id|null, today: {pig_id: used boolean}, out: [rows], board: [back rows newest first LIMIT board_cap], tuning: _errand_tuning()}`.
   - `claim_errand(p_id bigint, p_action text, p_nonce uuid)`: row must be `back` and the caller's (`not_back`); `p_action='keep'` → for each `result_find_ids` insert `satchel_items (user_id, find_id, source='errand')` (respect `_satchel_tuning().cap` with `bag_full` — cannot trigger at 9999 but stays); `p_action='give'` → requires `for_user_id` and one result; calls `swap_with_host(for_user_id, <the just-inserted bag row id>, NULL, for_wish_no, p_nonce)` — i.e. **keep first into the caller's bag, then gift that row**, so the give path is byte-for-byte the existing gift (tickles, caps, ledger, provenance `source='gift'` on the host's row; the caller's row is deleted by the swap as today). Map the swap's refusals: `wrong_find`/`wish_changed` → `wish_moved` (+ the live wish), `host_bag_full` → `host_bag_full`, `already_today` → `wish_moved`. On a refused give the kept row stays in the caller's bag and the errand becomes `kept` — never lost. Sets `status`, `claimed_at`. Nonce replay returns the original answer.
   - `recall_pig(p_id bigint)`: `out` → `recalled`, `result_find_ids='{}'`, `resolved_at=now`; `not_out` otherwise. The UNIQUE row stays (the day is spent).
   - `dev_summon_return(p_id bigint)`: `is_test` only (reuse the `dev_summon_trader` gate): `ends_at = _patch_now()`.
6. **Push** — a cron job every minute (`cron.schedule('pig_errands_returns', '* * * * *', $$SELECT public.sweep_errand_returns()$$)`): for rows `out`/`back` with `ends_at <= now` and `notified_at IS NULL`: `_errand_materialise(user)` then `send_push_to_user(user_id, title, body, jsonb_build_object('screen','pen','errand_id',id))`; title `'{Pig}''s back'`; body `'{He/She} found {the thing} {Friend}''s pig was hoping for.'` when a friend-targeted result hit, else `'Back from the hedge — come and see.'`; set `notified_at`. Pronouns: Rosie/Pepper/Pickles she, Copper/Bandit/Biscuit he (put the map in the SQL and in `utils/pigs.ts`).
7. **Auto-Tickler** — `_process_auto_tickler_user(p_user_id)` carried VERBATIM from `20260829000000_contraptions_and_streaks.sql` with one early `IF public._errand_pig_away(p_user_id) IS NOT NULL THEN RETURN 0; END IF;`.
8. **Field Guide** — `unlock_field_guide_page` carried from its latest def (`20260917170000_ghost_sheep_trader.sql`) with `'pen'` added to the allowed pages.
9. **Analytics** — `errand_sent`, `errand_returned`, `errand_claimed`, `errand_recalled` through the existing analytics-insert helper the trader uses, inside the same transaction.

### 5.4 Client — the Pen

`hooks/usePigErrands.ts`: `{ enabled, away, today, out, board, loading, error, refresh, send(pig, target?, for?), claim(id, action), recall(id), busyId }`; polls on focus and on the push tap; optimistic `send` (adds a local `out` row, reverts on `{ok:false}` with the roster-message toast pattern `showPurchaseToast`).

`components/pen/`:
- `Paddock.tsx` — the sky `Sticker` (reuse the geometry from today's `PigPenView` hero: `HERO_H`, fence rails/posts). Two `PigStage`s at `HERO_PIG`, idle loops (`pigFrozen={false}`); the pig that is `out` is absent; the note sticker's text from `paddockNote(state)`.
- `FenceRow.tsx` — six medallions, Rosie first. States: `home`, `selected` (cream, 4,4 shadow, −1°), `out` (dashed, faded 45%), `back` (sun dot top-right), `resting` (dashed cream2, muted name). 56pt circle on `PIG_ACCENT[pig].tint`, name in `T role="label"`.
- `PigCard.tsx` — `Sticker` paper, `TILT.card`; nameplate `Sticker` on `PIG_ACCENT[pig].solid` with `T role="handDisplay"`; coat `label`; hand line (`"looks anywhere · back in about 4h"` in Build 1); the **job segment** (`SegmentedControl` with `At home · In the Pen · Out looking`; the first two map to today's `activate_pig`; `Out looking` is a readout, disabled as a target); the **one action** by state: non-member → today's gold `Join Slop Club — {pig} moves in`; member-unrecruited → today's lilac `Recruit {pig}` (+ the existing `ConfirmDialog`); sendable → lilac `Send {pig} to look for…`; out → the errand line + ghost `Call {him} home` (a `ConfirmDialog`: *"He'll come back now, empty-handed. Today's errand is spent either way."* / `Call him home` (destructive) / `Let him look` (lilac)); used today → hand line `back tomorrow`; resting → hand line.
- `SendSheet.tsx` — `Sheet` (`components/ui/Sheet`) titled *What should {pig} look for?*; sections `friends' wishes` (rows: friend's pig avatar, `{Friend}'s {Pig}`, `hoping for {withArticle} · {age}`, the find coin), `your pig`, `or` → `Anything`. Rows are `ListRow`-shaped `Sticker`s at 44pt min.
- `ErrandTicket.tsx` — inside the same sheet after a pick: stub (find coin + `cardTitle` name + `for {Friend}'s {Pig}`), `who goes?` pig picker (every pig at home; an out pig dashed *out*), `back by {time} · one errand a day`, gold `Send {pig}`, ghost `Not now`.
- `Corkboard.tsx` — under the fence row when `board.length > 0`: cork-coloured `Sticker` (new token `WHIMSY.cork` — add it to `constants/theme.ts`, do not inline) with a bark label `the board · N waiting`; pins (paper `Sticker` 92pt, red dot, `kickerPillSm` top line `for Maya` / `anything` / `{Pig}`, the find coin or the dizzy glyph, a hand line). Tap → `Homecoming` for that row. At `board_cap`: the card's hand line reads *resting until you look*.
- `Homecoming.tsx` — host for `RewardReturn` (§5.5).

`components/PigPenView.tsx` — replaces the current five-card grid with `Paddock` + `FenceRow` + `Corkboard` + `PigCard`; keeps the `LoadingBeat` (*gathering the pigs*) and the `EmptyState kind="error"` (*Couldn't round up your pigs*) exactly as today.

### 5.5 The homecoming on `RewardReturn`

```tsx
<RewardReturn
  open={!!row}
  pigId={row.pig_id}
  carry={items[0] ?? null}
  items={items}                              // resultItems(row): {id, kind:"find", name}
  kicker={items.length ? "he found it" : "back"}   // pronoun by pig
  title={items.length ? withArticle(items[0]) : "muddy trotters"}
  body={row.for_user_id ? `the one ${friend}'s ${friendPig} is hoping for` : items.length ? "yours to keep or give" : `he looked everywhere; ${target} wasn't there today. ${friend}'s wish is still open.`}
  primaryLabel={row.for_user_id && items.length ? `Give it to ${friend}` : items.length ? "Keep it" : `Ok, ${pigName}`}
  secondaryLabel={row.for_user_id && items.length ? "Keep it" : undefined}
  grantedLine={row.for_user_id ? `${friend}'s pig has its ${name} · you both got 3 tickles` : `in your Satchel · ${count} finds`}
  target={barnButtonCentre ?? null}
  onGrant={() => claim(row.id, giveOrKeep)}      // maps {ok:false, reason} straight through
  onDone={() => { refresh(); close(); }}
/>
```
`secondary` (Keep) calls `claim(row.id, "keep")` **before** `onDone` — a secondary in `RewardReturn` is "skip", so the host performs the keep itself, then closes. Empty hands: primary is `claim(id,"keep")` with an empty result (marks the row `kept`, inserts nothing).

### 5.6 Home, visit, Friends row, push

- `components/Barn.tsx`: when `roster.away === roster.activePigId`, render no `PigStage` — the mound (existing), a paper `Sticker` at `TILT.card` with `cardTitle` *{Pig}'s out looking* and `hand` *back by {time} · tap to visit the Pen* (`router.push("/pen")`); a tap on the empty yard wobbles the sticker (the `Tired` tag's wobble recipe).
- `components/BarnButton.tsx`: `BarnMark` gains `"pen"` (glyph `pen`); fan row `{title: "{Pig} · out", sub: "back by {time}"}` when away, and `{title: "{Pig} · back", sub: "N on the board"}` when the board has pins; `onPress` → `/pen`.
- `app/visit.tsx` / `BarnVisitModal`: when the host's pig is away (add `away` to the visit payload the host's `pig_errands` exposes through the existing visit RPC — or, simpler and acceptable for Build 1, the visit RPC reads `_errand_pig_away(host)`), the same sticker; the tap-tickle bar reads *she's out*; blessing/wish untouched.
- Friends row: on a wish marked today with *you have it* nothing changes; on a wish you cannot fill add the `send a pig` tag (`Tag tone="sun" glyph="pen"`) → `/pen?send=<friendId>` which opens the ticket with `for` preset; on a wish a pig is out for, `Tag tone="muted"` *back ~7:40*.
- `utils/notificationRouting.ts`: `pen: "/pen"`.

### 5.7 Art (walk strips)

`project_lounge_sprite_pipeline` memory + `docs/placement-process.md`: one Codex ImageGen one-shot per pig from its Lounge walk sheet — a 6-frame *walk right* strip; the walk-in is the same strip mirrored (`scaleX: -1` on the stage wrapper, as `facing` does). Slice → strip disc/specks → `normalize_body_pink --check` → register as `walk_out` in `pigRendererContract.ts` sharing the `walk` family's anchors (`pigAnchorAnimation`). If skipped this session, `RewardReturn` and the Paddock use `walk` as they do today.

### 5.8 Tests

- `__tests__/errands.test.ts`: sanitizer per-field fallback; `backByLabel` across midnight; `homecomingCopy` for the four cases (friend hit, anything hit, empty hands, friend-targeted but distracted).
- Harness (`scripts/db-harness`): `send_pig` refusals in order; `errand_used_today` after a recall; replay; `_errand_roll` deterministic under `fake_now`; `claim_errand give` produces exactly one `satchel_swaps` row with `took_find_id NULL` and the host's bag row `source='gift'`; `wish_moved` leaves the row `kept` and the find in the caller's bag; Auto-Tickler returns 0 while away; the sweep enqueues one push per errand.
- UI: `__tests__/PigPen.test.tsx` — optimistic send then revert on `{ok:false}`; board caps at 3; homecoming opens once per `back` row; recall dialog copy.
- `__tests__/notificationRouting.test.ts` guard gains `pen`.

### 5.9 Docs

- `CONTEXT.md`: **Errand** — *a pig sent from the Pen to look for one Find, one per pig per local day, resolved server-side at `ends_at` from a committed seed; a return is claimed as a give (the swap's gift path) or a keep; a recall spends the day. Avoid: quest, mission, expedition.* Amend **Pig roster** (the Pen is the errand board; the home toggle is the job segment).
- `SKILL.md` decision log on ship; `docs/builds/YYYY-MM-DD-build-N.md` before the build; Field Guide page copy: *the Pen — send a pig to look for a Find; back in about {hours}h; one errand a day.*

---

## 6. Order of work for the fresh session

1. Read this brief, `docs/pig-errands-spec.md`, `constants/satchel.ts`, `utils/satchel.ts`, `supabase/migrations/20260917100000_satchel_swaps.sql` (`swap_with_host`), `20260917170000_ghost_sheep_trader.sql` (`trader_status`, `_trader_visit_for`, `dev_summon_trader`), `components/PigPenView.tsx`, `components/RewardReturn.tsx`, `utils/notificationRouting.ts`.
2. Steps 1–4 (tuning, migration, harness tests, route). Stop and report if the harness cannot run.
3. Steps 5–7 (roster/away, the Pen, the homecoming). Restart Metro per batch; screenshot each board.
4. Step 9 docs; changelog.
5. Report: what is built, what was skipped (walk strips?), the sim screenshots, and the one line: *migration written, not pushed*.
