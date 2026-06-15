---
title: Referral Program (the Drove)
aliases: [referrals, sounder, drove, invite, downline]
tags: [system, social, growth, onboarding]
status: draft
sources:
  - code: utils/referrals.ts
  - code: constants/featureFlags.ts
  - code: components/ReferralCodeEntry.tsx
  - code: app/sounder.tsx
  - sql: supabase/migrations/20260520020000_sounder.sql
  - sql: supabase/migrations/20260530000000_referral_cap.sql
  - sql: supabase/migrations/20260566000000_referrals.sql
  - sql: supabase/migrations/20260644000000_restore_referral_gate.sql
  - doc: docs/referrals.md
  - doc: docs/referral-onboarding-flow.md
---

# Referral Program (the Drove)

Invite friends, both sides earn snouts, and recruiting unlocks milestone titles. **Two referral systems coexist in the repo** on the shared `profiles.referred_by` column; both are currently backend-only — `SOUNDER_VISIBLE = false` hides every UI surface (`constants/featureFlags.ts`).

## How it works

There are two overlapping implementations, distinguished by who they pay and how:

**Sounder (older, username-attribution).** A new account opens an invite link and calls `attribute_referral(username, discriminator)` which sets `referred_by` and pays a `signup` milestone — originally +100 to both sides, later **capped: a referrer earns 100 snouts from referrals lifetime, total** (`20260530000000_referral_cap.sql`). When a referee crosses `tickles_earned >= 50`, a trigger fires `check_referral_milestones` (the `engaged` milestone, +500 both sides) and grants the referrer whatever sounder **title** their new engaged-count just crossed: `sounder_initiate` (1), `sounder_scout` (3), `ambassador` (5), `drove_captain` (10), `sounder_sovereign` (25), `crown_hog` (50) (`20260520020000_sounder.sql`). `my_sounder()` / `sounder_leaderboard()` feed the `/sounder` screen, gated behind `SOUNDER_VISIBLE` (`app/sounder.tsx`).

**Code-based revival (newer, the spec'd flow).** Each user has a persistent share code `ROSIE-K3T9` (5-char letters prefix, X-padded; 4 random alphanumeric; `REFERRAL_CODE_PATTERN` in `utils/referrals.ts`). Shareable via `https://ticklethepig.com/r/<code>` (Universal Link → deep-link handler in `app/_layout.tsx`; uninstalled friends hit a landing page). `redeem_referral_code` runs only at signup (account < window, low tickles) and pays the **invitee +50 immediately**; the **inviter gets +100 only after an engagement gate** — invitee reaches 100 lifetime tickles AND 3 distinct active days — at which point `referrals_completed` increments and the **Messenger Hat** is granted at 3 (`docs/referrals.md`). `ReferralCodeEntry.tsx` is the onboarding step; `my_referral_summary()` hydrates the Account card.

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

- **status: draft** — two parallel systems (`sounder` vs code-based `referrals`) overlap on one column with different economies (+100/+500 vs +50/+100), eligibility windows, and surfaces. Unclear which is canonical; the spec docs describe the code-based flow but `attribute_referral` + titles are the Sounder system. Needs reconciliation or an ADR.
- **Naming knot:** player-facing "Sounder" now means war crews ([[sounder-mud-fights]]); the referral downline is proposed to become "the Drove" but titles still read `sounder_*` / `crown_hog` and `app/sounder.tsx` still says "Sounder". See [[identity-model]].
- **BLOCKED on public App Store launch** — `SOUNDER_VISIBLE` stays `false`; the whole feature is dark-launched backend-only until launch.
- The gate was silently lost once (build 93) because the tickle RPC was rebuilt from a stale base — a recurring carry-latest-def footgun; any future rewrite of `update_profile_and_item_count` risks dropping it again.
- **All referral rewards pay `counter` (snouts), never `tickles_earned` (leaderboard)** — signup +100/+100, engaged +500/+500, code redeem +50, completion +100. `tickles_earned` is only the *gate* (engaged at ≥50, completion at ≥100), not a payout destination — so referral does **not** inflate the leaderboard (there is no 250 referral payout; 250 is the Slop Club stipend). As of `20260648`, [[barn-visiting]] credits the visitor's `tickles_earned`, so visiting can now advance a referee toward the engaged gate (friends-only + 20/day-capped) — see [[../outputs/lint/2026-06-14-visit-cash-payout-review]].
