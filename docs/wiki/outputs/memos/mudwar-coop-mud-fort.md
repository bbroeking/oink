---
title: "Build the Mud Fort — co-op staged crew project for Mud Wars"
type: plan
date: 2026-06-14
tags: [plan, mud-wars, co-op, shared-goal, cosmetics, snouts, draft]
status: draft
---

# Build the Mud Fort

> Over a 3-day war, the crew collectively raises a staged Mud Fort — a visibly-growing structure that doubles as the progress bar — and the winning crew keeps it forever as a war-tagged cosmetic.

This is a **capped co-op BONUS layered on top of the existing daily sling**, not a replacement. The base war (flat-20 sling, per-capita-average, quorum-2, `war_winner_regen`) is untouched and remains the spine; the Fort is a second, *cooperative-inside* track that fills as the crew slings, ladders through cosmetic stages, and on a win becomes a kept artifact. It clones the **Trough's communal-funding pattern** (pooled contributions → milestone → grant a `hats`-catalog cosmetic via `user_hats` upsert) and the **Garden's staged-visual pattern** (N discrete stages with no raw number on the face). The "war" stays competitive *outside* (whose Fort is bigger/finished) and cozy *inside* (you build, you don't destroy).

The mechanic is fully isolated to the war and **resets to zero each war** — same isolation guarantee as the base sling field (`20260647000000_mud_fights.sql` header: "None of the core account's regen/blessing/alignment/VIP buffs can touch a war"). No core-account strength leaks in; a Fort's ceiling is `members × DAILY_ALLOTMENT × days`, i.e. roster participation only.

**One framing decision stated up front (so the rubric can see the trade-off):** the research brief's #1 principle is *make togetherness strictly better via a **multiplicative** bonus*. The Fort deliberately does **not** take that lever. A multiplicative crew-score would re-open the exact snowball TTP's per-capita base was built to prevent. The Fort is instead a **shared-goal / collective-contribution** mechanic (research §"Shared-goal"), which is legitimately *additive* — every member's sling moves the same structure, and the interdependence comes from the **completion gate** (the crew only *finishes* if enough heads each pull their per-capita weight) plus a **bounded mid-war catch-up treat** (the one mild compounding lever, kept war-scoped and cosmetic). We name this so it's a chosen trade, not an oversight: fairness spine first, multiplicative thrill sacrificed on purpose.

---

## How it plays (the co-op interaction, day-to-day)

The Fort *is* the existing mud the crew is already slinging — re-read as construction. There is **no new verb and no new resource**. `sling_mud` already records each member's daily slings in `mud_slings` (clamped to `DAILY_ALLOTMENT=20`/day, use-or-lose, no modifiers — `20260647`, lines 550–584). The Fort's "bricks" are simply the crew's running slings for the war, normalized per-capita (see Scoring).

- **Open the war as usual.** Leader runs `challenge_crew` / `challenge_house`; defender `accept_challenge` stamps the window. The only change: the war length drops from 5 days to **3 days** (the resolved cadence), stamped the same way. Today the `interval '5 days'` literal appears in **three** sites — `challenge_house` (`20260647`, line 472), `accept_challenge` (line 507), and the client mirror `WAR_LENGTH_DAYS=5` (`constants/mudFights.ts`, line 10). All three move to 3 (plus the migration-header comment). No new war setup step.
- **Each sling lays a brick.** The active-war screen (`app/mud-war.tsx`, `ActiveWar`, line 225) keeps its tug-of-war bar (`ropePosition(war.mine.perCapita, war.them.perCapita)`, line 232) and the bucket tap. Below it, a **Mud Fort panel** renders the crew's *own* structure growing through staged art: a muddy lot → stake fence → wall → ramparts → gate → flag-topped fort. The stage is derived from the crew's **per-capita** progress, which `war_state` already has the inputs for (`mine.total` + `mine.active`, both returned by `war_side` — `20260647`, lines 811–812), so it needs no new write on the hot path — every sling that updates the tug bar also nudges the Fort.
- **Milestone laddering, fast early wins.** Tiers are spaced so the first stage lands in the first session and the *next* milestone is always shown, never the distant finish (the goal-gradient / Irrational-Labs "design for fast early wins" rule). Crossing a tier fires a small in-crew celebration (a brick-laying juice burst — reuse the existing splat `Animated` pattern in `ActiveWar`, lines 237–257) and an inline `system_announcements` row to the crew: "Crew Mudlarks raised the walls!" — co-presence rendered, not inferred (research principle #2).
- **Compounding halfway treat (the one mild interdependence lever).** At the middle tier the crew unlocks a one-war **fort buff** — by default purely **cosmetic/visual** (a "rally banner" overlay + a brighter Fort) so it can never touch the isolation invariant. This is the research's "compounding mid-event treat" to pull stragglers into the back half; making it visual-only keeps the war-isolation guarantee absolute (see Rewards #4 for the bounded-core alternative if the grill wants a mechanical version).
- **Soft-cozy stakes.** Falling short never punishes: an unfinished Fort just resolves at whatever stage it reached. The base-war draw/no-quorum path is unchanged. One absent member can't sink it — the Fort is a *floor-additive* track (more present builders = more bricks per head retained), so an absentee subtracts nothing the crew had, while a *present* low-baller can drag the per-capita stage (the same property that makes the base scoring alt-resistant; see Scoring).
- **Resolve.** On the first read after `ends_at`, the existing lazy `resolve_war` runs (no cron — Trough/`resolve_expired_drives` pattern; triggered by `war_state` line 843 and `sling_mud` line 564). It already loops the winning crew's members (`20260647`, lines 664–703); we extend that loop to grant the **Fort cosmetic** to every contributor and stamp the final stage on the war.

The day-to-day loop: open app → tap the bucket your usual 20 → watch *both* the tug rope and your crew's Fort climb → cross a tier, get a crew ping → final day, everyone shows up to lay the last bricks and top the flag. The Fort is the artifact you keep (research principle #8, FarmVille-barn / Helldivers-monument).

---

## Scoring & fairness (capped crew war-points without reopening snowball/alt abuse)

**The Fort does not change who wins the war.** Win/loss is still decided exactly as today in `resolve_war`: per-capita active average (`SUM(slings)/COUNT(active)`, `20260647` lines 617–652), quorum-2 gate, tie/both-below-quorum = no winner. The Fort is a **derived view of the same `mud_slings` data** plus a bounded completion bonus — it adds nothing to the per-capita comparison. This is deliberate: the research's central fairness finding is that **the scoring shape is the whole ballgame**, and TTP already chose the anti-dominance shape (per-capita average). Layering a *second* score that rewarded raw crew total would re-introduce the exact snowball the migration was built to prevent (a 5-crew out-bricks a 3-crew on volume). So the Fort *stage* is shown per-crew for flavor, but the **fairness spine is per-capita average, unchanged**.

How the Fort earns its capped bonus without reopening abuse:

- **Anti-snowball holds because the Fort tiers are per-capita, not per-total.** The fort stage is computed from `total / active` (per-capita slings per head), mirroring `war_side.perCapita` (`20260647` line 813) and the client `perCapita(total, active)` helper (`utils/mudWars.ts` lines 158–161), so a big crew and a small crew that each sling at the same per-head pace reach the same stage. Headcount buys no extra Fort. (If we keyed tiers off raw `total`, a bigger roster would always build a taller fort — the dominance problem the brief forbids. Per-capita tiering closes it.) **This resolves the one internal inconsistency a careful reader will look for: the Fort stage is per-capita everywhere — there is no "stage from raw total" path.**
- **Participation gate on the completion bonus.** The Fort-finish reward is gated like Clash of Clans' "contribute ≥1 to claim anything": only members with `SUM(slings) > 0` get the cosmetic, and the capped snout payout only goes to contributors — the `resolve_war` winner loop *already* filters `HAVING SUM(slings) > 0` (`20260647` line 666), so this is free. Alts that never sling get nothing; a quiet-but-present member still earns (rewards participation, not excess-over-mean — the research's fix for the "don't play unless above average" trap).
- **Alts stay worthless.** The per-member daily cap is already `DAILY_ALLOTMENT=20` and use-or-lose (`mud_slings.slings <= 20` CHECK, line 98); an alt can add at most 20/day, and because tiers are per-capita, an alt that slings *below the crew's pace drags the average and the stage down*, not up. An alt that slings the full 20 is just… a real participant doing the work. Either way there's no farm.
- **Capped completion bonus (cash-faucet lesson).** Finishing the Fort pays a **flat, bounded snout bonus** (`FORT_BONUS`, proposed 30, in the `HOUSE_BONUS=25` order of magnitude), granted **idempotently** inside the same `FOR UPDATE`-guarded `resolve_war` transaction that already pays the war and stamps `resolved_at` (lines 608–612 guard, 707 stamp). No per-sling minting, no compounding, no per-day faucet. It rides the same idempotency stamp (`resolved_at`), so a double-resolve can't double-pay (the migration's existing guarantee).
- **Anti-collusion.** The existing 24h rematch cooldown per crew pair (`challenge_crew`, lines 433–438) and the bot-war neutralization (beating the house grants NO `tickles_earned`/`war_wins`/titles — lines 668–673) extend unchanged: **bot wars build a Fort for flavor but grant NO Fort cosmetic and NO completion snouts** — a fixed-pace, re-challengeable bot must not be farmable for a permanent cosmetic (same reasoning that neutralized the bot for rank/prestige). Real wars only, gated by the existing `NOT w.is_bot_war` branch.
- **Bounded win/loss gradient stays.** Mud is free; a lost war still pays nothing; the Fort cosmetic only goes to the *winning* crew's contributors. There's nothing to gain by sandbagging.

