---
title: "Future Direction — June 2026"
type: memo
date: 2026-06-13
tags: [strategy, roadmap]
---

# Future Direction — June 2026

> Grounded multi-lens strategy analysis for Tickle the Pig → synthesized prioritized roadmap + POV (7 analysis lenses).

## Situation

TTP is a feature-dense, technically healthy solo project (239 green jest tests, clean `tsc`, hard-won SQL footgun discipline now baked into the 884-line Mud Fights migration) that is paradoxically stuck: ~27 beta players, no public App Store listing (iTunes id 6740339848 returns 0), and almost every growth lever already BUILT and idle behind a single gate.

The central tension is sequencing under one developer's finite hours: the founder's instinct is depth (a whole clan-war season, Mud Fights, is built and dark-launched as the "next season" headline), but the leverage right now is unblocking — a complete referral stack (live AASA, landing, /r/ links, +50/+100 economics, auto-cutover button) is dead weight until the listing publishes, and the two best retention levers (the streak Garden, a daily "done" beat) are designed but invisible.

Layered under all of it are two un-faced facts the brief itself gets wrong:

- ⚠️ **`finalize_season` is NOT manual** — `20260579_judgement_day_cron.sql` schedules a DESTRUCTIVE `pg_cron` job that wipes all alignment at noon UTC on **2026-07-15** (32 days out).
- The word **"Sounder"** now names three different things in shipped code (friends graph in `CONTEXT.md`, referral downline in the shipped migration + titles, and the war crew in the new spec).

The right read: TTP does not have an idea problem or a tech problem — it has a **SEQUENCING and COHERENCE problem**, and the calendar is forcing a decision whether the founder sequences it or not.

## Strategic Bets

### 1. Win the unblock-and-ship race before depth.
Treat the App Store cutover, the Garden/daily-loop visibility, and the founder-skin+reset as a single launch package — and hold Mud Fights dark until there is a population to fill it.

**Why:** Every growth dollar is already spent: AASA, landing, /r/ path, redeem RPC, +50/+100 economics, and an auto-cutover landing button all ship live and idle behind one gate. Until id 6740339848 goes public, every shared invite dead-ends at a high-friction TestFlight install and growth from 27 is structurally impossible. Mud Fights is a clan-war season that, by its own spec (house-bot Mudlarks crew), can't fill two crews of 5 at 27 players — building depth for a world too small to use it is the exact mis-sequence that wastes a solo dev's scarce hours.

### 2. Make loyalty PERCEIVABLE.
The streak Garden + a single daily "your pig's day is done" beat is the cozy retention spine — not a competitive layer.

**Why:** The streak is the best-designed D7/D30 lever in the repo (consecutive-day multiplier, hour-24 cozy push, 5-stage Garden in `CONTEXT.md`/ADR-0002) but ships HEADLESS — no garden art, no Garden component, no surface in `Barn.tsx`/`useHomeStats.ts`. A multiplier the player can't see is not a loyalty mechanic. The core loop's only reward is regen compression toward a 60s floor plus one-time cosmetics; a cozy player needs a 5-minute terminal "done for today" goal, not a clan war. This is an art-session-sized fix to a structural boredom problem the founder correctly diagnosed.

### 3. Commit to a three-layer identity model — SOUL / TRIBE / BANNER.
Resolve "Sounder" before any new social surface flips.

**Why:** TTP carries four overlapping "pick a side" systems (alignment, World Cup allegiance, referral downline, war crew) designed in separate sessions and never reconciled; the teams idea alone churned through three incompatible designs. "Sounder" simultaneously names the friends graph, the referral downline (with `drove_captain` titles already granted to real users), and the war crew — a live three-way contradiction that will read as a bug. Fixing it now (alignment = permanent SOUL, war crew = permanent TRIBE, time-boxed events = disposable BANNER; rename downline to "Drove", friends graph to "Friends") is a copy/find-replace migration that prevents the next brainstorm from spawning a fifth faction and dissolves the badge-fatigue risk for a one-head, one-aura, one-flag pig.

### 4. Build ONE recurring snout SINK and harden the leaderboard BEFORE turning on a single dollar of IAP or attaching competitive stakes.

**Why:** There is exactly one currency in code (`profiles.counter`) and exactly one sink (`buy_hat`, one-time). Every faucet — trades (net +N mint), lucky pig (client-trusted, admittedly spoofable), visits, Trough, the 250/mo stipend, and future Mud Fight payouts — mints into a reservoir with no outlet, so your most engaged (most monetizable) players eventually own the catalog and the shop stops mattering, collapsing the whole cosmetic-purchase thesis. Worse, the leaderboard you're about to reset and attach a founder-skin/Mud-Fight prestige to double-mints and is gameable. A perishable sink wired into systems you already own (happiness treats, blessing buffs, non-refundable Trough seeds) plus server-authoritative lucky-pig is the precondition for monetization being sustainable rather than front-loaded.

