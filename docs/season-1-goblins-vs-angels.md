# Season 1: Goblins vs Angels — Engineering Plan

Companion to `season-1-goblins-vs-angels.html` (the visual / pitch doc). This file is the build reference: weekly scope, concrete file paths, dependencies, and the full todo list.

---

## 0. Foundations (Phase 0, ship before Week 1)

These prerequisites are *not* part of the 8-week player-facing schedule — they unblock everything else.

### 0.1 Alignment system migration

Files:
- `supabase/migrations/20260521000000_alignment.sql` *(new)*
- Adds `alignment_score int NOT NULL DEFAULT 0` to `public.profiles`
- Adds `alignment_updated_at timestamptz` for inactivity-decay calculations
- Creates `public.alignment_label(score int) → text` SQL function returning `'goblin' | 'neutral' | 'angel'` with the ±34 hysteresis thresholds
- Creates `public.shift_alignment(target_user_id uuid, delta int) → void` SECURITY DEFINER RPC
- Adds a trigger on `tickle_trades` `fulfilled`: +2 to the giver (`target_id`, gave from their bank), −2 to the asker (`requester_id`, pocketed 2N for free). No repay step — asking-and-pocketing-double is the Goblin path.

### 0.2 Helper for client-side label derivation

Files:
- `utils/alignment.ts` *(new)*
- `alignmentLabel(score: number): 'goblin' | 'neutral' | 'angel'` mirrors the SQL with hysteresis logic.
- `alignmentEmblem(label): string` returns emoji or glyph for inline display.
- `alignmentBackground(label): string` returns a theme color name.

### 0.3 Test scaffolding (bootstrap)

Files:
- `__tests__/alignment.test.ts` *(new)*
- Covers `alignmentLabel` thresholds + hysteresis edge cases.
- Establishes the jest test pattern other tests will follow.
- Update `package.json`'s `test` script if needed; ensure `bun test` or `jest` runs locally.

---

## 1. Week-by-week

### Week 1 — "The schism"

**Goal:** alignment system is live; first players cross ±25 and see the reveal.

Files:
- `components/AlignmentSchismModal.tsx` *(new)* — one-time fullscreen reveal when score first crosses ±25. Big animated pig avatar, "you are becoming…" headline, badge, dismiss.
- `app/_layout.tsx` — poll `profiles.alignment_score` on focus, surface modal if first-cross.
- `supabase/migrations/20260521010000_schism_seen.sql` — `profiles.schism_seen_label text` to track which milestone was last revealed.

Tests:
- `__tests__/AlignmentSchismModal.test.tsx` — renders given props; fires `onDismiss` on tap.

### Week 2 — "Visibility everywhere"

**Goal:** alignment badge appears wherever identity does.

Files:
- `components/ui/AlignmentBadge.tsx` *(new)* — small chip: `<icon> <label>` with proper color theme.
- `app/(tabs)/leaderboard.tsx` — add badge to `ClippingRow` + `ChampionPoster`.
- `components/UserSheet.tsx` — replace generic "Given/Received" stats with a big alignment dial (visual representation of the score).
- `components/Friends.tsx` — badge next to each friend row.
- `components/TickleTradeModal.tsx` — show badge next to requester/target in each pending trade.

Tests:
- `__tests__/AlignmentBadge.test.tsx` — renders correct emblem + label for each state.

### Week 3 — "Blessings unlock"

**Goal:** daily blessing ritual + push reminders.

Files:
- `supabase/migrations/20260522000000_blessings.sql` — `blessings` table (sender, receiver, kind, sent_at), unique index on (sender, receiver, date), `send_blessing(target_user_id, kind)` RPC, `daily_blessing_kind()` SQL function returning today's rotation.
- `components/BlessingPicker.tsx` *(new)* — UI in UserSheet (and Friends row) when action button = "Bless."
- `components/Barn.tsx` — surface "you have 3 blessings to cast today" indicator.
- `utils/pushNotifications.ts` — schedule local 9am reminder if user has uncast blessings.

Tests:
- `__tests__/blessings.test.ts` — `daily_blessing_kind` rotation logic in JS.
- `__tests__/BlessingPicker.test.tsx` — picker shows today's kind, fires action on tap.

### Week 4 — "Curses unlock"

**Goal:** daily curse + cleanse system, with the anti-grief cap.

Files:
- `supabase/migrations/20260523000000_curses.sql` — symmetric to blessings: `curses` table, `send_curse(target_user_id, kind)`, `daily_curse_kind()`. Adds `curse_dampener_view` for the daily cap (sum of incoming today, return 0 if cap hit).
- `components/CursePicker.tsx` *(new)*
- `components/CleanseModal.tsx` *(new)* — explains current curses, lets user spend 5 snouts to remove.

Tests:
- `__tests__/curses.test.ts` — anti-grief cap math (incoming curses past cap should be no-op effects, still recorded).
- `__tests__/CursePicker.test.tsx`, `__tests__/CleanseModal.test.tsx`

### Week 5 — "Sanctuary / Lair theming"

**Goal:** visual barn overlay based on alignment (polish week).

