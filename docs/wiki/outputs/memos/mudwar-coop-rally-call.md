---
title: "Mud War Co-op Mechanic — Rally Call"
type: plan
date: 2026-06-14
tags: [plan, mud-wars, co-op, social, notifications, synchronized, fairness]
status: draft
---

# Mud War Co-op Mechanic — Rally Call

> One crewmate fires a timed "rally"; anyone who slings inside the window earns a small **capped crew bonus** that *grows with how many crewmates pile on*, and a push goes out — *"Jen called a mud rally — pile on!"* — turning a solo daily chore into a re-engagement pulse, without ever reopening the snowball or alt-farm holes the base sling so carefully closed.

This is the **synchronized-burst** transfer from the co-op research ([[coop-mechanics-research-2026-06]], "Crew Surge" sketch) made concrete on the real mud-fights stack. It layers a **capped, breadth-scaled bonus** on top of the flat base sling, reusing `sling_mud` + `system_announcements` (INLINE) + `send_push_to_user`. The base war (per-capita-average, quorum-2, flat-20 in `20260647000000_mud_fights.sql`) is untouched; the rally only ever *adds* a bounded bonus, so the anti-dominance spine still holds.

---

## How it plays

The base loop is unchanged: in an active war each member gets a flat **20 slings/day**, use-or-lose, no modifiers (`sling_mud`, `allotment int := 20` in `20260647000000_mud_fights.sql` §6). The rally sits *on top* of that loop.

Day-to-day, on the `/mud-war` `ActiveWar` screen (`app/mud-war.tsx`, the `function ActiveWar` at line 225):

