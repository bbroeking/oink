# Barn social completeness audit

Scope: the visiting and social side of the Barn as implemented on 2026-09-10. Decorating and the furnishing economy are covered separately. This audit distinguishes verified foundations, functional gaps, optional additions, and device-only acceptance work.

## What is already implemented

The Barn already has a coherent visit loop; the missing work is not a new guestbook or another parallel visit system.

- Both real entry points route an explicit user id into the visit: the Friends row uses `visiting.id` (`components/Friends.tsx:314-319`) and the profile sheet uses its current `targetUserId` (`components/UserSheet.tsx:824-829`). Both key the visit component by that id.
- `BarnVisitModal` treats a visit as an owner-scoped session and remounts all local state and callbacks when `targetUserId` changes (`components/BarnVisitModal.tsx:187-199`). Host profile, outfit, pig, truffle, visit status, tickle, stamp, kindness-card, dig, parting-note, and porch-stop calls all use that same target id (`components/BarnVisitModal.tsx:382-502`, `components/BarnVisitModal.tsx:527-783`).
- The saved room read is bound to the host. `fetchFriendHabitat` sends `p_owner` and rejects a response whose snapshot owner differs (`utils/habitat.ts:337-345`). `HabitatFriendRoom` independently checks `result.ownerId === ownerId`, clears authorization while refreshing, ignores superseded requests, clears on background/auth transitions, and will not render a snapshot for a previous owner (`components/habitat/HabitatFriendRoom.tsx:33-87`).
- The visit renders the current host pig and the current visitor pig with their respective equipped cosmetics. Both pigs share the same server-backed tickle action while labels and roles remain distinct (`components/BarnVisitModal.tsx:382-442`, `components/BarnVisitModal.tsx:1025-1037`).
- A successful tickle unlocks the optional guestbook stamp, records a porch stop once per visit session, updates the shared-heart presentation, and observes the server's visit limits (`components/BarnVisitModal.tsx:527-595`, `components/BarnVisitModal.tsx:983-1005`).
- Guestbook stamps are already permanent, one per eligible visit, and shown to the Barn owner. The owner surface supports dismissal until a new signature arrives, preserves a total beyond the displayed page, and renders attached kindness cards (`components/BarnGuestbook.tsx:90-137`, `components/BarnGuestbook.tsx:145-283`; `supabase/migrations/20260787000000_barn_guestbook_stamps.sql:8-153`).
- Kindness cards already extend a successful stamp with an eligible daily blessing; they are offered and sent inside the existing stamp sheet rather than creating another popup chain (`components/BarnVisitModal.tsx:602-711`; `supabase/migrations/20260790000000_barn_kindness_cards.sql:13-181`).
- VIP parting emotes, buried/shared truffles, Golden Truffle forage, per-friend visit streaks, visit budgets, and Porch Round progress are existing layers of the loop (`components/BarnVisitModal.tsx:314-329`, `components/BarnVisitModal.tsx:527-595`, `components/BarnVisitModal.tsx:716-801`; `components/Friends.tsx:91-99`, `components/Friends.tsx:186-225`; `utils/visitStreaks.ts:19-21`).
- Furnishings in a friend's room can be inspected. Each occupied scene position exposes an accessible control and calls `onInspect` with that exact placed item (`components/habitat/HabitatScene.tsx:64-93`); the visit currently presents its name and description (`components/habitat/HabitatFriendRoom.tsx:95-102`).

## Functional gaps

### P1, unverified reachability — invalidate a visit on direct account replacement

`HabitatFriendRoom` exits the interior on `SIGNED_OUT` and `SIGNED_IN`, but the surrounding `BarnVisitModal` has no auth-user generation of its own (`components/BarnVisitModal.tsx:382-442`; compare `components/habitat/HabitatFriendRoom.tsx:69-79`). This is mitigated for ordinary sign-out: the tabs layout subscribes to auth state, replaces the entire authenticated tab tree with `SupaAuth` when the session becomes null, and therefore unmounts Friends, its nested `UserSheet`, and either visit entry point (`app/(tabs)/_layout.tsx:55-63`, `app/(tabs)/_layout.tsx:193-199`; `app/(tabs)/friends.tsx:186-191`; `components/Friends.tsx:304-329`). There is no global Barn visit overlay outside that authenticated tab subtree.

