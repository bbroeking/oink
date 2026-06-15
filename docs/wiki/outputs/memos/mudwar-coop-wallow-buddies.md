---
title: "Mud War Co-op — Wallow Buddies (pairwise combo)"
type: plan
date: 2026-06-14
tags: [plan, mud-wars, sounder, co-op, pairwise, fairness, cosmetics, snouts-economy]
status: draft
---

# Mud War Co-op — Wallow Buddies

> Inside a Sounder Mud Fight, the server pairs you with a rotating crewmate each war-day; when **both** of you sling into a shared "wallow" inside a short window, you each bank a small, capped **buddy combo** bonus — a gain-when-both-show pairwise layer on top of the flat anti-snowball base sling, never a streak-debt.

This is the **cooperation bonus** that [[team-clan-mud-wars-plan]]'s *Tension #1* explicitly flagged as the v2 reconciliation: keep the flat per-capita-average sling as the fair scoring floor, and let cooperation *earn* a bounded advantage on top — "advantages are EARNED only via in-war cooperation," literally. The pairwise framing (vs the crew-wide "Crew Surge" in `coop-mechanics-research-2026-06.md`) is chosen because the research's strongest retention finding is pairwise: a bond with **a name** re-engages ~2× harder than an anonymous bar (Duolingo Friend Streaks, +22% daily-lesson completion). The hard constraint is to capture that lift **without** importing the streak dark pattern — so the entire design is gain-when-both-show, with rotation as the fairness valve against dead pairs and exclusion.

## How it plays

Day-to-day inside an active war (`mud_wars.status='active'`, the `app/mud-war.tsx` screen):

- **You already sling a flat 20/day** (`sling_mud`, `DAILY_ALLOTMENT`). Nothing about the base loop changes — slinging solo still fully "counts."
- **Each war-day you have one Wallow Buddy** — a crewmate the server picks for you that UTC day. The war screen shows "Today's buddy: **@hazel**" with their live buddy-state. Pairings **rotate daily** (a deterministic round-robin over the crew roster keyed on `war_day`), so over a 5-day war you buddy a different crewmate most days and nobody is permanently locked to (or excluded from) anyone.
- **The shared wallow is a per-(war, day, pair) combo window.** When *either* buddy slings, a wallow window opens (default 30 min, `WALLOW_WINDOW_MINS`). If the *other* buddy slings into that same window, the pair **closes the combo**: both earn `BUDDY_COMBO` bonus mud (default +3), credited to each as a normal sling on their own side. The window is async-tolerant (30 min, not "the same second"), honoring the research's *async + local-time beats global-now* and *render co-presence, don't infer it* rules.
- **It's a gift, not a debt.** If your buddy never shows, you simply don't get the bonus that day — there is **no penalty, no decaying streak counter, no "you broke it" UI**. The screen frames it as "Wallow with @hazel for +3 → both of you" (gain framing), and a closed combo plays a small shared juice beat. Research rule #7 and the pairwise dark-pattern warning are the binding constraints here.
- **Caps make it cozy, not a grind.** At most **one** buddy combo per pair per day (`BUDDY_DAILY_CAP=1` close), so the bonus is a pleasant beat, not a tap-race. The bonus mud still flows through the normal 20/day clamp on `mud_slings` (see Scoring) so it can't blow the per-capita ceiling.

The verb stays "show up and sling"; the buddy layer just makes "we both showed up today" *visible and slightly rewarded* — the legible co-presence the research says is the most motivating UI state, scoped to a face instead of a crowd.

