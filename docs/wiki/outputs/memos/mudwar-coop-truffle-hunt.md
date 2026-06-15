---
title: "Mud-War Co-op: Crew Truffle Hunt"
type: plan
date: 2026-06-14
tags: [plan, mud-wars, co-op, truffle, fairness, cosmetics, draft]
status: draft
---

# Mud-War Co-op: Crew Truffle Hunt

> A war-only buried "war-truffle" that needs **N digs from N distinct crewmates** to unearth — a shared-goal dig layered as a *capped bonus* on top of the simple daily sling, where the distinct-member gate (not raw effort) is what wins it and what defeats alts.

This is a small, layered follow-on to [[sounder-mud-fights]]. It reuses TTP's existing buried-truffle dig mechanic (`truffles` / `truffle_digs` / `dig_truffle`, from `supabase/migrations/20260592000000_buried_truffle.sql` → `20260610` shared-pot → `20260611` stake+status → `20260629` re-dig cooldown) but re-scopes a truffle to a **war** instead of a **barn host**, and changes the win condition from "take a share of snouts" to "land the **distinct-digger** count that unearths the prize for the whole crew." The base sling (`sling_mud`, flat-20, per-capita-average, quorum-2) is untouched: the truffle is strictly additive juice, never the spine.

## How it plays (the co-op interaction, day-to-day)

The mud-fights field is already a fully isolated, reset-to-zero arena: a crew's only verb is the flat daily sling (`sling_mud` in `20260647000000_mud_fights.sql`), 20/day/member, no core buffs leak in. Crew Truffle Hunt adds one optional shared object on top of that field, per war:

- **A war-truffle appears for each crew when the war goes active.** At `accept_challenge` / `challenge_house` (the two places a war flips to `'active'` in the mud-fights migration), the server seeds one **war-truffle row per real crew** (challenger and defender). It is *not* buried by a host and costs no snouts — it's a war prop, not a barn treat. The screen shows it on each side as a dirt mound with a fill meter: **"0 / 3 crewmates have dug."**
- **Slinging is what digs.** A crewmate doesn't dig separately — the *first sling of the day* by a member who hasn't yet dug *this crew's* war-truffle counts as their distinct dig (the dig is a side-effect of `sling_mud`, savepoint-guarded, so it can never roll back a sling). This keeps the day-to-day loop identical to today's: open the war, tap "Sling mud!", watch your bar and the rope move. The truffle meter ticks up by one **the first time each distinct member participates.**
- **N distinct diggers unearths it.** When the crew's distinct-digger count hits the threshold `TRUFFLE_DIGGERS_NEEDED` (proposed **3**, clamped to `LEAST(needed, crew_size)` so a 2-person crew needs 2), the truffle is "unearthed": a one-time crew bonus is granted, savepoint-guarded, idempotent (a `unearthed_at` stamp gates it exactly like `resolved_at` gates `resolve_war`). Every crewmate gets a "Crew truffle unearthed! 🐽" announcement (INLINE `system_announcements` INSERT, never `send_system_announcement` — the [[notifications]] / admin-gated footgun).
- **A laddered meter, not a binary flip.** Each distinct dig is its own celebrated tick (`1/3 → 2/3 → 3/3`), so the meter delivers the research's *fast early win* and always shows the *next* milestone rather than a distant finish (the goal-gradient + Irrational-Labs "show the next rung" finding — see the shared-goal axis). The **first** distinct dig fires a tiny "First dig! 🐽 1/3" flourish (fast early win); the **halfway** dig (`ceil(needed/2)`, i.e. the 2nd of 3) fires a "Almost there — one more crewmate!" nudge to pull the last digger in (the brief's *compounding mid-event treat to rally stragglers*). The terminal dig unearths. This is purely client/announcement juice — the server still records one row per distinct digger; no extra economy.
- **Cozy, async, no homework.** There's no timer on the dig and no "everyone online now" — it just needs three *different* people to each sling on some day during the war, on their own clock. That satisfies the research's async/local-time and "render co-presence, don't infer it" principles (a visibly filling meter is the most motivating UI state — see the shared-goal axis of the research brief). It also can't be done by one person grinding: 60 slings from one account moves the rope but leaves the truffle at 1/3.
- **War-isolated + resets every war.** The war-truffle is keyed to `war_id` and dies with the war (FK `ON DELETE CASCADE` off `mud_wars`), so it resets to zero each war exactly like slings do. Nothing persists into the core game except the capped payout.