A narrower component risk remains if Supabase replaces one non-null session directly with another without an intervening null render. The tab layout is not keyed by `session.user.id`, and its auth callback does not clear the authenticated subtree for a non-null replacement (`app/(tabs)/_layout.tsx:60-63`). In that case a mounted exterior visit could retain the former account's visitor pig, outfit, VIP entitlement, tallies, and locally unlocked actions while later RPCs run as the replacement account (`components/BarnVisitModal.tsx:382-442`, `components/BarnVisitModal.tsx:527-536`). No repository test or observed runtime reproduction establishes that this transition occurs in the shipped login/logout flow, so this is an unverified defense-in-depth risk rather than a confirmed P0 failure. The robust fix is to close the visit when the authenticated user id changes and invalidate its pending continuations.

### P1 — bind profile-sheet async results to the requested target

`UserSheet` launches several independent requests when `targetUserId` changes, but their completion handlers do not check that the target is still current. A slow result for user A can overwrite `stats`, visit eligibility, bond, trade state, tickle total, wallow count, or curse state after the sheet has moved to user B (`components/UserSheet.tsx:271-354`). The visit action itself routes to the current id and `BarnVisitModal` remounts by that id, so server mutations are protected; however, the visible name/profile and the decision to offer or disable the Visit button can temporarily belong to the wrong person (`components/UserSheet.tsx:630-672`, `components/UserSheet.tsx:824-829`).

Every target-scoped completion should use a generation token or captured-id/current-id comparison. The sheet should clear the old `stats` immediately when switching targets so it cannot pair an old profile with a new visit id.

### P1 — guard post-action updates against an auth/session exit

Owner changes are protected by the keyed visit session, but async action completions and delayed callbacks are not tied to an auth generation or mounted flag. Examples include tickle results, the Porch Round continuation, the 600 ms kindness-card transition, the 900 ms kindness close, and the 650 ms parting-note close (`components/BarnVisitModal.tsx:527-575`, `components/BarnVisitModal.tsx:602-711`, `components/BarnVisitModal.tsx:777-801`). The parent unmount protects the visible UI on ordinary sign-out, and React ignores state updates after unmount; remaining effects can still emit analytics or invoke a stale `onClose`, particularly under the unverified direct non-null account-replacement case. A shared session-generation guard would make that boundary explicit.

## Product additions after correctness

These are proposals, not missing foundations.

1. **Make the room inspection sheet the next social addition.** Replace the native name/description alert with the existing styled furnishing preview pattern, adding owner-safe details such as item story, collection, and “Wallow Rank gift” provenance when metadata exists. Keep it read-only: no buy or placement control inside a friend's Barn. This builds on the inspection controls already present instead of adding another social currency or inbox.
2. **Show the pair's visit streak inside the visit.** The Friends list already fetches and displays streak state, but the room itself does not carry it into the arrival or leave summary. A small read-only line such as the current streak and whether today's visit advanced it would give the visit more continuity. It should use server-returned state after a confirmed tickle and must not imply a streak is required to keep guestbook history; the guestbook explicitly says stamps never expire (`components/BarnGuestbook.tsx:231-235`).
3. **Add a compact host identity header for the interior.** The outside scene has host identity and heart totals, while the interior primarily relies on the pig and room to communicate ownership (`components/BarnVisitModal.tsx:947-982`, `components/BarnVisitModal.tsx:1025-1037`). A persistent handle/avatar label inside the room would make routing visibly auditable and reduce ambiguity when two friends use the same pig skin or furnishing layout.

## Bounded work packages

