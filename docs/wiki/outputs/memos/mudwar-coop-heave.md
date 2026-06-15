---
title: "The Heave — Synchronized Co-op Bonus for Mud Fights"
type: plan
date: 2026-06-14
tags: [plan, co-op, mud-wars, sounder, synchronized, fairness, realtime]
status: draft
---

# The Heave — Synchronized Co-op Bonus for Mud Fights

> A capped, multiplicative "heave!" combo: when 2+ crewmates sling inside a short rolling window, the tug-of-war rope yanks harder and everyone in the window banks a little bonus mud — co-presence made loud and visible, layered *on top of* the flat anti-snowball base so fairness never reopens.

This is the cheapest concrete realization of the **deferred "cooperation-bonus mud" hook** named in [[sounder-mud-fights]] (its Open-questions list: *"Cooperation-bonus mud … deferred to P3"*) and in the spec (`docs/sounder-mud-fight-spec.md` — *"Cooperation hooks (v2): bonus mud for warring-crew-mate interactions"*, *"P3 polish: cooperation bonus mud"*). The shipped build (`resolve_war` in `supabase/migrations/20260647000000_mud_fights.sql`) deliberately flattens group output via per-capita-average of a flat 20/day, so "cooperate to win" isn't yet literally true. The Heave makes it true by adding a **capped bonus** — the floor stays flat and fair; the *earned* advantage is synchronization. It reuses the existing tug-of-war screen (`app/mud-war.tsx`), the `mud_slings` realtime subscription (`hooks/useMudWar.ts`), and the `sling_mud` RPC almost verbatim.

> **Resolved-design fidelity (the four invariants this plan must not break):** (1) bonus is **capped** and sits on top of the untouched flat base; (2) the war stays **isolated + reset-to-zero each war** — no core buffs in, no Heave state out; (3) rewards are **cosmetic + capped-core only** — no new snout faucet; (4) the founder's **~3-on / 1-off cadence** is a war-scheduling concern, untouched here. Every section below is checked against these.

## How it plays

