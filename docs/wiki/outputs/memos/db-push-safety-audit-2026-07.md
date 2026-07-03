---
title: "DB-push safety audit — what live clients can see of the Season-2 migrations"
type: memo
date: 2026-07-03
tags: [mud-wars, season-2, migrations, safety, audit, feature-flags]
status: draft
---

# DB-push safety audit (held Season-2 migrations vs the live app)

Founder's worry: *"we added some items to the DB, and now they show up incorrectly in
the UI of the currently live app."* This audit traces every path a LIVE client uses to
discover DB content, verifies what hides Season-2 rows today, and gives verdicts for the
held migrations + a seeding rule for the ones being written now. Read-only; nothing changed.

## 0. The live baseline

Newest shipped build = **build 101 (2026-06-25**, `docs/builds/2026-06-25-build-101.md`).
At its commit (`dd841f2`):
- **Every war surface is compile-time dark**: `constants/featureFlags.ts` at that sha has
  `MUD_FIGHTS_VISIBLE = DEV_PREVIEW = __DEV__`, which is **false in every release build**;
  `app/mud-war.tsx:120` hard-redirects home, and the Friends hub omits the Sounder segment
  (`friends.tsx:38`). `throw_mud`/`submit_run` call sites exist in the binary
  (`utils/mudWars.ts:283,297` at that sha) but are unreachable.
- **Live clients never read `app_config`**: `hooks/useFeatureFlags.tsx` did not exist at
  build 101 (the flag system landed with `20260692`, 2026-07-01). Server flag rows are
  invisible to the field.

## 1. The verified item-hiding predicate: `cost = 0`

| Surface | Query | Hide mechanism | Where |
|---|---|---|---|
| Shop "Daily" | `daily_shop()` RPC | **server-side** `h.cost > 0 AND NOT pass_exclusive AND NOT members_only` | latest def `20260688000000` |
| Shop "Browse" | client `from("hats")` full-table select | **client-side** `(cost > 0 && !pass_exclusive) \|\| ownedSet.has(id)` | `app/(tabs)/shop.tsx:586-598,631-635` |
| Mystery box pool | `grant_mystery_box()` | **server-side** `h.cost > 0` (+ category allowlist) | latest def `20260631000000` |
| Closet / equip | owned rows only (`user_hats`) | can't show unowned | `components/ClosetView.tsx` |
| WarSpoilsSheet | `.in("id", grantedIds)` | granted-only + unreachable (dark) | `components/WarSpoilsSheet.tsx:45` |
| Battle-pass track | explicit tier→item mapping | new hats rows never auto-appear | `20260686000000` area |
| Trades | tickle trades — no item picker exists | n/a | — |
| Titles | `user_titles` join (owned-only, server-driven name text) | ungranted titles invisible | `components/TitlesSection.tsx:31-35` |
| Achievements | `my_achievements()` returns **ALL** `achievements` rows | **locked rows are VISIBLE** ("N/M unlocked" counts them) | `20260677000000:211`, `app/achievements.tsx:148` |

So the 25 war cosmetics already in prod are hidden by `cost=0` — server-side for Daily +
box, **client-side for Browse** (fragile in principle, but verified present in build 101,
and it deliberately *surfaces owned cost-0 items*, which matters below).

## 2. Verdicts on the held migrations

**`20260704100000_truffle_patch.sql` — SAFE.** Observable-by-live-clients changes, checked
one by one: `profiles.golden_truffles` column (all live profile reads use explicit column
lists — e.g. `shop.tsx:603-614`; no `select("*")` on profiles anywhere in app/components/
hooks/utils); new tables `war_truffles`/`war_rootings` (RLS'd, never queried by live code);
new RPCs (never called); `throw_mud`/`submit_run` carries (no other SQL function calls them
— grep clean — and the only client call sites are behind the compile-time-false gate);
`mud_slings` CHECK 21→27 (only war paths write that table). No `hats`, `titles`,
`achievements`, or announcement rows are seeded. Nothing for a live client to render.

**`20260704200000_hunger_meter.sql` — SAFE.** Read-only RPC (REVOKEd from PUBLIC/anon) +
one `app_config` row (`world_boss`, enabled=false) that build-101 clients structurally
cannot read.

## 3. The REAL leak vectors (for the Exchange + beta-rewards builders)

1. **Granting a NEW-id item to live players surfaces it immediately** — Closet (owned
   list) and shop Browse (the `ownedSet.has(id)` clause exists precisely to surface owned
   cost-0 items). The live binary has no bundled art for new ids, so it degrades to the
   category icon → neutral print glyph (`ClosetView.tsx:346-365`) and an art-less preview
   (`ItemPreviewModal.tsx:194`) — **not broken, but generic**, i.e. exactly "shows up
   incorrectly." Granting items whose art IS bundled (the 25 war spoils are in build 101's
   `HAT_IMAGES` — verified) renders perfectly.
2. **Seeding `achievements` rows is instantly visible** on the live Achievements screen as
   locked rows and moves the "N/M unlocked" denominator. Fine as a deliberate teaser;
   wrong as an accidental one.
3. Everything else checked is inert: seeded titles (owned-only surface), `app_config`
   rows (unread), extra `hats` **columns** (explicit selects; the shop even has fallback
   retries for unknown columns, `shop.tsx:582-598`), pass tiers (explicit mapping).

## 4. The codified seeding rule

> **A migration may seed content rows into prod iff every new `hats` row has `cost = 0`
> (+ `war_exclusive = true` metadata) and is granted to no one; grants of NEW-id items
> wait for the client release that bundles their art (granting already-bundled ids is
> safe); new `achievements` rows are seeded only when they're allowed to be seen (they
> render locked immediately); new `titles`/`app_config`/RPCs/tables are inert until
> granted or called.**

One-liner for the parallel builders: **seed `cost=0`, grant nothing new-id, and treat
`achievements` inserts as a public announcement.**

## 5. Pre-push checklist (push day, in order)

1. **Rename `20260691000000_barn_three_to_seven_taps.sql`** to a fresh stamp AFTER the
   applied head `20260692000000` (e.g. `20260704050000_…`) — it currently sorts before the
   head, violating the ordering rule. Confirm content still applies cleanly.
2. Re-verify the applied head: `supabase migration list`.
3. Validate every pending file on the stubbed plain-Postgres Docker harness
   ([[project_local_db_validation]]; Colima) — apply in filename order onto a schema
   snapshot; watch for the `mud_slings` CHECK swap and the function carries.
4. Push on Brian's explicit go (`npx supabase db push`), all pending files in one push
   (order: renamed barn-taps → `20260704100000` → `20260704200000` → Exchange → beta
   rewards, i.e. plain filename order).
5. **Post-push smoke on a LIVE build 101 device/TestFlight** (not the dev client):
   - Shop: Daily + Browse lists unchanged (no new items, counts identical); buy something.
   - Mystery box (if obtainable): opens, grants normally.
   - Closet + Achievements: item grid unchanged; "N/M unlocked" denominator unchanged.
   - Core loop: tickle, barn visit, trade — RPCs unaffected.
   - Then on the DEV client: play a real (non-practice) Rooting end-to-end and read
     `hunger_meter()`.

## Connects to
- [[mudwar-scope-a-weathered-2026-07]] — migration sequencing note this extends
- [[mudwar-rewards-spec-2026-07]] · [[mudwar-hunger-arc-cadence-2026-07]]
- [[clan-buildout-audit-2026-07]]
