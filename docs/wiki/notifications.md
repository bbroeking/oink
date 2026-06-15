---
title: Push Notifications
aliases: [notifications, push, system-announcements, while-away]
tags: [infrastructure, push, supabase, expo]
status: stable
sources:
  - code: utils/pushNotifications.ts
  - code: app/_layout.tsx
  - code: components/WhileAwayModal.tsx
  - sql: supabase/migrations/20260520040000_push_tokens.sql
  - sql: supabase/migrations/20260520050000_push_delivery.sql
  - sql: supabase/migrations/20260556000000_system_announcements.sql
last_compiled: 2026-06-13
---

# Push Notifications

How TTP reaches players outside the app: best-effort Expo/APNs pushes fired from Postgres via `pg_net`, backed by a persistent `system_announcements` table that guarantees important messages land even for players who never granted push permission.

## How it works

**Token registration.** The client never prompts on launch. `ensurePushPermission()` (`utils/pushNotifications.ts:34`) runs the first time a player touches a social surface, requests permission only when status is `undetermined`, fetches an `ExponentPushToken[...]`, and persists it via the `set_push_token` RPC (`supabase/migrations/20260520040000_push_tokens.sql`), which writes `profiles.expo_push_token` and `push_permission_granted`. The token is cached in AsyncStorage for a fast no-op return; denial persists `token=null`.

**Delivery (pg_net pipeline).** `send_push_to_user(uid, title, body, data)` reads the target's token and fire-and-forgets a POST to `https://exp.host/--/api/v2/push/send` via `extensions.http_post` (`supabase/migrations/20260520050000_push_delivery.sql:47`); Expo forwards to APNs. No-ops silently if the token is null. Triggers (e.g. `tickle_trades_push_notify`) call it on state changes; responses land in `net._http_response` for debugging.

**Persistent backstop.** Pushes are best-effort — an untokened player gets *nothing* from a push. `system_announcements` (`supabase/migrations/20260556000000_system_announcements.sql`) gives every system message a durable, RLS-scoped row. `send_system_announcement` inserts the row AND fires the push (swallowing push failure). On launch, `app/_layout.tsx:307` calls `my_unseen_announcements`, merges rows into the WhileAway batch (`source: "system"`), and `mark_announcement_seen` fires per-row on dismiss (`app/_layout.tsx:615`). Unlike rituals/trades, system rows use server-side `seen_at` tracking, so a fresh install still gets every unread one.

**Admin gate footgun.** `send_system_announcement` raises `admin_only` unless the caller's `profiles.is_test` is true (`...system_announcements.sql:74`). Any *player*-facing RPC that wants to announce must INLINE its own `system_announcements` INSERT — calling `send_system_announcement` from a non-admin path raises and silently rolls back.

## Key files

- `utils/pushNotifications.ts` — client permission flow + token register/cache/clear.
- `app/_layout.tsx` — launch-time poll of `my_unseen_announcements`; merges into WhileAway; marks seen on dismiss.
- `components/WhileAwayModal.tsx` — single launch modal rendering system rows as cream "from the barn" cards alongside rituals/trades.
- `supabase/migrations/20260520040000_push_tokens.sql` — `expo_push_token` column + `set_push_token`.
- `supabase/migrations/20260520050000_push_delivery.sql` — `send_push_to_user` (pg_net), trade trigger, `dev_send_push`.
- `supabase/migrations/20260556000000_system_announcements.sql` — table + `send_system_announcement` / `my_unseen_announcements` / `mark_announcement_seen`.

## Connects to

- [[core-loop-and-tickle-trade]] — trade INSERT/UPDATE triggers fire the "asked"/"answered" pushes.
- [[blessings-curses-effects]] — received rituals share the WhileAway launch modal with system announcements.
- [[friends-graph]] — friend-request acceptance and the social surfaces that trigger token registration.
- [[achievements-and-titles]] — achievement unlocks have a dedicated push path (decline_and_achievement_push).
- [[architecture-seams]] — Postgres-triggered side effects via pg_net is a cross-cutting backend seam.

## Open questions / risks

- **On-device token registration unverified.** The end-to-end flow (real APNs token → `set_push_token` → delivered push) has not been confirmed on a physical device in this pass; sim warns "Failed to get push token". Treat real delivery as unproven.
- **Admin-gate footgun is easy to retrip.** Future player RPCs that "send a note from the barn" will silently roll back if they call `send_system_announcement` instead of inlining the INSERT (see MEMORY: admin-gated announcement footgun).
- **No retry / dead-letter.** Push is pure fire-and-forget; failures only live in `net._http_response`. The announcement row is the sole durable guarantee.
- `dev_send_push` lets any authenticated user push any user; flagged in-source as worth gating behind a feature flag before wider release.
