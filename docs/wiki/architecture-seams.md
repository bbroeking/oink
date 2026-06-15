---
title: Architecture & Seams
aliases: [seams, architecture, rpc-layer, adapters]
tags: [infrastructure, architecture, rpc, sql, footguns]
status: stable
sources:
  - doc: CONTEXT.md
  - code: utils/rpc.ts
  - code: utils/activeEffects.ts
  - code: utils/friendships.ts
  - code: utils/iap.ts
  - code: hooks/useActiveEffects.ts
  - code: hooks/useHomeStats.ts
  - code: constants/theme.ts
last_compiled: 2026-06-13
---

# Architecture & Seams

The load-bearing boundaries that keep TTP's React Native client decoupled from Supabase, RevenueCat, and itself — plus the recurring SQL footguns that have bitten across builds. Documented in `CONTEXT.md` ("Seams") so each seam stays a single named owner instead of inlined branching.

## How it works

**RPC layer.** `utils/rpc.ts` exports one generic `rpc<T>(name, params?)` that absorbs the supabase cast + error log for ~67 call sites; errors flow to `log.error()` (Sentry) and callers get `T | null`. Action RPCs use `rpcAction<T>()`, which collapses three historical failure shapes (transport error, null data, legacy `{ok:false,error}`) into one `RpcResult<T>` — every caller branches on `r.ok` / `r.reason` (`utils/rpc.ts:38-60`). Typed wrappers grow per feature.

**Receiver-side effects layer.** `utils/activeEffects.ts` holds pure helpers (`effectMeta`, `fetchActiveEffects`, `partitionBySource`, `formatLeft`) over the `my_active_effects` RPC; `hooks/useActiveEffects.ts` is the single stateful owner (fetch, focus refresh, realtime subscription, cleanse). Receiver-side counterpart to the sender-side rituals.

**Friendships layer.** `utils/friendships.ts` owns the friendship contract — `FriendshipStatus`, `FRIEND_CAP_LIMIT` (100, mirrors the server cap), `friendActionMessage()` reason→copy, and typed wrappers over six RPCs. Moderation (block/report) stays out — different domain (`utils/friendships.ts:5-10`).

**Barn orchestrator.** `components/Barn.tsx` composes five hooks (`useHomeStats`, `useStipend`, `usePassEvents`, `useLuckyPig`, `useActiveEffects`); cross-hook coupling is explicit via callback props (`onClaimed: homeStats.refresh`). Pure roll math lives in `utils/luckyPig.ts`.

**IAP adapter pair.** `utils/iap.ts` defines an `IAP` interface with two adapters — `realIAP` (RevenueCat) and `noopIAP` — selected once at load by `iap = IAP_ENABLED ? realIAP : noopIAP` (`utils/iap.ts:281`). The kill switch lives at one seam; a `mockIAP` slots in as a third adapter with no call-site changes.

**Rarity tokens.** `constants/theme.ts` owns `RARITY_GRADIENT` + `RARITY_BG_SOLID` (one source of truth so Shop cards and `ItemPreviewModal` can't drift); `RARITY_COLORS` stays in `constants/hats.ts`.

### SQL footguns

- **Carry-latest-def.** `CREATE OR REPLACE` is whole-body replacement — rebuilding a function from a stale base silently deletes later feature blocks (build 93: the referral gate vanished until `20260644000000_restore_referral_gate.sql`). Diff against the newest definition before shipping.
- **Admin-gated announcement.** `send_system_announcement()` raises `admin_only` for non-admins → entire `SECURITY DEFINER` transaction rolls back silently. User RPCs must INLINE the `system_announcements` INSERT (bit `tickle_at_barn`, `dig_truffle`, `donate_to_drive`).
- **Migration filename ordering.** Filenames are timestamped `YYYYMMDDHHMMSS_*`; a new file must sort alphabetically *after* the latest applied one, or it collides on `schema_migrations.version` (PK).

## Key files

- `CONTEXT.md` — the canonical "Seams" list every page here derives from.
- `utils/rpc.ts` — generic `rpc<T>` + `rpcAction<T>` / `RpcResult<T>`.
- `utils/activeEffects.ts` — pure receiver-side effect helpers over `my_active_effects`.
- `hooks/useActiveEffects.ts` — stateful owner of the effects read path + cleanse.
- `utils/friendships.ts` — friendship contract + six typed RPC wrappers.
- `components/Barn.tsx` — home-screen orchestrator composing five hooks.
- `hooks/useHomeStats.ts` — stats state + `home_stats` RPC + refresh.
- `utils/iap.ts` — `IAP` interface + `realIAP` / `noopIAP` adapter pair.
- `constants/theme.ts` — `RARITY_GRADIENT` / `RARITY_BG_SOLID` rarity tokens.

## Connects to

- [[blessings-curses-effects]] — the receiver-side effects layer surfaces these via `my_active_effects`.
- [[friends-graph]] — the friendships layer is its data contract + RPC wrappers.
- [[barn-and-habitat]] — `Barn.tsx` is the orchestrator these seams feed.
- [[lucky-pig]] — a Barn sub-hook (`useLuckyPig`) whose math is the pure-helper pattern.
- [[battle-pass-and-slop-club]] — monetized via the IAP adapter pair + `useStipend`.
- [[shop-cosmetics-closet]] — consumes the rarity tokens for card + preview surfaces.
- [[referral-program]] — the carry-latest-def footgun deleted its server gate.
- [[notifications]] — the admin-gated footgun targets the `system_announcements` write path.

## Open questions / risks

- The SQL footguns recur across rewrites (admin-gated re-broke `dig_truffle` twice); they're convention, not enforced — no lint/CI guard exists.
- `mockIAP` is described but not yet built; IAP is currently kill-switched (`IAP_ENABLED = false`).
- `rpcAction`'s shape-collapsing is client-side only; servers still emitting legacy `.error` keep working but are untracked.