**Where the interdependence actually bites (and where it's only a beat).** Under the recommended accelerate-toward-20 cap, the mud bonus has its strongest pull on a *lagging* buddy who hasn't hit 20 — closing a combo moves their per-capita contribution up toward the cap faster, which is exactly the research's "lift the weak one without taxing the strong" (Borderlands costless-carry, the quorum/floor goal). For two *already-maxed* players the mud credit clamps to zero, so the combo is a pure social beat for them, not a score lever. That's the honest trade of a ceiling-neutral design: the **reward** is concentrated on the day a buddy is behind (where it does real work), and the **co-presence beat** (the shared confetti + the cosmetic-gate tick) fires for everyone regardless. The interdependence is therefore real but *asymmetric by design* — it's "I showed up so my buddy's lagging day counts for more," not "we both burst for a multiplier." The cosmetic gate (below) is what gives engaged-but-maxed pairs a reason to keep closing combos all war.

## Scoring & fairness

The anti-snowball spine is untouched: `resolve_war` still scores each crew as **per-capita active average** with a **quorum of 2** (`SUM(mud)/COUNT(members WHERE mud>0)`), over a flat use-or-lose 20/day. The cited research (`coop-mechanics-research-2026-06.md`, *Fairness & anti-abuse*) is explicit that per-capita-average is the anti-dominance move and that its one dark side — "a flat average *punishes participation*, because a below-mean player lowers the score" — must be patched with a quorum + per-member floor. TTP already has both. Wallow Buddies must not reopen either hole. The design choices that hold the line:

1. **The bonus rides the same 20/day clamp.** `BUDDY_COMBO` mud is written through `sling_mud`'s existing `mud_slings.slings` column under the `CHECK (slings <= 20)` and `LEAST(20, …)` cap. So a buddy combo *brings a lagging member up toward the cap faster*, it never lets anyone exceed it. The crew ceiling stays exactly `members × 20 × days` — the founder's central isolation rule (`sounder-mud-fights.md`) survives byte-for-byte. (Decision D-CAP below: whether buddy mud is *additive over 20* or merely *accelerates toward 20*; recommended = accelerates-toward, which is provably ceiling-neutral.)
2. **It rewards participation, not excess-over-mean.** Because both buddies get the same +3 and the credit lands on the *low* side just as much as the high side, the bonus structurally pulls toward the mean rather than away — it *helps* the quorum/floor goal the research demands, it doesn't fight it. A below-average member who wallows is now *less* below average, killing the "don't play unless above average" trap rather than worsening it.
3. **Anti-alt / anti-collusion is the rotation + the 1/day pair cap.** Two alts can't farm each other indefinitely: pairings are **server-assigned, not player-chosen**, and rotate by `war_day`, so a colluding pair only buddies on the days the round-robin pairs them (~1 in N-1 days). The combo is capped at one close/pair/day. Combined with the existing 24h rematch cooldown (`challenge_crew`) and the crew-cap, an alt's marginal value stays near-zero — the research's "per-account caps make alts a labor cost, not a cheat."
4. **Odd-roster fairness (the dead-pair / exclusion risk the brief names).** With an odd number of active members one player is unpaired that day. Per the pairwise research (*cover-for-the-absent*, MH SOS-flare NPC fill), the unpaired player is auto-matched to a **house wallow** — a synthetic buddy that auto-closes the combo if they sling (a fractional, bounded self-bonus, e.g. `BUDDY_COMBO` but flagged `is_house=true`), so being odd-one-out never means *zero* shot at the bonus. This is the explicit "never strand the live player" mitigation.
5. **Buddy mud is real-war only.** House/bot wars (`is_bot_war`) already pay only a flat capped stipend with no `tickles_earned`/titles (the bot-farm fix). Buddy combos are **disabled in bot wars** so the fixed-pace Mudlarks can't be farmed for combo value — same neutralization stance as the rest of the build.

Net: the snowball math is identical; the only thing that changed is that two members who both showed up today each get a small, clamped, rotation-gated nudge toward their own daily cap. No new alt vector, no whale lever, no participation penalty.

## Already built ✅

Wallow Buddies reuses almost the entire mud-fights stack — it's a thin layer, not a new system:

- **`sling_mud` is the write path.** The buddy bonus is just extra `mud_slings` increments under the same `(war_id, user_id, war_day)` upsert and the same `LEAST(20, …)` clamp (`20260647000000_mud_fights.sql` §6). No new hot path.
- **`mud_slings` already buckets by `war_day date`** (UTC day) and is **already in the `supabase_realtime` publication** — the daily rotation key and the live "your buddy just wallowed" push both fall out of existing infra. `hooks/useMudWar.ts` already subscribes to `postgres_changes` on `mud_slings filter=war_id=eq.<id>` (throttled 1.5s); a buddy close is just another event on that channel.
- **`war_state` / `war_side` already return the per-member roster** (`user_id`, `username`, `slings`) gated by `is_war_participant` — the buddy payload extends these, not a new query.
- **`crew_members` gives the roster to rotate over**; the round-robin is a pure function of (sorted member ids, `war_day`).
- **Idempotent, savepoint-guarded, INLINE-announce patterns** are all established in `resolve_war` / `challenge_crew` — the buddy-close announcement and any payout reuse them verbatim (INLINE `system_announcements` INSERT inside a `BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END`, never `send_system_announcement`).
- **War-exclusive cosmetics + title infra** already exist: `titles_source='mud_war'`, the `war_winner_regen` blessing kind, and the capped `HOUSE_BONUS` snout stipend — the reward tie-in slots into these.
- **Client mirror discipline** is in place: `constants/mudFights.ts` already mirrors the server constants with the "change here → change there" note; new buddy constants follow the same rule.

## What's needed 🔨

A follow-on migration timestamped **after `20260649000000_onboarding_checklist.sql`** (the latest on disk) — e.g. `20260650000000_wallow_buddies.sql`. The mud-fights migration (`20260647`) is itself still UNPUSHED, so this stacks cleanly behind it (push order: 20260647 dark → … → 20260650). All carry-latest-def / INLINE-announce / idempotent-payout footguns apply.

**Tables / columns**

- **`public.wallow_combos`** — the idempotency + audit record of closed combos. One row per closed pair-day:
  ```
  id        uuid    PRIMARY KEY DEFAULT gen_random_uuid()
  war_id    uuid    NOT NULL REFERENCES mud_wars(id) ON DELETE CASCADE
  war_day   date    NOT NULL
  user_a    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE  -- LEAST(user_id pair)
  user_b    uuid             REFERENCES auth.users(id) ON DELETE CASCADE  -- GREATEST; NULL if house-wallow
  is_house  boolean NOT NULL DEFAULT false
  opened_at timestamptz NOT NULL DEFAULT now()
  closed_at timestamptz
  ```
  The idempotency guard is a **partial-aware UNIQUE INDEX**, not a composite PK — because a nullable `user_b` can't sit in a PK and `(…, NULL)` rows don't collide under a plain unique. Use a COALESCE expression to a sentinel so house-wallows still dedupe:
  ```
  CREATE UNIQUE INDEX wallow_combos_one_per_pair_day ON public.wallow_combos
    (war_id, war_day, user_a, COALESCE(user_b, '00000000-0000-0000-0000-000000000000'::uuid));
  ```
  A double-close is then an `ON CONFLICT … DO NOTHING` no-op, exactly like `resolved_at` guards `resolve_war`. The RPC always writes the pair **sorted** (`user_a := LEAST`, `user_b := GREATEST`) so `(hazel,you)` and `(you,hazel)` map to one row. Add to `supabase_realtime` (guarded `DO $$ … EXCEPTION WHEN OTHERS THEN NULL`, same as the 20260647 publication adds). RLS: SELECT gated by `is_war_participant(war_id, auth.uid())`, mutations via SECURITY DEFINER RPC only (mirror the mud_slings policy).
- **No new column on `mud_slings`** — buddy mud is written into existing `slings` (recommended D-CAP=accelerate-toward-20). If D-CAP picks additive-over-20, add `mud_slings.bonus_slings int NOT NULL DEFAULT 0` and adjust `war_side`'s `SUM`; this is the more invasive path and reopens the ceiling question, so it's not recommended.
- **Constants** (mirror in `constants/mudFights.ts` + inline in RPCs): `WALLOW_WINDOW_MINS=30`, `BUDDY_COMBO=3`, `BUDDY_DAILY_CAP=1`.

**RPC signatures** (all `SECURITY DEFINER SET search_path TO 'public'`, `{ok, reason}` shape via `rpcAction`, granted to `authenticated`)

- `today_buddy(p_war uuid) RETURNS jsonb` — pure read: computes the caller's assigned buddy for `(p_war, current UTC war_day)` via the deterministic round-robin over `crew_members` of the caller's crew, returns `{buddyUserId, buddyUsername, isHouse, windowOpenUntil, comboClosedToday}`. STABLE; gated by `is_war_participant`. (STABLE is correct: it reads `now()` once per statement for the window, never mutates — matching `war_state`'s lazy-read shape.) This is the only genuinely new query.

  **The rotation algorithm — the one thing that MUST be byte-identical on server and client** (drift = a player sees @hazel but the server pairs them with @milo, so combos never close). Specify it once, port it verbatim:
  1. Take the crew's `crew_members.user_id` list, **sorted ascending as text** (stable, no clock/locale dependency). Call it `R`, length `n`.
  2. `d := (war_day - started_at::date)` — the integer war-day index (0-based), so the pairing advances each day.
  3. Standard **circle round-robin**: fix `R[0]`, rotate `R[1..n-1]` by `d mod (n-1)` positions, then pair `i` with `n-1-i`. This is the canonical tournament schedule — over `n-1` days every member buddies every other exactly once, then it repeats.
  4. **Odd `n`:** append a sentinel "house" slot before pairing; whoever pairs with the sentinel that day gets the `is_house=true` self-wallow (the odd-one-out mitigation, below). **`n=2`:** the two always pair (degenerate but correct — see Risks). **`n=1`:** always house-wallow.
  Because the inputs are only `(sorted text ids, integer day index)`, the function is pure and trivially mirrorable in `utils/mudWars.ts`; a jest test pins the two implementations to the same fixture (see Tests).
- **Extend `sling_mud`** (CREATE OR REPLACE, carrying the **latest** 20260647 body verbatim — carry-latest-def footgun) — after the existing upsert, in a **savepoint-guarded block**: resolve today's buddy, check the wallow window (did the buddy sling within the last `WALLOW_WINDOW_MINS`?), and if so atomically (a) UPSERT `wallow_combos` (PK = idempotency), and (b) credit `BUDDY_COMBO` to **both** members via the same `LEAST(20, …)` clamp, then INLINE-announce the buddy ("@you and @hazel wallowed — +3 each"). The combo write is wrapped so a fault can't roll back the base sling (the 20260624 hardening pattern the file already cites). Return shape gains `buddyCombo: {closed bool, with username, bonus int}`.
- **Extend `war_state` / `war_side`** (CREATE OR REPLACE, carry latest) — add a `buddy` block to the war payload: today's assigned buddy, whether the window is open, whether the combo closed. Keep `war_side` REVOKE'd from PUBLIC (it's still the internal helper).
- **No change to `resolve_war`** for the base case — buddy mud already lives in `mud_slings`, so the per-capita scoring and payout read it for free. (Optional cosmetic grant hook in the reward section is additive and savepoint-guarded.)

**Client changes** (all behind the existing `MUD_FIGHTS_VISIBLE` flag)

- `utils/mudWars.ts` — add `fetchTodayBuddy(warId)` wrapper + `BuddyState` type; extend `WarState` with the `buddy` block; thread `buddyCombo` through `slingMud`'s result type.
- `hooks/useMudWar.ts` — surface `war.buddy`; on the existing throttled `mud_slings` realtime tick, re-read (the buddy state rides the same refresh — a buddy sling already fires a `mud_slings` event on the subscribed channel). Optimistic-bump already exists; the combo-close juice fires when `slingMud`'s result reports `buddyCombo.closed`.
- `app/mud-war.tsx` — a small "Today's buddy: @hazel — wallow for +3 each" card with live state (window-open shimmer, closed-combo confetti beat), reusing the existing sling-juice. Gain-framed copy only.
- `constants/featureFlags.ts` — no new flag; the buddy card and `today_buddy` reads live entirely under the existing `MUD_FIGHTS_VISIBLE = false` gate, so this ships dark with the rest of the layer.

**Tests** (extend the existing pgTAP suite the team-clan plan names, `supabase/tests/02_mud_fights.sql` — same harness)

- Rotation determinism: `today_buddy` returns the *same* assignment for a fixed `(roster, war_day)` and is a bijection-or-house-cover over the crew (nobody double-assigned, nobody stranded).
- Idempotency: closing the same pair twice in one `war_day` writes one `wallow_combos` row and credits `BUDDY_COMBO` once (the `ON CONFLICT DO NOTHING` guard).
- Ceiling-neutrality (the load-bearing one): a buddy combo never pushes `mud_slings.slings` past 20 under accelerate-toward-20; a maxed buddy's combo records the row but credits zero mud.
- Savepoint isolation: a forced fault in the combo block (e.g. a bad announce) leaves the **base sling committed** — the combo write can never roll back the core upsert (the 20260624 pattern).
- Bot-war exclusion: `sling_mud` in an `is_bot_war` opens no wallow window and writes no `wallow_combos` row.
- House-wallow: an odd-roster unpaired member who slings closes a `is_house=true` combo (sentinel `user_b`) and the unique index dedupes it.

**Realtime / push**

- Live "your buddy just slung — wallow now (28 min left)" rides the **existing** `mud_slings` realtime channel — no new publication needed beyond adding `wallow_combos` for the close confirmation. Two distinct delivery paths, and the plan must not conflate them (`notifications.md`):
  1. **In-app backstop** — an INLINE `system_announcements` INSERT inside `sling_mud`'s savepoint block, surfaced via the existing `my_unseen_announcements` → WhileAway merge (`app/_layout.tsx`). Never `send_system_announcement` (admin-gated → silent rollback for a non-admin sling — the announcement footgun).
  2. **Actual push** — a `PERFORM public.send_push_to_user(buddy_id, …)` call, the same non-admin-safe path the trade/ritual/friendship pushes already use (`20260528_ritual_push`, `20260551_friendship_push`; `send_push_to_user` is SECURITY DEFINER + granted to `authenticated`, no admin gate). No-ops silently for an untokened buddy.
  Both go inside the savepoint block so a push/announce fault can't roll back the base sling. Push is **opt-in** (gated on a per-user war-buddy-push preference, defaulting off until the player closes their first combo) and gain-framed — never a "you're about to lose your streak" nag (the dark-pattern guardrail, research rule #7).

## Rewards tie-in

Two reward channels, both honoring the cash-faucet lesson (cap + anti-collusion gate + idempotent server-authoritative grant):

- **The "wallow chain" — the escalating, legible progress layer (this is what carries engaged-but-maxed pairs).** Because the mud bonus clamps to zero for a maxed pair, the *motivation* for two engaged players to keep closing combos all war is a **visible per-war chain counter**: the count of `wallow_combos` rows your crew has closed this war, rendered as a small filling meter on `app/mud-war.tsx` ("Wallow chain: 4 — one more unlocks the buddy hat"). This is the research's goal-gradient + persistent-artifact pair (FarmVille barn / Helldivers monument): a legible bar that climbs as you cooperate and leaves a kept cosmetic behind. It is **multiplicative-feeling without being multiplicative on score** — the chain advances the cosmetic, never the flat sling, so it adds co-op pull at zero ceiling/faithfulness cost. The meter shows the *next* milestone, never the distant finish (Irrational Labs' "design fast early wins, show the next tier"). No new table — it's `count(*) FROM wallow_combos WHERE war_id = … AND is_house = false`, already audited.
- **War-exclusive cosmetics (the headline reward).** A war-only **animated background + buddy hat** generated via the ChatGPT/icon-gen pipeline (the `icon-gen` skill, same pipeline as accessory sprite sheets), granted as a **war-scoped cosmetic** the way `mud_war` titles already are. The gate is the wallow chain above: closing **N** buddy combos across a war (e.g. a 2-tier ladder — 3 → the buddy hat, 5 → the animated bg, over the 5-day window) unlocks a per-war "Wallow Buddies" cosmetic — a monument that says "this crew actually cooperated." Idempotent via `ON CONFLICT DO NOTHING` on a user-cosmetic grant, mirroring the `user_titles` insert in `resolve_war`. War-exclusive = it can't inflate the cozy closet economy.
- **Capped core snout/tickle payout (kept tiny).** The buddy mud *already* flows into the existing `resolve_war` per-capita payout (own mud + share of loser pot) because it lives in `mud_slings` — so cooperation already nudges the core payout **without a new faucet**, and it's automatically capped because buddy mud rides the 20/day clamp. **Do not mint a separate buddy-snout bonus** — that would be a second uncapped faucet against the `snouts-economy` no-sink problem and the visit cash-faucet lesson. If a dedicated buddy payout is ever wanted, route it through the planned war-only token (`team-clan-mud-wars-plan` §B), never raw `counter`/`tickles_earned`. The regen buff (`war_winner_regen`, ×0.85/72h) remains the only core-loop payback, unchanged.

Anti-collusion on rewards: cosmetic/payout grants are gated on *closed combos*, which are rotation-assigned and 1/pair/day capped — so an alt pair can't farm the cosmetic faster than the round-robin allows, and bot wars grant nothing.

## Risks / open questions

- **D-CAP (the one real decision): does buddy mud add *over* 20/day or only *accelerate toward* 20?** Recommended **accelerate-toward-20** — provably ceiling-neutral, zero snowball risk, the conservative read of the founder's "members × 20 × days ceiling." Additive-over-20 makes cooperation feel more *generous* but reopens the ceiling question and needs `bonus_slings` plumbing through `war_side`/`resolve_war`. Founder call.
- **Combo-bonus on the low day.** If accelerate-toward-20 and a member already hit 20 solo, the combo can't credit them — the bonus silently no-ops for high-activity players. Mitigation: still record the `wallow_combos` row (for the cosmetic gate + the "we wallowed" beat) even when the mud credit clamps to zero, so the social beat fires regardless. Confirm that's the intended feel.
- **Rotation legibility.** Players may want to *choose* a buddy (a partner, a friend). Research says player-chosen pairing is exactly the alt-collusion vector and the exclusion risk — rotation is the fairness feature. Keep rotation; surface it as "today's buddy" with a friendly explainer, don't let players pin.
- **Two-person crews** trivially always buddy each other (rotation degenerates). At crew=2 that's fine (it *is* the pair), but it means a 2-alt crew gets a combo every day — bounded by `BUDDY_COMBO×days` and clamped under 20/day, and they still can't beat quorum-2 scoring meaningfully, but worth modeling against the tolerated injection budget before flip.
- **Timezone / `war_day` edges.** The window is UTC-day-bucketed like `mud_slings`; a buddy who slings at 23:55 and you at 00:05 land in different `war_day` rows and won't combo. Acceptable (matches the existing use-or-lose model) but the UI should show the window's hard end so it isn't a surprise.
- **Same flip gate.** This ships dark inside the already-dark mud-fights layer; it can't flip before the population gate in `team-clan-mud-wars-plan` §D clears.
- **Realtime fan-out is already bounded.** The research flags a global "everyone act NOW" spike as a Supabase load concern, but Wallow Buddies inherits the existing async, UTC-day, use-or-lose model — there is no synchronous window, and the close event rides the **already-throttled** (1.5s) `mud_slings` channel (`hooks/useMudWar.ts`). The only added write is one `wallow_combos` row per pair per day (≤ `n/2` rows/crew/day), so fan-out is strictly bounded and adds no new spike surface.

## Build order (this layer's own exit conditions)

This plan is a single follow-on migration; it still has internal gates. Each step has a concrete "done" check; it slots **after** team-clan §A/§E (the rename + the dark push of `20260647`) and **before** the §D population flip.

1. **Rotation pure-function + jest parity** — write `assignBuddy(sortedIds, dayIndex)` in `utils/mudWars.ts` and the SQL twin in the migration; **exit:** a jest fixture and a pgTAP fixture produce identical pairings for `n=2..5` across days 0..6.
2. **`20260650000000_wallow_buddies.sql`** — `wallow_combos` table + unique index + RLS + realtime add; `today_buddy`; CREATE-OR-REPLACE of `sling_mud`/`war_state`/`war_side` carrying the **latest 20260647 bodies verbatim** + the appended savepoint block. **Exit:** `02_mud_fights.sql` pgTAP suite (extended with the six cases above) green against a local DB; ceiling-neutrality and savepoint-isolation tests pass.
3. **Client thread-through** — `fetchTodayBuddy` + `BuddyState`, `war.buddy` in `useMudWar`, the buddy card in `app/mud-war.tsx`. **Exit:** `tsc` + `jest` green; a manual war (flag flipped for a test account only) shows the buddy card, closes a combo, fires the confetti beat, and records the `wallow_combos` row.
4. **Cosmetic gate (art session, parallelizable)** — the icon-gen run for the animated bg + buddy hat; the `ON CONFLICT DO NOTHING` grant hook in `resolve_war`'s reward loop. **Exit:** closing N combos in a test war grants the cosmetic exactly once (idempotent re-resolve grants nothing further).
5. **Push the migration dark + flip with §D** — push on explicit "go" (never autonomous), flag stays false until the team-clan §D population gate clears.

## Effort

**LOW–MEDIUM.** LOW because it's almost entirely reuse — one new small table (`wallow_combos`), one new read RPC (`today_buddy`), and CREATE-OR-REPLACE extensions to `sling_mud`/`war_state`/`war_side` that carry the latest 20260647 bodies and append a savepoint-guarded block. The realtime channel, the optimistic-sling juice, the `war_day` bucketing, the INLINE-announce and idempotency patterns, and the cosmetic/title grant infra all already exist. MEDIUM only at the edges: the deterministic rotation must be the *same* pure function on server and client (drift = wrong buddy shown), the savepoint guard around the combo write must be airtight so it can never roll back a base sling, and the cosmetic-gen pipeline run is a separate art session. No new hot path, no cron, no schema churn on the scoring engine.

## Connects to

- [[sounder-mud-fights]] — the layer this extends; reuses `sling_mud`, `mud_slings`, `war_state`, the realtime channel, the lazy idempotent `resolve_war`.
- [[team-clan-mud-wars-plan]] — this *is* the cooperation-bonus reconciliation that plan's Tension #1 (D6) called for; honors its economy-wall (§B) and cosmetic-tie (§C) stances.
- [[snouts-economy]] — buddy mud reuses the existing capped payout; no new faucet (the cash-faucet lesson).
- [[trough]] — `resolve_war` already clones the Trough's lazy first-reader resolution; this adds no new resolution path.
- [[regen]] — the `war_winner_regen` ×0.85/72h buff is the only core-loop payback, unchanged by this layer.
- [[notifications]] — buddy nudges are opt-in INLINE `system_announcements` inserts (never `send_system_announcement`).
