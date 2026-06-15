---
title: "Judgement Day Plan A — The Quiet Reckoning"
type: plan
date: 2026-06-14
last_compiled: 2026-06-14
tags: [strategy, season, judgement-day, plan, cozy]
status: draft
---

# Judgement Day Plan A — The Quiet Reckoning

> Make the season finale a personal, cozy turning point — a warm look back at *your* journey — not a competition you win or lose.

## Goal (one line)

Ship the already-built Judgement Day finale so it actually *reaches* all ~27 beta players on July 15, reframed from "you placed Nth" to "here's your story" — with the smallest possible new surface and no destructive surprises.

**Definition of done (exit conditions):**

1. The July-15 cron fires and **every** named player has a durable, unseen verdict waiting (a `season_finales` row **and** a `system_announcements` row), so even an absent/untokened player gets "the season has turned" on next launch.
2. The `JudgementDayModal` reveal copy reads as a personal arc, not a rank.
3. A build-up countdown line is live before July 15, anchored to the *exact* cron timestamp.
4. `finalize_season`'s reset (`alignment_score = 0`) and idempotency (`ON CONFLICT … DO NOTHING` + `IF FOUND` gate) are provably intact after the carry-latest edit — verified by a staging dry-run, not by eyeball.

## The arc / rollout

The whole point of this plan is **least new machinery, most reuse**. Judgement Day is already ~95% built (`20260526000000_finale.sql`, `JudgementDayModal.tsx`, the live cron). Plan A re-frames that machinery and adds exactly one missing beat: the finale telling you it happened.

- **Build-up (now → July 15).** A soft, pressure-free line surfaces in-app: *"The season turns in N days."* No leaderboard, no rank preview. The countdown is anchored to the **exact** cron timestamp (see *The end-of-season constant* below) so client and server never disagree by a day. Optionally a gentle "your story so far" personal preview — your current [[alignment]] standing in narrative words ("you've leaned Generous lately"). It reflects *you back to yourself*, never against others.
- **The moment (noon UTC, July 15).** The existing cron `judgement-day-season-1` fires `finalize_season('season_1')`. **Today this produces NO push and NO durable note** — the verdict only appears when the player next foregrounds the app (`_layout.tsx:201` polls `my_finale_result` on `AppState` active). The one real piece of new server work in this plan is making the finale *announce itself*: an INLINE `system_announcements` INSERT (+ best-effort push) inside `finalize_season`, so even an untokened or absent player gets a warm "the season has turned" note waiting for them.
- **The reveal (on next open).** The **existing** `JudgementDayModal` — recopied around a personal narrative. Same gradient, scales glyph, paper verdict Sticker, "Claim verdict" CTA. We only soften the words: less "Goblin King / rank #2 of the Greedy side," more "Here's how your season went."
- **What's next / Season 2.** Alignment is already wiped to 0 by `finalize_season` (line 117–119). Season 2 is simply the next quiet chapter — same systems, fresh slate. The five finale titles carry over as **quiet badges** in the existing `user_titles` / [[achievements-and-titles]] system (already wired — nothing to build).
- **Share (optional, gentle).** A reflective "my season" card — the pig in its cosmetics + a one-line persona drawn from the verdict. Lower-key than the competitive Verdict Card in [[virality-and-growth-loops]]; here it's a keepsake, not a flex.

## Already built ✅