### Package A — account-bound visit session

Ownership: `components/BarnVisitModal.tsx` and visit-specific tests.

Acceptance criteria:

- Ordinary sign-out continues to rely on the authenticated tabs parent unmount; a direct non-null authenticated-user replacement also closes the complete visit.
- No tickle, stamp, kindness, truffle, parting-note, Porch Round, analytics, or delayed close continuation from the previous account updates the next account's screen.
- Host switching continues to remount the session and route every RPC to the new host.
- Tests cover a direct A-to-B auth replacement before profile load, during a tickle, and during a delayed post-stamp/parting transition, plus the existing parent-unmount sign-out path.

### Package B — target-safe profile sheet

Ownership: `components/UserSheet.tsx` and focused UserSheet tests.

Acceptance criteria:

- When A's requests resolve after switching to B, none of A's stats, handle, friendship, visit gate, bond, trade state, tickle count, wallow count, or curse status renders for B.
- The Visit button remains hidden or loading until B's friendship and visit eligibility are known; pressing it always pairs B's id with B's displayed identity.
- Closing the sheet invalidates all pending target-scoped completions.
- Tests deliberately resolve A and B requests out of order.

### Package C — social furnishing inspection

Ownership: `components/habitat/HabitatFriendRoom.tsx`, a dedicated read-only inspection component, and inspection tests. Coordinate shared preview primitives before editing them.

Acceptance criteria:

- Tapping each occupied furnishing opens a styled, accessible read-only sheet for that exact snapshot item.
- The sheet never exposes purchase, edit, placement, or owner-only controls.
- Optional catalog metadata is shown only when present; older payloads still show name and description.
- Switching owner, losing friendship, backgrounding, or changing auth closes the inspection and never shows the previous owner's item.

### Package D — visit continuity presentation

Ownership: visit-streak data adapter plus `BarnVisitModal` presentation and focused tests.

Acceptance criteria:

- Arrival shows the pair's current streak without blocking the visit when the streak RPC is unavailable.
- A confirmed first tickle refreshes or consumes server-returned streak state exactly once.
- The leave summary states whether the streak advanced without changing guestbook permanence language.
- Repeated taps in the same visit cannot increment the displayed streak multiple times.

### Package E — visible host identity in the interior

Ownership: `BarnVisitModal`/`HabitatFriendRoom` presentation and accessibility tests.

Acceptance criteria:

- The interior continuously displays the host's resolved handle and an accessibility label naming whose Barn is open.
- The identity changes atomically with `ownerId`; no frame combines A's handle or pig with B's room.
- Missing profile data falls back to the caller-provided target name while the owner id remains the routing authority.

Package B addresses a confirmed target-switch race and should land first. Package A is bounded defense in depth for an account transition that has not been reproduced in the normal app flow. C is the strongest next product addition because the scene already has reliable item hit targets and exact snapshot data, making it a contained improvement to the feeling of visiting a personalized home.

## Unverified device and release gates

The code and component tests establish routing contracts but do not prove native modal behavior or touch geometry. Before calling the social Barn complete, verify on a physical iPhone or the exact signed release candidate:

- Open visits from both the Friends row and UserSheet, rapidly switch targets, background/foreground, then sign out and sign into another account.
- Confirm the interior door transition never flashes the prior room, the host label/pig match the selected friend, and the visitor pig matches the signed-in account.
- Exercise tickle, guestbook stamp, kindness card, truffle, leave summary, and VIP parting note in one session; verify modal handoffs do not wedge and VoiceOver can reach the actions.
- Inspect furnishings near every anchor at small and large supported screen sizes; confirm touch targets select the visible item and never intercept pig tickles unexpectedly.
- Validate server refusals for unfriended, blocked, self, missing-room, exhausted-budget, and expired-session cases against the installed binary.

These remain manual acceptance gates under `docs/RELEASE_CHECKLIST.md`; passing Jest or a simulator export does not replace them.
