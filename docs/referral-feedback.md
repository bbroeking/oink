# Referral completion feedback — Spec

Closes the gap surfaced during referral debugging: the inviter-side "+100 / your friend made it" moment has the weakest feedback of any reward in the game. A friend you invited becoming a real player is the single most rewarding *social* event TTP can produce, and today it lands as a silently-incremented number on a screen the inviter has to navigate to — plus a push notification they likely never get (push permission is only requested on the Friends tab).

Companion to `docs/referrals.md` (the flow) and `docs/referrals-debug.md` (the diagnostic playbook). This spec is purely about **surfacing a completion that already fires correctly server-side** — it does not change the engagement-gate logic.

---

## The gap (what exists today)

| Surface | Side | Strength |
|---|---|---|
| "★ you're in ★" success screen (`ReferralCodeEntry.tsx:115`) | Invitee (redeemed a code) | **Strong** — full-screen, immediate |
| Push notification (`20260566000000_referrals.sql:477`) | Inviter (completion) | **Weak** — only fires if push is enabled, and push is only requested on the Friends tab |
| Account "Refer friends" card milestone row (`Account.tsx:608`) | Inviter | **Weak** — a number that silently increments on focus; no celebration |

For comparison, every other reward event fires an in-app celebration: shop purchase (`BuyCelebration`), season tier-up (`TierUpBanner`), Lucky Pig (`LuckyPigModal`). Referral completion has nothing equivalent.

There's also no **anticipation** state: `my_referral_summary` returns `referrals_pending` (friends who redeemed but haven't completed), but the Account card never displays it.

---

## Decisions (locked)

| # | Decision |
|---|---|
| 1 | **In-app completion modal.** A `ReferralCompletedModal` mirroring `LuckyPigModal`, fires on next Barn focus after a new completion is detected. Shows the friend's name + reward. |
| 2 | **Server-side acknowledgement, not client diff.** Detection uses a new `profiles.referral_completion_ack_at` timestamp + a query against invitees' `referral_completed_at`. Survives reinstalls, shows friend names, handles multiple-while-away. (Alternative — AsyncStorage count-diff — rejected: loses names + double-fires across reinstall.) |
| 3 | **Names matter.** "Mei made it!" not "a friend made it." The completion data (invitee username) already exists server-side at gate-fire time; we surface it via the new RPCs. |
| 4 | **Milestone variant.** When the completion is the inviter's 3rd (Messenger Hat unlock), the modal celebrates the Hat, not just +100. |
| 5 | **Pending state on the Account card.** Surface the already-fetched `referrals_pending` as a "N friends on their way" line. |
| 6 | **Close the push gap.** Call `ensurePushPermission()` when the inviter engages the referral card (mount of the "Refer friends" card or first Share tap) — a referral-relevant moment where the prompt is earned. |

---

## Detection — server-side acknowledgement