Net: the Fort is **strictly-better-when-you-cooperate** (more present builders → taller fort → cosmetic + small bonus) but **never required and never snowball-able**, because every Fort threshold is per-capita and every payout is capped, participation-gated, and idempotent — exactly the "capped co-op bonus on a fair base" the founder grill resolved.

---

## Already built ✅ (what TTP reuses)

- **The whole sling/scoring stack** — `mud_slings` (per-(war,user,day) clamp, line 98), `sling_mud` (550), `war_side` (returns `total`/`active`/`perCapita`/`quorumMet`, 791–816), `war_state` (818), `my_war` (872), `resolve_war` (588). The Fort reads `mine.total`/`mine.active` that `war_side` *already* computes; no new aggregate query on the read path.
- **Lazy idempotent resolution** — `resolve_war` runs on first read after `ends_at` (`war_state` line 843, `sling_mud` line 564 trigger it), `FOR UPDATE` (line 608) + `resolved_at` guard (lines 610–612), savepoint-guarded side effects. The Fort grant slots into the existing winner loop (lines 664–703).
- **The Trough's communal-funding → cosmetic-grant pattern** — the funded path does `INSERT INTO public.user_hats (user_id, hat_id) ... ON CONFLICT (user_id, hat_id) DO NOTHING` (`20260582000000_item_drives.sql`, lines 171–173). The Fort grant is the same upsert, keyed on the winning crew's contributors. (NB: the *announcement* path in that base file used the admin-gated `send_system_announcement` and was later **inlined** in `20260619000000_fix_donate_to_drive_announcement.sql` — the Fort copies the **inlined** form, not the base.)
- **The cosmetics catalog + equip slots** — `hats` (catalog: `id text PK`, `name`, `emoji`, `image_path`, `cost int CHECK cost>=0`, `display_order`; `20260501210000_hats_shop.sql` lines 3–11), `user_hats` (inventory, PK `(user_id, hat_id)`), the `category text NOT NULL DEFAULT 'hat'` column (added `20260502030000_shop_catalog.sql` line 6), and the `profiles.active_aura_id` / `active_background_id` slots with documented z-order (`20260514000000_aura_background_slots.sql`). An animated war background is a `hats` row with `category = 'background'`, equipped via `active_background_id`; a war hat routes through `active_hat_id`. **No new cosmetic infrastructure.**
- **The server-side "can't be bought" guarantee** — `buy_hat` **rejects `cost <= 0` with `'not_for_sale'`** (latest def, `20260544000000_season_pass_missing_hats.sql` lines 84–87: "Season-pass exclusives carry cost = 0 — block the buy path"). So a `cost = 0` Fort cosmetic is **unbuyable by construction at the RPC layer**, not merely "unlisted in the client." `open_item_drive` separately rejects `cost <= 0` as `not_eligible`/exclusives (`20260582` lines 63–65). The Fort cosmetic is therefore obtainable *only* by winning + finishing a Fort — enforced in two RPCs, not by client omission.
- **The Garden's staged-visual pattern** — N discrete stages, no number on the face, stage derived from a single scalar (`streak-and-garden.md`; the Garden spec is *5 stages off `current_streak`*). The Fort is the same idea off the crew's per-capita slings. (NB: the Garden/streak system itself is **design-intent, not yet in the repo** — `streak-and-garden.md` flags no `streak_mod`/`current_streak` in `supabase/migrations/`. We borrow the *pattern*, not a live `streak_mod` helper; the Fort's helper is modeled on the live `war_side.perCapita`, which does exist.)
- **Inline `system_announcements` notification path** — challenge/start/resolve already INSERT inline (never `send_system_announcement`), savepoint-guarded (`20260647`, e.g. resolve announce lines 711–725). Fort tier-up and Fort-complete announcements reuse it verbatim.
- **Title-grant + war_wins + war_winner_regen machinery** — the winner loop already grants `mud_champion`/`mud_veteran`/`mud_legend` titles (`titles.source = 'mud_war'`, lines 252–257) and the regen self-blessing idempotently (lines 684–687); a Fort-completion title (if wanted) drops in beside `mud_legend` with the same `mud_war` source.
- **Realtime + optimistic client** — `useMudWar` subscribes to `mud_slings` (throttled 1.5s, `hooks/useMudWar.ts` lines 94–112) and bumps optimistically (`bumpMine`, lines 26–49, which already recomputes `perCapita`); the Fort panel re-renders from the same `mine` the hook already holds. `constants/mudFights.ts` is the client mirror for new constants.

---

## What's needed 🔨 (concrete, grounded)

Ships as a **single follow-on migration timestamped after `20260649000000_onboarding_checklist.sql`** (the latest on disk — verified), e.g. `20260650000000_mud_fort.sql`. The base mud-fights migration (`20260647`) is **still unpushed**, so this *could* be folded in — but a separate, after-`20260649` file is cleaner and avoids re-touching an in-review file. **Carry every `CREATE OR REPLACE`'d function body from its LATEST on-disk def** (carry-latest-def footgun): `resolve_war`, `war_side`, `war_state` all live in `20260647`; copy those exact bodies and add the Fort logic, or the rebuild silently reverts the review fixes. The 5→3 day change touches `challenge_house`/`accept_challenge` in the *same* `20260647` (if folded) or is re-stated in the new file's carried bodies (if separate).

### Tables / columns

- **`mud_wars.fort_stage int NOT NULL DEFAULT 0`** — the resolved Fort stage for the winning crew, stamped at resolve. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. (Live stage is *derived* during the war, not stored — only the final stage persists, for the cosmetic/recap.)
- **No `fort_bonus_paid` flag.** `resolved_at` already gates double-pay idempotently (lines 610–612); a second flag is redundant. Lean: rely on `resolved_at`.
- **No new contribution table.** Fort progress = the existing `mud_slings` aggregate. **The Fort is a derived view, not a new ledger.** (Contrast the Trough, which needed `item_drive_donations` because donations are real snout transfers; here the "donation" is the sling we already record.)
- **Seed ONE Fort cosmetic per war season into `hats`** — e.g. `INSERT INTO public.hats (id, name, emoji, image_path, cost, category, display_order) VALUES ('fort_bg_2026_spring', 'Mud Fort (Spring 2026)', '🏰', 'forts/spring-2026.png', 0, 'background', 900) ON CONFLICT (id) DO NOTHING`. `cost = 0` → `buy_hat` returns `not_for_sale` and `open_item_drive` returns `not_eligible` (both verified above), so it can never be bought or Trough-funded. `category = 'background'` so equip routes to `active_background_id` (`20260514`/`20260502030000`). Optionally a matching `category = 'hat'` war hat.

### RPC signatures / changes

- **`resolve_war(p_war uuid)` — extend the existing function** (carry its `20260647` body verbatim, add):
  - After the winner is decided and `win_active` is set (line 656), derive `final_stage := fort_stage_for(win_total, win_active)` where `win_total` is the winner's `SUM(slings)` (already computed as `ch_total`/`df_total`, lines 618/631 — reuse, don't re-query).
  - In the winner `FOR m IN ... HAVING SUM(slings) > 0` loop, real wars only (the existing `NOT w.is_bot_war` branch wraps this exactly like the title inserts, lines 688–702): `INSERT INTO public.user_hats (user_id, hat_id) VALUES (m.user_id, FORT_COSMETIC_ID) ON CONFLICT (user_id, hat_id) DO NOTHING;` (savepoint-guarded like the title inserts).
  - Pay the capped completion bonus only if `final_stage >= FORT_COMPLETE_STAGE`, additive to the existing per-member `reward`: fold `FORT_BONUS` into the same `UPDATE public.profiles SET counter = counter + reward + FORT_BONUS, tickles_earned = tickles_earned + reward + FORT_BONUS` (lines 676–681) — one write, leaderboard-shaped, bounded, idempotent via `resolved_at`. (Bot branch unchanged: no Fort pay.)
  - `UPDATE public.mud_wars SET fort_stage = final_stage WHERE id = p_war;` alongside the existing status/winner/`resolved_at` stamp (line 707).
  - Extend the inline resolve announcement copy (lines 718–722): on a completed Fort, append "Your Sounder's Mud Fort stands — it's yours to keep!"