- **`finalize_season(season_key default 'season_1')`** — `supabase/migrations/20260526000000_finale.sql:54`. Ranks every named profile (`username IS NOT NULL AND username <> ''`) by `alignment_score`, buckets `top3/top10/participant/neutral`, writes `season_finales`, grants title + snouts (**snouts are added to `profiles.counter`**, line 111 — *not* a `snouts` column), then `UPDATE profiles SET alignment_score = 0, alignment_updated_at = now()` (lines 117–119). **Idempotent** per `season_key` via `ON CONFLICT (user_id, season_key) DO NOTHING` + the `IF FOUND` reward gate. `SECURITY DEFINER`, **not** granted to `authenticated`.
- **`season_finales` table** — `finale.sql:30`. Keyed `(user_id, season_key)`; holds `final_score`, `side`, `side_rank`, `bracket`, `title_id`, `snouts`, `finalized_at`, `seen_at`. RLS: view-own only.
- **Five finale titles** seeded — `halo_bearer_2026`, `goblin_king_2026`, `gilded_2026`, `schism_survivor`, `calm_in_the_storm` (`finale.sql:18`, `source='season'`).
- **`my_finale_result()`** (`finale.sql:128`) + **`mark_finale_seen(target_season_key)`** (`finale.sql:166`) — granted to `authenticated`; return the caller's latest unseen verdict / stamp `seen_at`.
- **`JudgementDayModal.tsx`** — full reveal UI: ember gradient, light rays, scales glyph, `headline()`/`subtitle()` copy helpers (lines 51–76), paper verdict Sticker, `resetNote` (line 193–195: "Season 2 begins — alignment reset to Neutral."), "Claim verdict" CTA that calls `mark_finale_seen`. Driven by the popup-queue slot.
- **Root wiring** — `app/_layout.tsx:201` polls `my_finale_result` on auth + foreground, sets `finale` state (line 104), mounts the modal via `usePopupSlot("finale", !!finale, 20)` (line 122) and renders it at line 594.
- **The announcement backstop** — `my_unseen_announcements()` (`20260556000000_system_announcements.sql:103`, granted to `authenticated`, `LIMIT 20`) is polled by `_layout` and surfaces unseen `system_announcements` rows in `WhileAwayModal.tsx` on next launch. This is the path that makes a durable finale note land for *untokened* players.
- **The cron** — `supabase/migrations/20260579000000_judgement_day_cron.sql` schedules `judgement-day-season-1` at `0 12 15 7 *` (noon UTC July 15). Verified live (jobid 2, active).
- **[[alignment]]** — the axis: `profiles.alignment_score` (−100..+100), driven by trades (+2/−2/+3), blessings (+1), curses (−1). Client-side label/display helpers live in `utils/alignment.ts`: `alignmentLabel(score)` → `"goblin"|"neutral"|"angel"` (thresholds ±25); `alignmentDisplay(label)` → the *player-facing word* `"Generous"|"Greedy"|"Pilgrim"`. The "your story so far" preview must compose **both** (`alignmentDisplay(alignmentLabel(score))`), not `alignmentLabel` alone.

## What's needed 🔨

The deliberately small surface:

1. **`finalize_season` announces itself (the one real new server beat).**
   New migration. **Filename must sort alphabetically *after* the latest applied migration** (currently `20260649000000_onboarding_checklist.sql`) — e.g. `20260650000000_finale_announce.sql` is safe; a duplicate prefix collides on the `schema_migrations.version` PK.
   **Carry-latest-def footgun:** `CREATE OR REPLACE FUNCTION public.finalize_season` must start from the **latest committed body** (`20260526000000_finale.sql:54`), copying the full rank loop, the `IF FOUND` reward gate, **the `profiles.counter` snout grant**, and the `alignment_score = 0, alignment_updated_at = now()` wipe **verbatim**, then add the announce step — never re-author from a stale base, or the reset/idempotency silently vanish (the build-93 referral-gate regression is the cautionary tale).
   Inside the `IF FOUND` block (so it fires once, idempotently, per granted user), add an **INLINE** announcement — do **NOT** call `send_system_announcement` (it raises `admin_only` in non-admin/cron context → silent rollback). Mirror the proven inline pattern in `20260595000000_barn_visit_mutual.sql:58`:
   ```sql
   INSERT INTO public.system_announcements (user_id, kind, title, body, data)
   VALUES (r.id, 'season_finale',
           'The season has turned',
           'Your Season 1 story is ready. Open the app to see how it went.',
           jsonb_build_object('season_key', season_key));
   ```
   Optionally also `PERFORM public.send_push_to_user(r.id, 'The season has turned', '…', jsonb_build_object('kind','season_finale'))` — signature `(uuid, text, text, jsonb)`, granted to `authenticated`, best-effort, no-ops on null token (`20260520050000_push_delivery.sql:24`). The durable row is the real guarantee — it lands in the WhileAway launch batch via `my_unseen_announcements`.
   *No new table.* Reuses `system_announcements`.
   **`LIMIT 20` caveat:** `my_unseen_announcements()` returns only the newest 20 unseen rows. For 27 beta users over weeks this is fine, but if a player has ≥20 other unseen announcements the finale note could be buried. Acceptable at beta scale; noted as known debt, not a blocker.

