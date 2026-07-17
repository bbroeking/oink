# Spec 08 — Seeded crew boards (wedge 5a): migration authored + smoke

**Source:** docs/wedge-plan.md §Phase 1 (5a). Server-heavy; migration is
AUTHORED ONLY — never `db push` (hard project rule).

## What to build

Board generation becomes deterministic per (feeding window, crew): every pig
in the same Sounder digs the IDENTICAL patch each feeding, so results are
comparable in the group chat. Solo/crewless pigs seed on (window_id, user_id)
— feel unchanged.

### Server (one new migration)

- **Carry-latest-def base:** the newest `open_rooting` definition lives in
  `supabase/migrations/20260744100000_feeding_schedule_config.sql` (function
  body at ~line 136; that file's header documents the carry). Copy THAT body
  verbatim as your starting point — NOT an older migration's. This is the
  carry-latest-def footgun (see CLAUDE.md memory: a stale base silently
  deletes later features — build 93's referral gate died this way). Also
  carry `submit_rooting`/`feeding_state` only if your change touches them.
- Change: the board seed derives as f(window_id, crew_id) when the caller is
  in a crew, f(window_id, user_id) otherwise. Practice digs stay fully
  random (verify how practice mode seeds today in the current def and
  preserve it).
- Boards already expire with the 8h window — no retention change.
- Migration filename: timestamped `YYYYMMDDHHMMSS_description.sql`,
  alphabetically AFTER 20260745000000_feedback_den.sql (the latest authored).
  Use 20260746000000_seeded_crew_boards.sql.

### Client parity

`utils/rooting.ts` mirrors the server PRNG (`generateBoard` ~line 147; the
parity contract is documented at the top of the file). Update the client seed
derivation to match, and keep the parity tests green
(`__tests__/rooting.test.ts`).

### Harness smoke

Add `scripts/db-harness/` smoke (next free number): same window+crew ⇒
identical board; different crew ⇒ different board; solo user ⇒ (window, user)
seed; practice dig ⇒ random. Follow the structure of
`scripts/db-harness/15_coop_dig_smoke.sql` / `17_patch_phase_smoke.sql` and
wire it into `run.sh` (NOTE: the run glob currently skips 50–53 silently —
make sure YOUR smoke actually executes; fixing the glob for 50–53 is welcome
if trivial, it's roadmap debt item §6).

## Constraints

- The migration must not change reward math, find tables, or uniques rolls —
  seed derivation only.
- Client must tolerate a server that hasn't been pushed yet (the migration
  ships later on founder go): if the server board differs from a locally
  predicted seed, the server board wins — check how parity mismatches are
  handled today and don't tighten them.

## Verify

- `__tests__/rooting.test.ts` extended for the new seed derivation.
- Run the db-harness (`scripts/db-harness/run.sh`) if the Docker harness is
  available (Colima); otherwise state that it wasn't run in the report.
- Full JS suite + typecheck.