- **`war_state(p_war uuid)` — extend the returned jsonb** (carry `20260647` body lines 818–870 verbatim, add to the final `jsonb_build_object`, line 864): a `fort` block `{ myStage, myNextThreshold, myPerCapita, theirStage }` derived from `mine`/`them` already in scope. This is the only read-path change and it's pure computation over data `war_side` already returns. No new query, no extra round-trip.
- **`fort_stage_for(per_capita_total int, active int) RETURNS int`** — small `IMMUTABLE SQL` helper mapping per-capita slings → stage index against `FORT_TIERS`. Centralizes the curve so `resolve_war` and `war_state` agree. Pass `(total, active)` and compute `total/active` inside (guarding `active = 0 → stage 0`), mirroring `war_side.perCapita`. `REVOKE EXECUTE ... FROM PUBLIC` (internal-only, like `war_side`, line 931) — the client never calls it; `war_state` returns the stage.
- **No new mutation RPC.** There is no "build" action — building *is* slinging. This is what keeps the hot path single-write and the mechanic anti-snowball (no second resource to hoard).

### Concrete starter tier curve (the tuning knob, seeded)

A fully-active 3-day crew tops out at `DAILY_ALLOTMENT × days = 60` per-capita slings. 6 stages, front-loaded for the goal-gradient fast first win, "complete" at stage 5 reachable only by a real 3-day effort:

