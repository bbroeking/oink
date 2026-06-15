---
title: Friends Graph
aliases: [friends, sounder, friendships, friend cap]
tags: [social, system, friendships]
status: stable
sources:
  - code: utils/friendships.ts
  - sql: supabase/migrations/20260501200000_friendships.sql
  - sql: supabase/migrations/20260520000000_discriminator.sql
  - sql: supabase/migrations/20260541000000_friend_cap.sql
  - doc: CONTEXT.md
last_compiled: 2026-06-13
---

# Friends Graph

The mutual-consent social graph of who a player can bless, curse, trade with, and visit. Each edge is a friendship with a `FriendshipStatus`, capped at 100 accepted friends per player. (CONTEXT.md still calls this "Sounder"; that word is being reclaimed for the war crew — see [[identity-model]] and [[sounder-mud-fights]].)

## How it works

A friendship is a directed request that becomes an undirected edge on accept. `utils/friendships.ts` is the single owner of the contract — no other module reaches into friendship state (`utils/friendships.ts:1-10`).

**Status.** `FriendshipStatus` is one of `self | none | pending_outgoing | pending_incoming | friends` (`utils/friendships.ts:19-24`). It rides along on profile fetches (e.g. `public_user_stats`) rather than from a dedicated RPC.

**The six RPCs**, each a typed pass-through to `rpc<T>()` (`utils/friendships.ts:82-119`): `getFriendIds` (`friend_ids` → `string[]`), `sendFriendRequest` (by `username` + optional `discriminator`), `acceptFriendRequest` (by `other_user_id`), `cancelFriendRequest`, `getSuggestedUsers`, `searchUsers` (prefix search). Block/report are deliberately excluded — moderation is a different domain (`utils/friendships.ts:1-10`).

**The cap.** `FRIEND_CAP_LIMIT = 100` (`utils/friendships.ts:17`), enforced server-side: `send_friend_request` gates only the *caller's* accepted count, while `accept_friend_request` gates *both* sides — that's the moment the edge would push either over (`supabase/migrations/20260541000000_friend_cap.sql:10-21`). Failure returns `{ ok, reason, cap }`; `friendActionMessage()` maps reasons (`at_cap`, `target_at_cap`, `already_friends`, `pending`, `self`, `no_pending_request`, `no_such_user`) to UI copy (`utils/friendships.ts:55-80`).

**Discriminator handles.** Usernames aren't unique; each profile gets a random 4-digit code, so identity is `username#1234` (`supabase/migrations/20260520000000_discriminator.sql:1-12`). The UNIQUE constraint is composite `(username, discriminator)`; a trigger auto-assigns on signup and re-rolls on rename only if it would collide. The `#` is hidden day-to-day and surfaces only where ambiguity matters — search, the Account "your code" card, request targeting.

## Key files

- `utils/friendships.ts` — the friendship contract: status type, cap, reason→copy map, six RPC wrappers.
- `utils/rpc.ts` — generic `rpc<T>(name, params?)` every wrapper delegates to (see [[architecture-seams]]).
- `supabase/migrations/20260501200000_friendships.sql` — friendships table + request/accept/cancel RPCs.
- `supabase/migrations/20260520000000_discriminator.sql` — `username#1234` discriminator column, trigger, generator.
- `supabase/migrations/20260541000000_friend_cap.sql` — server-side 100-cap enforcement + `accepted_friend_count`.
- `components/Friends.tsx`, `components/UserSheet.tsx`, `components/Leaderboard.tsx`, `components/Inbox.tsx` — render surfaces that consume the layer.

## Connects to

- [[core-loop-and-tickle-trade]] — friends are the eligible counterparties for tickle-trades.
- [[blessings-curses-effects]] — you bless/curse players in your graph; the cap keeps cooldowns meaningful.
- [[barn-visiting]] — visiting a friend's pig is gated on the friendship edge.
- [[identity-model]] — discriminator handles (`username#1234`) are the player's stable identity here.
- [[sounder-mud-fights]] — "Sounder" is being reclaimed from this graph for the war crew.
- [[notifications]] — incoming requests + accepts fire push (`supabase/migrations/20260551000000_friendship_push.sql`).
- [[referral-program]] — the Account "your code" card shares the same handle used to add friends.

## Open questions / risks

- A pending request against a full inbox is a silent no-op until the target frees a slot (`...friend_cap.sql:13-14`) — no UI signal that the recipient is at cap on the sender's side beyond the `target_at_cap` accept-time rejection.
- `getFriendIds` returns ids with no documented ordering; list hydration order is the consumer's concern (Friends.tsx join).
- Discriminator generator caps at 256 attempts and raises if a username is taken 10k+ times (`...discriminator.sql:33-36`) — theoretical, but unhandled client-side.