2. **The end-of-season constant (client, prerequisite for #3).** A single source of truth for the season end, matching the cron exactly: `2026-07-15T12:00:00Z` (`0 12 15 7 *`). Add as a typed constant (e.g. `constants/season.ts → SEASON_1_END = "2026-07-15T12:00:00Z"`). The countdown and any "your story so far" gating both read this — never recompute the date inline, or client/server drift by a day at the timezone boundary.

3. **Build-up line (client only).** A small banner/line on the home surface reading "The season turns in N days," where `N = ceil((SEASON_1_END − now) / 1d)`. Pure client date math; no schema. A tiny component + the constant from #2.

4. **"Your story so far" preview (client only, optional).** Render narrative words via `alignmentDisplay(alignmentLabel(score))` from `utils/alignment.ts` (e.g. "you've leaned Generous lately"). **Availability caveat:** `hooks/useHomeStats.ts` does **not** reliably surface `alignment_score` — the primary `home_stats` RPC omits it (hook comments, lines 13/38/82–84); it's only read on the multi-query *fallback* path (line 192) and pushed via `onAlignmentLoadedRef` (line 225). So the preview must either (a) consume that callback, or (b) add `alignment_score` to the `home_stats` RPC, or (c) do its own one-shot `profiles.alignment_score` read. If we want kindness/greed *counts*, that needs a new read-only RPC (`my_season_story()` → trades fulfilled / asks pocketed this season) — keep it `STABLE`, server-authoritative, no rewards. **LOW for label-only via the existing callback; MED if counts or an RPC change are wanted.**

5. **Recopy `JudgementDayModal`.** No new component — edit `headline()`/`subtitle()` (lines 51–76) toward personal-narrative phrasing and soften the `resetNote` (line 193). Keep the `top3` personas ("Halo Bearer"/"Goblin King") for flavor, but lead the subtitle with the personal arc, not the rank. **Copy-only** — the `FinaleResult` shape and `mark_finale_seen` call are unchanged, so no contract risk.

6. **(Optional) Reflective "my season" share card.** Lowest-priority. A simple in-app capture of the pig + a verdict-derived one-liner. No out-of-app plumbing (App Clips / deep links) — that's [[virality-and-growth-loops]] bet 5, explicitly out of scope here.

## Verification & rollout (do this, in order)

The cron is destructive and unattended; treat the push like a release, not an edit.

1. **Staging dry-run of the carry-latest edit.** On a non-prod DB (or a throwaway `season_key`), apply the new migration, then `SELECT public.finalize_season('staging_test')` against seeded test profiles. Assert: rows land in `season_finales`; titles + `counter` snouts grant; **one** `system_announcements` row per granted user; `alignment_score` reset to 0. Then re-run `finalize_season('staging_test')` and assert **no** double-grant / double-announce (the `IF FOUND` gate holds). This is the line-for-line idempotency proof the carry-latest footgun demands.
2. **Diff the rewritten body** against `finale.sql:54` before pushing — confirm the loop, `ON CONFLICT … DO NOTHING`, `IF FOUND`, `counter` grant, and the wipe are byte-identical except the added announce block.
3. **Push window.** DB push requires explicit user "go" (never autonomous). The announce migration **must be applied before noon UTC July 15** or the moment stays silent. Target: push by **July 13** to leave a 2-day buffer.
4. **Client ship.** Reveal recopy (#5) + countdown (#2/#3) ride a normal TestFlight build; land that build before July 13 too so build-up is visible and the new copy is in players' hands when the cron fires. **Partial-deploy guard:** the server announce and the client recopy are independent and both backward-compatible (old copy still renders a correct verdict; the announce row is inert until a client reads it), so shipping one without the other degrades gracefully rather than breaking.
5. **Post-fire check (July 15, ~12:05 UTC).** `SELECT count(*) FROM season_finales WHERE season_key='season_1'` (should equal named-profile count) and `SELECT count(*) FROM system_announcements WHERE kind='season_finale'` (should match). If the cron didn't fire, finalize manually: `SELECT public.finalize_season('season_1')` from the SQL console.

## Success metrics

- **Delivery (hard):** 100% of named profiles have a `season_finales` row and a `season_finale` announcement after the cron (count query above). This is the "did the moment land" gate.
- **Reach (soft):** ≥ ~80% of the ~27 beta users open a verdict (a `season_finales` row with `seen_at` set) within 72h of July 15. Below that, the durable-note backstop or the push dial needs revisiting.
- **Idempotency (hard):** a second `finalize_season('season_1')` call grants 0 (`granted: 0` in its return jsonb) and inserts 0 new announcements.
- **Quiet (qual):** no beta complaint that the finale felt "competitive" or "noisy" — the whole thesis. One pointed "this felt like a flex, not a keepsake" is a copy-failure signal.

## Decisions to make

- **Build-up: personal preview or countdown-only?** Preview = warmer but risks nudging players to "game" alignment before the wipe. Countdown-only is the safest cozy choice.
- **Kindness/greed counts, or just the alignment label?** Counts need the new `my_season_story()` read RPC; the label is nearly free (composed from existing helpers). How precious is the extra warmth vs the extra build?
- **How hard do we strip competition from the reveal copy?** Keep "Halo Bearer / Goblin King" personas, or fully neutralize rank language? Plan A leans *keep the persona, drop the ranking pressure.*
- **Ship the reflective share card now, or defer to a Season-2 pass?** It's the only piece touching virality; easy to cut for "quiet" v1.
- **Push + durable note, or durable note only?** A push is warmer but louder; cozy audiences churn on noise (one-beat rule, [[notifications]]). The durable `system_announcements` row is the floor; push is the dial.

## Effort + sequencing

Overall tier: **LOW** (the cheapest of the three plans by design — it ships the finale that's already in the box).

1. **(LOW) Announce migration** — `finalize_season` carry-latest-def + inline `system_announcements` INSERT (+ optional push). The keystone; unblocks the "moment" actually reaching players. **Gated by the staging dry-run above.**
2. **(LOW) End-of-season constant** — `SEASON_1_END = 2026-07-15T12:00:00Z`. Prerequisite for the countdown.
3. **(LOW) Build-up countdown line** — client date math + small component, reading the constant.
4. **(LOW) Reveal recopy** — `headline`/`subtitle`/`resetNote` in `JudgementDayModal.tsx`.
5. **(LOW–MED) "Your story so far" preview** — LOW for label-only *if* it consumes the `onAlignmentLoadedRef` callback; MED if it touches the `home_stats` RPC or adds `my_season_story()`.
6. **(MED, optional, last) Reflective share card.**

Steps 1–4 are the minimum viable "quiet reckoning," and all ship comfortably before July 15 for ~27 beta users. **Critical path: step 1 pushed by July 13.**

## Risks / open questions

- **The cron fires regardless.** `judgement-day-season-1` runs at noon UTC July 15 with no human in the loop. The announce migration **must be pushed before then** (target July 13) or the moment stays silent. Inspect/cancel per `20260579000000_judgement_day_cron.sql` (`SELECT * FROM cron.job`; `SELECT cron.unschedule('judgement-day-season-1')`).
- **Idempotency must survive the carry-latest edit.** If the rewritten `finalize_season` drops `ON CONFLICT … DO NOTHING`, the `IF FOUND` gate, the `counter` grant, or the wipe, a cron re-fire (scheduled yearly) could double-announce / double-grant or skip the reset — the exact carry-latest-def footgun. The staging dry-run (re-run, assert `granted: 0`) is the mitigation; diff line-for-line before pushing.
- **Wrong-helper copy bug.** The "your story so far" string must be `alignmentDisplay(alignmentLabel(score))`. `alignmentLabel` alone returns `"angel"/"goblin"/"neutral"` (engine words), not the player-facing `"Generous"/"Greedy"/"Pilgrim"`. Using the raw label leaks internal vocabulary into the cozy build-up.
- **`alignment_score` isn't reliably on the home surface.** `useHomeStats`'s primary RPC omits it; rely on the fallback callback or add it to `home_stats`. If neither, the preview silently shows "neutral/Pilgrim" for everyone.
- **Announcement burial (`LIMIT 20`).** `my_unseen_announcements` caps at 20 newest unseen rows; a player buried under ≥20 other unseen notes could miss the finale row. Fine at 27-user beta scale; known debt for public launch.
- **Server-authoritative rewards.** Any new `my_season_story()` must be read-only; do not let a client surface mint snouts or shift alignment (the visit cash-faucet lesson — every faucet needs a cap + a gate).
- **Season 2 reuses `season_1`.** The cron hardcodes `'season_1'`, so it's a no-op next July (idempotent on already-finalized users), not a real Season 2 finale. A genuine Season 2 needs its own key + job — out of scope here but a known debt.
- **Cozy-noise risk.** Even one finale push can feel loud to a 27-person beta. Lean on the durable row; treat the push as the optional dial.
- **Preview gaming.** A pre-finale personal preview could invite last-minute alignment farming — argues for countdown-only build-up.

## Connects to

- [[seasons-and-judgement-day]] — the system this plan reframes (finalize_season, season_finales, the cron).
- [[alignment]] — the −100..+100 axis the verdict reads and then wipes; source for the "your story so far" narrative (composed via `alignmentDisplay(alignmentLabel())`).
- [[achievements-and-titles]] — finale titles carry into Season 2 as quiet badges (`source='season'`).
- [[snouts-economy]] — bracket rewards (100–500 snouts → `profiles.counter`) are faucets; the new announce step mints nothing.
- [[notifications]] — the INLINE `system_announcements` pattern + `my_unseen_announcements`/WhileAway backstop that makes "the moment" land for untokened players.
- [[virality-and-growth-loops]] — the optional reflective share card is the cozy, lower-key cousin of bet 4's competitive Verdict Card.
- [[identity-model]] — the verdict + carried titles are part of how a player's pig signals who they've been.
- Sibling plans: [[judgement-day-plan-b-great-schism]] (the competitive, factional take) and [[judgement-day-plan-c-living-almanac]] (the persistent-history take). Plan A is the minimal-effort, cozy-soul-first option.
</content>
</invoke>
