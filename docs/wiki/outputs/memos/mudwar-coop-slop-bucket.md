---
title: "Pass the Slop Bucket — async crew-relay co-op layer (build-ready plan)"
type: plan
date: 2026-06-14
tags: [plan, mud-wars, co-op, async, telephone, relay, cosmetics, fairness]
status: draft
---

# Pass the Slop Bucket

> A shared slop bucket the whole crew fills on their own time: anyone can add a scoop whenever they open the app, and a lap completes the instant **every active member has scooped** — a parallel meter, not a baton — for a **capped** crew bonus, repeating until the war ends. A telephone *narration* (whose turn the "🪣 it's with you" nudge points at) rides on top for the open-loop pull, but it can never block a scoop. Bolted onto the existing Mud Fights stack as a layered co-op bonus that never reopens the snowball.

This is a **follow-on migration** to the unpushed `20260647000000_mud_fights.sql`. It reuses crews/mud_wars/mud_slings wholesale and adds two small relay-state tables + a handful of RPCs. It honors the resolved design: **ASYNCHRONOUS** (no co-presence, no real-time windows), **parallel sum-of-parts contribution** (the brief's *"parallelize, never serialize"* mandate — no single blocker), a **capped** co-op bonus layered on the flat-20 base sling, war fully isolated + reset each war, ~3-on/1-off cadence, rewards = many war-exclusive cosmetics + a capped core snout payout.

---

## How it plays (ASYNC)

The slop bucket is a shared crew artifact with a **telephone baton riding on top of a parallel meter**. This split is the load-bearing design decision, and it resolves the brief's sharpest warning head-on (research Lens 1: *"Parallelize, never serialize… a 5-person crew has zero slack; the war must be a collaborative artifact each member fills independently — sum of parts, not a baton"*):

- **The lap is a parallel meter, not a baton.** A lap completes when **every active-this-war member has added ≥1 scoop this lap, in any order, on their own time** — nobody waits on anybody to *act*. Scooping is never gated on "it's your turn"; you can scoop the moment you open the app. This is the brief's mandated *sum-of-parts* structure (and matches Monopoly GO partner-event "shared meter everyone fills from normal play").
- **The baton is the narration + heartbeat only.** On top of the meter, a single `holder_id` advances in fixed order purely to decide **who gets the "your turn, the bucket's with you" push** and whose name leads the carried-forward flavor line. The baton can *never block a scoop* — it only steers the open-loop nudge (research Lens 1: *push is the heartbeat; open-loop "your turn" is a Zeigarnik pull*). If the holder stalls, the baton skips forward (below) so the nudge keeps moving; meanwhile any of the other four can already be scooping toward the lap. **No single human ever blocks the crew's progress *or* their own reward** — the single-blocker failure mode (Diplomacy, Draw Something) is designed out, not patched with a skip valve.

**The loop, concretely:**

1. **Order fixed at war start.** When a war goes `active` (`accept_challenge` / `challenge_house` stamp `started_at`), each crew gets a baton order = its `crew_members` rows sorted by `joined_at` (stable, deterministic, the same source `leave_crew` leader-succession uses). The bucket starts with the first member; `slop_relay.holder_id` is whoever currently *holds the nudge*. (`leave_crew` already blocks leaving during an `active`/`pending` war — line 379-383 of `20260647` — so the order can't churn mid-war; no roster-drift edge to handle.)
2. **Add a scoop — anytime, turn or not.** On `/mud-war` the bucket CTA reads **"Add a scoop"** for everyone, with a gentle **"the bucket's with you 🪣"** accent when you're the current holder. Tapping calls `add_scoop(p_war)`. One scoop = one `mud_slings` increment (the relay *rides the existing base verb* — a scoop IS a sling, counting toward the flat-20 daily allotment and per-capita score; nothing new to balance). If you were the holder, the baton advances and a push fires to the next member; if you weren't, you still scooped toward the lap and the baton is untouched.
3. **You build on what came before.** The bucket is a running artifact: `slop_relay.scoops` increments every scoop, and `last_scooper_id` + a rotating `flavor` string (e.g. "extra-muddy", "frothy", "lumpy") carry forward so the holder's nudge reads **"Greta added a frothy scoop (#7) — toss yours in."** The fun lives in the accumulation, telephone-style (research Lens 1: *one shared artifact each player mutates in turn*; *reframing the warped result as content*).
4. **A full lap = the bucket is full = a capped crew bonus.** When every **active-this-war** member has scooped this lap (each member's `slop_scoops.scooped_lap` reaches `cur_lap`), the lap closes on that completing scoop: `laps` increments, every member who scooped that lap gets a small **capped** co-op bonus (deduped per member by `last_paid_lap`), and a fresh lap opens. Laps repeat for the whole war. Because completion is "everyone scooped" rather than "the baton returned home," a slow holder can't freeze a lap that the other four already finished.
5. **The war still resolves on the clock.** The base 5-day window and `resolve_war` are unchanged. The relay is a *bonus layer* — a crew that never touches the bucket still fights a normal flat-20 war. The relay can't extend or block resolution.

**How a turn is prompted (push as the heartbeat).** The nudge is the baton's whole job, so the prompt is load-bearing. When a scoop advances the baton, `add_scoop` ends by **inlining a push + an announcement to the new holder** (research Lens 1: *push is the heartbeat, ~20% open rate, open-loop "your turn" is a Zeigarnik pull*):

- `send_push_to_user(next_holder, 'The slop bucket is with you 🪣', '<crewmate> added a frothy scoop — toss yours in', {war_id, kind:'slop_bucket_turn'})` — best-effort, no-ops if untokened (reads `profiles.expo_push_token`; this is the **non-admin** push path, NOT `send_system_announcement`; signature verified at `20260520050000_push_delivery.sql` line 24).
- An **INLINE** `system_announcements` row (`kind='slop_bucket_turn'`) as the backstop, so an untokened player still sees "it's your turn" via the WhileAway modal (`_layout.tsx` → `my_unseen_announcements()`).
- All of it **savepoint-guarded** (`BEGIN … EXCEPTION WHEN OTHERS THEN NULL`) so a push/announcement fault can never roll back the scoop write — the 20260647 hardening pattern.

**Gift-framing, never blame.** Copy celebrates the pass ("the bucket's moving!"), never shames a stall ("Greg sat on it"). On a skip, the next holder just sees "your turn" — they're never told who got skipped (research Lens 4 / coop brief: *gift, not debt; no streak-broken red emoji*).

---

## Scoring & fairness (capped crew points without reopening the snowball)

The relay must add cooperation texture **without** undoing the anti-snowball spine that makes Mud Fights fair (flat-20, per-capita-average, quorum-2). It does this by being a **bonus layered on top of the base sling**, capped hard, and gated by a binary floor.

**The bonus shape (low floor, flat ceiling — research Lens 4 principle 3 & Lens 4 fairness table "Performance-weighted participation"):**

- **A scoop IS a sling.** `add_scoop` writes one `mud_slings` increment, clamped by the *same* daily-20 allotment (`LEAST(20, slings+1)`). So the relay can never let anyone exceed the flat ceiling — a whale who taps the bucket 200×/day still tops out at 20 slings/day like everyone else. The flat-20 cap *is already the anti-whale, anti-alt tool* (research Lens 4: *capping payout is itself the strongest anti-collusion lever — it starves alt-funneling of payoff*).
- **The lap bonus is small, flat, and per-completed-lap.** Closing a lap grants each member who scooped that lap a fixed `SLOP_LAP_BONUS` (proposed **5 snouts**, no `tickles_earned` → off the leaderboard, so it can't be farmed for rank) — *not* a multiplier on their slings, *not* scaled by who scooped most. Flat removes the DKP-gap snowball (research Lens 4: *a flat/capped reward kills the whale-snowball and the DKP-gap simultaneously*).
- **A per-war cap on relay bonus.** `slop_scoops.bonus_paid` accumulates per member and is hard-capped at `SLOP_BONUS_CAP` (proposed **50 snouts/member/war** = 10 laps). Past the cap, laps still complete (the cosmetic/fun continues) but pay 0. The `last_paid_lap` ledger makes each lap's payout exactly-once even under a concurrent double-close. This is the cash-faucet lesson: **cap + idempotent + server-authoritative**.
- **Binary participation floor for the cosmetic.** The war-exclusive cosmetic (below) is gated on a binary "did you add ≥1 scoop this war" check — clearable in one tap, one session. Kills the pure free-rider without grading effort (research Lens 4: *a low binary floor, not a graded grind*; coop brief: *Clash of Clans "contribute ≥1 to claim any reward" — the cleanest gate*).

**Why this can't reopen the snowball or reward alts/free-riders:**

- **Snowball:** the relay never touches the per-capita-average winner math in `resolve_war`. Scoops fold into `mud_slings` and are already capped at 20/day, so the *war outcome* is decided exactly as today. The relay bonus is a flat snout trickle bounded at 50/war — economically negligible next to a real win's payout, by design.
- **Alts:** an alt added to a crew must *clear the floor itself* to earn anything, and the flat-20 cap means the alt can contribute at most what a real member can — adding an alt drags the per-capita average **down** (the existing spine) while adding only a capped 5-snout-per-lap trickle. There is no concentrated-effort payoff to funnel, so the alt incentive collapses (research Lens 4).
- **Free-riders:** a member who never scoops earns **zero** relay bonus AND zero war-exclusive cosmetic (binary floor), while the crew's base war proceeds without them (graceful degradation — *a missing member contributes 0, the clock still resolves*, research Lens 1 principle 2). Crucially, **a free-rider can't even slow the rest of the crew down**: lap completion is "every active member scooped," and a never-online member is excluded from "active" (below), so the other four close laps without them.

**Stall handling — the baton skips, the lap never stalls (no single blocker, no griefable auto-skip):** Because the *lap* is a parallel meter (completion = everyone-who-is-active scooped), the only thing the baton stall can delay is the *nudge*, never the crew's progress or anyone's reward. The fatal telephone failure mode (research Lens 1: *Diplomacy hangs on one neglected turn; BGA's auto-skip is exploitable*) simply doesn't apply, because nobody's scoop is gated on the baton. The baton-skip exists only to keep the heartbeat moving:

- Each baton hand-off stamps `slop_relay.holder_since`. If the current holder hasn't scooped within `SLOP_SKIP_HOURS` (proposed **24h** — generous, async, "take your turn on your own time"), the **next** caller's `add_scoop`/`war_state` read lazily advances the baton past the stalled holder (the same lazy-on-read pattern `resolve_war` uses — no cron) so the *next* live member gets the nudge.
- The skip is **time-gated, not actor-gated** — a teammate can't *choose* to skip an active player (the BGA exploit); the baton only moves past you after *you* held the nudge for 24h. It only ever advances *forward in the fixed order*, so it can't be weaponized to deny a specific person their scoop (and it can't, since scooping isn't baton-gated anyway).
- **Who counts as "active-this-war" for lap completion.** A member is *active* (and so required-and-able to complete the lap) the moment they log their **first scoop of the war**. A member who has never scooped the entire war is *not* counted toward lap completion — so a totally-absent player never freezes a lap. A member who scooped earlier but goes quiet *is* still counted; if they sit out a lap, that lap simply waits on them **only up to** the per-war clock — but since no other player is *blocked from scooping their own next lap's contribution* (a player can be "ahead" by scoops while the lap-close bonus waits), the felt experience is never a freeze. Lap bonus quorum still requires ≥2 distinct scoopers that lap (`SLOP_LAP_QUORUM`, mirrors the war's QUORUM=2), so a solo player can't farm laps alone.

**Everyone scores, win or lose.** The relay bonus and the war-exclusive cosmetic are granted on *participation*, decoupled from the win/loss outcome (research Lens 1 principle 4: *everyone scores, race don't duel*; coop brief: *earn whether you win or lose defangs sandbagging*). Losing the war still leaves you with your scoops' worth of relay snouts and the war cosmetic if you cleared the floor.

---

## Already built ✅ (TTP reuse)

- **Crews + roster + join order.** `crews`, `crew_members` (with `joined_at` — the deterministic relay order), `is_crew_member`, recursion-safe RLS, cap-5 trigger — all in `20260647000000_mud_fights.sql`. The relay needs *zero* new membership code.
- **The war + the base verb.** `mud_wars` (status/started_at/ends_at/resolved_at), `mud_slings` (the `UNIQUE (war_id, user_id, war_day)` flat-20 row a scoop rides on), `sling_mud`'s `LEAST(20, slings+1)` clamp — the scoop *is* a sling. Per-capita-average + quorum-2 winner math in `resolve_war` is untouched.
- **Lazy idempotent resolution pattern.** `resolve_war` (first-reader-after-`ends_at`, `FOR UPDATE` + `resolved_at` guard) — the relay's lap-close and skip-advance copy this exact lazy-on-read shape, so no cron.
- **The push + announcement spine.** `send_push_to_user(uid,title,body,data)` (SECURITY DEFINER, reads `expo_push_token`, no-ops if untokened — the legitimate **non-admin** push path) in `20260520050000_push_delivery.sql`; the `system_announcements` table + `my_unseen_announcements()` WhileAway poll in `_layout.tsx`; the INLINE-insert convention proven across `invite_to_crew`/`accept_challenge`/`resolve_war`.
- **Client war scaffolding.** `useMudWar` (lazy resolve on focus, optimistic tap, throttled realtime sub on `mud_slings`), `utils/mudWars.ts` typed RPC wrappers + `WarState`/`WarSide` shapes, `app/mud-war.tsx` war screen, `constants/mudFights.ts` constant mirror. The relay extends these, doesn't replace them.
- **Cosmetics infra (the whole reward pipeline).** `hats` catalog (`category` + `rarity` per `20260502030000_shop_catalog.sql`), `user_hats` inventory, equip slots `active_hat_id`/`active_glasses_id`/`active_mask_id`/`active_neck_id`/`active_aura_id`/`active_background_id`/`active_held_id`/`active_tickle_particle_id` (across `20260514000000`/`20260519000000`/`20260549000000`/`20260596000000`), `HAT_IMAGES` + `HAT_OVERLAYS` render path, the backgrounds folder (full-canvas opaque, `Z_BEHIND_PIG`), and the **weighted-grant helper `grant_mystery_box(uid, box_kind)`** (rarity-weighted, unowned-only, snout fallback) — the exact pattern for a "Slop Bucket pull."
- **Titles + buff infra.** `titles` (`source='mud_war'`, `mud_champion/veteran/legend`), `user_titles`, the `war_winner_regen` blessing kind folded into `regen_secs_for` — the relay can add a participation title with one seed row.
- **Anti-collusion precedent.** `challenge_crew`'s 24h rematch cooldown + the bot-farm neutralization (bot wins give no `tickles_earned`/`war_wins`/titles) — the relay's flat-cap follows the same "bounded, off-leaderboard" stance.
- **Feature flag.** `MUD_FIGHTS_VISIBLE = false` in `constants/featureFlags.ts` — the relay ships dark behind the same flag (add `SLOP_BUCKET_VISIBLE` if it wants independent staging).

---

## What's needed 🔨

**Migration file:** `supabase/migrations/20260650000000_slop_bucket_relay.sql` (sorts after the latest applied `20260649000000_onboarding_checklist.sql` and after the unpushed `20260647`; ships as a **follow-on**, never a CREATE-OR-REPLACE of the mud-fights file — carry-latest-def footgun).

### Table

```sql
-- One relay per (war, crew). The bucket's current state.
CREATE TABLE IF NOT EXISTS public.slop_relay (
  war_id          uuid        NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
  crew_id         uuid        NOT NULL REFERENCES public.crews(id)    ON DELETE CASCADE,
  holder_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL, -- whose turn
  holder_since    timestamptz NOT NULL DEFAULT now(),                       -- skip clock
  last_scooper_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  scoops          int         NOT NULL DEFAULT 0,   -- total scoops this war (every add_scoop)
  laps            int         NOT NULL DEFAULT 0,   -- completed full laps
  cur_lap         int         NOT NULL DEFAULT 1,   -- the lap currently being filled (1-based)
  flavor          text        NOT NULL DEFAULT 'fresh',
  PRIMARY KEY (war_id, crew_id)
);
-- Per-(war,member) participation + bonus ledger (floor gate + cap + lap-fill tracking).
CREATE TABLE IF NOT EXISTS public.slop_scoops (
  war_id        uuid NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scoop_count   int  NOT NULL DEFAULT 0,   -- ≥1 ⇒ "active-this-war" (the binary floor + lap-roster membership)
  bonus_paid    int  NOT NULL DEFAULT 0,   -- capped at SLOP_BONUS_CAP
  scooped_lap   int  NOT NULL DEFAULT 0,   -- highest lap this member has scooped in (the meter cell)
  last_paid_lap int  NOT NULL DEFAULT 0,   -- highest lap already paid out (bonus dedupe)
  PRIMARY KEY (war_id, user_id)
);
```

`scoop_count ≥ 1` is the single source of truth for three things: the **binary participation floor**, the **"active-this-war" lap roster**, and the cosmetic-grant gate. `scooped_lap = slop_relay.cur_lap` means "this member has filled their cell for the current lap." A lap closes when **every member with `scoop_count ≥ 1` has `scooped_lap ≥ cur_lap`** and ≥2 of them are distinct — purely a set check over `slop_scoops`, no baton-position math.

RLS: SELECT-only, gated on `is_war_participant(war_id, auth.uid())` (the proven helper); all writes via SECURITY DEFINER RPCs. Add both tables to `supabase_realtime` (guarded `DO $$ … EXCEPTION WHEN OTHERS THEN NULL`) so the meter + baton hand-off animate live, same as `mud_slings`.

### RPC signatures

- `public.start_relay(p_war uuid, p_crew uuid) RETURNS void` — internal, SECURITY DEFINER, REVOKEd from PUBLIC. Called from `accept_challenge`/`challenge_house` (extend those two RPCs — carry their **latest** bodies verbatim, add the `start_relay` call after the existing announcement loop) to seed one `slop_relay` row per real crew with `holder_id` = first member by `joined_at`, `cur_lap = 1`. (Bot crew gets no relay — `challenge_house` seeds only the one real crew; `accept_challenge` seeds both real crews.) `ON CONFLICT (war_id, crew_id) DO NOTHING` so a re-accept can't double-seed.
- `public.add_scoop(p_war uuid) RETURNS jsonb` → `{ ok, reason?, scoops, laps, myScoopedLap, myRemainingToday, lapClosed, bonusAwarded, isHolder }`. The hot path (note: **scooping is never blocked by the baton** — that's the whole parallel-meter point):
  1. Guards mirror `sling_mud` (`unauthenticated`/`no_war`/`war_not_active`/`not_in_war`/lazy-resolve-if-expired).
  2. `FOR UPDATE` on the crew's `slop_relay` row (serializes the meter + baton per crew, same lock discipline as `enforce_crew_cap`). First run `advance_if_stalled` so a stale baton gets moved before this scoop is attributed.
  3. Write the scoop = one `mud_slings` upsert (`LEAST(20, slings+1)`); if already at daily cap → `{ok:false, reason:'daily_cap'}` (no meter/baton change — you've already used your 20 today; come back tomorrow or just hold the nudge).
  4. Upsert `slop_scoops`: `scoop_count+1`, set `scooped_lap = GREATEST(scooped_lap, cur_lap)`. Bump `slop_relay.scoops`, stamp `last_scooper_id`, rotate `flavor`.
  5. **Baton advance — only if the caller IS the current `holder_id`:** advance `holder_id` to the next member in fixed order, reset `holder_since`. If the caller wasn't the holder, the baton is untouched (they scooped toward the lap anyway). Return `isHolder`.
  6. **Lap-close check (set-membership, not baton position):** if **every** member with `scoop_count ≥ 1` now has `scooped_lap ≥ cur_lap` AND that set has ≥`SLOP_LAP_QUORUM` members → `laps+1`, `cur_lap+1`; for each member whose `last_paid_lap < laps`, pay `SLOP_LAP_BONUS` (`counter` only, no `tickles_earned`) bounded by `SLOP_BONUS_CAP`, set `last_paid_lap = laps`; grant the war cosmetic + title to every floor-clearer not yet holding it (idempotent `ON CONFLICT DO NOTHING`); set `lapClosed`/`bonusAwarded`. The bonus dedupe is `last_paid_lap`, so a concurrent double-close can never double-pay a lap.
  6. INLINE push + `system_announcements` to the **new** holder, *only if the baton advanced* (savepoint-guarded).
- `public.advance_if_stalled(p_war uuid, p_crew uuid) RETURNS boolean` — internal, REVOKEd. Baton-only skip: if `now() - holder_since > interval 'SLOP_SKIP_HOURS hours'`, advance `holder_id` to the next member in fixed order, stamp `holder_since`. **Touches only the baton/nudge — never the lap meter** (the meter is a `slop_scoops` set check, so the baton can't freeze or alter it). Called from `add_scoop` and the read path. Idempotent under `FOR UPDATE`. Loops at most `CREW_CAP` advances so a fully-idle crew can't spin.
- Extend `public.war_state(p_war uuid)` — carry its **latest** body verbatim, add a `relay` block to the returned jsonb: `{ holderId, holderName, isMyTurn, scoops, laps, curLap, myScoopedLap, lapFilled, lapTotal, flavor, lastScooperName, skipAtIso }` (where `lapFilled`/`lapTotal` are the meter's filled-vs-active counts for the progress bar), and call `advance_if_stalled` before reading (lazy skip on read, same place it already lazy-resolves the war). `isMyTurn` is purely cosmetic now (it accents the CTA; it does **not** gate scooping).
- All grants: `GRANT EXECUTE … add_scoop TO authenticated`; `REVOKE … FROM PUBLIC` on `start_relay`/`advance_if_stalled` (the `war_side` lesson — SECURITY DEFINER defaults to PUBLIC EXECUTE; verified at `20260647` line 931).

### Constants (mirror in `constants/mudFights.ts` AND inline in each RPC — drift caveat already documented there)

```ts
export const SLOP_LAP_BONUS = 5;     // flat snouts per member per completed lap
export const SLOP_BONUS_CAP = 50;    // hard cap on relay snouts per member per war (10 laps)
export const SLOP_SKIP_HOURS = 24;   // hold this long → the bucket skips past you
export const SLOP_LAP_QUORUM = 2;    // distinct scoopers needed to bank a lap bonus
```

### Cosmetic seed (the floor reward + the pull)

```sql
-- War-exclusive background, granted on first qualifying lap to floor-clearers.
INSERT INTO public.hats (id, name, emoji, image_path, cost, display_order, category, rarity, description)
VALUES ('bg_slop_bucket', 'Slop Bucket Bog', '🪣', 'backgrounds/slop_bucket_bog.png',
        0, 700, 'background', 'rare', 'Passed the bucket in a Mud Fight.')
ON CONFLICT (id) DO NOTHING;   -- cost 0 = not buyable, war-exclusive (matches season-pass-exclusive convention)
-- Participation title (source must be in titles_source_check — carry the LATEST list incl. 'mud_war').
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES ('slop_relay', 'Bucket Brigade', 'pre', 'Passed the slop bucket a full lap.', 'mud_war', false, 213)
ON CONFLICT (id) DO NOTHING;
```

Grant via `INSERT INTO user_hats … ON CONFLICT DO NOTHING` + `INSERT INTO user_titles … ON CONFLICT DO NOTHING`, savepoint-guarded, inside the lap-close block — idempotent, server-authoritative.

### Client

- `utils/mudWars.ts` — add `addScoop(warId)` (rpcAction), extend `WarState` with a `relay?: RelayState` field + the `RelayState` interface, add `SLOP_*` constants.
- `hooks/useMudWar.ts` — surface `relay`; reuse the optimistic-bump pattern for the scoop tap (bump local `mine` slings + the lap meter instantly, reconcile on failure — note the CTA is *always* enabled when you have slings left, so the optimistic path is the same as `sling`'s today); the existing throttled `mud_slings` realtime sub already covers the opponent + teammate bar; add a parallel sub on `slop_relay` (+ optionally `slop_scoops` for the live meter fill) for the baton hand-off + lap-fill animation.
- `app/mud-war.tsx` — relay strip above the tug bar: the bucket, a **lap-fill meter** (`lapFilled`/`lapTotal` dots, one per active member — the "sum of parts" made visible), the current holder avatar with a soft "🪣 with you / with <name>" accent, scoop count, lap count, flavor line. The main CTA is **"Add a scoop"** for everyone whenever they have slings left (it is *not* gated on `isMyTurn` — only accented by it), disabled-with-reason only on `daily_cap`. This is the visible difference from a baton: the button is live for all five at once.
- Push payload `{kind:'slop_bucket_turn', war_id}` deep-links to `/mud-war` (the announcement-data convention already used by `war_started`/`war_challenge`).

### Push / notifications

- Baton-nudge push fires from `add_scoop` (inline `send_push_to_user`, savepoint-guarded) **only when the baton actually advances** — **never** `send_system_announcement` (admin-gated → silent rollback for non-admins; `20260647` line 17 documents this for the mud-fights RPCs).
- One emoji in the title (🪣), high-CTR framing, gift-toned body (research Lens 1: *emojis +20%, open-loop "your turn" pull*). No nag-spam: at most one push per baton hand-off, to one person; a non-holder's scoop sends nothing.

---

## Rewards tie-in (war cosmetics + capped core payout)

- **The capped core payout** is the flat `SLOP_LAP_BONUS` (5 snouts/lap), `counter`-only (off the leaderboard, can't be farmed for rank), bounded at `SLOP_BONUS_CAP` (50/war). It sits *beside* the existing win payout (own-mud + 50%-of-loser-pot share) and the `war_winner_regen` buff — additive, small, idempotent, server-authoritative.
- **War-exclusive cosmetics** are the headline reward (resolved design: *MANY war-exclusive cosmetics via the ChatGPT/icon-gen pipeline*). The floor grant is `bg_slop_bucket` (an animated bog background at the apex tier per research Lens 3: *put motion at the top*). This scales into a War Pass / Mud-Bucket pull using the **existing** `grant_mystery_box` weighted-grant helper pointed at a `category='background'` (or a new war-themed pool) — *no new grant engine needed*. The asset pipeline is the locked-anchor batch approach (research Lens 3: *one anchor × 8 palettes × 5 set themes = 40 SKUs*; coop brief item-pool checklist) driven by the `icon-gen` skill.
- **A participation title** (`slop_relay` / "Bucket Brigade", `source='mud_war'`; pick a `display_order` clear of the seeded `mud_champion/veteran/legend` at 210-212 — proposed 213) for clearing the floor — the visible, wearable flex the cosmetic economy runs on (research Lens 2: *players pay to be seen*).
- **Reveal-as-reward (P1, not deferred).** The brief is emphatic that *the assembled artifact IS the reward — reveal it with each member's fragment attributed* (Lens 1 principle 5; Lens 4 checklist). Under the parallel-meter model the reveal is nearly free: the lap-fill meter (`lapFilled`/`lapTotal` dots, each tied to a crewmate) **is** the artifact, visible as it fills. On lap-close, the inline `system_announcements` row that already fires can carry a "your crew filled the bucket — Greta, Otis & you scooped lap 3 🪣" body (gift-framed, names the scoopers, never the absent). This costs one extra sentence in the close block, not a new system — so it ships P1, not P3, and is the single cheapest way to honor the brief's central "reveal is the payoff" finding.

---

## Risks / open questions

- **Two crews, two relays, one screen.** Each crew runs its own independent bucket (`PRIMARY KEY (war_id, crew_id)`); the opponent's relay is private (RLS). `war_state` exposes only the caller's relay block (it already resolves `my_crew` for `mine`; the relay block reads that same crew). Confirm the UI never shows the enemy's holder/meter.
- **Lap pacing is now meter-bound, not baton-bound.** Because a lap closes on "every active member scooped" (not "the baton returned home"), a 5-member crew where all five scoop on day 1 closes a lap on day 1 — no waiting through five 24h skips. The only thing 24h `SLOP_SKIP_HOURS` governs is how fast the *nudge* chases an idle holder; it can't slow lap completion. Verify the meter strip *feels* like collaborative fill (the dots lighting up) rather than a turn queue. A shorter `SLOP_SKIP_HOURS` (12h?) only makes the nudge livelier; leave it a constant.
- **Lap-close concurrency.** Two members scooping near-simultaneously must not double-close a lap or double-pay. `FOR UPDATE` on the `slop_relay` row serializes the meter + close check per crew (same lock discipline as `enforce_crew_cap`); the per-member `last_paid_lap < laps` guard makes each lap's bonus exactly-once even if two closes race. Needs a pgTAP test for the race.
- **Floor-gate persistence.** A member who scoops once mid-war then goes quiet keeps their already-earned floor cosmetic + title (grant is `ON CONFLICT DO NOTHING`, never revoked) and stays on the lap roster (so later laps wait on them up to the meter rule) — confirm both in test.
- **Daily-cap while holding the nudge.** If the holder is at their 20-sling daily cap, `add_scoop` returns `daily_cap`; the baton stays with them until they scoop tomorrow or the 24h skip moves the nudge on. This blocks *only the nudge*, never the crew (others scoop freely; the lap can still close around them). Confirm copy reads "you're out of scoops today — the bucket carries on without you" rather than "broken." Also confirm a holder at daily cap is still eventually skipped so the nudge keeps moving.
- **Self-pass alt-farming.** An alt in your own crew could "complete" a 2-person lap with you to farm the flat lap bonus — but `SLOP_LAP_QUORUM=2` of *distinct* members is the floor, the bonus is flat-and-capped (50/war, `counter`-only, off-leaderboard), and the alt drags the war's per-capita average down (the existing spine). The payoff (≤50 off-leaderboard snouts) is below the cost of running an alt, so the incentive collapses — the same flat-cap logic the brief calls the strongest anti-collusion lever.
- **NULL holder edge.** `holder_id` is `ON DELETE SET NULL` (account deletion). `advance_if_stalled` and the read path must treat a NULL holder as "stalled" and advance to the next live member by `joined_at`; the lap meter is unaffected (it reads `slop_scoops`, not the holder). Cover with a test that nulls `holder_id` and asserts the next read re-seeds it.
- **Constant drift** (`constants/mudFights.ts` vs inlined RPC values) — the documented Mud-Fights P3 caveat; the `mud_fight_const()` SQL single-source-of-truth would cover the new `SLOP_*` values too.
- **Test gaps to fill before push:** lap-close on "all active scooped" + bonus-cap, baton skip-after-timeout (meter untouched), floor-gate grant idempotency + persistence, two-distinct-scooper quorum, daily-cap-while-holding, non-holder scoop fills the meter without moving the baton, concurrent double-close pays once. pgTAP `supabase/tests/` after the migration is applied.
- **Unpushed dependency.** This stacks on the unpushed `20260647`; both push together, on explicit user "go" (never autonomously).

---

## Effort

- **Migration (2 small tables + 3 RPCs + 2 RPC extensions + seeds):** ~1 day. The heavy lifting (crews, slings, lazy-resolve, push, announcement, weighted grant) all already exists; this is wiring, not new engines. The one genuinely new bit of logic — the lap-close set-check over `slop_scoops` — is a single `NOT EXISTS (active member with scooped_lap < cur_lap)` query, simpler than baton-return bookkeeping.
- **Client (`utils` types + `useMudWar` relay sub + `mud-war.tsx` meter strip):** ~1–1.5 day. The meter (dots that light per crewmate + the holder accent + flavor line) is a touch more than a static strip, but reuses the existing pip row + sling-tap feel in `mud-war.tsx`.
- **Cosmetic art (1 floor background now, batch pool later):** ~0.5 day for the floor SKU via `icon-gen`; the pool is incremental.
- **Tests (pgTAP for the gaps listed above, ~8 cases):** ~0.5–1 day.
- **Total: ~3–4 days** to a dark-launchable follow-on behind `MUD_FIGHTS_VISIBLE` (and `SLOP_BUCKET_VISIBLE` if staged independently).

---

## Connects to

- [[sounder-mud-fights]] — the host system; the relay is a co-op bonus layer on its crews/wars/slings.
- [[coop-telephone-items-research-2026-06]] — the telephone/async + item-pool + async-fairness research this honors.
- [[coop-mechanics-research-2026-06]] — the prior co-op brief (free-rider gate, gift-framing, no synchronous siege).
- [[notifications]] — the turn prompt is an INLINE push + `system_announcements` row, non-admin path.
- [[snouts-economy]] — the capped relay bonus mints `counter`-only snouts (off-leaderboard).
- [[blessings-curses-effects]] / [[regen]] — unchanged; the relay doesn't touch the win buff.
- [[achievements-and-titles]] — the `slop_relay` participation title (`source='mud_war'`).
- [[trough]] — same lazy first-reader resolution pattern the relay's lap-close/skip copy.
- [[friends-graph]] — crews are friends-gated; the relay order is the crew roster by `joined_at`.
- [[seasons-and-judgement-day]] — pinned alongside Mud Fights as the next-season competitive headline.
