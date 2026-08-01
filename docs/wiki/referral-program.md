---
title: Referral Program (the Drove)
aliases: [referrals, sounder, drove, invite, downline]
tags: [system, social, growth, onboarding]
status: ready
sources:
  - code: utils/referrals.ts
  - code: constants/featureFlags.ts
  - code: components/ReferralCodeEntry.tsx
  - code: app/sounder.tsx
  - sql: supabase/migrations/20260520020000_sounder.sql
  - sql: supabase/migrations/20260530000000_referral_cap.sql
  - sql: supabase/migrations/20260566000000_referrals.sql
  - sql: supabase/migrations/20260644000000_restore_referral_gate.sql
  - sql: supabase/migrations/20260783000000_consolidate_referrals.sql
  - doc: docs/referrals.md
  - doc: docs/referral-onboarding-flow.md
---

# Referral Program (the Drove)

Invite friends, give each newcomer an immediate welcome reward, and earn
tickles plus milestone rewards when they become active. Referral surfaces are
live behind `SOUNDER_VISIBLE = true`. Migration `20260783000000` makes the
code-based flow the only active writer when it is applied.

## How it works

Each user has a persistent share code such as `ROSIE-K3T9`. It is shareable
through the app's Universal Link. `redeem_referral_code` is available only
during the signup window and gives the invitee 50 snouts immediately. When the
invitee reaches 100 lifetime tickles, `complete_referral_if_eligible` gives the
inviter 100 spendable tickles, increments `referrals_completed`, and evaluates
the 3/5/10/25/100/500/1000 reward ladder.

The original username-attribution RPC, its 50-tickle trigger, and its reward
writer are retired by `20260783000000_consolidate_referrals.sql`. After that
migration is applied, historical `referral_milestones` rows remain available
for audit while `my_sounder()` and `sounder_leaderboard()` read the canonical
completion counter.

The gate lives inside `update_profile_and_item_count` (the tickle-increment RPC) and was **silently dropped in build 93** when that function was rebuilt from a pre-referral base — restored as a guarded block in `20260644000000_restore_referral_gate.sql`, which also adds inline announcements (never `send_system_announcement`) so the inviter sees feedback at next launch.

## Key files

- `utils/referrals.ts` — code format, URL/clipboard parsers, error-copy map, typed wrappers for `redeem_referral_code` / `my_referral_summary`.
- `constants/featureFlags.ts` — `SOUNDER_VISIBLE` (hides downline UI; RPCs stay live).
- `components/ReferralCodeEntry.tsx` — onboarding code-entry step with AsyncStorage/clipboard pre-fill.
- `app/sounder.tsx` — the Sounder leaderboard screen (behind `SOUNDER_VISIBLE`).
- `supabase/migrations/20260520020000_sounder.sql` — Sounder economy, milestone titles, leaderboard RPCs.
- `supabase/migrations/20260530000000_referral_cap.sql` — caps referrer signup payout at 100 lifetime.
- `supabase/migrations/20260566000000_referrals.sql` — code-based flow (columns, `redeem_referral_code`, gate).
- `supabase/migrations/20260644000000_restore_referral_gate.sql` — restores the dropped gate + adds inline inviter announcements.
- `supabase/migrations/20260783000000_consolidate_referrals.sql` — retires the legacy writer and points recruiter views at canonical completions.
- `docs/referrals.md`, `docs/referral-onboarding-flow.md` — the locked spec + the three onboarding entry paths.

## Connects to

- [[snouts-economy]] — every reward (+50/+100, +100/+500) is a snout payout.
- [[achievements-and-titles]] — sounder milestones grant pre-titles (`drove_captain`, `crown_hog`).
- [[shop-cosmetics-closet]] — the 3-referral milestone grants the Messenger Hat cosmetic.
- [[friends-graph]] — `utils/referrals.ts` mirrors the `utils/friendships.ts` wrapper shape; referrals seed the social graph.
- [[notifications]] — the completion path pushes + inline-announces "your friend made it! +100".
- [[sounder-mud-fights]] — the word "Sounder" was reclaimed for war crews, forcing the downline rename to "Drove".
- [[identity-model]] — the proposed downline → "Drove" rename to resolve the naming knot lives here.
- [[architecture-seams]] — `app/_layout.tsx` deep-link handler is the Universal Link seam.

## Open questions / risks

- **Naming knot:** player-facing "Sounder" now means war crews ([[sounder-mud-fights]]); the referral downline is proposed to become "the Drove" but titles still read `sounder_*` / `crown_hog` and `app/sounder.tsx` still says "Sounder". See [[identity-model]].
- The gate was silently lost once (build 93) because the tickle RPC was rebuilt from a stale base — a recurring carry-latest-def footgun; any future rewrite of `update_profile_and_item_count` risks dropping it again.
- Referral completion grants the inviter spendable tickles through `grant_tickles`;
  it does not increase `profiles.tickles_earned` or seasonal leaderboard score.
