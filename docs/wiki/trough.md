---
title: The Trough
aliases: [trough, item-drive, drive, item_drives, communal gift fund]
tags: [system, social, economy, snouts, tickles]
status: stable
sources:
  - doc: docs/trough-pool-spec.md
  - sql: supabase/migrations/20260582000000_item_drives.sql
  - sql: supabase/migrations/20260583000000_item_drives_resolve.sql
  - sql: supabase/migrations/20260627000000_trough_cooldown_per_drive_and_refund_fix.sql
  - sql: supabase/migrations/20260628000000_trough_reward_to_leaderboard.sql
  - code: components/TroughSection.tsx
  - code: components/ItemPreviewModal.tsx
last_compiled: 2026-06-13
---

# The Trough

A communal gift fund: a player **opens a drive** for a Shop item, their friends **donate snouts** toward its price, and once funded the **opener is granted the item** while every donor banks a claimable tickle reward. A barn-raising, not a raffle — no chance, no loss (`docs/trough-pool-spec.md`).

## How it works

- **Open.** `open_item_drive(target_item_id, seed_snouts)` requires the opener to seed **≥10%** of the item price (`min_seed := CEIL(cost * 0.10)`) and gates on a **one-drive-per-3-days** opener cooldown. The drive's `closes_at` is set to `now() + 48 hours` (`supabase/migrations/20260582000000_item_drives.sql`).
- **Donate.** `donate_to_drive(drive_id, snouts)` is **Sounder-scoped** (`are_friends` check), refuses the opener, and enforces a **per-drive 12h cooldown** — scoped to `(donor, drive)`, not global, so you can help every friend back-to-back (`supabase/migrations/20260627000000_trough_cooldown_per_drive_and_refund_fix.sql`). Donations clamp to the remaining gap, debit `profiles.counter`, and mint `reward := floor(snouts / 10.0)` — **10 snouts → 1 tickle**.
- **Fund → grant.** When `raised_snouts >= target_snouts`, the item is granted to the opener (`user_hats` upsert), the drive flips to `funded`, and donor rewards become claimable.
- **Claim.** `claim_drive_reward(donation_id)` credits the reward as a **tap-equivalent**: `+counter` (snouts) and `+tickles_earned` (the **leaderboard**) — *not* the tickle bank. This was changed because banking it minted XP, lucky rolls, and a distorted communal counter per tickle (`supabase/migrations/20260628000000_trough_reward_to_leaderboard.sql`).
- **Lazy expiry (no cron).** `resolve_expired_drives()` is **not scheduled** — read/donate paths call it. `my_drives()` "resolves expiries first so the list is fresh" (`supabase/migrations/20260583000000_item_drives_resolve.sql`). It refunds each donor the **SUM** of their chips (an earlier version refunded one arbitrary row, shorting multi-chip donors) plus the opener's seed, then marks the drive `expired`.
- **Inline-announcement footgun.** Funding/refund notices INSERT into `system_announcements` directly. Calling `send_system_announcement()` is **admin-gated** and would raise `admin_only`, silently rolling back the whole donation for non-admins (`supabase/migrations/20260627000000_...sql`, comment at the funded branch).

## Key files
- `supabase/migrations/20260582000000_item_drives.sql` — tables (`item_drives`, `item_drive_donations`) + `open_item_drive` (seed ≥10%, 3-day cooldown, 48h window).
- `supabase/migrations/20260583000000_item_drives_resolve.sql` — lazy `resolve_expired_drives`, `claim_drive_reward`, `my_drives` (Sounder read path that resolves first).
- `supabase/migrations/20260627000000_trough_cooldown_per_drive_and_refund_fix.sql` — per-drive 12h cooldown + per-donor SUM refund fix; inline-announcement comment.
- `supabase/migrations/20260628000000_trough_reward_to_leaderboard.sql` — reward pays to the leaderboard/snouts, not the tickle bank.
- `components/ItemPreviewModal.tsx` — "Open a Trough" entry; surfaces `opener_cooldown` ("one per 3 days").
- `components/TroughSection.tsx` — Shop-embedded Sounder browse + donate UI.

## Connects to
- [[snouts-economy]] — donors spend snouts; refunds and rewards credit `profiles.counter`.
- [[core-loop-and-tickle-trade]] — rewards land on `tickles_earned` (the leaderboard) as tap-equivalents, not the tickle bank.
- [[shop-cosmetics-closet]] — drives fund a Shop item; the grant upserts into `user_hats`.
- [[friends-graph]] — Sounder-scoped via `are_friends`; only the opener's friends may donate.
- [[notifications]] — funded/refund notices INSERT `system_announcements` inline (never `send_system_announcement`).
- [[architecture-seams]] — RPCs wrapped via the typed `rpc<T>` seam; lazy resolve replaces a cron.
- [[regen]] — the spec's over-cap-tickle clamp work touches the shared regen formula.

## Open questions / risks
- **Spec drift on exchange rate.** `docs/trough-pool-spec.md` records "Decided: 2:1", but shipped code is **10:1** (`floor(snouts / 10.0)`). The doc is stale; code is canonical.
- **No cron safety net.** If no read/donate path runs, an expired drive's refunds stay pending until the next `my_drives()`/`donate_to_drive` call resolves it.
- **Faucet throughput.** Per-drive cooldown widens the 10:1 reward throughput to ~2/day/drive; migration header flags revisiting with a per-day reward cap if whale-pair farming shows up.
- **Reward path divergence.** The spec describes over-cap tickle-bank rewards; the shipped reward bypasses the bank entirely (leaderboard credit), so the over-cap clamp work in the spec is not exercised by the Trough as shipped.