## Roadmap

### Now

- ⚠️ **Verify the live cron (`SELECT * FROM cron.job`) and DECIDE the July 15 Judgement Day:** the destructive auto-wipe fires in 32 days. If public launch + leaderboard reset won't be aligned to it, `cron.unschedule('judgement-day-season-1')` until ready. Fix the stale `systems-overview.md` "Known gaps" that calls it manual — a destructive auto-firing job the founder believes is manual is the single riskiest drift in the repo.
- **Confirm the EXACT App Store Connect state of id 6740339848** (in-review / rejected / metadata-incomplete / approved-unreleased). If approved-pending-release, release it. If rejected, fix the two flagged culprits (`demo@ticklethepig.com` seed likely skipped because the auth user was never created; Spanish ToS). The landing button auto-cuts to the App Store on publish — no rebuild needed to unblock distribution.
- **Build the launch package as ONE migration + one art session:** grant the exclusive Founder/Beta skin to all ~27 current accounts, reset the public leaderboard at the cutover, and add a short in-app note so testers understand the reset and see their skin. The scarcity hook only works if it exists AT the cutover.
- **Ship the streak Garden visual + hour-24 push** (finish `docs/streak.md` Phase 2/3 via the icon-gen pipeline; thread `current_streak` through `useHomeStats.ts`; add the Garden to the Barn ambient layer). Make the existing silent multiplier perceivable — the highest-value, lowest-effort retention fix sitting half-done.
- **Resolve the "Sounder" word collision:** friends graph = "Friends", referral downline = "Drove", war crew = "Sounder". Display-name-only titles migration + find/replace + a one-paragraph identity model (SOUL/TRIBE/BANNER) written into `CONTEXT.md` so it can't fork again.
- **HOLD Mud Fights dark** (`MUD_FIGHTS_VISIBLE=false`) through launch — do not let a clan-war season for a 27-player world consume the hours this package needs.

### Next

- Add ONE recurring snout sink before flipping IAP — make snouts perishable somewhere (non-refundable/house-cut Trough seeds, or a consumable happiness "slop"/blessing-buff reusing existing infra). Near-zero new art; the precondition for sustainable monetization.
- Add a daily terminal goal on Home/Barn ("hit today's tickle goal → claim snouts + streak credit") that ties bounty + streak + happiness into one cozy "done for today" beat, and fix the `halo_kiss` no-op so the daily ritual always lands.
- Build the inviter completion celebration (`referral-feedback.md` `ReferralCompletedModal` + pending line) AND move push-permission request into the core loop (Barn/launch), not just the Friends tab — today the inviter often never gets the payout push, so the most rewarding social event lands as a silent number.
- Resolve the World Cup with a real finale: a one-shot idempotent RPC granting a "backed-the-winner" title to matching allegiance picks when the champion is known (~2026-07-19), with an inlined `system_announcement`. Events that never pay off train players that events don't matter — this is one migration on existing plumbing.
- Pick ONE final price sheet (Slop Club $3.99/mo or $29.99/yr; Season Pass $4.99) and mark the contradictory specs (`subscriptions-spec` $19.99/yr; `SUBS_REQUIREMENTS` old product IDs) as superseded. DROP raw currency consumable bundles from the v1 storefront — they undercut the Trough bridge, are the ugliest cozy-game optics, and draw the harshest review. Sub + pass only.
- Wire `supabase test db` (the 3 existing pgTAP suites) into `package.json` + `ship-ios.sh` alongside `tsc`/`jest`, and add a plain `test: jest` non-watch alias. 100% of shipped prod regressions came from the RPC/SQL layer and 0% of the 239 green tests touch it.
- Server-authoritate the two leaderboard mints (move lucky-pig roll server-side or rate-limit/sanity-cap it; reconsider whether the trade-flip should mint to `tickles_earned` at all) before competitive stakes ride that number.
- Land the barn-visiting v2 "warmth loop" (visit gift → alignment, while-away "friends visited" claim, daily visit budget). Visiting is the only social mechanic that threads into every other system — deepen the connective tissue before adding more competitive surface.

### Later