| Stage | Name | Per-capita threshold | Reached by |
|---|---|---|---|
| 0 | Muddy lot | 0 | start |
| 1 | Stake fence | 3 | first session (≈ one sitting) |
| 2 | Wall | 12 | end of day 1 at a relaxed pace |
| 3 | Ramparts | 24 | midpoint — unlocks the rally-banner treat |
| 4 | Gate | 40 | day 2–3 push |
| 5 | Flag-topped fort (**COMPLETE**) | 54 | ≈ 90% of the 60 ceiling — needs near-full participation |

`FORT_COMPLETE_STAGE = 5`; cosmetic granted to winning contributors at stage `>= FORT_MIN_COSMETIC_STAGE = 1` (any win that built *something*); `FORT_BONUS = 30` paid only at stage 5. Thresholds are the explicit `FORT_TIERS = [0,3,12,24,40,54]` array, mirrored in SQL and client. These are starting values for the post-launch audit window the streak `0.75×` cap got.

### Client changes

- **`constants/mudFights.ts`** — add `FORT_TIERS = [0,3,12,24,40,54]`, `FORT_BONUS = 30`, `FORT_COMPLETE_STAGE = 5`, `FORT_MIN_COSMETIC_STAGE = 1`, `FORT_COSMETIC_ID`. Same server/client drift caveat the file header already flags (lines 1–7); the P3 `mud_fight_const()` would unify.
- **`utils/mudWars.ts`** — extend the `WarState`/`WarSide` types with the `fort` block (the file already defines these, lines 59–80); add a pure `fortStage(total, active)` helper next to `perCapita` (lines 158–161), unit-testable and mirroring the SQL.
- **`app/mud-war.tsx`** — add a `<MudFortPanel>` under the tug bar in `ActiveWar` (after line 283): staged art keyed off `war.fort.myStage`, a "next milestone" hint from `myNextThreshold`, and a tier-up juice burst (reuse the splat/`Animated` pattern, lines 237–257). The `ResolvedWar` recap (referenced line 81) shows the final Fort + "kept forever" line.
- **`hooks/useMudWar.ts`** — no structural change; the Fort re-renders from the `war` state the hook already refreshes on sling + realtime. Optionally extend `bumpMine` (lines 26–49) to recompute a local Fort stage so a tier-up feels instant (it already recomputes `perCapita`).