Files:
- `components/Barn.tsx` — conditional `<BarnOverlay alignment={...} />` mount.
- `components/ui/BarnOverlay.tsx` *(new)* — three variants (saintly clouds, neutral nothing, goblin gold piles), animated subtly.
- `assets/images/barn-overlays/*.png` *(new)* — generated via icon-gen pipeline.

Tests:
- `__tests__/BarnOverlay.test.tsx` — renders correct variant given alignment label.

### Week 6 — "Weekly bounty board"

**Goal:** rotating weekly quests on the season tab.

Files:
- `supabase/migrations/20260524000000_bounties.sql` — `weekly_bounties` table seeded with rotating sets (different bounties per ISO week). `claim_bounty(bounty_id)` RPC.
- `app/(tabs)/season.tsx` — render bounty board section, fetch via `my_weekly_bounties()` RPC.
- `components/BountyCard.tsx` *(new)* — single bounty row with progress + claim CTA.

Tests:
- `__tests__/bounties.test.ts` — week-key computation + bounty rotation.
- `__tests__/BountyCard.test.tsx`

### Week 7 — "Mid-season ranking"

**Goal:** alignment leaderboard with top 20 each side highlighted.

Files:
- `app/(tabs)/leaderboard.tsx` — add a third Scope toggle: `"alignment"`. Order by `alignment_score` (most generous → most greedy with a divider in the middle). Highlight top 3 / top 10.
- `supabase/migrations/20260525000000_alignment_leaderboard_view.sql` — view exposing `alignment_score`, rank-within-faction, etc.

Tests:
- `__tests__/leaderboard.test.tsx` — alignment scope renders correct ordering + highlights.

### Week 8 — "Judgement Day"

**Goal:** finale screen, top-3 exclusive issuance, reset for S2.

Files:
- `supabase/migrations/20260526000000_finale.sql` — `season_finales` table, `finalize_season(season_id)` admin/cron RPC that grants exclusive titles + items + snouts to top-3/top-10/all-participants, then resets every user's alignment to 0.
- `components/JudgementDayModal.tsx` *(new)* — big reveal modal: your final rank, your reward, your faction's top 3.
- Two new cosmetic items: `seraph_wings` and `cursed_crown` (need icon-gen).
- Four new titles: "Halo Bearer 2026", "Goblin King 2026", silver variants, "Schism Survivor", "Calm in the Storm".

Tests:
- `__tests__/finale.test.ts` — `finalize_season` correctly orders + awards.
- `__tests__/JudgementDayModal.test.tsx`

---

## 2. Full todo list (the build order)

> Phase 0 is happening THIS session. Subsequent phases are their own session.

### Phase 0 (this session)
- [ ] Migration: `20260521000000_alignment.sql` (column + functions + triggers)
- [ ] `utils/alignment.ts` (client-side label derivation)
- [ ] `__tests__/alignment.test.ts` (bootstrap test pattern)
- [ ] Wire alignment badge into existing UserSheet
- [ ] Commit + document

### Phase 1 (Week 1-2 features)
- [ ] AlignmentSchismModal component + first-cross detection
- [ ] AlignmentBadge component (chip)
- [ ] Wire badge into ChampionPoster, ClippingRow, Friends row, TickleTradeModal
- [ ] Replace UserSheet stats with alignment dial visual
- [ ] Tests for each

### Phase 2 (Week 3-4 features)
- [ ] Blessings migration + RPC
- [ ] BlessingPicker component
- [ ] Push notification scheduling for daily reminder
- [ ] Curses migration + RPC + anti-grief cap
- [ ] CursePicker component
- [ ] CleanseModal component
- [ ] Tests for each

### Phase 3 (Week 5-6 features)
- [ ] BarnOverlay component + assets
- [ ] Weekly bounties migration + RPC
- [ ] BountyCard component
- [ ] Bounty rotation logic + tests

### Phase 4 (Week 7-8 features)
- [ ] Alignment leaderboard scope
- [ ] JudgementDayModal
- [ ] Finale RPC (grants + reset)
- [ ] seraph_wings, cursed_crown icon gen
- [ ] Finale titles seeded

### Phase 5 (ship + monitor)
- [ ] Build 62 with Phase 0+1 included
- [ ] TestFlight rollout
- [ ] Monitor alignment-shift edge cases in prod
- [ ] Schedule Week 2 build for visibility rollout

---

## 3. Open questions still TBD

1. **Blessing/curse rate limit:** once per friend per day, capped at 3 total casts per day? (Recommend yes.)
2. **New-user starting alignment:** 0 or +5 nudge? (Recommend +5.)
3. **Inactivity decay:** -1/day after 7 days inactive? (Recommend yes.)
4. **Should the Lucky Pig fairy/imp variant respect current alignment?** (Recommend yes — Angel-aligned sees fairy, Goblin-aligned sees imp.)
5. **Is Season 1 launch gated on the saintly/goblin icons being generated, or can we ship Phase 0+1 with placeholder emoji and add art in Phase 2?** (Recommend ship with emoji placeholders; icons land in Phase 3.)
