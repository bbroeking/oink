# T5 — the two-account swap check, on prod

The rollout step that proves a swap really moves two finds between two real
accounts on the production database, and that a second one the same day is
refused. Plan: `docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md`
§7, row **T5**. Contract it asserts against: the same doc's §12.

Files: `prod-two-account-check.sql` (this directory) and this runbook.

## When to run it

**After all three of these, and not before:**

1. The founder has said "go" on `supabase/migrations/20260917100000_satchel_swaps.sql`.
2. `npx supabase db push --linked` has applied it (check the pending list with
   `--dry-run --linked` first — other lanes have authored migrations sitting in
   the same directory, and a push applies all of them).
3. T4 has passed: counts read back, one `friend_wishes` as demo2, one
   `fulfil_pig_wish` (the alias) as demo2, and **build 190 opened against the
   pushed DB with no blank surface**.

Never run it against a database that has not had the migration pushed — every
RPC it calls is new, and the file would fail on the first `swap_with_host`.

## Run it

```
npx supabase db query --linked -f scripts/swaps/prod-two-account-check.sql
```

The file runs as one implicit transaction and `db query` returns only the last
result set, so it logs every step into a temp table and prints the whole log at
the end — one row per step: `n | verdict | step | detail`.

**Done looks like every row PASS**, plus `99 | SKIP | G · cleanup` (cleanup is
off by default). One FAIL is a stop: read its `detail`, don't re-run blindly —
the day's `already_today` gate is spent for that pair after the first swap, so a
second run the same day will fail steps B–E for reasons that are not bugs. If
you need a clean second run, use `demohelper2` / `demohelper3` (edit the email
at section 0) or wait for the UTC day to turn.

### Who plays whom

| | account | role |
|---|---|---|
| host | `demohelper1@ticklethepig.com` | the pig doing the wishing; its bag supplies the options |
| giver | `demo@ticklethepig.com` (DemoPig) | the visitor; the account the simulator signs in as |

Both are `is_test = true`, password `TicklePig2026!`, and already friends on
prod. The runbook becomes each of them with
`set_config('request.jwt.claims', …)` — the house way to act as a user through
`db query --linked` (see `memory/project_prod_rpc_act_as_user`). Direct table
writes (the rig in section A) run as the DB owner, because no RPC sets another
player's wish and none should.

### What each step proves

| # | step | asserts |
|---|---|---|
| 0 | accounts | both uuids resolve and the two are friends |
| 1 | `my_satchel()` as the host | the host's bag and wish read; prints the **baseline wish** for section G |
| 2 | the rig | the host's pig now wishes for a find the demo bag holds, and the host's bag holds something else to spare |
| 3 | `friend_wishes([host])` as the giver | `options` is non-empty, `swapped_today` is false, `fulfilled_by_me` is false — exactly what the row mark and the tray read |
| 4 | `swap_with_host(host, item, take, wish_no, nonce1)` | `ok`, `replay:false`, the gave/took pair, tickles, and the wish rerolled **away** from the find just given |
| 5 | the **same nonce** again | `replay:true`, the original receipt, and still exactly one ledger row for that nonce |
| 6 | a **new nonce**, same pair, same day | `already_today`, and no ledger row written |
| 7 | both bags | the two rows **moved**, with `source='swap'` and `from_user_id` provenance |
| 8 | `satchel_swaps` | one ledger row with the right wish_no, gave, took, tickles |
| 9 | the host's `system_announcements` | `kind='satchel_swap'`, `data.screen='barn'`, `data.giver_id` — the while-away line that taps through |
| 10 | `satchel_swaps_for` | the Board's *N swapped* counts the giver |
| 11, 13 | `my_satchel_swaps` as both | `given` for the giver, `received` for the host, same row |
| 12, 14 | `tickle_breakdown` as both | a `swaps` lane exists — the F4 fix; the +3 is no longer hiding in the home-taps residual |
| 15 | `my_satchel()` as the host | `shelf` is empty, `swaps_received ≥ 1`, `paid_left_today` reads |

## What the simulator does in parallel

Same day, **a different helper** (`demohelper2`) so the one-swap-per-pair-per-day
gate doesn't collide with step 6. Sign the 16 Pro Max simulator into
`demo@ticklethepig.com` and drive it with `idb` taps taken from
`idb ui describe-all` frames (`memory/project_idb_frames_for_taps`). Rig
helper2's wish the same way the SQL rigs helper1's — copy section A's `DO $rig$`
block with the other email.

Screenshot each of these:

1. **Friends** — helper2's row carrying the *you have it* mark.
2. **The visit** — the wish bubble over the host pig with its *will swap* line,
   and the Satchel strip with the matching find lifted.
3. **The tray** — tap the lifted find: up to three options and *…or just give it*.
4. **The receipt** — tap an option: both finds named, both tallies +3.
5. **The strip afterwards** — quiet; the bubble reads *next time*.
6. **The host's side** — sign in as helper2 (or read it in SQL), background and
   reopen: the while-away line, tapped through to the Barn, and the Inbox row.
7. **The Board** — *N swapped* on the row.

Before trusting any screenshot: restart Metro for the edit batch and grep the
entry bundle for `OfferTray` — the watcher goes stale on existing files too
(`memory/project_metro_stale_watcher`). With the tray open, tap both pigs once:
they must still react. A full-screen overlay on the new architecture needs
`pointerEvents="none"` or it eats every tap (the build-99 dead-Barn footgun).

## Done looks like

- Every SQL row PASS.
- The seven simulator screenshots, filed under `docs/reviews/` or attached to
  the build-191 changelog's verification section.
- One real `satchel_swaps` row per pair, with `from_user_id` provenance on both
  moved finds.
- The build-191 changelog's two-account-run checkbox ticked with the date.

## Cleaning up

Section **G** of the SQL is off by default. Once the screenshots are taken,
uncomment its single `set_config('ttp.cleanup', 'on', false);` line and run the
file again. On that second run steps B–E will report FAIL — expected, the swap
has already happened — and only the cleanup line matters.

It removes exactly what the runbook created: the two ledger rows (by nonce), the
announcement it wrote, and every find row it planted (tagged
`found_window_index = -991`, a tag that travels with a row when a swap moves it).

It deliberately does **not** unwind: the +3 tickles `apply_tickles` paid into
both profiles, the pair's visit-streak credit, the `satchel_met` rows, any
keepsake threshold crossed, or the host's rerolled wish. Three tickles on two
test accounts are not worth hand-editing `profiles` for; a wish rerolls by
itself every 48 hours anyway. If you want the host's wish put back exactly,
step 1 printed its baseline `find_id / wish_no`.