The completion fires inside `update_profile_and_item_count` (the invitee's threshold-crossing tickle) and sets the invitee's `referral_completed_at`. The inviter needs to learn about it on their next session.

Lightweight model — **one new column, no new table:**

```sql
ALTER TABLE public.profiles
    ADD COLUMN referral_completion_ack_at timestamptz;
```

"Unacknowledged completions for me" = invitees pointing at me whose `referral_completed_at` is newer than my `referral_completion_ack_at`:

```sql
SELECT referred_by = me
   AND referral_completed_at > COALESCE(my ack_at, '-infinity')
```

The modal fetches these on Barn focus, shows them, then acks. Naturally handles "3 friends completed while I was on vacation" (all show in one modal), shows names (join to invitee profiles), and survives reinstalls (the marker is server-side, not in AsyncStorage).

> Alternative considered: a `referral_completions` audit table (inviter_id, invitee_id, completed_at, acknowledged_at). More robust if we ever want a permanent completion log or per-completion analytics, but heavier. The single-column approach is sufficient for the feedback use case. If an audit log becomes desirable later, the table can be added without disturbing this surface.

---

## Backend RPCs

### `unacknowledged_referral_completions()` — new

Returns the list of invitees who completed since the caller last acknowledged, newest first.

```sql
RETURNS jsonb
-- {
--   ok: true,
--   completions: [
--     { invitee_username: "mei",  completed_at: "...", milestone: false },
--     { invitee_username: "theo", completed_at: "...", milestone: true }  -- this one crossed the 3rd
--   ],
--   total_completed: 3   -- caller's referrals_completed, for milestone framing
-- }
```

- `milestone` is true for the completion that took the caller's cumulative `referrals_completed` to exactly 3 (the Messenger Hat unlock). Computed by ordering completions and finding which one crossed the boundary.
- Empty `completions` array = nothing to show.
- Auth via `auth.uid()`, SECURITY DEFINER (same pattern as `my_referral_summary`).

### `ack_referral_completions(p_seen_through timestamptz)` — new

Marks completions acknowledged up to a given timestamp.

```sql
-- UPDATE public.profiles
--    SET referral_completion_ack_at = GREATEST(
--          COALESCE(referral_completion_ack_at, '-infinity'), p_seen_through)
--  WHERE id = auth.uid();
-- Returns { ok: true }.
```

Passing `p_seen_through` (the max `completed_at` the client actually displayed) rather than `now()` avoids a race: a completion that lands between the fetch and the ack isn't silently swallowed — it'll surface next session.

### `my_referral_summary()` — no change

Already returns `referrals_pending`. The Account card just needs to render it (see UI below). No backend change.

---

## UI surfaces

### `ReferralCompletedModal` (new) — `components/ReferralCompletedModal.tsx`

Mirrors `LuckyPigModal` structure. Props: the `completions` array + `total_completed`.

- **Single completion, non-milestone:** Happy Rosie + "★ {name} made it! ★" + "Your friend joined the sounder for real. +100 snouts." + Continue.
- **Single completion, milestone (3rd):** Bigger celebration + Messenger Hat art + "{name} made it — and that's 3! You earned the Messenger Hat." + "+100 snouts AND a new hat."
- **Multiple completions:** "★ 2 friends made it! ★" + names listed ("Mei and Theo") + "+200 snouts." If one of them was the milestone, append the Hat callout.
- On dismiss: call `ack_referral_completions(maxCompletedAt)`.

Visual language matches the existing celebration modals (sticker card, confetti/sparkle, fanfare sound — reuse the season tier-up fanfare or Lucky Pig sound).

### Modal firing — Barn

Mirror `useLuckyPig`'s pattern (a hook owned by `Barn.tsx`). On Barn focus:

1. Call `unacknowledged_referral_completions()`.
2. If `completions` non-empty, open `ReferralCompletedModal`.
3. On dismiss, `ack_referral_completions(maxSeenCompletedAt)`.

Barn is the home screen, hit every session — so even an inviter with push disabled sees the celebration the next time they open the app. The push deep-link to `/account` still works; the modal can also fire there if the user lands on Account first (the check is cheap and idempotent via the ack).

Recommend a small new hook `useReferralCompletions` co-located with the other Barn hooks (`useLuckyPig`, `useHomeStats`, etc.), keeping `Barn.tsx` as the orchestrator (consistent with the Barn-orchestrator seam in `CONTEXT.md`).

### Account "Refer friends" card — pending line

In `Account.tsx`, the `ReferralMilestoneRow` (or just below it), add a line driven by the already-fetched `referral.referrals_pending`:

- `referrals_pending > 0`: "🐾 {N} friend{s} on their way" (subtle, warm — anticipation, not pressure).
- `referrals_pending === 0`: render nothing (no empty-state clutter).

This gives the inviter a reason to come back ("Mei redeemed my code — waiting for her to play a bit").

### Push permission — close the gap

Add `ensurePushPermission()` at a referral-relevant moment so inviters actually receive the completion push:

- On mount of the "Refer friends" card in `Account.tsx` (the user is clearly thinking about referrals), **or**
- On first tap of the Share button (even more intentful).

Recommend the **Share-tap** site — it's the highest-intent referral moment and avoids prompting users who merely scrolled past the card. Same coalesced, denial-safe `ensurePushPermission()` already used by Friends.

---

## Detection flow

```
Invitee crosses gate (their tickle)
        │  update_profile_and_item_count sets invitee.referral_completed_at = now()
        │  + inviter.counter += 100, inviter.referrals_completed += 1
        ▼
Inviter opens app → Barn focus
        │  useReferralCompletions calls unacknowledged_referral_completions()
        ▼
  completions non-empty?
        │ yes → ReferralCompletedModal (names + reward + milestone variant)
        │       on dismiss → ack_referral_completions(maxCompletedAt)
        │ no  → nothing
        ▼
Account card (anytime) → "N friends on their way" from referrals_pending
```

---

## Edge cases

- **Multiple completions while away** — all surface in one modal ("2 friends made it!"). The ack timestamp covers all of them.
- **Completion lands mid-session** (between fetch and ack) — the ack uses `p_seen_through = max displayed completed_at`, so a newer completion isn't swallowed; it shows next Barn focus.
- **Reinstall** — `referral_completion_ack_at` is server-side, so a reinstalled inviter won't re-see already-acknowledged completions, and won't miss ones that completed while the app was gone.
- **Push tapped → Account, then Barn** — the modal fires on whichever screen runs the check first; the ack makes the second check a no-op. No double-show.
- **Milestone boundary** — if completions 2 and 3 both land while away, the modal shows both and flags #3 as the Hat unlock. If somehow the count jumps past 3 (shouldn't happen), the milestone flag falls back to "whichever completion's cumulative index == 3"; if none, no Hat callout (the Hat grant itself is handled server-side and is idempotent).
- **Inviter with push disabled** — fully covered by the Barn-focus modal. Push is a bonus, not the only channel.
- **Invitee privacy** — the modal shows the invitee's username (already public via leaderboards / Sounder). No PII beyond what's already visible.

---

## Migration phases

### Phase 1 — Backend (silent)

- `ALTER TABLE profiles ADD COLUMN referral_completion_ack_at timestamptz`.
- `unacknowledged_referral_completions()` + `ack_referral_completions(timestamptz)` RPCs + typed wrappers in `utils/referrals.ts`.
- No UI yet. Completions accrue; nothing surfaces.

### Phase 2 — Modal + Barn hook

- `ReferralCompletedModal` component.
- `useReferralCompletions` hook wired into `Barn.tsx` (fetch on focus, show, ack on dismiss).
- Fanfare + confetti reuse.

### Phase 3 — Account card polish

- "N friends on their way" pending line from `referrals_pending`.
- `ensurePushPermission()` on the Share-tap site.

---

## Tests

- **`utils/referrals.ts` wrappers** (Jest, mocked rpc): `unacknowledgedReferralCompletions()` calls the right RPC with no params; `ackReferralCompletions(ts)` passes `p_seen_through`. Same style as the existing wrapper tests.
- **Milestone framing** (pure helper, Jest): given a completions array + a `total_completed`, the helper that decides "which completion is the milestone" flags the right one (the one whose cumulative index == 3). Boundary cases: 0 completions, the 3rd exactly, completions past 3.
- **pgTAP** (`supabase/tests/02_referral_feedback.sql`): extend the fixture pattern from `01_referrals_gate.sql` — after the gate fires, assert `unacknowledged_referral_completions()` returns the invitee; call `ack_referral_completions(now())`; assert it returns empty after. Verify a second completion after ack surfaces correctly.
- **Manual / TestFlight**: complete a referral with a test pair; confirm the modal fires on the inviter's next Barn open with the correct name + reward; confirm the milestone variant on the 3rd; confirm the "on their way" line appears after redemption (pre-completion).

---

## Heads-up

- **This spec does not touch the engagement gate.** It assumes the gate fires correctly (see `docs/referrals-debug.md` if it doesn't). This is purely a feedback/surfacing layer. If the underlying bug report turns out to be "the gate isn't firing," fix that first — this spec makes a *working* gate visible, it doesn't make a broken one work.
- **The push gap is shared with streak warnings.** Both features need push, and push is only requested on Friends today. The Share-tap `ensurePushPermission()` here helps referrals; streak Phase 3 needs its own prompt site (flagged in `docs/streak.md`). Consider a small audit of all the moments push *should* be requested and add the missing call sites together.
- **No ADR written.** The server-side-ack-vs-client-diff decision is borderline ADR-worthy (a real trade-off, somewhat hard to reverse) but smaller than the happiness/streak/habitat decisions. The rationale is captured in Decision #2 above. If you want it recorded as ADR-0004 so a future reviewer doesn't re-litigate "why not just AsyncStorage," say so and I'll write it.
- **Reuse, don't rebuild, the celebration chrome.** `LuckyPigModal` + `TierUpBanner` already define the sticker-card + confetti + fanfare visual language. The new modal should borrow their components/sounds, not introduce a new celebration style.
