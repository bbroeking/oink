# Season 1 flip runbook — "The Great Hunger" go-live

> **Renumbered 2026-07-06: greedy/generous era = Season 0, Great Hunger = Season 1.** (This file was `docs/season2-flip-runbook.md`; server ids below reflect the renumber migration — the `season1_finale` flag key is a legacy name and deliberately unchanged.)

The exact operational sequence from the **July 12 Season-0 finale cron** to **Season 1 being live**. Every step is grounded in a migration or flag that exists in this repo; anything not yet decided or not verifiable from the repo is marked **[OPEN QUESTION]**.

> **Read first.** Nearly every Season-1 migration carries a `HELD FOR REVIEW — push only on Brian's explicit "go"` header (`20260692`, `20260704100000`–`20260704600000`). Per `CLAUDE.md`, DB pushes are **never** autonomous. This runbook is the checklist for the human who runs `npx supabase db push` from Brian's machine, in order.

---

## 0. Cast of flags, jobs, and functions

| Thing | Where it lives | Default | Role at flip |
|---|---|---|---|
| `app_config.'mud_wars'` | `20260692000000_feature_flags.sql` | global **false** | reveals the war surfaces (crew card, `/mud-war`, `/clan-ladder`) |
| `app_config.'world_boss'` | `20260704200000_hunger_meter.sql:21` | global **false** | reveals the Great Hunger layer (intro modal, hunger meter, drain surfaces, barn-forage truffle) |
| `app_config.'season1_finale'` | `20260704400000_beta_rewards.sql:50` | global **false** | reveals the `SeasonEndModal` beta-founder recap (**legacy key name** — it means the *season-0* finale; shipped build 103 reads this exact string) |
| `feature_flags()` RPC | `20260692` | — | effective flag = `COALESCE(per-user override, global default)` |
| `admin_set_feature_flag(key, bool)` | `20260692:77` | `is_test`-gated | the supported way to flip a global from the app/SQL |
| `run_judgement_day_season0()` | `20260709000000_season_renumber.sql` (carried from `20260704500000:31`; old `..._season1()` dropped) | cron | the Jul-12 finale engine (below) |
| cron `judgement-day-season-0` | `20260709000000` (reschedules `judgement-day-season-1`) | `0 0 13 7 *` | **00:00 UTC Jul 13 = 8:00 PM ET Jul 12** |
| `finalize_season('season_0')` | latest def `20260704600000_finalize_season_ambiguity_fix.sql` | service-role only | grants S0 alignment finale titles + snouts, then **wipes `alignment_score` to 0** |
| `grant_beta_rewards()` | `20260704400000:77` | service-role only | grants beta founder titles + `beta_founder_ribbon` + snouts + per-user inbox note |
| `hunger_meter()` | latest def `20260704200000:25` | `authenticated` | derives the boss drain stage from `mud_slings`; thresholds are **placeholders** |
| Client flag keys | `hooks/useFeatureFlags.tsx:32` | — | `"mud_wars" \| "world_boss" \| "season1_finale"` — all three must exist server-side |
| Client S0 countdown | `utils/season.ts` `SEASON_0_END` | `2026-07-12` | display only; see `20260704500000` header |

Brian's `brian` account already carries per-user overrides `mud_wars: true` (`20260692:113`) and `world_boss: true` (`20260704500000:67`), so the test account exercises the full season against the live DB **before** any global flip.

---

## 1. Pre-flip — land the migrations and the build (before Jul 12)

**Who:** Brian, from his machine. **When:** with enough lead time that the client build clears App Store review before Jul 12.