1. **Anyone in the crew can tap "Call a rally"** (one button under the sling juice). A rally is a short, server-stamped window — **15 minutes** (`RALLY_WINDOW_MIN`). It is **opt-in to fire, opt-in to answer** — never a scheduled siege, never a global "be-online-now" spike (the research's hard anti-pattern: synchronous windows punish timezone-spread crews; async + own-clock wins — research §timezone).
2. **A push + announcement fans out to the rest of the crew** the instant the rally is called: *"Jen called a mud rally — pile on for the next 15 min!"* This is the whole point — a **re-engagement pulse with a face on it** (research §pairwise: an obligation with a name re-engages harder than a number; Duolingo's friend-nudge is "from your friend, not the app," structurally un-muteable). The caller is *giving the table a gift*, not flexing (research principle #4, "one person's prep is a gift to the table").
3. **Crewmates who sling at least once inside the window "answer" the rally.** Each answerer (including the caller) earns a **breadth-scaled bonus** of mud credited to the war — capped, see below. The screen shows a live *"4 of 5 answered — 9 min left"* banner (research principle #2: render co-presence, don't infer it; a visibly filling count is the most motivating UI state in the genre).
4. **When the window closes** (lazily, on next read — same pattern as `resolve_war`/`war_state`), the rally is settled: bonus already credited per-answerer, banner flips to *"Rally over — +N for the crew."* A short cooldown (**~3h**, mirroring the existing truffle re-dig cooldown — `interval '3 hours'` in `20260629000000_truffle_redig_cooldown.sql`) gates the next rally so the pulse stays special and can't be machine-gunned.

**Cadence shape ("3-on / 1-off").** The resolved design's rhythm is *bursts clustered, then a rest*: the per-crew daily cap is **2 rallies/day** and the 3h cooldown means a crew can fire a couple of close-together pulses ("on") and then is forced quiet ("off") — the research's **rolling/relay** intuition (Puyo's 10-min relay) reframed for a cozy crew as *a short flurry of rallies, never a constant siege*. v1 ships the simplest instantiation of that rhythm: fixed 15-min window + 3h cooldown + 2/day cap. (A v1.1 relay — each answer *extends* the window — is the natural escalation; see Risks.)

The feel target (the evoke-online-game-feel design philosophy): a small cozy burst of "we all showed up at once" a couple times a day, **never required** — a member who ignores every rally still earns their full flat-20 base and is never punished (research principles #1 + #5: reward presence, don't punish absence; one absent member must never sink the crew).

---

## Scoring & fairness

The single hardest constraint, honored from the founder grill: **the rally must add capped crew war-points without reopening snowball or alt abuse.** The base war is "fully isolated + resets to zero each war" (each war's slings live in `mud_slings` keyed by `war_id`, scored fresh in `resolve_war`); the rally is a *capped co-op bonus layered on the simple base daily sling.*

**Where the bonus lands.** A rally answer mints bonus mud into a **dedicated `rally_bonus` column** on the *same* `mud_slings` ledger the base loop uses, so it flows through the existing per-capita-average / quorum-2 scoring with a **one-line change** in `resolve_war` and `war_side`. (Tracked in a separate column so it can be capped independently of the flat-20 base clamp yet still rolled into the per-member sum — see "What's needed".)

**The bonus is breadth-scaled, not flat-per-head — this is what makes togetherness *strictly* better (research principle #1).** A rally where only the caller answers is worth less per head than a rally the whole crew piles into. Concretely, each answer earns `RALLY_BONUS_BASE = 2` mud, plus a `+1` "pile-on" step for each *other* answerer already in the window at the moment you answer, clamped so a single answer can never exceed `RALLY_BONUS_MAX = 3` and the per-day total per member can never exceed `RALLY_BONUS_DAILY_CAP × RALLY_BONUS_MAX = 6`. The "feels multiplicative" payoff comes from the *banner filling and everyone's bonus ticking up together*, not from multiplying anyone's raw sling volume — so the per-capita-average shape stays honest (a percentage-of-volume bonus would re-privilege the heavy slinger and reintroduce a snowball — research §fairness).

*Worked example (5-member crew, everyone answers).* Bonus is `LEAST(3, 2 + other_answers_so_far)`. The 1st answerer banks `2+0 = 2`; the 2nd `2+1 = 3`; the 3rd/4th/5th each `2+(≥2) → 3` (clamped). Per-member daily total is then `LEAST(6, …)`. Note the **caller is usually the 1st answerer and so banks the *smallest* per-answer bonus (2)** — deliberately on-brand: the caller's reward is the *gift to the table* (the whole crew's pile-on), not a personal payout. Total crew bonus for a full 5-pile rally ≈ `2+3+3+3+3 = 14` mud, spread across 5 real humans, still under the `members × 20 × days` base ceiling and still gated by quorum.

**The four caps that keep fairness intact** (each cites the research that demands it):

- **Bonus is breadth-scaled and absolute-clamped, never multiplicative on personal volume.** Answering is worth `LEAST(RALLY_BONUS_MAX, RALLY_BONUS_BASE + other_answers_so_far)` mud, independent of how much you've already slung. Rejecting "multiply your slings" keeps the per-capita *average* shape honest (research §fairness: "per-capita/average scoring is the explicit anti-snowball move… and what TTP already does").
- **Daily rally-bonus cap per member.** A member can bank rally bonus from at most **2 rallies/day** (`RALLY_BONUS_DAILY_CAP = 2` → max +6 mud/day/member, ~30% over the flat-20 base). This is the Clash-Royale "low, breadth-forcing per-account daily cap" — an alt that only ever answers rallies is worth a near-worthless +6/day and still must clear the quorum-of-real-humans gate to matter (research §fairness, contribution caps).
- **The quorum gate is unchanged and now does double duty.** Scoring still requires **≥2 active members** (`c_quorum int := 2` in `resolve_war`; `'quorumMet', active >= 2` in `war_side`). A rally answered by one person credits that one person's bonus but cannot, by itself, lift a crew over a real opponent — the average still needs 2+ real humans active. Alts can't manufacture a win by spamming self-rallies.
- **Anti-collusion on the call itself.** A rally call is rate-limited per *crew* (the ~3h cooldown), and a member's *own* rally only pays them bonus once **≥1 other member has also answered it** (kills the solo-alt-rally → free-bonus loop). Both are cheap `EXISTS` guards in the answer path, in the spirit of the existing `challenge_crew` 24h rematch cooldown (lines 433-438).

Net effect: the rally is **strictly-better-when-together and worthless-when-alone** — exactly the research's prescription (togetherness strictly better, never required; floor generous; alts and free-riders made worthless without a punitive ban layer). The base war's "members × 20 × days" ceiling rises by at most a bounded **answers × 3** that itself needs multiple real humans to count.

---

## Already built ✅

The rally reuses almost the entire mud-fights + push stack — this is a thin layer, not a new system. Every reference below is verified against the cited file.

- **`sling_mud(p_war uuid)`** — the hot path (lines 550-584). Rally-answer detection hooks the *existing* sling write; no new write path for the core action.
- **`mud_slings` table** — the ledger the bonus lands in (`war_id, crew_id, user_id, slings, war_day`; `slings` `CHECK (slings >= 0 AND slings <= 20)`; `UNIQUE (war_id, user_id, war_day)` — lines 93-102). Already in the `supabase_realtime` publication (line 181), so the rally banner gets live updates for free via the existing `useMudWar` subscription on `mud_slings`.
- **`resolve_war` / `war_side` / `war_state`** — per-capita-average + quorum-2 scoring (588-870); bonus rides through. `war_state` gates on `is_war_participant` and lazily resolves on read (842-845) — the same lazy pattern settles an expired rally.
- **INLINE `system_announcements` inserts** — every mud-fights RPC announces this way (`invite_to_crew` 320-326, `challenge_crew` 441-448, `accept_challenge` 509-517, `resolve_war` 711-725), each wrapped `BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END`. `system_announcements.kind` is free-form `text NOT NULL` with **no CHECK** (`20260556000000_system_announcements.sql` line 28), so a new `'mud_rally'` kind needs no constraint migration. **Never `send_system_announcement`** (admin-gated → silent rollback for non-admins — [[notifications]], the documented footgun).
- **`send_push_to_user(target_user_id uuid, push_title text, push_body text, push_data jsonb)`** — `20260520050000_push_delivery.sql` lines 24-28. Fire-and-forget Expo push, no-ops on missing token (lines 41-43), already savepoint-wrapped by every caller. The rally call loops the crew and fires one push each — this is the *first* mud-fights feature to use real push (challenges only used `system_announcements`), precisely the re-engagement upgrade.
- **`useMudWar` hook + `app/mud-war.tsx ActiveWar`** — optimistic sling taps (`bumpMine`), throttled realtime on `mud_slings` (1500 ms, lines 105-110), tug-of-war bar + roster pips (284-299), splat/squish juice (242-264). The rally button + banner slot into `ActiveWar`; `useMudWar` gains a `callRally()`/`rally` field alongside `sling()`.
- **`utils/mudWars.ts` + `constants/mudFights.ts`** — typed `rpcAction` wrappers (`slingMud` etc.) and the client-side constant mirror (`DAILY_ALLOTMENT = 20` …). Rally constants and wrappers append here.
- **Lazy idempotent settle pattern** — `resolve_war`'s `FOR UPDATE` + `resolved_at` idempotency stamp (608-612, 707) is the template for the rally's "settle once" guard.
- **Cosmetic grant rails already exist** — `user_titles (user_id, title_id)` with `ON CONFLICT DO NOTHING` (the title path, used in `resolve_war` 691-700 and ~10 other migrations) **and** the equippable item slots `active_background_id` / `active_aura_id` on `profiles` (`20260514000000_aura_background_slots.sql`) for a *background* cosmetic. The rally reward uses whichever fits the artifact (title for a badge, background-item for the animated splatter) — see "Rewards tie-in", which no longer conflates the two.

---

## What's needed 🔨

Ships as a **follow-on migration `20260650000000_mud_rally.sql`** (after `20260649000000_onboarding_checklist.sql`, the verified current latest; mud-fights `20260647` is still UNPUSHED, so this stacks cleanly on top). Carry-latest-def discipline: the `CREATE OR REPLACE` of `sling_mud` must start from the `20260647` body (lines 550-584) **verbatim** and add only the rally hook — re-deriving from an older base would silently drop the lazy-resolve and the `LEAST(20, …)` daily clamp.

### New tables

```sql
CREATE TABLE public.mud_rallies (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    war_id      uuid        NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
    crew_id     uuid        NOT NULL REFERENCES public.crews(id)     ON DELETE CASCADE,
    caller_id   uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
    started_at  timestamptz NOT NULL DEFAULT now(),
    ends_at     timestamptz NOT NULL,            -- started_at + RALLY_WINDOW_MIN
    settled_at  timestamptz,                     -- idempotency stamp (mirrors mud_wars.resolved_at)
    created_at  timestamptz NOT NULL DEFAULT now()
);
-- One live rally per crew (the ~3h cadence is enforced in the RPC, but this
-- partial unique blocks two concurrent open rallies — the TOCTOU belt).
CREATE UNIQUE INDEX mud_rallies_one_open_per_crew
    ON public.mud_rallies (crew_id) WHERE settled_at IS NULL;
CREATE INDEX mud_rallies_settle_idx ON public.mud_rallies (ends_at) WHERE settled_at IS NULL;

-- Answer dedup + per-rally answer count (for breadth scaling, the banner,
-- and the anti-self-rally check). The PK dedupes a member's repeated slings
-- within one rally — only the FIRST in-window sling earns the bonus.
CREATE TABLE public.mud_rally_answers (
    rally_id  uuid        NOT NULL REFERENCES public.mud_rallies(id) ON DELETE CASCADE,
    user_id   uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
    bonus     int         NOT NULL DEFAULT 0 CHECK (bonus >= 0 AND bonus <= 3),  -- RALLY_BONUS_MAX
    answered_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (rally_id, user_id)
);
```

### New column on `mud_slings`

A separate bonus column so the bonus is **capped independently** of the flat-20 base clamp, yet still sums into the per-member total for scoring:

```sql
ALTER TABLE public.mud_slings
    ADD COLUMN IF NOT EXISTS rally_bonus int NOT NULL DEFAULT 0
        CHECK (rally_bonus >= 0 AND rally_bonus <= 6);   -- RALLY_BONUS_DAILY_CAP(2) × RALLY_BONUS_MAX(3)
```

`resolve_war` / `war_side` scoring then sums `slings + rally_bonus` per member. The two touch-points are exact and minimal:
- `resolve_war` lines 620 & 633: `SUM(slings)::int AS own` → `SUM(slings + rally_bonus)::int AS own` (both the challenger and defender subqueries; the FOR-loop payout at 665 too, so the loser-pot and reward use the bonus-inclusive `own`).
- `war_side` line 794: `COALESCE(SUM(ms.slings), 0)` → `COALESCE(SUM(ms.slings + ms.rally_bonus), 0)`.

The base-20 clamp on `slings` is preserved exactly; the bonus rides alongside, capped by its own CHECK + the daily-answer guard. **Carry-latest-def note:** `resolve_war` is *not* re-created by this migration — only the two `SUM` expressions change, so re-`CREATE OR REPLACE` from the `20260647` body verbatim and edit only those lines.

### Table to realtime + RLS

```sql
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mud_rallies;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
```
RLS: `mud_rallies` + `mud_rally_answers` SELECT gated on `is_war_participant(war_id, auth.uid())` (reuse the existing SECURITY DEFINER helper, lines 139-147 — no policy recursion). `mud_rally_answers` has no `war_id`; gate it via a join to its `mud_rallies` row, or (leaner) leave it RLS-on with no SELECT policy and surface answer *counts* only through the `rally_state` RPC (preferred — the client never needs raw answer rows).

### RPCs

**`call_rally(p_war uuid) RETURNS jsonb`** — SECURITY DEFINER, `GRANT … TO authenticated`.
- Guard: caller authenticated, war `status = 'active'` and not past `ends_at`, caller `is_war_participant`, caller's crew has **no open rally** (`settled_at IS NULL`) and **none settled in the last `RALLY_COOLDOWN_HOURS` (3h)** (the `EXISTS` cooldown check, mirroring `challenge_crew`'s 24h rematch guard at 433-438).
- Insert one `mud_rallies` row (`ends_at = now() + RALLY_WINDOW_MIN * interval '1 min'`). The `mud_rallies_one_open_per_crew` partial unique is the race belt: a second concurrent `call_rally` raises `unique_violation`, caught → `{ ok:false, reason:'rally_open' }`.
- **INLINE** announce + push to every *other* crew member, savepoint-guarded:
  ```sql
  BEGIN
    SELECT username INTO caller_name FROM public.profiles WHERE id = caller_id;
    FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = my_crew AND user_id <> caller_id LOOP
      INSERT INTO public.system_announcements (user_id, kind, title, body, data)
      VALUES (m.user_id, 'mud_rally', 'Mud rally!',
        COALESCE(caller_name,'A crewmate') || ' called a mud rally — pile on!',
        jsonb_build_object('war_id', p_war, 'rally_id', new_rally));
      PERFORM public.send_push_to_user(m.user_id,
        COALESCE(caller_name,'A crewmate') || ' called a mud rally',
        'Pile on — sling in the next 15 min for a crew bonus!',
        jsonb_build_object('kind','mud_rally','war_id',p_war::text,'rally_id',new_rally::text,'screen','mud-war'));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  ```
- Returns `{ ok, rally_id, ends_at }`.

**`sling_mud(p_war uuid)`** — `CREATE OR REPLACE` from the `20260647` body (550-584) **verbatim**, plus one **savepoint-guarded** rally-answer block after the successful `mud_slings` upsert (so a bonus-path fault can never roll back the core sling — the 20260624 hardening pattern):
1. Find an open rally for the caller's crew: `mud_rallies WHERE crew_id = my_crew AND settled_at IS NULL AND ends_at > now()` `FOR UPDATE` (locks the rally row so concurrent answers serialize for breadth counting).
2. Bail out of the bonus block (but still succeed the core sling) if: no open rally; OR caller already has a `mud_rally_answers` row for this rally (PK dedupe — only the first in-window sling pays); OR caller has already banked from `RALLY_BONUS_DAILY_CAP` rallies today (`COUNT(*)` over today's `mud_rally_answers` joined to `mud_rallies.started_at::date`); OR (anti-self-rally) the rally is the caller's own **and** no other member has answered yet (`NOT EXISTS (SELECT 1 FROM mud_rally_answers WHERE rally_id = r.id AND user_id <> caller_id)`).
3. Otherwise compute `other_answers := (SELECT count(*) FROM mud_rally_answers WHERE rally_id = r.id)` and `bonus := LEAST(RALLY_BONUS_MAX, RALLY_BONUS_BASE + other_answers)`; `INSERT INTO mud_rally_answers (rally_id, user_id, bonus) VALUES (r.id, caller_id, bonus) ON CONFLICT DO NOTHING`; and `UPDATE mud_slings SET rally_bonus = LEAST(6, rally_bonus + bonus) WHERE war_id = p_war AND user_id = caller_id AND war_day = today`.
4. Return shape extends to `{ ok, slings_today, remaining, rally_answered: bool, rally_bonus_today: int }`.

**`settle_rally(p_rally uuid)`** *(lazy, internal)* — `UPDATE mud_rallies SET settled_at = now() WHERE id = p_rally AND settled_at IS NULL AND ends_at <= now()` guarded by `FOR UPDATE`; called lazily from `rally_state`/`war_state` on first read after `ends_at`. No payout pass needed (bonus credited at answer-time). Keeps `mud_rallies_one_open_per_crew` clean so the next rally can fire. `REVOKE EXECUTE … FROM PUBLIC` (internal helper like `war_side`, lines 927-931).

**`rally_state(p_war uuid) RETURNS jsonb`** *(query)* — current open rally for the caller's crew: `{ rallyId, callerName, endsAt, answered: int, crewSize: int, iAnswered: bool, iCalled: bool, onCooldownUntil }`. Lazily settles an expired rally first (the `war_state` pattern, 842-845). Gated on `is_war_participant`. **Folded into `war_state`'s return as a `rally` sub-object** to save a round-trip, since `useMudWar` already calls `war_state` via `my_war`/`war_state`. (`war_state` is `CREATE OR REPLACE` from the 20260647 body verbatim + the `rally` sub-object; carry-latest-def discipline applies.)

### Client changes

- **`constants/mudFights.ts`** — add `RALLY_WINDOW_MIN = 15`, `RALLY_BONUS_BASE = 2`, `RALLY_BONUS_MAX = 3`, `RALLY_BONUS_DAILY_CAP = 2`, `RALLY_COOLDOWN_HOURS = 3` (the server inlines them; keep this mirror in sync, same caveat the file header already flags).
- **`utils/mudWars.ts`** — `callRally(warId)` (`rpcAction`), extend `WarState` with an optional `rally?: RallyState` field + a `RallyState` type, reuse the existing `formatCountdown` for the rally countdown (it already handles sub-hour: `${mins}m`).
- **`hooks/useMudWar.ts`** — expose `rally` (from the folded `war_state.rally`) and `callRally()`. The existing throttled `mud_slings` realtime subscription already repaints answers (bonus lands in `rally_bonus`, picked up on refresh); **add a parallel subscribe on `mud_rallies` filtered `war_id=eq.…`** so a *newly called* rally appears live for crewmates with the screen open. Optimistic: on `callRally` success, set a local open-rally so the banner shows instantly (mirrors `bumpMine`).
- **`app/mud-war.tsx ActiveWar`** (line 225) — (1) a "Call a rally" button (disabled with a countdown when on cooldown or a rally is open); (2) the live banner *"4 of 5 answered — 9 min left"* using `rally.answered / rally.crewSize` + `formatCountdown(rally.endsAt)`; (3) a subtle highlight on the existing `slingBtn` while a rally is open (the "pile on now" affordance). Reuse the existing splat/squish juice (242-264) — no new animation system.
- **`app/_layout.tsx` push handler** — **NEW BRANCH REQUIRED.** The current handler (lines 538-552) routes `data.screen === 'trade' | 'friends' | 'achievements' | 'account'` only — there is **no `mud-war` branch today**. Add `else if (data.screen === 'mud-war') router.replace('/mud-war')` so the rally push deep-links correctly. This is a one-line addition, but it is *net-new* work, not "existing routing."

### Realtime / push summary

- **Push** = the re-engagement engine: `send_push_to_user` fired per non-caller at call-time (the *only* new push surface in mud-fights). `push_data.screen = 'mud-war'` + the new `_layout` branch lands the tap on `/mud-war`.
- **Realtime** = the in-app co-presence: existing `mud_slings` subscription repaints the answer count + bonus on refresh; new `mud_rallies` subscription surfaces a freshly-called rally to crewmates already on-screen.
- **`system_announcements`** = the WhileAway fallback for players who never granted push — INLINE `'mud_rally'` kind, never `send_system_announcement`.

---

## Rewards tie-in

Two reward channels, both honoring the cash-faucet lesson (cap + anti-collusion gate + idempotent, server-authoritative grants). **The two grant rails are distinct and not conflated:**

1. **War-exclusive cosmetic (primary, uncapped-safe because cosmetic).** The rally is the natural unlock for a war-only animated cosmetic from the ChatGPT/icon-gen pipeline (the icon-gen pipeline skill). Two grant rails fit, pick by artifact type:
   - a **"Rallyer" title** → `INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'rally_caller') ON CONFLICT DO NOTHING` (the exact path `resolve_war` uses at 691-700; requires seeding a `titles` row with `source = 'mud_war'`, the source already whitelisted in the 20260647 `titles_source_check` at 247-250 — no constraint change);
   - **or** a **"Mud Splatter" animated background** → an equippable item in the `background` category surfaced via `profiles.active_background_id` (`20260514000000_aura_background_slots.sql`), granted the same idempotent way the mystery-hat-box grants items.
   Granted the first time a crew lands a *fully-answered* rally (all active members in-window) in a **won** war — cosmetic-only, no economy risk, a *kept artifact* (research principle #8: leave a monument behind) that doubles as social proof of a tight crew.
2. **Capped core snout/tickle payout (secondary, tightly bounded).** The `rally_bonus` *is* the core-economy tie-in: bonus mud flows into `resolve_war`'s existing payout (`counter + tickles_earned`, the 20260628 leaderboard shape, lines 676-679) via the `SUM(slings + rally_bonus)` change — so answering rallies modestly increases a winner's snout payout, but only up to the **+6 mud/day/member** ceiling, only when the crew **wins**, and only when the quorum gate is met. No new faucet, no new grant path: the bonus rides the *already idempotent, already capped, already savepoint-guarded* `resolve_war` payout.
   - **Bot-war exclusion (critical).** Beating the **house bot** already pays only the flat `c_house = 25` stipend with **no `tickles_earned` and no `war_wins`** (the bot-farm fix, lines 668-673). `rally_bonus` must stay irrelevant to that branch. Because the bot-war payout branch (`IF w.is_bot_war THEN UPDATE … counter + c_house`) **ignores `m.own` entirely**, the `SUM(slings + rally_bonus)` change *cannot* leak into it — the bonus only ever affects `m.own`, which the bot branch never reads. The tug-of-war display still shows bonus (via `war_side`), but the payout is bonus-blind by construction. **This invariant is the must-not-miss test below.**

---

## Risks / open questions

- **Bot-war faucet (highest).** If `rally_bonus` ever leaked into the bot-war payout it would reopen the farmable-house exploit the `20260647` review closed. Structural mitigation: the bot branch (line 673) pays a flat `c_house` and never reads `m.own`, so the `SUM(slings + rally_bonus)` change is inert there. **Explicit test (T1) below.**
- **Self-rally alt loop.** A lone alt calling + answering its own rally for free bonus. Defused by the anti-self-rally guard (own rally pays only once ≥1 *other* member answered) + the quorum-2 scoring gate + the +6/day cap. The `mud_rally_answers` PK + `FOR UPDATE` on the rally row in `sling_mud` step 1 serialize two near-simultaneous slings so the breadth count and self-rally check can't be raced. **Test (T2).**
- **Breadth-count race.** Two crewmates answering in the same instant could both read `other_answers = N`. The `FOR UPDATE` on the rally row serializes the bonus block; the `mud_rally_answers` PK + `ON CONFLICT DO NOTHING` makes a double-insert a no-op. Worst case two answers tie on bonus value — harmless (both ≤ cap). **Test (T3).**
- **Push spam / fatigue.** 2 rallies/day/crew × up-to-4 pushes each is the ceiling; the 3h cooldown caps it. Open Q: a per-war **mute rally pushes** toggle (still showing the in-app banner) is cozy-correct but **P2** — the daily cap + cooldown keep v1 humane.
- **Window length.** 15 min is a guess. The research favors a *rolling* relay (Puyo's 10-min). v1.1 could let each answer *extend* the window. Start fixed-15, instrument, revisit.
- **Constant drift.** Same `constants/mudFights.ts` ↔ inlined-RPC drift the mud-fights doc already flags; rally constants inherit the future `mud_fight_const()` (P3) fix.
- **Cooldown source of truth.** 3h mirrors the truffle re-dig cadence by intuition, not data — confirm it feels special-not-stale once mud-fights itself is live (still dark-launched behind `MUD_FIGHTS_VISIBLE = false` in `constants/featureFlags.ts`).
- **Visibility gate.** Ship dark-launched with the parent feature — the rally UI lives inside `ActiveWar`, which only renders when `MUD_FIGHTS_VISIBLE` is flipped on. No separate flag needed.

### Test checklist (must-pass before push)

- **T1 — bot-faucet:** crew beats the house with a fully-answered rally; assert each winner's `tickles_earned` and `war_wins` are **unchanged** and `counter` rose by exactly `c_house` (25), not 25 + bonus.
- **T2 — self-rally:** lone member calls + answers own rally; assert `rally_bonus = 0` until a second real member answers, then assert only post-second-answer slings bank bonus.
- **T3 — breadth + cap:** 5 members pile in; assert per-answer bonus climbs (2→3, clamped at `RALLY_BONUS_MAX`), no member exceeds `rally_bonus = 6/day`, and the `mud_slings.rally_bonus` CHECK never trips.
- **T4 — idempotent settle:** read `war_state` twice after a rally's `ends_at`; assert one `settled_at` stamp, no double-grant, `mud_rallies_one_open_per_crew` freed for the next call.
- **T5 — scoring parity:** a real-vs-real war with rally bonus; assert `resolve_war` winner matches `SUM(slings + rally_bonus)` per-capita and the flat-20 `slings` clamp is untouched.

### Backout

Pure additive migration: drop `mud_rallies`, `mud_rally_answers`, the `mud_slings.rally_bonus` column, and the three rally RPCs; revert `sling_mud` / `resolve_war` / `war_side` / `war_state` to the `20260647` bodies. No base-war data is mutated (bonus lives in its own column), so backout is clean even mid-war. Client: gate the rally button/banner behind a local `RALLY_VISIBLE` const so the UI can be dark-dropped without a redeploy if needed.

---

## Effort

**MEDIUM (low-medium).** One small additive migration on a stack built to absorb exactly this: two new tables (`mud_rallies` + `mud_rally_answers`) + one nullable column + 3 RPCs (`call_rally`, `rally_state`, lazy `settle_rally`) + verbatim-carry `CREATE OR REPLACE` of `sling_mud` (one guarded block), `resolve_war`/`war_side`/`war_state` (each a 1–2 line `SUM` / sub-object edit). Every hard part is solved and copy-pasteable — INLINE announce, savepoint guards, lazy idempotent settle, per-capita scoring, push delivery, realtime publication, optimistic client juice. Client is one button + one banner + one realtime subscription in screens that already exist, **plus one genuinely new line: the `'mud-war'` branch in the `app/_layout.tsx` push handler** (which does not exist today). The only genuinely new surface is the rally window state machine + the four fairness guards + the five-row test checklist — all small `EXISTS`/`CHECK`/cap checks modeled on guards the migration already contains. Pushed up from LOW by the carry-latest-def discipline on four functions and the must-not-miss bot-war exclusion test (T1).

---

## Connects to

- [[sounder-mud-fights]] — the parent system; rally is a capped bonus layered on its flat-20 base sling, reusing `mud_slings`, `resolve_war`, `war_side`, `war_state`.
- [[team-clan-mud-wars-plan]] — sibling crew-war design memo; this is the synchronized-burst co-op layer it anticipates.
- [[coop-mechanics-research-2026-06]] — the research brief; rally is the "Crew Surge" synchronized-burst transfer, honoring the fairness checklist (capped, breadth-scaled, never required, generous floor).
- [[snouts-economy]] — the capped core payout rides `resolve_war`'s existing `counter + tickles_earned` mint; +6 mud/day/member ceiling, win-gated, quorum-gated, bot-war-excluded.
- [[trough]] — the lazy first-reader resolution pattern `resolve_war`/`settle_rally` both clone.
- [[regen]] — unchanged; the war-winner regen buff still pays back into the core loop independent of the rally.
- [[notifications]] — `send_push_to_user` (the re-engagement push) + INLINE `system_announcements` (the WhileAway fallback), never `send_system_announcement`; plus the new `'mud-war'` deep-link branch in `app/_layout.tsx`.
- the evoke-online-game-feel design philosophy — the "we all showed up at once" cozy burst the rally is tuned to produce.