- Soft-launch Mud Fights as the Season 2 headline ONCE post-launch DAU can fill 2+ real crews of 5. Give it one cosmetic-only tie to the cozy loop (your real closet loadout + alignment aura show in the pit, display-only, zero effect on the flat 20 slings/day) so it's YOUR pig fighting, not a stripped avatar. Gate house-bot (Mudlarks) wins to cosmetic/title only — no regen buff, no snout transfer — so core value can't be farmed against a fixed-pace bot.
- Pay Mud Fight rewards in a war-only token redeemable for war-exclusive cosmetics + the regen buff instead of raw snouts, giving the competitive layer its own closed economy that can't flood the cozy core — reinforcing the isolation thesis you already locked.
- Generalize seasons: a `seasons` table + `finalize_season(key)` + `start_season(key)` driven by ONE nightly cron checking for end/start, replacing the bespoke season-1 job, with a re-skinnable Rivalry/BANNER frame slotting into it. Removes the no-season-2-spin-up dead-air risk after each finale.
- Run World Cup (or a future event) as "Rivalry-0": collapse the 47 countries into a 2-side rope for the final week, scoring = tickles + barn visits, one reward, reusing `AllegianceModal`/flag/leaderboard code — the cheap learning step for the tug-of-war mechanic that Mud Fights skipped, and the first instance of the BANNER layer.
- Pre-model and cap the Mud Fight snout faucet against a tolerated weekly injection budget before it scales with the player base.
- Add a migration-redefinition guard script (the carry-latest-def grep+diff recipe) and a minimal pre-push CI (`tsc` + `jest` + pgTAP) so velocity survives public-launch pace without re-breaking the core loop in the dark.

## Biggest Risk

> ⚠️ A solo dev who believes `finalize_season` is manual gets blindsided on **2026-07-15** when the scheduled `pg_cron` job wipes every player's `alignment_score` to 0 — unsupervised, 32 days out, with no Season 2 content queued behind it and no comms to the 27 testers.

This is the compounding failure: it can collide with (or pre-empt) the still-unscheduled public launch and the planned leaderboard-reset-plus-founder-skin (which would then either double-reset or fire in the wrong order), it lands the marquee D30 moment as silent dead-air instead of a climax, and the canonical "Known gaps" doc actively misleads the one person who could prevent it. The fix is one SQL query and one decision this week (align the launch + reset + Judgement Day onto one date, or unschedule the cron until they're aligned) — cheap to fix now, catastrophic to discover on July 15.

## The One Next Thing

> ⚠️ **Reconcile the calendar collision FIRST.**

Run `SELECT * FROM cron.job` on the live DB to confirm the `judgement-day-season-1` job, then make one decision — does Season 1 end (and the public launch + leaderboard reset + founder-skin grant fire) on **2026-07-15**, or do you unschedule the cron until launch is confirmed?

Everything else in the "now" bucket (App Store cutover, founder skin, leaderboard reset, Garden) hangs off this date, and it is a destructive, automated, solo-owned job firing in 32 days that the founder currently believes is manual. It costs one query and one founder decision; getting it wrong wipes the season unsupervised and torpedoes the one-time scarcity hook. Sequence the calendar, then ship the launch package against it.

## Open Decisions

### 1. Does Season 1 / Judgement Day fire on its scheduled 2026-07-15, or move it to align with the (still-unconfirmed) public launch date? ⚠️
**Recommendation:** Unschedule the cron now and re-anchor Judgement Day to the public-launch week. The founder skin + leaderboard reset are a one-time scarcity hook that MUST coincide with the cutover; letting an automated wipe fire before the listing is even public squanders it and risks an unsupervised reset. Make the season end a deliberate launch moment, not a calendar accident.

### 2. Mud Fights at launch as the "Season 2" headline, or held dark until DAU supports real 5-person crews?
**Recommendation:** Hold it dark through launch. It's a heavyweight clan-war layer that its own spec admits falls back to a house-bot at low population — shipping it to 27 people who can't yet frictionlessly invite friends is the retention layer arriving before the acquisition unlock. Launch on the cozy spine (Garden + daily goal + founder skin + reset); flip Mud Fights once real players can fill it.

### 3. Which concept owns the word "Sounder" — friends graph, referral downline, or the war crew?
**Recommendation:** The war crew. It's the most evocative meaning and where you're investing. Rename the referral downline to "Drove" (already half-used in `drove_captain`), the friends graph to "Friends", and codify SOUL/TRIBE/BANNER in `CONTEXT.md`. Display-name-only migration, no data move — do it before `MUD_FIGHTS_VISIBLE` ever flips.

### 4. Ship raw currency (tickle/snout) consumable bundles in the v1 storefront, or sub + season pass only?
**Recommendation:** Sub + season pass only. Raw-currency bundles undercut the Trough's 2:1 bridge and the stipend, are pay-to-win against the leaderboard you reset to make competitive, are the worst cozy-game optics, and draw the harshest App Review for a tiny audience. Revisit only after a real sink exists and data shows demand.

### 5. Turn IAP on at/near public launch, or wait until a recurring snout sink exists?
**Recommendation:** Wait for the sink. The plumbing is 90% done and dormant, but with `buy_hat` as the only (one-time) drain, every monetization product funnels currency into a reservoir with no outlet — turning IAP on just front-loads the collapse. Ship one perishable sink (non-refundable Trough seed or a consumable happiness/blessing buff) FIRST, then flip IAP.