1. **Push the Season-1 migration stack** in filename order (all currently HELD-FOR-REVIEW):
   - `20260692000000_feature_flags.sql` — the flag table + `mud_wars` seed *(may already be applied; the header says applied-head at authoring was `20260692` — verify with the query in step 5)*.
   - `20260704100000_truffle_patch.sql` — `golden_truffles` pouch, `war_truffles` ledger, `mint_truffles()`.
   - `20260704200000_hunger_meter.sql` — `hunger_meter()` + **seeds `world_boss` = false**.
   - `20260704300000_truffle_exchange.sql` — `token_cost`, `exchange_rotation()`, `redeem_war_cosmetic()`, milestone mints.
   - `20260704400000_beta_rewards.sql` — beta titles, `beta_founder_ribbon`, `season1_finale` seed, `grant_beta_rewards()`, `my_beta_reward()`.
   - `20260704500000_judgement_day_beta_grants.sql` — **reschedules the destructive cron** + couples the grant + finale reveal to it + Brian's `world_boss` override.
   - `20260704600000_finalize_season_ambiguity_fix.sql` — **must land before the cron fires** (fixes a runtime 42702 in `finalize_season` that would otherwise strand the whole Jul-12 job).
   - `20260709000000_season_renumber.sql` (greedy/generous era → Season 0, Great Hunger → Season 1: `seasons` ids `snout_season_1`→`snout_season_0` / `snout_season_2`→`snout_season_1`, league key `season_2`→`season_1`, finale key + cron + engine fn → `season_0` names; flag keys untouched). Push together with `20260708000000_sounder_ribbons.sql`, which precedes it.
   - Any merged Season-1-queue migrations (e.g. the S1 battle pass `20260706*` from PR #16, the barn-forage truffle `20260704700000` from PR #17) once reviewed and merged.

   > **Ordering trap** (`CLAUDE.md` DB rule): every new migration must sort **strictly after** the newest already-applied file. Two files sharing a `YYYYMMDDHHMMSS` prefix collide on `schema_migrations.version` (PK).

   > **Battle-pass gap to note:** the Season-0 pass `ends_at` was extended to `2026-07-06` (`20260568000000_extend_season_1.sql:13` — filename is pre-renumber history), but the finale cron fires ~6 days later (Jul 12/13). Between Jul 6 and the flip, `active_season()` returns **nothing** (no S1 `seasons` row exists in the repo yet — PR #16 adds `snout_season_1`, post-renumber id). Decide whether that dead-pass window is acceptable or whether S1's `starts_at` should backfill it. **[OPEN QUESTION]**

2. **ART GATE — blocking.** `beta_founder_ribbon` art (`HAT_IMAGES` + placement) **must ship in a client build that is live before the cron fires** (`20260704400000:12`, restated `20260704500000:23`). If the grant lands before owners have the art, they see the orphan-cosmetic fallback bug (`20260685`). Same gate applies to every Great Hungerer asset the `world_boss` surfaces render.

3. **Ship the first Season-1 app build** (TestFlight → App Store; local build per `CLAUDE.md`). It **must** contain:
   - The `world_boss` / `mud_wars` / `season1_finale` client surfaces (`hooks/useFeatureFlags.tsx` reads all three; they render only when the flag is on).
   - `beta_founder_ribbon` art (step 2) and all Great Hungerer art.
   - `utils/season.ts` `SEASON_0_END = 2026-07-12` (moved in the same commit as `20260704500000`).
   - The bundled war-spoils art (all 25 since build 101) so the Truffle Exchange / `SpoilsShowcase` render.
   - **[OPEN QUESTION]** confirm the S1 battle-pass client (PR #16) is in this build if the pass is meant to appear at flip.

---

## 2. The Jul-12 finale — mostly automatic

The cron `judgement-day-season-0` fires `run_judgement_day_season0()` at **00:00 UTC Jul 13 (8:00 PM ET Jul 12)** (both renamed by `20260709000000`). In one transaction it (each step independently exception-guarded, `20260704500000:37`):

- **a.** `finalize_season('season_0')` — grants S0 alignment finale titles + snouts, then **wipes every `alignment_score` to 0** (the Season-1 slate). Idempotent per `season_key`.
- **b.** `grant_beta_rewards()` — ranks the founding herd by `tickles_earned`, grants tier titles (`beta_snoutfather` / `beta_bog_royalty` / `beta_trough_table` / `beta_founding_herd`), the `beta_founder_ribbon`, snouts (1000/750/500/250), and writes each player an inline `system_announcements` inbox note. Idempotent per user.
- **c.** Flips `app_config.'season1_finale'` → **true** (runs regardless of a/b outcome) → the `SeasonEndModal` recap reveals on next client boot.

**If the cron fails or you want to fire by hand** (option B in `20260704400000:24`), from the SQL console / service role:
```sql
SELECT public.run_judgement_day_season0();
-- or the individual steps:
--   SELECT public.finalize_season('season_0');
--   SELECT public.grant_beta_rewards();
--   UPDATE public.app_config SET enabled = true, updated_at = now() WHERE key = 'season1_finale';
```
Both are idempotent — safe to re-run if a step logged a `WARNING`.

> **Renumber check — RESOLVED:** `20260709000000_season_renumber.sql` carries the engine as `run_judgement_day_season0()` calling `finalize_season('season_0')`, unschedules `judgement-day-season-1`, schedules `judgement-day-season-0` on the same `0 0 13 7 *`, and drops the old function.

**Verify (`20260704500000:27`):**
```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'judgement-day-season-0';
SELECT count(*) FROM public.beta_reward_grants;        -- grants written
SELECT enabled FROM public.app_config WHERE key = 'season1_finale';  -- expect true
```

---

## 3. Flip Season 1 live

`finalize_season` and the finale reveal are **not** the same thing as turning on Season 1. The two boss/war flags default global-false and are **not** touched by the cron — a human flips them. Do this **after** confirming §2 landed:

1. **Retune the Hunger meter first (before the surfaces go live) — see §4.** The thresholds are placeholders; flipping `world_boss` with the beta-sized thresholds against the live population would mis-stage the boss from the first render.

2. **Flip the globals** (as an `is_test` account, or by hand in the dashboard):
   ```sql
   SELECT public.admin_set_feature_flag('world_boss', true);
   SELECT public.admin_set_feature_flag('mud_wars',   true);
   ```
   These reveal the Great Hunger layer and the war surfaces for **all** users (per-user overrides still win, but the global is now the default).

   **[OPEN QUESTION — sequencing/soft-launch]** whether `mud_wars` and `world_boss` flip together or `world_boss` leads (intro + meter first, wars a beat later). The repo supports either; the arc memos imply the war *is* the weapon against the boss, so they likely flip together. Confirm with Brian.

3. **Verify the effective flags** for a non-test account (impersonate or check via `feature_flags()` semantics):
   ```sql
   SELECT enabled FROM public.app_config WHERE key IN ('world_boss','mud_wars','season1_finale');
   ```

---

## 4. Hunger-meter threshold recompute for the live population

`hunger_meter()` (`20260704200000:42`) hard-codes:
```
thresholds := ARRAY[40, 100, 200, 340, 520];   -- gorged→stuffed→full→peckish→hungry→famished
season_start := 2026-07-01 00:00:00+00;
```
The header states these are **placeholders sized for the ~27-player beta** and must be retuned at the `mud_wars` flip from `war_population_ready()` instrumentation (rule of thumb: full season ≈ 5 stages ≈ expected total war output at ~40% participation).

**How to retune (the required mechanism):** carry `hunger_meter()` **verbatim** into a **new** migration (filename `> 20260704600000`, and after any later-merged migration), changing **only** the `thresholds` array and — if the season formally starts on a different date — `season_start`. Do **not** edit the applied `20260704200000` file (the repo's carry-latest-def rule; the header says so explicitly at line 41).

**[OPEN QUESTION]** the live population and expected per-capita war output at go-live are not knowable from the repo — pull them from `war_population_ready()` / live analytics right before the flip and size the five thresholds so the boss reaches `famished` around the season-end (Judgement-Day finale) date, not before.

---

## 5. Beta reward grants — what actually lands, and when

Covered by §2b, but for the operator's mental model:
- **Trigger:** `grant_beta_rewards()`, fired by the Jul-12 cron (or by hand).
- **Who qualifies:** named profiles (`username` non-empty) with any lifetime play (`tickles_earned > 0`), not `hide_from_leaderboard`; ranked tiers additionally exclude `is_test` (`20260704400000:94`).
- **What each gets:** `beta_founding_herd` title for everyone; rank tiers stack their podium title; everyone gets `beta_founder_ribbon` + snouts; an inbox note per user.
- **Recap surface:** gated by `season1_finale` (legacy key name — the season-0 finale); `SeasonEndModal` reads `my_beta_reward()`. (PR #19 in the S1 queue adds a persistent re-entry icon so the recap can be reopened after its one-time auto-play.)
- **Idempotency:** `ON CONFLICT (user_id) DO NOTHING` — re-running never double-grants.

---

## 6. What must be in the first Season-1 app build (consolidated)

1. `world_boss` / `mud_wars` / `season1_finale` client surfaces (they render only when flagged on, so shipping them dark is safe).
2. `beta_founder_ribbon` art **and** all Great Hungerer art — the **blocking ART GATE** (§1.2).
3. `utils/season.ts` `SEASON_0_END = 2026-07-12`.
4. Bundled war-spoils art (present since build 101) for the Truffle Exchange + `SpoilsShowcase`.
5. **[OPEN QUESTION]** the S1 battle-pass client (PR #16) and the Great Hunger story video (PR #18) if they're meant to be live at flip.

---

## 7. Post-flip verification checklist

- [ ] `cron.job` shows `judgement-day-season-1` at `0 0 13 7 *`.
- [ ] `beta_reward_grants` populated; a sample player sees the recap + ribbon + snouts.
- [ ] `season1_finale`, `world_boss`, `mud_wars` all `enabled = true` in `app_config`.
- [ ] `hunger_meter()` returns a sane `stage` for current live `mud_slings` totals (not stuck at `famished` from beta-sized thresholds).
- [ ] `active_season()` returns the S1 pass (`snout_season_1`, post-renumber id) **[OPEN QUESTION — depends on PR #16 merge + its `starts_at`]**.
- [ ] A non-test account sees the Great Hunger intro + war surfaces; a fresh account with `tickles_earned = 0` correctly gets **no** beta grant.
- [ ] `alignment_score` is 0 for all (S0 slate wiped).

---

## Open questions (rolled up)

1. Do `mud_wars` and `world_boss` flip **together** or does `world_boss` lead? (§3.2)
2. Live population + expected war output for the Hunger-meter threshold sizing — pull from `war_population_ready()` at flip. (§4)
3. Is the S1 battle pass (PR #16) meant to be live at flip, and is its client in the first build? (§1.3, §6)
4. Are PR #18 (story video) / other S1-queue surfaces required in the first build, or fast-follow? (§6)
5. Confirm `20260692` is already applied vs. part of this push (its header says applied-head was `20260692` at authoring). (§1.1)
6. ~~Renumber-carry check~~ — resolved by `20260709000000` (see §2). Post-push verify: `SELECT jobname, schedule FROM cron.job;` should list `judgement-day-season-0` and NOT `judgement-day-season-1`.
