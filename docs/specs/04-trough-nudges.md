# Spec 04 — Trough nudges: supersede + tap-through

**Source:** GitHub issue #10 (`gh issue view 10`). Two halves: server spam,
client dead card. Migration AUTHORED ONLY — never `db push`.

## Part A — spam: no supersede (server)

`supabase/migrations/20260623000000_trough_nudge_and_brian_test.sql:51-67` —
`nudge_trough(p_drive_id)` unconditionally INSERTs a `trough_nudge`
system_announcements row per accepted friend; only a 6h per-drive cooldown
(`last_nudge_at`) exists. Unseen identical nudges pile up and drip through
the While-Away LIMIT 20.

Fix: in a NEW migration, redefine `nudge_trough` (carry the LATEST definition
— find the alphabetically newest migration defining it; carry-latest-def
footgun) to supersede before inserting: delete (or mark seen) existing
UNSEEN `trough_nudge` rows for the same recipient whose
`data->>'drive_id' = p_drive_id::text`. Keep the `p_`-prefixed signature
EXACTLY (deployed builds call it). Reconcile with server-side seen tracking
(`mark_announcement_seen`) — supersede unseen rows only.
**Footgun check:** if the function body inserts into system_announcements it
must keep the INSERT inlined (never call send_system_announcement() — it
raises admin_only → silent rollback for non-admins; see CLAUDE.md memory).

## Part B — dead card: no tap-through (client)

The While-Away normalizer in `app/_layout.tsx` drops the deep-link payload:
`my_unseen_announcements` returns `data` (carries `drive_id`) at :578-589,
but the `Norm` type (:596-606) and system-row mapping (:626-632) keep only
`announcement_id/title/body`, and `WhileAwayEvent`'s system variant
(`components/WhileAwayModal.tsx:43`) has no drive_id; the render (:106-137)
has no Pressable.

Fix: thread `kind` + `data.drive_id` through `Norm` → the system branch of
the event mapping (:671-677) → the `WhileAwayEvent` system variant → wrap
the system row in a Pressable that routes to the drive via the existing
deep-link helper (`utils/notificationRouting.ts` `routeForScreen`, already
imported in `_layout.tsx:49`). Rows without a route (kind ≠ trough_nudge or
missing drive_id) stay non-pressable — no dead affordance.

Constraints: tapping through should dismiss the While-Away modal via its
normal dismiss path (it persists `away_seen_v1` on dismiss — don't skip
that). Don't alter `donate_to_drive`'s frozen positional signature.

## Verify

- Unit-test the normalizer threading (announcement row → event with
  drive_id) in `__tests__/`.
- db-harness smoke for supersede: nudge → nudge again ⇒ one unseen row per
  recipient. Wire into run.sh (watch the 50–53 glob gap).
- Full suite + typecheck.
