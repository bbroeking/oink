# Sounder: invite any player (leaderboard recruiting + poaching)

**Status:** proposal, pending founder approval (Brian).
**Author:** Cash. **Date:** 2026-07-30.
**Code:** branch `feat/sounder-invite-any-player` — migration
`20260741000000_sounder_invite_any_player.sql` + client. No `db:push` run (gated
on your go). Separate from PR #52 (dig schedule).

---

## TL;DR

Today a leader can only invite **friends who aren't already in a Sounder**
(`invite_to_crew`: `are_friends` gate + `invitee_in_crew` refusal). This opens
recruiting up:

1. **Leaders can invite any player**, not just friends. (Members still invite
   their own friends only — reaching strangers is a *leader* power.)
2. **Poaching** — you can invite a player who's **already in another Sounder**.
   The invite is a **request**: the invitee **accepts & switches** (leaves their
   current Sounder, joins yours) or **declines & stays**. Nothing happens without
   their consent.
3. **Discovery** — a new leader-gated read `sounder_invite_candidates`: default
   is the **top diggers** (leaderboard by tickles), plus a **username search**.

## Guardrails (the ask is unsolicited now)

- **Block-aware** — never invite across a block, either direction, even as leader.
- **24h decline cooldown** — a player who declined *this* Sounder can't be
  re-pestered by it for 24h. (Needed a new `crew_invites.updated_at`, stamped by
  a `BEFORE UPDATE` trigger — added in the migration.)
- **No new rate limit needed** — the existing combined seat cap (members +
  pending-out ≤ 4) already caps a Sounder at **≤ 3 outstanding asks** at once.

## The switch (poaching mechanics)

When an invitee **accepts** from another Sounder, `accept_crew_invite` reuses
`leave_crew`'s exact rules to depart the old one **first**, then joins yours:

- New-Sounder capacity is checked **before** any departure, so a failed switch
  never leaves the invitee crewless.
- Leaving the old Sounder: if they were its **last member**, it **disbands**; if
  they **led** it and others remain, leadership **auto-promotes** to the oldest
  remaining member (identical to leaving normally today).
- The old Sounder's leader gets a quiet "a snout answered another banner" note.

**Consequence to weigh:** a leader who accepts a poach silently hands off (or
disbands) their old Sounder — consistent with how `leave_crew` already works, but
worth a conscious nod. If you'd rather *block* poaching a leader-with-members
(force an explicit hand-off first), that's a one-line refusal to add.

## What's in the PR

- **`supabase/migrations/20260741000000_sounder_invite_any_player.sql`** (sorts
  after `20260739300000_friend_favorites`):
  - `crew_invites.updated_at` + touch trigger (for the cooldown).
  - `invite_to_crew` — carried verbatim from `20260738000000`; deltas: leader may
    invite non-friends; `are_blocked` refusal; 24h `recently_declined` refusal;
    **removed** the `invitee_in_crew` refusal (poaching allowed).
  - `accept_crew_invite` — carried verbatim; deltas: **removed** `already_in_crew`
    refusal; capacity-check-first; leave-old-Sounder-then-join switch.
  - `sounder_invite_candidates(p_search, p_limit)` — leader-gated; top-by-tickles
    or username prefix; annotates `in_crew` / `crew_name` (poach) + `already_invited`;
    excludes self, blocked, and `hide_from_leaderboard` players.
- **`utils/crews.ts`** — `InviteCandidate` type + `fetchInviteCandidates`.
- **`components/PlayerInvitePicker.tsx`** — the leader recruiting sheet (search +
  leaderboard list; poach / free / pending / full row states). Reuses `useCrew`'s
  `invite` / `cancel` — accept & decline already exist on the invitee's side.
- **`components/SounderCard.tsx`** — a leader-only "Recruit any snout" CTA beside
  the existing friends invite; renders the new picker.

## Verification

- `tsc --noEmit`: clean for all touched files.
- `jest`: **612/612 green**.
- Not run: `db:push` (awaiting your go), on-device pass, build.

## Rollout

1. Approve the direction (esp. the leader-poach consequence above).
2. `db:push` `20260741000000`.
3. Client ships in the next build.

_Note: `invite_to_crew` gains new refusal reasons (`blocked`, `recently_declined`)
— the existing FriendInvitePicker maps unknown reasons to a generic line, so it's
unaffected; the new PlayerInvitePicker maps them explicitly._
