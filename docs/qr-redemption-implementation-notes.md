# QR Redemption ("Golden Ticket") — implementation notes

Spec: inline "SPEC — QR Code Redemption" (founder workflow). Tracks the four
required sections; appended continuously as the work lands.

## Off-spec decisions

- 2026-07-11 — Migration filename `supabase/migrations/20260732000000_qr_redemption.sql`
  (constraint-mandated). Sorts after the latest applied head `20260730000000`
  (`20260732` > `20260730`). Brand-new tables + one brand-new RPC only — no
  CREATE OR REPLACE of anything existing, so the carry-latest-def footgun is
  avoided by construction.
- 2026-07-11 — Shop entry point: appended a "Have a code?" row at the BOTTOM of
  the **daily** view's ScrollView (after `TroughSection`), `app/(tabs)/shop.tsx`.
  Spec said "bottom of shop.tsx"; the daily ScrollView is the one always-scrollable
  always-mounted surface at the shop's foot (Browse/Closet are FlatList catalogs).
  Not a forbidden file. Routes `router.push("/scan-code")`.
- 2026-07-11 — Client payload URL segment: spec §2.3 says "take the last path
  segment of anything matching `/redeem/`". Implemented `parseRedemptionCodeFromUrl`
  to match `/redeem/<tail>` (mirrors `parseReferralCodeFromUrl`'s host+path shape)
  AND, per §2.3, fall back to treating a bare non-URL string as the raw code. Host
  check is lenient (any host) because the printed QR is our own domain but a typed/
  pasted code has no host — the server re-normalizes regardless.
- 2026-07-11 — Reveal UI reuses the existing `BuyCelebration` sparkle burst (fired
  on a successful reveal) rather than inventing a new celebration; spec said "reuse
  an existing celebration pattern (grep BuyCelebration / MysteryHatReveal)".
- 2026-07-11 — `PENDING_REDEMPTION_CODE_KEY = "pending_redemption_code"` added to
  `utils/redemption.ts`, mirroring `PENDING_REFERRAL_CODE_KEY`.

## Changes from spec

- 2026-07-11 — **Package manager: pnpm, not npm.** The repo is pnpm-managed
  (`pnpm-lock.yaml`, `node_modules/.pnpm/`). `npm install` errors out
  ("Cannot read properties of null (reading 'matches')") and would corrupt the
  tree. Used `pnpm add expo-camera@~16.0.18` + `pnpm add -D qrcode`. package.json
  updated correctly either way.
- 2026-07-11 — **expo-camera pinned to `~16.0.18`, not the default latest.** A
  bare `pnpm add expo-camera` resolved `57.0.1` (a much newer major, wrong for
  SDK 52). Pinned to the SDK-52 line (16.0.x, latest patch 16.0.18) per spec §6.
- 2026-07-11 — Migration column `grant` is a **Postgres reserved word** — quoted
  as `"grant"` in the DDL and as `rec."grant"` in the RPC body. Spec §1 wrote it
  bare; the codebase (Postgres) contradicts, so quoted. Column name unchanged.
- 2026-07-11 — `FONTS.mono` does not exist. Spec §2.2 said "monospace-ish styling
  within FONTS tokens" — used `FONTS.bodyExtra` (Nunito 800) + wide letter-spacing
  for the code-field feel (`app/scan-code.tsx` input style).
- 2026-07-11 — Reveal uses `HAT_IMAGES.golden_truffle` art for the truffle count
  (matches TruffleExchangeSheet) and `SnoutCoin` for snouts; hat uses
  `HAT_IMAGES[id]`. Reveal does NOT show rarity color from the server unless a
  `rarity` field is present (redeem_code returns name but not rarity — see Heads-up).
- 2026-07-11 — See Tradeoffs for the reveal-celebration choice
  (used BuyCelebration, not a bespoke MysteryHatReveal-style modal — MysteryHatReveal
  is a full-screen gacha animation tied to shop mystery boxes; too heavy for the
  in-place reveal the spec's one-loop legibility asks for).

## Tradeoffs

- 2026-07-11 — In-place reveal state (spec §2.5, "replaces the scanner in-place, no
  navigation") over a modal. Keeps the single-screen loop legible; gives up the
  bigger MysteryHatReveal spectacle.
- 2026-07-11 — Client-side payload parsing is convenience-only; the server RPC is the
  single normalization chokepoint (`upper(regexp_replace(...))`), so a sloppy client
  parse can never mis-grant — it just fails the server lookup with `unknown`.

## Heads-up

- 2026-07-23 — `20260776000000_cosmetic_owner_caps.sql` is deployed to
  production. It caps both existing Crown/Cap campaigns to 10 uses and adds a
  server-owned lifetime issuance cap of 10 owners per cosmetic. A row-locked
  `user_hats` trigger enforces the cap across every grant path; `redeem_code`
  checks it before consuming a claim and returns `item_sold_out`. Existing
  ownership is counted and never revoked if circulation already exceeded ten.
- 2026-07-23 — `20260777000000_extend_release_party_crown.sql` is deployed to
  production. It extends only `PIG-GXF8-ST7N` through the end of September 1,
  2026 Eastern (`2026-09-02 00:00:00-04`), leaving future Crown campaigns
  untouched.
- 2026-07-23 — `supabase db push --dry-run` reports the remote database is
  current; no migration push was required in the release pass.
- **Harness note:** `scripts/db-harness/run.sh` CANNOT run to completion on `main`
  right now — a PRE-EXISTING failure at `22_uniques_smoke.sql` (the CHAIN in
  run.sh stops at 20260725, so the `unique_id` key from 20260728 is absent; the
  baseline `run.sh` with NO args fails at the identical line). This is unrelated
  to my work. I validated the migration + RPC in ISOLATION against a fresh
  plain-Postgres container (stub → auth.uid override → `00b_redemption_prep.sql`
  → the migration → `36_redemption_smoke.sql`): the smoke passes every assertion
  (auth guard, normalize chokepoint incl. dashed+lowercase, unknown/expired/
  exhausted/bad_grant refusals, per-user-once, hat + already_owned, truffles via
  mint ledger, snouts, rarity return, race-safe `uses` counting). Once the CHAIN
  is repaired to include 20260728, `36_redemption_smoke.sql` auto-globs after the
  `15_coop_dig_smoke.sql` auth.uid override and runs in the normal suite.
  - Harness-only helper files added: `scripts/db-harness/00b_redemption_prep.sql`
    (backfills `hats.name`/`rarity` onto the minimal stub, since
    `check_function_bodies=on` validates the RPC body's `SELECT name, rarity`) and
    `scripts/db-harness/36_redemption_smoke.sql`.
- **RPC returns `rarity`** (enrichment beyond spec §1b's literal return list) so
  the reveal can color the hat name by rarity per spec §2.5. Prod `hats.rarity`
  exists (20260502030000). `Reveal.rarity` is optional on the client, so a
  pre-migration/absent value just falls back to ink.
- Native dep `expo-camera` added to package.json (npm install, NO pod install run).
  ALL app.json / infoPlist requirements are in the final report for manual apply.
- The shop entry link ships only in the SAME native build as expo-camera (§5/§6):
  the `/scan-code` route imports `CameraView`, which needs the native module present.
- Deep-link `/redeem/*` is deployed on `ticklethepig.com`. The live fallback
  route returns the App Store handoff and code-entry instructions, and the live
  AASA file includes `"/redeem/*"` with `application/json`.
- `scripts/mint-redemption-codes.mjs` requires `qrcode` (dev dep) to emit PNGs;
  added to package.json.