## Scoring & fairness (capped crew war-points without reopening snowball/alt abuse)

The hard design constraint from the founder grill: **anti-snowball fairness must hold**, and this must be a *capped bonus*, not a second scoring track that whales/big-crews can lean on. The truffle does **not** feed the win condition at all — `resolve_war`'s per-capita-average + quorum-2 math stays the sole arbiter of who wins the war. The truffle is a **parallel, binary, capped crew bonus**: either the crew unearthed it (distinct-digger gate met) or it didn't. That choice is what keeps it clean:

- **It's a count of distinct humans, not a sum of effort.** The research's central anti-abuse finding is *"the scoring shape is the whole ballgame"* — total-sum scoring rewards headcount and whales; the fix is bounded-per-slot/per-capita scoring (coop-mechanics-research-2026-06.md, Fairness axis). A *distinct-member requirement is the strongest version of that*: the truffle's "score" is `COUNT(DISTINCT digger)`, hard-capped at the threshold. One whale slinging 1000 times still contributes exactly **1** to the count. Alts are worthless unless they're real, active, friend-gated crew members — and the crew is capped at 5 (`CREW_CAP`, enforced by `enforce_crew_cap`) and invites are `are_friends`-gated (`invite_to_crew`), so manufacturing three distinct "members" means recruiting three real friends. This is exactly Clash of Clans' "contribute ≥1 to claim" gate (research: cleanest free-rider gate in the genre) made into the *whole* objective.
- **Participation, not excess-over-mean.** The research flags the known dark side of average-scoring: a flat average *punishes participation* (a below-mean player drags the score, so the rational move becomes "don't play unless above average"). The base sling already lives with that via quorum-2. The truffle is the antidote: it rewards the *act of showing up at all* (your first sling counts), so a casual, low-volume crewmate is now strictly *valuable* — they're a needed distinct digger — without being able to inflate the war score. That's the "reward participation, not excess" rule from the brief's checklist.
- **Capped payout, anti-collusion gate, idempotent server-authoritative grant.** Respecting the cash-faucet lesson (`project_admin_gated_announcement_footgun` / the [[snouts-economy]] cap discipline): the unearth bonus is a **flat, low, capped** snout/tickle grant per crewmate (proposed **`TRUFFLE_BONUS` 15 snouts**, in the same ballpark as `HOUSE_BONUS` 25 for beating the bot), granted **once per war** (the `unearthed_at` stamp is the idempotency guard, same pattern as `resolved_at`), and **only to members who actually dug** (participation-gated, like the truffle ≥1 rule — a member who never slung gets nothing). It is granted server-side inside the savepoint-guarded `sling_mud` extension. To bound farming, the bonus is *war-scoped and non-repeatable* (one unearth per war-truffle), and bot-war truffles either grant nothing or grant only the cosmetic (mirroring the bot-farm fix in `resolve_war`, where beating the house gives a flat stipend + no `tickles_earned` / no titles).
- **No new snowball vector.** Because the truffle never touches `ch_score`/`df_score`, a crew that unearths its truffle does **not** gain any advantage in the actual tug-of-war — it just pockets the capped bonus. A big/coordinated crew and a small crew both cap out at the same flat per-head bonus. The anti-dominance spine (per-capita average) is fully preserved.
- **A deliberate trade: cozy fairness over multiplicative payoff.** The research's headline principle is "make togetherness *strictly better* via a **multiplicative** (not additive) bonus." This truffle deliberately does **not** do that — a multiplicative crew bonus is exactly the whale/big-crew snowball lever the founder grill ruled out. We take the brief's *other* load-bearing levers instead (the ≥1 participation gate, the distinct-human requirement, the filling meter, the dual-track reward, the generous floor) and consciously drop multiplicativity, because in a 5-cap friend-gated crew the scarce resource isn't *effort* (which a whale has) but *distinct active humans* (which no whale can fake). The "strictly better together" feeling is preserved through the gate — the prize is literally unreachable alone — without handing anyone a score multiplier. That is the resolved design's central bet.