### Realtime / push

- **Realtime is already wired** — the Fort panel updates via the existing throttled `mud_slings` subscription in `useMudWar` (lines 94–112). No new channel.
- **Push / announcements** — tier-up and Fort-complete are **inline `system_announcements` INSERTs** in `resolve_war` (complete) and optionally on tier-cross. Surfaced via the existing WhileAway/announcement path. **Never `send_system_announcement`** (admin-gated → would roll back a non-admin's `resolve_war` — the documented footgun, fixed for `donate_to_drive` in `20260619`). Keep them savepoint-guarded so a bad insert can't undo the cosmetic grant or the payout.
- **Tier-cross announcement cost note.** A live tier-cross ping would need a write on the hot `sling_mud` path (to detect the crossing). To keep `sling_mud` single-write, **v1 fires no per-tier push**; the in-app Fort panel animates the cross locally (free), and only the **Fort-complete** announcement is emitted at resolve (already a write site). Per-tier push is a follow-on if wanted.

---

## Rewards tie-in (war cosmetics + capped core payout)

Two reward tracks, both **war-exclusive** and **dual-track** (Destiny Empyrean model: a collective unlock everyone shares + per-member recognition):

1. **The kept war cosmetic (the headline reward).** A completed Fort grants every winning contributor an **animated war background** — a season-tagged `hats` row (`category = 'background'`, `cost = 0`), generated via the ChatGPT/icon-gen sprite pipeline (`icon-gen` skill) like the existing hat/aura art. Granted by the same `user_hats` upsert the Trough uses, equipped via `profiles.active_background_id` with the documented z-order (`20260514`). Because `cost = 0`, both `buy_hat` (`not_for_sale`) and `open_item_drive` (`not_eligible`) refuse it at the RPC layer — it's *only* obtainable by winning + finishing a Fort that war. Optionally a matching **war hat** (`active_hat_id`). This is the standing monument / social proof the research's principle #8 wants — "Mud Fort, Spring 2026, built by Crew Mudlarks."
2. **Capped core snout payout (respect the cash-faucet lesson).** A **flat, bounded `FORT_BONUS = 30`** (`HOUSE_BONUS`-order) paid only to contributors of a *completed* Fort (stage 5), **once**, folded into the existing idempotent per-member `UPDATE` in `resolve_war` (rides `resolved_at`; double-resolve = no-op). Leaderboard-shaped (`counter + tickles_earned`) like the base payout. **Cap + anti-collusion gate**: contributors-only (`HAVING SUM(slings) > 0`), real-wars-only (bot wars grant neither cosmetic nor bonus), 24h rematch cooldown unchanged. No per-sling or per-day minting — the faucet is one bounded grant per won war.
3. **Per-member recognition (the gentle anti-loafing lever).** The resolved recap and the in-crew Fort panel show each member's brick count (already in `war_side.members[].slings`, lines 808–810) and a soft "top builder" highlight — the lowest-pressure free-rider deterrent, the most on-brand for cozy (research checklist, cozy-soft stakes).
4. **Mid-war compounding treat (default cosmetic, war-scoped).** At stage 3 (midpoint), a one-war **rally banner** — default a purely **visual** overlay (banner + brighter Fort) that lives only in the war screen, never the core account, so the isolation guarantee is absolute. *If the grill wants a mechanical version*, the only isolation-safe option is a war-field-scoped nudge (e.g. a temporary cap bump inside `mud_slings`), explicitly **NOT** a core-account buff; anything touching the core must be capped/bounded/idempotent like `war_winner_regen`. The safer default ships visual-only.

The existing `war_winner_regen` blessing (×0.85/72h, `regen_secs_for` lines 233–237) still fires for *any* win (granted unconditionally in the winner loop, lines 684–687) — the Fort bonus is **additive on top**, and capped, so total per-war payout stays bounded and anti-snowball.

---

## Risks / open questions

- **Fort tier curve is the tuning knob.** The seeded `[0,3,12,24,40,54]` per-capita curve gives a fast first stage yet makes "complete" (54 of a 60 ceiling) genuinely require a 3-day crew effort. Needs the same post-launch audit window the streak `0.75×` cap got; adjust thresholds from telemetry on real completion rates.
- **Server/client constant drift.** `FORT_TIERS` lives in both `constants/mudFights.ts` and the SQL `fort_stage_for` helper — same drift risk the file header flags (lines 1–7). The P3 `mud_fight_const()` SQL source-of-truth would close it; until then, change both in the same commit.
- **Cosmetic art pipeline dependency.** Each war season needs one animated background (+ optional hat) from the icon-gen pipeline before the war opens, or the cosmetic id won't resolve. Seed the `hats` row first; the `user_hats` upsert is `ON CONFLICT DO NOTHING` so a missing-art row still grants safely (just shows the `🏰` emoji fallback).
- **Bot-war Fort.** Decided: bot wars *display* a Fort (so the screen isn't empty) but grant **no cosmetic and no bonus** (anti-farm). The existing `NOT w.is_bot_war` branch (lines 688/689) wraps the Fort grant exactly as it wraps titles — confirm in code review that the new upsert sits *inside* that branch.
- **"Complete" vs "any win" for the cosmetic.** Resolved: winning grants the cosmetic at any final stage `>= FORT_MIN_COSMETIC_STAGE = 1` (built *something*); the **bonus snouts** require stage 5. A win always feels rewarding; the headline payout is reserved for real collective effort.
- **Cadence (3 on / 1 off).** The 5→3 day change is a literal swap in three sites (`challenge_house` line 472, `accept_challenge` line 507, `WAR_LENGTH_DAYS` line 10). The "1 day off" rest cadence is **not** enforced — there's no season scheduler. For v1 the rest day is informal (the existing 24h rematch cooldown, lines 433–438, already blocks immediate same-pair re-challenge); a real on/off scheduler is an explicit follow-on, flagged so it isn't mistaken for shipped.
- **Test gaps (write before push).** The base migration's pgTAP (`supabase/tests/02_mud_fights.sql`) doesn't cover tie/no-winner/bot payout yet. The Fort adds: (a) `fort_stage_for` threshold mapping (incl. `active=0 → 0`), (b) complete-bonus idempotency across a double `resolve_war`, (c) contributor-gate (a `SUM(slings)=0` member gets neither cosmetic nor bonus), (d) bot-war grants nothing, (e) per-capita parity (a 5-crew and a 3-crew at the same per-head pace reach the same stage). Add these cases before push.
- **Mid-war treat scope.** Default cosmetic-only. If it ever touches the core account it breaks war-isolation; the grill must explicitly opt into the bounded war-field-scoped variant, never a core buff.

---

## Effort

**MEDIUM.** Most of the cost is already paid: the contribution ledger (`mud_slings`), the pooled-funding→cosmetic-grant pattern (Trough `user_hats` upsert), the staged-visual pattern (Garden), the cosmetic catalog + equip slots (`hats`/`user_hats`/`active_background_id`, with `buy_hat`/`open_item_drive` *already* refusing `cost=0`), the lazy idempotent resolve, and the realtime client all exist. The genuinely new work: one small migration (1 column, a tier helper, a seed row, ~25 lines folded into `resolve_war`/`war_state` carried from their latest defs), the staged Fort art (icon-gen pipeline — the real time sink), and a `<MudFortPanel>` plus type/constant additions on the client. No new table, no new mutation RPC, no new realtime channel, no cron. **LOW** on backend novelty; **MEDIUM** mostly because of art production + tuning the per-capita tier curve + writing the missing pgTAP cases.

---

## Connects to

- [[sounder-mud-fights]] — this is a co-op bonus track layered on the existing Mud Fights stack; reuses `mud_slings`, `resolve_war`, `war_side`, `war_state`, the bot neutralization, and the 24h rematch cooldown.
- [[team-clan-mud-wars-plan]] — sibling plan; this one is the *shared-goal / reward* axis of the same crew-war feature.
- [[trough]] — clones the communal-funding → `user_hats` cosmetic-grant pattern (`donate_to_drive`, inlined form `20260619`) and the lazy-resolve discipline (`resolve_expired_drives`); the inline-`system_announcements` footgun is the same.
- [[streak-and-garden]] — clones the staged-visual *pattern* (discrete stages off a single scalar, no number on the face). Note the Garden/streak system itself is design-intent, not yet in the repo.
- [[snouts-economy]] — the capped `FORT_BONUS` mints to `counter + tickles_earned` (leaderboard-shaped), bounded + idempotent (the cash-faucet lesson).
- [[shop-cosmetics-closet]] — the Fort reward is a `hats`-catalog cosmetic (`background` category, `cost = 0`), unbuyable by the `buy_hat` `not_for_sale` gate and un-Troughable by `open_item_drive`'s `not_eligible` gate, equipped via `active_background_id`.
- [[regen]] — the existing `war_winner_regen` ×0.85/72h buff still fires on any win; the Fort bonus is additive and capped on top.
- [[notifications]] — Fort-complete is an inline `system_announcements` INSERT surfaced via WhileAway; never `send_system_announcement`.