Day-to-day, nothing about the base loop changes: every crewmate still gets a flat **20 mud-slings/day, use-or-lose, no modifiers** (`DAILY_ALLOTMENT`, `constants/mudFights.ts`; the `slings <= 20` CHECK + `ON CONFLICT … LEAST(20, …)` in `sling_mud`). You can play the whole war solo and async — the entry fee stays at zero (research rule #1: *"reward presence, don't punish absence"*; #5: *"one absent member must never sink the crew"*).

The bonus layers on when crewmates overlap:

- **The window opens on the first sling.** When any crewmate slings, a short rolling **Heave window** opens for their crew (proposed `HEAVE_WINDOW_SECS = 90`). Every additional *distinct* crewmate who slings before it closes **extends** it (Puyo Puyo Quest Guild Rush's rolling-window "asynchronous synchronization" — research's single most-transferable sync mechanic, stretched for a cozy crew) and bumps the live combo.
- **The combo is visible and multiplicative.** The war screen already renders a live tug-of-war bar (`ropeTrack`/`ropeMine`/`ropeKnot`, `app/mud-war.tsx` `ActiveWar`); The Heave adds a banner over it: **"HEAVE! 3 of 5 — ×1.6"**, with the rope visibly *yanking* (an extra `Animated.spring` on the existing squish animation) on each new distinct slinger. Research rule #2: *render co-presence, don't infer it*; the multiplicative (not additive) escalation is what makes syncing **strictly better** than spreading out (Bloodlust principle), while staying capped so it can't snowball.
- **Banked, not multiplied-into-the-base.** Each sling thrown *while the window holds ≥2 distinct crewmates* mints into a small **bonus-mud** credit (a separate ledger, never touching the flat `mud_slings.slings ≤ 20` clamp). The combo multiplier scales the bonus only: 2 crew → ×1.0 bonus-rate, all-5 → ×2.0, then **hard cap**. Bonus mud is itself **daily-capped per member** (`HEAVE_DAILY_CAP`, proposed 15) so the breadth-forcing fairness property holds.
- **A crewmate opening a Heave is a gift you can answer.** When a window opens, crewmates get an **opt-in push** ("Your Sounder is heaving — 80s left!") via the existing `send_push_to_user` path (`supabase/migrations/20260520050000_push_delivery.sql`, signature `send_push_to_user(uuid, text, text, jsonb)`) plus an INLINE `system_announcements` row ([[notifications]]). The push is throttled (one Heave-open push per crew per `HEAVE_PUSH_COOLDOWN_HOURS`) so it never becomes a Snapchat-streak obligation (research rule #7: *bonus when both show, never a loss when one doesn't*).
- **The "first sling" is itself the gift (research rule #4 — *"one person's prep is a gift to the table"*).** Rather than bolt on a separate "prep" verb (a new button, a new state machine — cost the founder shouldn't pay in v1), the Heave makes the *opener's first sling* the prep act: it opens the window, fires the one nudge, and pre-arms the multiplier the rest of the crew can climb. The opener's own bonus is back-credited once a second crewmate joins in-window, so being first is rewarded, not taxed — "I showed up first" becomes a present, not a flex. (A heavier, optional **"rally" prep act** that widens `HEAVE_WINDOW_SECS` for the next window is the natural v2; deliberately deferred to keep v1 to one new verb.)

The Heave is **war-exclusive and resets to zero each war** — bonus rows are keyed to `war_id` and `ON DELETE CASCADE` with the war, so nothing leaks into the core account, consistent with the build's central thesis (no core buffs in, mud is its own verb).

## The mechanism — how "live" is computed (the load-bearing design choice)

**The naïve "derive it from `mud_slings.created_at`" approach does NOT work, and the plan must not pretend it does.** `mud_slings` stores **one row per `(war_id, user_id, war_day)`** with a `slings` counter; the `sling_mud` upsert (`ON CONFLICT (war_id, user_id, war_day) DO UPDATE SET slings = LEAST(20, slings + 1)`) **never touches `created_at`**, so `created_at` is the timestamp of a player's *first* sling that day, not their most recent. A `created_at > now() - 90s` window would only ever fire in the first 90 seconds after each player's *first* daily sling and could never re-trigger later — i.e. it would almost never produce a real overlap. This is the single biggest correctness trap in the feature and is fixed one of two ways:

**Chosen for v1 — add a `last_sling_at` bump to `mud_slings` (one column, one line in the upsert):**
```sql
ALTER TABLE public.mud_slings ADD COLUMN IF NOT EXISTS last_sling_at timestamptz NOT NULL DEFAULT now();
-- in sling_mud's ON CONFLICT … DO UPDATE, add:  , last_sling_at = now()
CREATE INDEX IF NOT EXISTS mud_slings_window_idx
    ON public.mud_slings (war_id, crew_id, war_day, last_sling_at);
```
Now "live" is a real query: count distinct `user_id` in this crew+war+`war_day` with `last_sling_at > now() - (HEAVE_WINDOW_SECS || ' seconds')::interval`. The existing `mud_slings_war_idx ON (war_id)` does **not** cover this scan; the composite index above does. (`crew_id` is already a column on `mud_slings`, so no join is needed.)

**Alternative (richer, not needed for v1) — a per-event `mud_heave_taps(war_id, crew_id, user_id, at)` append table** so every individual sling timestamp is retained (enables a true "last N taps" window and replay). More writes on the hot path; defer unless the `last_sling_at` approximation (one timestamp per user/day, fine for a 90s window) proves too coarse.

## Scoring & fairness (capped crew war-points without reopening snowball/alt abuse)

The fairness spine is untouched: `resolve_war` still computes **per-capita active average with a quorum-2 floor** (`ch_score := ch_total / ch_active`, `ch_qual := ch_active >= c_quorum`) over the flat base slings. The Heave adds bonus mud into the *same* per-capita-average shape, so all four anti-abuse properties the research demands are preserved:

- **Anti-snowball holds (per-capita average).** Bonus mud is summed per member and divided by active count, exactly like base mud. Adding a weak/idle member still drags the mean down. A 5-crew can earn a richer Heave than a 3-crew *only by getting more distinct humans to overlap* — the "earned via cooperation" advantage the founder wants, not a roster-size or wallet advantage. (Research: *"per-capita/average scoring is the explicit anti-snowball move."*)
- **The "don't play unless above average" trap is defused by the participation gate.** A flat average punishes below-mean players. The Heave *inverts* this at the margin: the bonus rewards **showing up in-window**, not excess-over-mean — research's prescribed fix (*"reward participation, not excess-over-mean"*). The quorum-2 floor already gates a crew's score; the Heave requires **≥2 distinct crewmates in-window** (`HEAVE_MIN_CREW`) to mint anything, the same K-of-N shape.
- **Alts are worthless (breadth-forcing per-account cap).** The combo counts **distinct `user_id`s**, and bonus mud is per-member daily-capped (`HEAVE_DAILY_CAP`). An alt-stuffer gains nothing from a second account they must *separately* drive inside a 90s window — a labor cost, not a cheat (research: *"per-account caps make alts a labor cost not a cheat"*). The combo cannot exceed crew size (`CREW_CAP = 5`), so there's no headcount runaway.
- **Hard caps everywhere (the cash-faucet lesson).** Two caps: per-tap combo multiplier (`HEAVE_COMBO_CAP = 2.0`) and per-member daily bonus mud (`HEAVE_DAILY_CAP = 15`). The *payout* of bonus mud rides the existing bounded snout grant in `resolve_war` (own mud + per-capita share of 50% of loser pot, `floor((loser_pot * 0.5) / win_active)`) — bonus mud just increases `own`/`total` within that already-capped, idempotent, savepoint-guarded engine. **No new snout faucet is opened.**
- **Bot wars unaffected.** The house ("The Mudlarks", `BOT_CREW_ID = …b0`) has no member rows to overlap (the seeded bot crew has a NULL leader and zero `crew_members`), so no Heave is possible against the bot — which also means the Heave can't be farmed against a re-challengeable fixed-pace opponent. Beating the house stays a flat `HOUSE_BONUS = 25` stipend with no `tickles_earned`/`war_wins` (the existing `IF w.is_bot_war THEN counter := counter + c_house` branch is untouched).

Net: the crew's ceiling rises from `members × 20 × days` to `members × (20 + HEAVE_DAILY_CAP) × days`, but **only the synchronization portion is bonus**, it's per-capita-averaged, and it's double-capped. Snowball and alt abuse stay closed.

## Already built ✅ (what TTP reuses)

- **Tug-of-war screen** — `app/mud-war.tsx` `ActiveWar` has the rope track (`ropeTrack`/`ropeMine`/`ropeKnot`), per-capita labels (`{war.mine.perCapita} / head`), roster pips, the sling button with squish (`Animated.spring` on `scale`) + flung-splat juice (💩 splats), and `ropePosition(mine.perCapita, them.perCapita)` (`utils/mudWars.ts`). The Heave banner + rope-yank spring slot directly into this.
- **Realtime `mud_slings` subscription** — `hooks/useMudWar.ts` subscribes to `postgres_changes` on `mud_slings` filtered by `war_id=eq.{id}`, with a 1.5s refresh throttle. The Heave's live combo reads off the *same* event stream — opponent and crewmate slings already flow through here. (`mud_slings` is in the `supabase_realtime` publication, added by the guarded `DO $$ … ALTER PUBLICATION` block in the migration.)
- **`sling_mud` RPC** — the hot path (`20260647000000_mud_fights.sql`) does the per-day upsert with the `≤ 20` clamp and lazy-resolve-on-expiry. The Heave bonus is computed *inside* this same RPC call (the `last_sling_at` bump + one bonus-ledger write), so no new round-trip.
- **Per-capita-average + quorum scoring** — `resolve_war` and `war_side` aggregate `SUM(slings)` per member into the per-capita average; bonus mud folds into the same per-member sum via a LEFT JOIN.
- **Bounded idempotent payout** — `resolve_war` is `FOR UPDATE` + `resolved_at`-guarded, each side-effect savepoint-wrapped (`BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END`); bonus mud rides this with zero new payout code.
- **Push + announcement infra** — `send_push_to_user` (pg_net, `20260520050000`) and INLINE `system_announcements` INSERTs ([[notifications]]) are the exact path for the Heave-open nudge.
- **Optimistic tap + reconcile** — `useMudWar.sling()` bumps local state via `bumpMine` instantly and reverts on `!ok`; the Heave banner reads from refreshed war state, no new optimistic logic needed.

## What's needed 🔨

**Migration ordering.** The latest migration on disk is **`20260649000000_onboarding_checklist.sql`** (with `20260648` between it and the mud-fights file); the Heave ships as a **follow-on timestamped strictly after `20260649`** — proposed **`20260650000000_mud_heave.sql`**. Confirm the push state of `20260647`–`20260649` before choosing the fold-in option below; do **not** assume `20260647` is "the latest unpushed."

**SQL footgun guards (honor these):**
- **No `send_system_announcement`** for the Heave-open nudge — it's admin-gated and raises `admin_only`, silently rolling back a non-admin's whole `sling_mud` (the `donate_to_drive` lesson in `20260627`). INLINE the `system_announcements` INSERT and/or call `send_push_to_user` directly, each savepoint-guarded (`BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END`, the pattern used throughout `20260647`).
- **Carry-latest-def.** `sling_mud` and `resolve_war` must be `CREATE OR REPLACE`d from their **current shipped bodies verbatim** (whichever migration last defined them — `20260647` unless a later file has touched them) plus the Heave delta, never from a stale copy. Two safe paths: **(a)** if `20260647` is confirmed still UNPUSHED *and* nothing after it redefines these RPCs, fold the Heave into `20260647` directly (no carry trap, but a larger migration); **(b)** otherwise, a clean follow-on `20260650` that re-emits the exact current bodies + delta. **Open: confirm push state → pick (a) or (b).** Default to (b) (follow-on) unless fold-in is verified safe.
- **Idempotent / bounded.** Because the bonus ledger is keyed `UNIQUE (war_id, user_id, war_day)` and minted via an **upsert** (`LEAST(15, bonus + combo_increment)`), a retried `sling_mud` that re-mints would over-credit; guard the mint so it runs **once per successful base-sling increment** (the same code path that bumped `slings`), not on a `daily_cap`/`no_war` early-return. The daily cap is a `LEAST()` clamp like the base. (Note: this is one bonus *row per day*, not per sling — the row's `bonus` accumulates; an earlier draft mislabeled it "one row per sling-sequence.")

**New table — the bonus ledger (kept separate from the `≤20` base clamp):**
```sql
CREATE TABLE public.mud_heaves (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    war_id      uuid NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
    crew_id     uuid NOT NULL REFERENCES public.crews(id)    ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
    war_day     date NOT NULL,                  -- UTC bucket, mirrors mud_slings
    bonus       int  NOT NULL DEFAULT 0 CHECK (bonus >= 0 AND bonus <= 15),  -- HEAVE_DAILY_CAP
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (war_id, user_id, war_day)
);
ALTER TABLE public.mud_heaves ENABLE ROW LEVEL SECURITY;
-- RLS SELECT mirrors mud_slings exactly (reuse the existing helper):
CREATE POLICY "View heaves in your wars" ON public.mud_heaves FOR SELECT
    USING (public.is_war_participant(war_id, auth.uid()));
-- Add to supabase_realtime (guarded, matching the migration's DO-block pattern):
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mud_heaves; EXCEPTION WHEN OTHERS THEN NULL; END $$;
```
Plus the `last_sling_at` column + `mud_slings_window_idx` from the **Mechanism** section above — those are what make "live" computable at all.

**New constants** (mirror in `constants/mudFights.ts` — the file already warns about drift, and points at the optional `mud_fight_const()` SQL single-source-of-truth):
- `HEAVE_WINDOW_SECS = 90` · `HEAVE_DAILY_CAP = 15` · `HEAVE_COMBO_CAP = 2.0` · `HEAVE_MIN_CREW = 2` · `HEAVE_PUSH_COOLDOWN_HOURS = 6`

**RPC changes:**
- **`sling_mud(p_war uuid)` — extend, same signature.** After the base upsert (and only on a real increment, not an early return), set `last_sling_at = now()`, then compute the live combo: count distinct crewmates (including caller) in this crew+war+`war_day` with `last_sling_at > now() - (HEAVE_WINDOW_SECS || ' seconds')::interval`. If `crew_in_window >= HEAVE_MIN_CREW`, mint into `mud_heaves` (upsert, `LEAST(15, bonus + combo_increment)`), where `combo_increment` scales 1.0→2.0 by in-window crew count, capped at `HEAVE_COMBO_CAP`. **Opener back-credit:** on the <2→≥2 transition, also mint the *just-arrived second* crewmate's mint **and** a one-time catch-up credit to every other in-window member whose first-of-window sling predated quorum (so the opener who slung at T=0 isn't penalized for being first — research rule #4). Cheapest implementation: on the transition, mint `combo_increment` for **all** distinct in-window `user_id`s this tick, not just the caller. Return shape gains `heave: { live: bool, crewInWindow: int, multiplier: numeric, bonusToday: int }`. The Heave-open push fires (savepoint-guarded, throttled by `HEAVE_PUSH_COOLDOWN_HOURS`) only on the *transition* from <2 to ≥2 in-window.
- **`resolve_war(p_war uuid)` — one-join delta.** In **both** crew subqueries, replace the per-member `SUM(slings)::int AS own` with `SUM(slings)::int + COALESCE(h.bonus_sum, 0)` via a LEFT JOIN to a per-`(crew, user)` `SELECT user_id, SUM(bonus) AS bonus_sum FROM mud_heaves WHERE war_id = p_war …`. Everything downstream (quorum, per-capita, payout `m.own + share`, the `resolved_at`/`FOR UPDATE` idempotency, the savepoint-guarded title/blessing inserts) is unchanged — bonus mud is just more `own`/`total`.
- **`war_side` / `war_state` — surface bonus.** `war_side` adds a `heaveBonus` per member (LEFT JOIN to the same per-member `mud_heaves` sum) and folds it into the `total`/`active`/`perCapita`/`quorumMet` aggregates. `war_state` adds a top-level `heave` block (live combo for *my* crew, computed the same way as in `sling_mud`) so the client renders the banner without a separate fetch.
- **GRANTs.** `mud_heaves` needs no direct grant (written only via `sling_mud` / read via `war_side`/`war_state`, all SECURITY DEFINER); RLS SELECT (above) covers the realtime subscription. No new `GRANT EXECUTE` since `sling_mud`/`resolve_war`/`war_state` signatures are unchanged and already granted.

**Client changes (small):**
- `utils/mudWars.ts` — extend `WarState` with `heave?: { live: boolean; crewInWindow: number; multiplier: number; bonusToday: number }` and `WarSideMember` with `heaveBonus`; `slingMud` result type gains the `heave` field. Add a pure `heaveMultiplier(crewInWindow: number): number` helper (unit-testable, mirrors the server curve) next to `perCapita`/`ropePosition`.
- `hooks/useMudWar.ts` — the existing `mud_slings` subscription already fires on crewmate slings; on refresh, the new `heave` block lands. Optionally derive a client-side countdown to window-close from `last_sling_at + HEAVE_WINDOW_SECS`. `bumpMine` reflects only base mud (bonus is server-authoritative — do **not** optimistic-mint a capped, other-player-dependent reward).
- `app/mud-war.tsx` `ActiveWar` — add a `HeaveBanner` above the `ropeTrack` ("HEAVE! 3 of 5 — ×1.6 · 72s") and an extra `Animated.spring` on the rope/button when `crewInWindow` increases. Reuse the existing splat/Haptic juice, amplified during a live Heave (heavier `Haptics.impactAsync`, gold splats). Gate everything behind the existing `MUD_FIGHTS_VISIBLE` flag (`constants/featureFlags.ts`) — the whole mud-fights surface is still dark-launched, so the Heave inherits the same gate and does not need its own flag.

**Realtime/push:** no new channel — the existing `realtime:mud-war:{warId}` subscription on `mud_slings` already carries crewmate sling events (and `last_sling_at` rides the same UPDATE). Add `mud_heaves` to the publication for the bonus-mint event. The Heave-open push is one throttled `send_push_to_user` call inside `sling_mud`.

## Tests, rollout & rollback

- **Pure-helper unit test** — `heaveMultiplier(crewInWindow)` across 1→5 (1 → ×1.0/no-mint, 5 → ×2.0 cap), mirroring the server curve; add to the existing `utils/mudWars.ts` test surface alongside `perCapita`/`ropePosition`.
- **SQL smoke (manual, against a local branch):** (1) two distinct users sling within 90s → both get a `mud_heaves` row, `bonus > 0`, combo ≥ ×1.0; (2) one user spams 20 slings solo → **zero** `mud_heaves` rows (min-crew gate holds); (3) re-call `sling_mud` after `daily_cap` → no extra bonus mint (idempotency on early-return); (4) `resolve_war` with bonus present → winner's `own` reflects base + bonus, payout still `floor((loser_pot*0.5)/win_active)`-bounded, second `resolve_war` call returns `noop`; (5) bot war → no `mud_heaves` rows possible.
- **Rollout.** Dark-launched with the rest of mud fights (`MUD_FIGHTS_VISIBLE = false`); flip on with the feature. Migration goes up only on the user's explicit "push it now."
- **Rollback.** The feature is additive and isolated: `DROP TABLE public.mud_heaves CASCADE;` + `ALTER TABLE public.mud_slings DROP COLUMN last_sling_at;` + re-emit the pre-Heave `sling_mud`/`resolve_war`/`war_side`/`war_state` bodies reverts cleanly. No base-loop data is mutated by the Heave (it only *adds* rows and one column), so a rollback cannot corrupt an in-flight war's base scoring.

## Rewards tie-in

- **War-exclusive cosmetics (the headline reward).** Heaving unlocks **animated war backgrounds + hats** generated via the existing ChatGPT/icon-gen pipeline ([[shop-cosmetics-closet]], `icon-gen` skill). Proposed cosmetic gates, all war-scoped and non-economic: a **"Heave-Ho" animated mud-splatter background** for any crew that lands a 5-of-5 (all-crew) Heave during a war, and a **mud-crown hat** for the war's top Heave contributor (by `SUM(bonus)`). Cosmetic-only, so even at full neutralization they can't distort the economy (the stricter [[identity-model]] stance). Persistent artifact = the cosmetic in your closet, war-tagged (research rule #8: *leave a persistent artifact behind*).
- **Capped core payout (respect the cash-faucet lesson).** Bonus mud pays out through the **existing** `resolve_war` snout grant (own mud + per-capita share of 50% loser pot) — no new faucet. The double cap (`HEAVE_COMBO_CAP` ×2.0, `HEAVE_DAILY_CAP` 15/member/day) bounds the maximum extra snouts a member can earn; the **24h rematch cooldown** (`challenge_crew`'s `rematch_cooldown` guard) + bot-farm neutralization (no Heave vs the house) are the anti-collusion gates. Grants stay **idempotent + server-authoritative** (`resolved_at`, `FOR UPDATE`, savepoint-guarded) — bonus mud changes the *amount*, never the payout machinery ([[snouts-economy]]).
- **Titles** — optionally a `mud_heaver` title at a lifetime Heave-contribution threshold, reusing the `mud_war` title source (already added to `titles_source_check` in `20260647`) and the `user_titles` ON-CONFLICT-DO-NOTHING insert pattern in `resolve_war` ([[achievements-and-titles]]). Defer to a follow-up; not needed for v1.

## Risks / open questions

- **Window length is a feel/server-load tradeoff.** 90s is long enough for a timezone-spread cozy crew to overlap loosely (research: async > global-now) but short enough to feel "synchronized". Too long and it's always-on (no combo tension); too short and a 27-player beta rarely triggers it. **Open: confirm 90s, or make it `mud_fight_const()`-tunable.** Stagger concern is minor (slings are self-paced taps, not a global instant).
- **`last_sling_at` is a per-day approximation.** It tracks each user's *most recent* sling, so the window sees "this user slung in the last 90s," not their full tap history — correct for a presence window, but it can't power a "last N taps" analytic. If finer granularity is ever needed, switch to the per-event `mud_heave_taps` table (named in **Mechanism**).
- **Beta population may rarely trigger a Heave** at 27 players across two real crews. The base loop is fully playable without it (by design), so this is "bonus lies dormant until population grows," not a blocker — same posture as the whole dark-launched mud-fights flip (`MUD_FIGHTS_VISIBLE = false`).
- **Optimistic-mint temptation.** Do NOT optimistically credit bonus mud client-side — it's a capped reward and the combo depends on *other* players' server state. Render the banner from refreshed `heave` state only; keep `bumpMine` base-only.
- **Push fatigue.** The Heave-open nudge must be throttled (`HEAVE_PUSH_COOLDOWN_HOURS`) and ideally opt-out, or it becomes the streak dark pattern the research explicitly warns against (rule #7).
- **Constant drift** — `constants/mudFights.ts` vs inlined RPC values; the existing file already flags this and points at `mud_fight_const()` (P3). With five more constants, that single-source-of-truth becomes more valuable; consider landing it in the same migration.
- **Fold-into-`20260647` vs follow-on `20260650`.** Depends on the push state of `20260647`–`20260649` (see **Migration ordering** + **carry-latest-def**). **Open: confirm push state; default to the follow-on.**

## Effort

**LOW–MEDIUM.** This is the *cheapest* of the co-op mechanics because it reuses the entire stack — the tug-of-war screen, the `mud_slings` realtime subscription, the `sling_mud` hot path, the per-capita/quorum scoring, and the bounded idempotent payout — and adds exactly **one table, one column (`last_sling_at`) + one index, five constants, two extended RPCs (same signatures), two surfaced query RPCs, and one banner**. No new screen, no new payout engine, no new realtime channel. The MEDIUM tail is (a) tuning the window/combo curve for feel at low population, (b) the cosmetic-generation pass via icon-gen, and (c) getting the `last_sling_at` window + idempotent mint exactly right (the one genuinely new bit of logic). The risky parts (economy faucet, alt abuse, idempotency) are all *closed by reusing the existing capped machinery* rather than building new.

## Connects to

- [[sounder-mud-fights]] — the base system this layers onto; the Heave is the deferred "cooperation-bonus mud" P3 hook named in its Open-questions list.
- [[snouts-economy]] — bonus mud pays out through the *existing* bounded `resolve_war` snout grant; no new faucet.
- [[trough]] — `resolve_war` clones the Trough's lazy first-reader resolution; the Heave inherits it untouched.
- [[regen]] — winners still get the `war_winner_regen` ×0.85/72h buff via `regen_secs_for`; the Heave doesn't touch the buff path.
- [[notifications]] — the Heave-open nudge fires via `send_push_to_user` + INLINE `system_announcements` (never `send_system_announcement`).
- [[shop-cosmetics-closet]] — war-exclusive animated backgrounds/hats are the headline non-economic reward (icon-gen pipeline).
- [[achievements-and-titles]] — optional `mud_heaver` title via the `mud_war` source + `user_titles` pattern.
- [[identity-model]] — cosmetic-only rewards keep the war's economic isolation clean.