Net: the truffle adds a *cozy shared-goal moment and a capped treat* without adding a single lever a whale, a big roster, or an alt farm can pull. The distinct-member requirement is simultaneously the co-op hook and the anti-abuse mechanism.

## Already built ✅ (what TTP reuses)

The whole point of this mechanic is leverage — it is mostly re-pointing two existing stacks at each other:

- **The buried-truffle dig stack** — `public.truffles` (`id`, `host_id`, `reward`, `remaining`, `dug_by`, `dug_at`) + `public.truffle_digs` (`truffle_id`, `digger_id`, `amount`, `dug_at`, surrogate `id` PK after `20260629`) + `dig_truffle(p_host)`. The "lock the active row `FOR UPDATE`, atomic `UPDATE ... RETURNING`, ledger-insert, INLINE announcement" shape is exactly what a war-truffle dig needs (`20260610_truffle_shared_pot.sql`, `20260629_truffle_redig_cooldown.sql`). The *distinct-digger ledger* already exists conceptually as `truffle_digs`.
- **The mud-fights stack** — `crews` / `crew_members` (cap-5, friend-gated) / `mud_wars` (status machine, `started_at`/`ends_at`/`resolved_at`) / `mud_slings` / `sling_mud` / `resolve_war` / `war_side` / `war_state` / `my_war`, all in `20260647000000_mud_fights.sql`. War isolation, the daily-bucket sling, the per-capita-average + quorum-2 scoring, and the lazy-resolve idempotency pattern are all done.
- **Idempotent + savepoint-guarded side-effect patterns** — `resolved_at` as a double-pay guard, `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END` around every announcement/blessing so a faulty side-effect can't roll back a payout. The truffle reuses both verbatim.
- **INLINE announcements** — the mud-fights migration already inlines all `system_announcements` INSERTs (the un-truffle base `20260592` used `send_system_announcement`, but `20260618`/`20260629` switched truffle digs to INLINE — that's the version to copy).
- **Server-authoritative payout into the core loop** — `resolve_war` already mints into `profiles.counter` (+ `tickles_earned` for the leaderboard shape from `20260628`). The truffle bonus uses the same `UPDATE public.profiles` write.
- **Client layer** — `utils/mudWars.ts` (typed RPC wrappers + `WarState`/`WarSide` shapes), `hooks/useMudWar.ts` (lazy resolve on read, optimistic sling, throttled realtime on `mud_slings`), `app/mud-war.tsx` (tug-of-war + sling button + quorum line + roster). The truffle meter is one new sub-component on the existing active-war screen.
- **Cosmetic delivery rails** — `titles` / `user_titles` (mud-war source already added in `20260647`) and the blessing infra for buffs. The art pipeline is the ChatGPT/icon-gen accessory-sheet flow (the `icon-gen` skill).

## What's needed 🔨

A **single new follow-on migration**, timestamped **after `20260649`** (the latest file is `20260649000000_onboarding_checklist.sql`; the mud-fights migration `20260647` is itself UNPUSHED, so the new file must sort after both — e.g. `20260650000000_war_truffle_hunt.sql`). The mud-fights migration is unpushed, so a *cleaner* option is to fold the seed/columns into `20260647` directly; but per the carry-latest-def discipline, a **separate additive migration** is safer to reason about and avoids re-opening the reviewed mud-fights file. Recommend a new file.

**Build order (do-this-first, for a single dev):**
1. Write the migration: two tables → RLS + realtime → `unearth_war_truffle` (the payout engine) → `seed_war_truffles` → the three `CREATE OR REPLACE`s carrying `20260647` bodies verbatim → grants/REVOKEs. Write the build changelog (`docs/builds/…`) before any build, per project convention.
2. Apply locally and run the QA smoke test below against a 2- and 3-person crew. **Do not `db:push` until the user says go**, and only after `20260647` has landed (the new migration depends on its tables/RPCs).
3. Client: `constants/mudFights.ts` → `WarSide` type → `bumpMine` optimistic tick → `<TruffleMeter>` component. Ships behind the same gate as the parent mud-war screen (dark-launch — see Rollout).
4. Art (parallel, off the critical path): pre-create the `truffle_unearther` title now; the icon-gen cosmetic lands in a later build.

### Table / columns

A war-truffle is its own small table rather than overloading `truffles.host_id` (which FKs `auth.users`, not a crew, and carries snout-pot semantics we don't want):

```sql
CREATE TABLE IF NOT EXISTS public.war_truffles (
    id            bigserial   PRIMARY KEY,
    war_id        uuid        NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
    crew_id       uuid        NOT NULL REFERENCES public.crews(id)    ON DELETE CASCADE,
    diggers_needed int        NOT NULL,            -- LEAST(TRUFFLE_DIGGERS_NEEDED, crew_size at seed)
    unearthed_at  timestamptz,                     -- idempotency stamp (mirrors mud_wars.resolved_at)
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (war_id, crew_id)                        -- one truffle per crew per war
);

CREATE TABLE IF NOT EXISTS public.war_truffle_digs (
    war_truffle_id bigint     NOT NULL REFERENCES public.war_truffles(id) ON DELETE CASCADE,
    digger_id      uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dug_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (war_truffle_id, digger_id)         -- DISTINCT digger by construction
);
```

The `(war_truffle_id, digger_id)` PK is the entire anti-alt/anti-grind guarantee in one constraint: a member can land at most one dig, so `COUNT(*)` over this table *is* the distinct-digger count.

RLS is SELECT-only (every write flows through the SECURITY DEFINER `sling_mud` extension), gated through the existing `is_war_participant(p_war, auth.uid())` helper — the same leak posture `mud_slings` uses (`20260647` lines 173-175). Because the dig table keys on `war_truffle_id` (not `war_id`), its policy joins back to `war_truffles`:

```sql
ALTER TABLE public.war_truffles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.war_truffle_digs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View war-truffles in your wars" ON public.war_truffles FOR SELECT
    USING (public.is_war_participant(war_id, auth.uid()));

CREATE POLICY "View war-truffle digs in your wars" ON public.war_truffle_digs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.war_truffles t
                   WHERE t.id = war_truffle_id
                     AND public.is_war_participant(t.war_id, auth.uid())));

-- Realtime, guarded exactly like the mud_slings ADD in 20260647 (lines 179-181).
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.war_truffle_digs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
```

(Note `is_war_participant` is `STABLE SECURITY DEFINER`, so the policy doesn't self-recurse — same reason `mud_slings`' policy is safe.) Adding `war_truffles` itself to the publication is an optional belt-and-braces nicety; the dig table is the one that actually animates the meter.

### RPC changes

1. **Seed at the two activation points only.** Add a tiny `seed_war_truffles(p_war uuid)` helper (or inline the INSERTs) called from **`accept_challenge`** (defender accepts → `status = 'active'`, line 507 of `20260647`) and **`challenge_house`** (bot auto-accepts → inserted already `'active'`, line 471). Deliberately **not** from `challenge_crew`, which only creates a `'pending'` row (line 439) — a pending war has no field yet, so seeding there would orphan truffles on a declined challenge. The helper inserts one `war_truffles` row per **real** crew (skip the bot crew `00000000-...-b0`), with `diggers_needed = LEAST(TRUFFLE_DIGGERS_NEEDED, <that crew's current member count>)`. Because `20260647` is unpushed at time of writing (verify with `supabase migration list` before authoring — if it has shipped, the carry-verbatim rule below still holds, only the push order changes), these two RPC bodies are edited via `CREATE OR REPLACE` in the *new* migration — but **carry their bodies verbatim from `20260647`** and add only the seed call (carry-latest-def footgun: re-deriving from an older base would silently drop the `defender_busy`/`target_busy` two-simultaneous-wars guards and the savepoint-wrapped announcement loop).

2. **Dig as a side-effect of `sling_mud`.** Extend `sling_mud(p_war)` (again, `CREATE OR REPLACE` carrying the `20260647` body verbatim) so that *after* the successful `mud_slings` upsert, inside a savepoint, it records a distinct dig and possibly unearths:

   ```sql
   -- savepoint-guarded so a truffle fault can NEVER roll back the core sling write
   BEGIN
     SELECT id, diggers_needed, unearthed_at INTO v_tr_id, v_need, v_done
       FROM public.war_truffles
       WHERE war_id = p_war AND crew_id = my_crew FOR UPDATE;
     IF v_tr_id IS NOT NULL AND v_done IS NULL THEN
       INSERT INTO public.war_truffle_digs (war_truffle_id, digger_id)
         VALUES (v_tr_id, caller_id) ON CONFLICT DO NOTHING;     -- idempotent distinct dig
       SELECT count(*) INTO v_count FROM public.war_truffle_digs WHERE war_truffle_id = v_tr_id;
       IF v_count >= v_need THEN
         PERFORM public.unearth_war_truffle(v_tr_id);            -- pays the participants, idempotent
       END IF;
     END IF;
   EXCEPTION WHEN OTHERS THEN NULL; END;
   ```

3. **`unearth_war_truffle(p_truffle bigint)`** — SECURITY DEFINER, the capped-payout engine, idempotent via `unearthed_at` exactly like `resolve_war` is via `resolved_at`:
   - `SELECT ... FOR UPDATE`; if `unearthed_at IS NOT NULL` → no-op return (never double-pay).
   - For each **digger** of this truffle (`war_truffle_digs` join `crew_members`, real-crew only): `UPDATE public.profiles SET counter = counter + TRUFFLE_BONUS, tickles_earned = tickles_earned + TRUFFLE_BONUS WHERE id = digger`. (Whether `tickles_earned` is touched is a *capped-faucet* decision — see open questions; if leaderboard contamination is a worry, mint into `counter` only, like the bot-stipend branch of `resolve_war`.)
   - Optionally grant the **war cosmetic** (a `mud_war`-source title, e.g. `truffle_unearther`, `ON CONFLICT DO NOTHING`, reusing the `user_titles` insert pattern + the `titles_source_check` already permitting `'mud_war'`). No new blessing kind needed unless a regen treat is desired.
   - Stamp `unearthed_at = now()`. Announce to all crew participants via INLINE `system_announcements` INSERTs, savepoint-guarded.
   - **Bot-war truffle**: either don't seed one for crews fighting the house, or seed it and grant cosmetic-only / nothing (mirror the bot-farm neutralization in `resolve_war`). Recommend: seed for the challenger only, grant the capped bonus but **no `tickles_earned`** (consistent with the bot-stipend rule).

4. **Surface in `war_side` (so both sides carry it for free).** Add the `truffle` block into `war_side(p_war, p_crew)` — the per-side aggregator — so both `mine` and `them` inherit it without touching `war_state`'s procedural body. Note `war_side` is `LANGUAGE sql` (`20260647` line 792), so the block must be a **correlated sub-SELECT** in the `jsonb_build_object`, not procedural code:

   ```sql
   'truffle', (
     SELECT CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object(
       'diggersNeeded', t.diggers_needed,                       -- column is snake_case; alias to the camelCase the client WarSide expects
       'diggersSoFar',  (SELECT count(*) FROM public.war_truffle_digs d WHERE d.war_truffle_id = t.id),
       'unearthed',     t.unearthed_at IS NOT NULL,
       'iDug',          EXISTS (SELECT 1 FROM public.war_truffle_digs d
                                WHERE d.war_truffle_id = t.id AND d.digger_id = auth.uid()),
       -- Named co-presence: which crewmates have dug (defeats "my effort is invisible" social-loafing — brief, free-rider axis).
       'diggers',       (SELECT COALESCE(jsonb_agg(p.username ORDER BY d.dug_at), '[]'::jsonb)
                         FROM public.war_truffle_digs d JOIN public.profiles p ON p.id = d.digger_id
                         WHERE d.war_truffle_id = t.id)
     ) END
     FROM public.war_truffles t WHERE t.war_id = p_war AND t.crew_id = p_crew
   )
   ```

   The bot side has no `war_truffles` row, so this yields `NULL` for it automatically — no special-casing. `war_state` is then carried **verbatim** (it just re-emits `mine`/`them` from `war_side`); the only `war_state` edit needed is none, which is the cleanest possible change. `war_side` stays the REVOKE'd internal helper (`20260647` line 931), so no new grant.

5. **Grants** — `GRANT EXECUTE ... TO authenticated` on any new *public* RPC; `unearth_war_truffle` and `seed_war_truffles` are internal-only (called only by SECURITY DEFINER RPCs that run as owner), so `REVOKE EXECUTE ... FROM PUBLIC` exactly as `war_side` does (`20260647` line 931) — Postgres grants EXECUTE to PUBLIC by default, so a bare "don't grant" is *not* enough; the REVOKE is mandatory.

### Client changes

- **`constants/mudFights.ts`** — add `TRUFFLE_DIGGERS_NEEDED = 3`, `TRUFFLE_BONUS = 15` (mirror the server inline constants; the file already documents this must-stay-in-sync contract).
- **`utils/mudWars.ts`** — extend the `WarSide` interface (lines 59-66) with `truffle?: { diggersNeeded: number; diggersSoFar: number; unearthed: boolean; iDug: boolean; diggers: (string | null)[] }`. No new RPC wrapper needed (it rides on `war_state`/`war_side`); `slingMud`'s result (currently `{ slings_today, remaining }`, line 150) can optionally surface an extra `{ truffleUnearthed: true }` for a one-shot celebration.
- **`hooks/useMudWar.ts`** — the optimistic `bumpMine` already recomputes `mine`; extend it to optimistically tick `truffle.diggersSoFar`/`iDug` on the *first* sling of the day. The existing throttled realtime subscription on `mud_slings` already triggers a `refresh()` that will pull the live opponent truffle state; optionally also subscribe to `war_truffle_digs` for the opponent's meter (or rely on the existing `mud_slings` event, since a dig only happens alongside a sling).
- **`app/mud-war.tsx`** — add a `<TruffleMeter>` sub-component to `ActiveWar` (line 225, rendered next to `QuorumLine` at line 339 / the rope at lines 283-285), showing each side's "🐽 2 / 3 dug" with a fill bar, the **named diggers** (the `diggers` array — visible individual contribution), and an "Unearthed!" state. Reuse the existing `WHIMSY` palette (imported line 42) + the squish/flung-mud-splat tap juice (lines 237-260). On `truffleUnearthed`, a small flourish in the same animation idiom the screen already uses.

### Realtime / push

- Realtime: the opponent meter rides the existing `mud_slings` channel in `useMudWar` (a dig only ever accompanies a sling), so **no new subscription is strictly required**; adding `war_truffle_digs` to the publication is a belt-and-braces nicety.
- Push: the unearth event already produces a `system_announcements` row per crewmate, which flows through TTP's existing WhileAway/announcement path (same as war start/resolve). No new push infra. ([[notifications]])

## Rewards tie-in (war cosmetics + capped core payout)

Two-track reward, matching the research's "dual-track recognition" (personal badge + collective unlock — Destiny's Empyrean Foundation) and the founder's resolved reward context:

- **War-exclusive cosmetic (the prestige track + the kept artifact).** Unearthing the crew truffle grants a **war-only cosmetic** produced via the ChatGPT/icon-gen accessory pipeline — an *animated war background* (mud-fight arena variant) and/or a **truffle-hunter hat**, surfaced only inside the war screen / season. To make it the research's *kept artifact* (FarmVille's bigger barn, Destiny's emblem — a standing monument, not a one-off toast), the granted `mud_war`-source title is **permanent on the profile** (a `user_titles` row never expires, unlike the 72h regen blessing), and reads as a season-tagged trophy ("Truffle-Unearther — \<season\>") so it survives the war's `ON DELETE CASCADE` reset. The *war-truffle row* dies with the war; the *earned title* is the keepsake that doesn't. It stays out of the core economy entirely (cosmetic, no snout value). Delivered as a `mud_war`-source title (e.g. `truffle_unearther`) or a new cosmetic id; `titles_source_check` already allows `'mud_war'` (`20260647` line 250), and the `INSERT ... ON CONFLICT DO NOTHING` into `user_titles` clones the exact `mud_champion` grant pattern in `resolve_war` (lines 691-700).
- **Capped core payout (the warmth track).** A flat **`TRUFFLE_BONUS` ~15 snouts** per participating crewmate, one-time per war, idempotent, participation-gated (you must have dug). This is deliberately small and capped — well under a day's sling-equivalent — so it's a treat, not a faucet. It respects the cash-faucet lesson: bounded, anti-collusion-gated (distinct real members + friend-gated crew + one unearth per war), server-authoritative, idempotent. Whether it also writes `tickles_earned` (leaderboard) is the one live economy question below; the conservative default (snouts only, no leaderboard) matches the bot-stipend precedent. ([[snouts-economy]])
- **No regen buff by default.** The war-winner regen blessing (`war_winner_regen`, ×0.85/72h, folded into `regen_secs_for`) stays the *win* reward; the truffle is a lighter, parallel treat and shouldn't stack a second core-loop buff unless playtesting wants it. ([[regen]])

## Risks / open questions

- **Does the truffle dilute the win condition's clarity?** Two parallel objectives on one screen (win the rope **and** unearth the truffle) could muddy "what am I playing for." Mitigation: keep the truffle visually subordinate (a small meter under the rope), and message it as "bonus dig," never as a second scoreboard. Decision needed: is that separation legible enough, or should the truffle visually *be part of* the rope?
- **`tickles_earned` on the bonus — yes or no?** Writing it contaminates the [[snouts-economy]] leaderboard with a capped, participation-only number; not writing it keeps the leaderboard purely sling-earned (matching the bot-stipend rule). **Recommend: no `tickles_earned`** unless the bonus should "count." Founder call.
- **Threshold tuning.** `TRUFFLE_DIGGERS_NEEDED = 3` against `CREW_CAP = 5`: too high and small/inactive crews never unearth (cozy-floor violation — the Fall Guys slacker-tanks-the-team failure); too low (e.g. 2 = the quorum) and it's nearly automatic and adds little. Clamping to `LEAST(needed, crew_size)` protects 2-person crews. Is 3 right, or should it scale (e.g. `ceil(crew_size * 0.6)`)?
- **Bot-war truffle policy.** Seed one for house-fighters or not? Granting the capped bonus for a bot war is farmable across repeated bot challenges unless rate-limited; safest is cosmetic-only or no bonus on bot wars (mirror the `resolve_war` bot-farm fix). Decision needed.
- **First-sling-of-day vs explicit dig.** Tying the dig to "first sling that day" is the lowest-friction (no new tap), but means a member who already slung *before* the truffle seeded (impossible at war-start, but relevant if we ever seed late) wouldn't retro-count. Alternative: a member's *very first sling of the war* counts, regardless of day. Recommend first-sling-of-war (`ON CONFLICT DO NOTHING` makes it naturally once-ever).
- **Cadence interaction (3-on/1-off) — resolved to a clamp, not a tuning knob.** The resolved war cadence is ~3 days on / 1 off; today `WAR_LENGTH_DAYS = 5` (`constants/mudFights.ts` line 10). Decision: keep the *threshold* fixed at distinct humans (`LEAST(3, crew_size)`) rather than scaling it to war length — the dig is a *participation* gate, and "3 different crewmates each show up once across a 3–5 day window" stays a meaningful-but-cozy ask whether the window is 3 or 5 days (it is exactly the brief's generous-floor + ≥1-participation rule, and a shorter window makes 3-of-5 *more* of a real coordination beat, not less). The truffle deliberately does **not** key off `WAR_LENGTH_DAYS`, so a future cadence change needs no truffle migration. Only revisit if wars ever drop *below* ~2 days, where even one distinct digger per day is tight.
- **Cosmetic production dependency.** The animated background / hat depends on the ChatGPT/icon-gen pipeline (`icon-gen` skill) and a manual reference-drag step — it's the long-pole art task, not a code risk. The code can ship with a placeholder title and the art lands later.
- **Migration ordering.** New file must sort after `20260649`; and the `CREATE OR REPLACE` of `sling_mud`/`accept_challenge`/`challenge_house` must carry their `20260647` bodies **verbatim** (carry-latest-def footgun). Since `20260647` is unpushed, push order matters: `20260647` must land before the new migration that depends on its tables/RPCs.

## QA / smoke test (the things that actually break)

The reused patterns are proven; the *seams* are where this can break. Before shipping, walk these:

1. **Idempotent unearth (no double-pay).** Two crewmates sling the 3rd-and-4th distinct dig nearly simultaneously → exactly one `unearth_war_truffle` body runs the payout (the `FOR UPDATE` + `unearthed_at IS NOT NULL → no-op` guard, cloned from `resolve_war`). Assert each participant's `counter` rose by `TRUFFLE_BONUS` exactly once.
2. **Sling never rolls back.** Force a fault inside the truffle savepoint (e.g. a deliberately bad announcement insert) → the `mud_slings` upsert still commits and the RPC returns `ok:true`. This is the whole reason the block is `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END`.
3. **Distinct-digger gate holds under grind.** One account slings 60× → `war_truffle_digs` has exactly 1 row for it (`ON CONFLICT DO NOTHING`), meter stays at `1/3`. One whale cannot unearth solo.
4. **Clamp on small crews.** A 2-person crew seeds `diggers_needed = 2`; both sling → unearths. A solo crew (shouldn't exist post-quorum, but defensively) seeds `1`.
5. **Bot war policy.** Challenge the house → confirm the seeded bot-side behavior matches the chosen policy (recommend: challenger seeded, capped bonus, **no `tickles_earned`** — mirroring the `resolve_war` bot-stipend branch, lines 668-673), and that re-challenging the bot can't farm the bonus repeatedly (rate-limited by the existing 24h rematch cooldown in `challenge_crew`, but the bot path has no such guard — **add a per-(user, bot-war) once-per-window check or grant cosmetic-only on bot wars**).
6. **RLS leak check.** A non-participant calling `war_state` on someone else's war still returns `null` (the `is_war_participant` gate at line 840), and cannot SELECT `war_truffle_digs` directly.
7. **Realtime parity.** Opponent's meter ticks within the 1500ms throttle window on the existing `mud_slings` channel without a dedicated subscription.

## Rollout (dark-launch, mirroring the parent)

Sounder Mud Fights itself was dark-launched (`20260647` header: "next-season headline, dark-launched"). The truffle should ride the same switch: ship the migration + client behind whatever gates the mud-war screen's visibility, seed truffles for all real wars from day one (harmless if the UI is hidden — the meter just accrues), and reveal the `<TruffleMeter>` when the parent feature goes live. The cosmetic art (long pole) can land in a later build with the title pre-created and the meter shipping against a placeholder.

## Effort (LOW–MEDIUM)

**LOW–MEDIUM, leaning LOW.** The mechanic is almost entirely composition of two finished stacks. New surface area is small and bounded:

- **DB (LOW):** two tiny tables, one seed helper, one `unearth_war_truffle` payout fn (a trimmed `resolve_war` clone), and three `CREATE OR REPLACE`s that *carry existing bodies verbatim* and bolt on a savepoint-guarded block each. Every pattern (FOR UPDATE idempotency, savepoint guards, INLINE announcements, distinct-member PK, capped server-authoritative payout) already exists in-repo to copy.
- **Client (LOW):** two constants, one `WarSide` field, one optimistic tick in `bumpMine`, one `<TruffleMeter>` component on an existing screen. No new RPC wrapper, no new realtime channel required.
- **Art (MEDIUM, parallel):** the animated war background / hat via the icon-gen pipeline is the only non-trivial lift, and it's decoupled from the code (ships with a placeholder cosmetic).

The biggest *risk* surface is correctly carrying the three reused RPC bodies (carry-latest-def) and the idempotency of the payout — both are well-trodden in this exact codebase.

## Connects to

- [[sounder-mud-fights]] — the host system; this is an additive bonus layer on its isolated field, sharing `crews`/`mud_wars`/`mud_slings`/`sling_mud`/`resolve_war`.
- `docs/sounder-mud-fight-spec.md` — the parent mud-wars design spec (cited in the `20260647` header); this is one of its deferred "cooperation-bonus mud" follow-ons (P3). (No `team-clan-mud-wars-plan` wiki page exists yet — fold this follow-on into [[sounder-mud-fights]] when the wiki page is next compiled.)
- [[snouts-economy]] — the capped truffle bonus mints snouts server-side; the cash-faucet cap + anti-collusion gate discipline lives here.
- [[trough]] — `resolve_war`'s lazy/idempotent resolution (the model for `unearth_war_truffle`'s `unearthed_at` guard) clones the Trough's first-reader pattern.
- [[regen]] — the win reward (`war_winner_regen`) lives in `regen_secs_for`; the truffle deliberately does *not* add a second regen buff by default.
- [[notifications]] — unearth/seed announcements are INLINE `system_announcements` inserts (never `send_system_announcement`), flowing through the existing WhileAway path.
- The research brief: `docs/wiki/outputs/memos/coop-mechanics-research-2026-06.md` — shared-goal axis (filling meter, participation gate, kept artifact, dual-track reward) and fairness axis (distinct-member gate, capped contribution, per-capita anti-snowball).
