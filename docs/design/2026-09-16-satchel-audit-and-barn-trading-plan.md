# The Satchel — section audit, and the plan for trading finds at a barn (2026-09-16)

Status: **audit of what shipped in build 186 (`20260915010000_satchel.sql`, pushed
2026-09-15) + a build plan for player-to-player trading.** Nothing in Part 2 is
built. Companion to `docs/satchel-spec.md` (what shipped), and to the
unratified `2026-09-16-finds-swaps-and-the-stranger.md` / `-plan.md` (the
wider proposal this plan carves the trade out of).

Founder's ask, verbatim: *"When we visit a barn, we want the ability to trade
with other people. That means we need trading functionality that lets users
exchange items between players, specifically by moving items in each player's
satchel from one person to another."*

Verified while auditing: `satchel.test.ts` + `BarnVisitSatchel.test.tsx` green
(20/20); every helper `fulfil_pig_wish` calls exists in prod with the signature
it uses; the latest Dig submit core (`20260914090000_loose_pouch.sql`) re-reads
the receipt row after its insert, so the trigger's `satchel` key does reach the
client.

---

## Part 1 — Section audit

Seven sections. For each: what it does · inputs/outputs · depends on · affects
downstream · gaps and failure modes · fixes. Severity: **H** breaks a promise
the spec makes · **M** visible or exploitable but bounded · **L** cosmetic or
hygiene.

### 1. Tuning — `app_settings.satchel_tuning` · `_satchel_tuning()` · `utils/satchel` config cell · `constants/satchel` fallback

| | |
|---|---|
| **Does** | One JSON row owns every number (cap 6, 30/50/20 find odds, 70/25/5 rarity, 48h wish, 3 tickles, keepsakes 10/50/100). Server reads it inside every RPC; the client boots on the compiled copy and refreshes through `createConfigCell` (`satchel_tuning_cache_v1`, 5s min refresh). |
| **In / out** | In: the `app_settings` row (or nothing). Out: server — a jsonb every helper `COALESCE`s field-by-field; client — a sanitised `SatchelTuning` (clamped: cap 1–24, hours 1–336, tickles 0–50, thresholds sorted positive ints). |
| **Depends on** | `app_settings` + `app_setting()` (the server-config rule, build 151). |
| **Affects** | Bag cap on the fan row, strip and sheet; the receipt's `cap`; `wishHoursLeft` copy; the "keepsake at N" line; the trigger's odds; `fulfil_pig_wish`'s tickles. |
| **Gaps** | **L** `rarity_weights` is read by the server only — the client neither shows nor needs it (fine, but `sanitizeSatchelTuning` silently drops it, so a future client use would have to add it). **L** Lowering `cap` below a live bag makes the fan row read "8 of 6 finds"; nothing enters until under cap (trigger uses `have < cap`), so the state is safe, only the copy lies. |
| **Fix** | Clamp the copy: when `items.length >= cap` say "full" rather than N of M. No server change. |

### 2. Catalog — `satchel_finds` · `SATCHEL_FIND_IDS` / `SATCHEL_FINDS` · `FindArt` · twelve `Glyph` entries

| | |
|---|---|
| **Does** | Twelve ids in three rarities, mirrored by hand on client and server; painted glyphs; `silhouette` = ink tint at ghost opacity for a find never carried. |
| **In / out** | In: the table (readable by `authenticated`; the only client-readable satchel table). Out: names with articles for copy, the `GlyphName` per id. |
| **Depends on** | `Glyph`'s require map; `ART_SIZE` / `OPACITY` tokens. |
| **Affects** | Every surface that draws a find; `isSatchelFindId` gates every parser, so a server id the binary doesn't know is **dropped**, not drawn blank (bag item, wish, shelf, met, receipt line). |
| **Gaps** | **M** The mirror is untested: no test asserts `SATCHEL_FIND_IDS` ⊆ `satchel_finds` (a harness read) or that every id has a glyph (a `require` map key check). The finds/swaps plan proposes 18 more ids — the moment that lands, a missed id silently vanishes from a bag. **L** The client never reads the table, so the server's `sort`/`name` are dead to the app. |
| **Fix** | Add `satchelCatalog.test.ts`: every `SATCHEL_FIND_IDS` entry has a `findArtGlyph`, and the migration's `INSERT` id list equals the constant (parse the SQL in the test the way `glyphArt.test.ts` locks assets). |

### 3. Bag — `satchel_items` · `my_satchel()` · `toss_find()` · `useSatchel` · `SatchelSheet` · Barn fan row

| | |
|---|---|
| **Does** | Row-per-find with provenance (`found_window_index`, `created_at`); `my_satchel` returns bag + met + wish + shelf + delivery count + keepsakes in one call; `toss_find` is the only owner mutation on a find; the sheet shows wish / bag / catalog / shelf; the fan row "Satchel · N of cap". |
| **In / out** | In: `auth.uid()`. Out: `SatchelState` (narrowed by `toSatchelState`). `toss` → `{count}`. |
| **Depends on** | §1 tuning (cap), §2 catalog, §5 wish (`my_satchel` calls `_ensure_wish` — a **read that writes**), `useFocusEffect`. |
| **Affects** | Fan row visibility (`available` gates it), the visit strip's items, the Friends wish marks (Friends fetches the bag itself via `fetchMySatchel`, not the hook). |
| **Gaps** | **M** `applyBagCount(count)` trims the bag to `items.slice(0, count)` — it removes the *last* item, not the one just given. After a delivery the strip can briefly show the given find still present and a different one gone until `refresh()` lands (the give path calls both back-to-back, so it's a flicker, but a wrong one). **L** Three independent `my_satchel` fetches per foreground (Barn hook, visit hook, Friends' direct call), each taking a `FOR UPDATE` on the caller's wish row. Harmless, redundant. **L** `toss` rollback re-appends the item at the end, reordering the bag. **L** `useSatchel` runs inside `BarnVisitModal`, which is mounted inline by `Friends` and `UserSheet` rather than as a route; `useFocusEffect` works there because both live inside a tab screen, but a `UserSheet` opened from a non-tab context would never refresh. Not observed; verify on device. |
| **Fix** | Replace `applyBagCount` with `removeItem(itemId)` and call it from `give` with `item.id` (keep `bag_count` as a reconcile check only). Add a `removed` re-insert at the original index on toss refusal. |

### 4. Dig hook — `rooting_receipts_roll_satchel` trigger · `receipt.satchel` · `useRooting` → `reconcileReceipt` → `satchelReceiptLine` → `SnoutDeepSheets`

| | |
|---|---|
| **Does** | BEFORE INSERT on `rooting_receipts`: rolls 0/1/2 finds, inserts up to cap, lists overflow as `lost`, records first-found in `satchel_met`, writes `{found, lost, count, cap}` onto the receipt JSON. Client turns it into the one receipt line. |
| **In / out** | In: `NEW.user_id`, `NEW.window_index`, the tuning. Out: bag rows, met rows, the receipt key. Client: `RootingOutcome.satchel` → `receipt.satchelLine`. |
| **Depends on** | The submit core inserting with `ON CONFLICT DO NOTHING` **and** re-reading the row (it does — `loose_pouch` lines 510–514); `_satchel_roll_find`; `satchel_items` count. |
| **Affects** | The only faucet for finds. Every bag count, wish mark and delivery starts here. |
| **Gaps** | **M** `_satchel_roll_find` is declared `STABLE` but calls `random()`. In plpgsql each call is its own statement so today's loop rolls independently — but any future single-statement use (`INSERT … SELECT _satchel_roll_find()` across rows) would let the planner evaluate it once and hand every row the same find. **M** The idempotency guard is an `EXISTS` on `(user_id, window_index)`; any *other* writer of `rooting_receipts` (an admin backfill, a repair script) now rolls finds as a side effect. The 20260913010000 backfill predates the trigger, so nothing has fired yet. **L** The roll runs even when the receipt insert is later rolled back — correct (same transaction), just worth knowing when reading harness output. |
| **Fix** | Re-declare `_satchel_roll_find` `VOLATILE` in the next satchel migration. Document the trigger side effect at the top of any future receipt backfill, or gate the roll on a receipt key the submit core sets (`receipt->>'ok' = 'true'`). |

### 5. Wish — `pig_wishes` · `_ensure_wish` · `reroll_my_wish()` · `friend_wishes()` · `WishBubble` · Friends row mark (`bagHasWishFor`)

| | |
|---|---|
| **Does** | Exactly one live wish per profile, lazily created/rerolled on read (`_ensure_wish` runs from `my_satchel`, `friend_wishes`, `reroll_my_wish`, `fulfil_pig_wish`). `wish_no` is the idempotency key. Owner gets one free reroll per wish. Friends see the wish only through `friend_wishes` (friends-only, not blocked). |
| **In / out** | In: target ids. Out: `{find_id, wish_no, expires_at, fulfilled_by_me}` per friend; the owner's row also carries `rolled_at`, `owner_rerolled`. |
| **Depends on** | `are_friends`, `are_blocked`, `_satchel_roll_find(p_not)`, tuning hours. |
| **Affects** | The bubble, the strip's lifted tile (`matchingItems`), the row mark, the "next time" state after a delivery, the delivery's `wrong_find`/`already_fulfilled` answers. |
| **Gaps** | **M** `friend_wishes` is a read RPC that takes `FOR UPDATE` and may `UPDATE` every friend's row (expired reroll). Correct, but it means the Friends screen holds N row locks for the RPC's duration and *rerolls other people's wishes*. At today's friend counts this is invisible; at hundreds it serialises against those friends' own visits. **L** The client's `wishHoursLeft` uses `expires_at`, which `friend_wishes` returns but the strip never shows — fine. **L** Harness never exercises the 48h timeout path (`expires_at <= now()` → `wish_no + 1`, `owner_rerolled` reset). |
| **Fix** | Split `_ensure_wish` into `_peek_wish` (no lock, no write; if expired, *then* call the writer) so the friends read only writes for the rare expired row. Add the timeout case to `90_satchel_smoke.sql` (set `expires_at = now() - 1h`, read, assert `wish_no` advanced and `owner_rerolled = false`). |

### 6. Delivery — `fulfil_pig_wish()` · `satchel_deliveries` · `pig_shelf` · `SatchelStrip` · `give` / `bounce` in `BarnVisitModal` · receipt sheet · nap card "Leave a find"

| | |
|---|---|
| **Does** | The one hand-off. Validates host ≠ self, exists, friends, not blocked, item owned (locked), wish open for this giver, find matches; then in one transaction: delete from bag, upsert host shelf, delivery row, `apply_tickles` both (count + `counter`, never the bank), happiness 1.0/0.25, generous tick, pair visit-streak credit, keepsake threshold, while-away announcement (inlined), reroll the wish away from the given find. Every refusal is `{ok:false, reason}`; nothing raises. |
| **In / out** | In: `p_host`, `p_item_id`. Out: `FulfilResult` (`find_id, tickles, giver_tickled, host_tickled, deliveries, keepsake, next_wish, bag_count`), or a reason with the live wish. |
| **Depends on** | §3 bag, §5 wish, `apply_tickles` (20260913120000), `apply_happiness` (20260738300000), `shift_alignment` (20260536000000), `_credit_visit_streak` (20260829000000), `are_friends`, `are_blocked`, `profiles.username`, `system_announcements`. |
| **Affects** | Both profiles' `tickles_earned` and `counter` (season standing), the giver's alignment, the pair's visit streak, the host's shelf, the Board slice, the keepsake row, the host's next launch (while-away card). |
| **Gaps** | **M — the only rule the server doesn't enforce.** The spec says the same visitor fulfils "the *next* wish on a later visit"; the server only enforces one delivery per `(giver, host, wish_no)`. After a delivery the wish rerolls and `fulfilled_by_me` is false again, so a client that skips the `given` guard can chain every matching find in one sitting: bag of 6 → up to 18 tickles + 18 to the host + 6 generous ticks. Bounded by cap 6 and the dig cadence, no currency, so **not** a farm — but it becomes material the moment items move *both* ways (Part 2). **L** A concurrency race on the `UNIQUE (giver, host, wish_no)` cannot produce a raise: the item lock then the wish lock is a fixed order, and a second giver re-reads the rerolled wish under `FOR UPDATE` and gets `wrong_find`. Verified by reading, not by a smoke. **L** The wrong-find bounce is client-only, as designed; a stale bubble gets the honest `wrong_find` answer. **L** No push to the host, no Inbox row; the while-away announcement carries no `data.screen`, so `systemAnnouncementRoute` returns null and the row is non-pressable. Once dismissed there is no place the host can see *who* brought what — the shelf shows counts only. |
| **Fix** | Add a server gate matching the spec: one delivery per `(giver, host)` per visit window — simplest honest key is per UTC day (`satchel_deliveries.created_at::date`), returned as `already_today`. Add `data.screen = "barn"` to the announcement so the row taps through. Add a `not_friends` / `blocked` case to the smoke (the harness header claims it, the body never calls it). Consider an Inbox row when trading lands (Part 2 §6). |

### 7. Traces and Contend — while-away line · `satchel_deliveries_for()` → `useLeaderboard.withDeliveries` → Board "N delivered" · keepsakes · shelf

| | |
|---|---|
| **Does** | The host's trace is one `system_announcements` row (`kind = 'satchel_delivery'`). The Board reads delivery counts per profile (public numbers). Keepsakes are threshold rows drawn as stacked finds. |
| **In / out** | In: profile ids. Out: `{id: count}`; the while-away event `{source:"system", title, body, route:null}`. |
| **Depends on** | `WhileAwayModal`'s system row, `Leaderboard` row layout (`showAlignment` toggle hides the slice), `satchelTuning().keepsakeThresholds`. |
| **Affects** | The Board's second line; the Satchel sheet's shelf section. |
| **Gaps** | **M** Delivery tickles have no `tickle_breakdown` lane — the latest def (`20260803010000`) predates the Satchel, so both pigs' +3 land in the `home_taps` residual. The glass-box breakdown misattributes every delivery as home taps. **L** `KeepsakeArt` bands on ≥100 / ≥50 / else, so retuned thresholds still draw, but the *third* band always shows the whistle even if thresholds become `[5, 25, 75]` — cosmetic. **L** The shelf is a dead end: a received find can't be tossed, given on, or seen by anyone but the owner. This is the structural thing Part 2 changes. |
| **Fix** | Carry `tickle_breakdown` from `20260803010000` and add a `deliveries` lane summed from `satchel_deliveries` (giver side + host side, `tickles` recorded on the row — today the row doesn't store the amount; add the column in the same migration and backfill from tuning). Fold the shelf into the bag (Part 2 §3). |

### Cross-section dependency map

```
tuning ─┬─► trigger (odds, cap) ─► bag rows ─► my_satchel ─► fan row / sheet / strip / Friends marks
        ├─► _ensure_wish (hours) ─► friend_wishes ─► bubble / row mark / strip lift
        └─► fulfil_pig_wish (tickles, thresholds) ─► apply_tickles ─► tickles_earned + counter (Board, season)
                                                  ├─► shift_alignment ─► alignment milestones + pushes
                                                  ├─► _credit_visit_streak ─► visit_streaks (Friends row)
                                                  ├─► system_announcements ─► while-away card (non-pressable)
                                                  ├─► pig_shelf ─► sheet "the shelf" (dead end)
                                                  └─► satchel_deliveries ─► Board "N delivered", keepsakes
```

### Findings, ranked

| # | sev | where | finding | fix |
|---|---|---|---|---|
| F1 | M | §6 | "Later visit" rule is client-only; a stale/modified client can chain deliveries in one visit | server per-(giver, host)-per-day gate → `already_today` |
| F2 | M | §3 | `applyBagCount` removes the wrong item until refresh | `removeItem(item.id)` |
| F3 | M | §4 | `_satchel_roll_find` STABLE + `random()` | `VOLATILE` |
| F4 | M | §7 | delivery tickles fall into the `home_taps` residual | `deliveries` lane, carried from the latest `tickle_breakdown` def |
| F5 | M | §2 | catalog mirror (ids ↔ glyphs ↔ SQL) is untested | `satchelCatalog.test.ts` |
| F6 | M | §5 | `friend_wishes` locks and may write every friend's wish row | `_peek_wish` read path; write only when expired |
| F7 | M | §4 | any future `rooting_receipts` backfill rolls finds | document / gate on a submit-core receipt key |
| F8 | L | §6 | while-away row can't be tapped; no host-side history of who gave what | `data.screen`; Inbox row with trading |
| F9 | L | §6, §5 | harness never runs `not_friends`, `blocked`, or the 48h timeout | extend `90_satchel_smoke.sql` |
| F10 | L | §1 | "8 of 6 finds" when cap is lowered | copy clamp |
| F11 | L | §7 | the shelf is a dead end | Part 2 |

None of these is a stop-ship for build 190. F1–F4 and F6 should ride the trading migration (Part 2) rather than a migration of their own.

---

## Part 2 — Trading finds at a barn: the build plan

### 0. Scope, and what this carves out of the wider spec

The wider proposal (`2026-09-16-finds-swaps-and-the-stranger.md`) bundles four
things: **(a)** the swap in the barn, **(b)** an owner-set ask with quantities
and pushes, **(c)** a 12 → 30 catalog, **(d)** the Stranger / Trading Hut,
which sells sets for tickles and *amends* the 2026-09-14 charter ruling.

The founder's ask is **(a)**. This plan ships (a) alone, as one migration and
one client PR, in a way that (b)–(d) can layer on without a second data
migration. Reasons:

- (a) needs no charter amendment — items move 1:1 between bags and mint
  nothing; "given, never sold" holds. (d) needs the founder to ratify an
  amendment first (plan S0), and (c) needs 18 glyphs. Neither should gate a
  friend handing a friend a pebble.
- The shipped delivery is already 80 % of a swap: the wish is the "want", the
  strip lifts the match, the RPC moves a row. What's missing is the *take*
  side and the find landing in a **bag** rather than a shelf.
- The audit's F1 (chaining) becomes material the moment finds flow both ways,
  so the trade migration is where that gate belongs anyway.

**One line:** *On a visit, hand a friend's pig the find it is hoping for and
take one of up to three things its owner's bag can spare — or just give it.*

Pillars: **Connect** (a specific reason to visit a specific friend; "you have
what Maple's pig wants" is a text message), **Collect** (a received find is in
your bag — tossable, re-giveable, counted toward met), **Contend** (the Board's
"N swapped").

Decision-lens check: pillar ✓ · one sentence ✓ · fair by construction (1:1,
server-chosen options, nothing minted beyond the flat 3 that a visit tap
already pays, capped per pair per day) ✓ · losing is warm (a full bag, a
changed mind and a beaten-to-it are all named, nothing is confiscated) ✓ ·
art pipeline: **zero new art** (the tray is Stickers and existing find glyphs) ✓.

### 1. Vocabulary (add to `CONTEXT.md` on ratification)

| code | on screen | meaning |
|---|---|---|
| `swap` | a swap | the visitor hands the host pig its wished find and takes one offered find back |
| `gift` | *just give it* | a swap that takes nothing (today's Delivery, renamed) |
| `options` | *Maple's pig can spare…* | up to three finds from the host's bag the visitor may take, chosen by the server |
| `nonce` | — | the client's idempotency key on every swap |

**Wish** stays the noun for the want (the owner-set *ask* is deferred, §9).
**Delivery** and **shelf** retire. *Trade* stays out of the UI (it means the
Exchange / `tickle_trades`).

### 2. The flow

1. **Discovery, unchanged.** Friends row mark "you have it"; the bubble over the host pig.
2. **Bubble** gains one hint under the find: *will swap* when the host's bag has ≥1 option, *gift only* when it doesn't.
3. **Tap the lifted find** → the **offer tray** rises from the strip (a `Sticker` card):
   > *Maple's pig can spare one of these for your blue feather:*
   > [ old key ] [ river pebble ] [ acorn cap ]
   > *…or just give it.*
4. **Tap an option** → `swap_with_host(host, item_id, take_find_id, wish_no, nonce)`. **Tap "just give it"** → same call, `take_find_id = null`.
5. **Ceremony**: host `surprise` → `happy`, guest `happy`, the taken find slides from the tray into the strip; receipt sheet in the tally voice: *"Swapped — Maple's pig got the blue feather it was hoping for; you took the old key. You both got 3 tickles."* A gift reads *"…you gave it away. You both got 3 tickles, and a generous tick."*
6. **Host, on return**: while-away line *"Jen swapped your pig the blue feather it was hoping for and took the old key."* (tappable, `data.screen = "barn"`) and an Inbox row.
7. **Bubble after**: the pig's next wish under *next time* — this visitor is done here today (server-enforced, F1).

Kept from the shipped visit: tap not drag; works after tickles are spent and
from the nap card (*Leave a find* becomes *Swap*); never opens a barn against
the 3-barn window; the host pig is the only tickle target.

### 3. Data model (one migration, `2026091[7-9]xxxxxx_satchel_swaps.sql`)

```sql
-- 3.1 provenance on the bag row
ALTER TABLE public.satchel_items
  ADD COLUMN source text NOT NULL DEFAULT 'dig'
    CHECK (source IN ('dig','swap','gift','migrated_shelf')),
  ADD COLUMN from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3.2 the ledger (replaces satchel_deliveries; the old name stays as a VIEW for one build)
CREATE TABLE public.satchel_swaps (
  id            bigserial PRIMARY KEY,
  nonce         uuid NOT NULL UNIQUE,
  giver_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wish_no       bigint NOT NULL,
  gave_find_id  text NOT NULL REFERENCES public.satchel_finds(id),
  took_find_id  text REFERENCES public.satchel_finds(id),      -- NULL = gift
  tickles       int NOT NULL DEFAULT 0,                        -- 0 when the pair's paid cap is spent
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT satchel_swaps_not_self CHECK (giver_id <> host_id),
  CONSTRAINT satchel_swaps_one_per_wish UNIQUE (giver_id, host_id, wish_no)
);
CREATE INDEX satchel_swaps_giver_day ON public.satchel_swaps (giver_id, created_at DESC);
CREATE INDEX satchel_swaps_host_day  ON public.satchel_swaps (host_id, created_at DESC);
-- + a partial index for the per-day gate: (giver_id, host_id, (created_at::date))

-- 3.3 data moves
INSERT INTO public.satchel_swaps (nonce, giver_id, host_id, wish_no, gave_find_id, took_find_id, tickles, created_at)
  SELECT gen_random_uuid(), giver_id, host_id, wish_no, find_id, NULL, 3, created_at FROM public.satchel_deliveries;
-- shelf → bag: each (user, find, count) becomes count rows, source='migrated_shelf', up to cap; overflow dropped
-- (prod 2026-09-16: one shelf row; nothing is lost)
DROP TABLE public.pig_shelf;
DROP TABLE public.satchel_deliveries;
CREATE VIEW public.satchel_deliveries AS SELECT id, giver_id, host_id, wish_no, gave_find_id AS find_id, created_at FROM public.satchel_swaps;  -- one-build alias

-- 3.4 tuning (extends the row; compiled fallback in constants/satchel.ts)
--   "options": 3, "paid_swaps_per_pair_per_day": 3, "paid_swaps_per_pig_per_day": 10
```

`pig_wishes` is unchanged. `satchel_met` gains a row for a *received* find (a
swap is how a lone digger meets a rare). `satchel_keepsakes` thresholds now
count gifts + swaps given.

### 4. Server surface

| RPC | change |
|---|---|
| `my_satchel()` | items gain `source`; no shelf; `deliveries` → `swaps_given`; `swaps_received` added; `paid_left_today` |
| `friend_wishes(p_targets)` | each entry gains `options: [find_id]` (≤3, from `_wish_options` — a pure function of the wish number and the host's live bag, so the same three on every read until that bag changes) and `swapped_today: bool` (the F1 gate, so the row mark can stay honest) |
| `_wish_options(p_host, p_wish_no)` → `text[]` | **one SQL function**: the host's bag grouped by find, excluding the wished find, **largest stacks first** (duplicates are what an owner values least), ties by `hashtext(wish_no::text \|\| find_id)`, limit `options`. The client never recomputes it. |
| `swap_with_host(p_host, p_item_id, p_take_find, p_wish_no, p_nonce)` | the trade (§5) |
| `fulfil_pig_wish(p_host, p_item_id)` | **kept for one build** as `swap_with_host(p_host, p_item_id, NULL, <live wish_no>, gen_random_uuid())` so build 190 keeps working against the pushed DB |
| `satchel_swaps_for(p_targets)` | Board counts (gifts + swaps given); `satchel_deliveries_for` aliases it for one build |
| `tickle_breakdown` | carried from `20260803010000`; new lane `swaps` = `SUM(tickles)` from `satchel_swaps` on either side (F4) |
| `_satchel_roll_find` | `VOLATILE` (F3) |
| `_ensure_wish` | split read/write (F6) |

### 5. `swap_with_host` — validation order and effects

Under `pg_advisory_xact_lock(hashtext('wish:' || p_host))` so two visitors of
one host serialise; every check answers by name; nothing raises.

| # | check | reason on failure |
|---|---|---|
| 0 | `auth.uid()`; `p_nonce` is a uuid; if a `satchel_swaps.nonce` row exists → return **its** receipt with `replay: true` | `not_authenticated`, `bad_nonce` |
| 1 | `p_host ≠ uid`, host profile exists | `invalid_host`, `host_not_found` |
| 2 | `are_friends` ∧ ¬`are_blocked` | `not_friends`, `blocked` |
| 3 | giver's item `FOR UPDATE`, owned | `not_in_bag` |
| 4 | host wish `FOR UPDATE`; `wish_no = p_wish_no` | `wish_changed` + live wish (bubble + tray redraw) |
| 5 | no `satchel_swaps` row for `(uid, host)` **today** (UTC) | `already_today` — the F1 gate; the strip goes quiet, the bubble says *next time* |
| 6 | `item.find_id = wish.find_id` | `wrong_find` + live wish |
| 7 | if `p_take_find` not null: it ∈ `_wish_options(host, wish_no)` | `not_offered` (a Sentry error, never a toast — it means the rule diverged) |
| 8 | …and the host still holds one: oldest `(host, take_find)` row `FOR UPDATE` | `option_gone` + fresh options (nothing moved; tray redraws with *"Maple's pig changed its mind"*) |
| 9 | if gift: host bag `count < cap` | `host_bag_full` (the wish stays; the client suggests the swap) |
| 10 | **move**: `UPDATE satchel_items SET user_id = host, source = 'swap'\|'gift', from_user_id = uid, created_at = now() WHERE id = item.id`; if swapping, the host's option row likewise → giver. Rows **move**, never delete-and-reinsert (provenance). `satchel_met` upsert for both receivers. | — |
| 11 | tickles: if the pair's paid swaps today < `paid_swaps_per_pair_per_day` ∧ giver's < `paid_swaps_per_pig_per_day` → `apply_tickles` both, else 0 and the receipt says *(no tickles — you've swapped plenty today)*. Happiness 1.0 / 0.25; **generous tick on gifts only**; pair visit-streak credit; keepsake check | — |
| 12 | ledger row; while-away announcement (inlined, `data: {screen:"barn", find_id, took_find_id, giver_id}`); wish rerolls away from the given find, `wish_no + 1` | — |
| 13 | return `{ok, replay:false, gave_find_id, took_find_id, tickles, giver_tickled, host_tickled, swaps_given, keepsake, next_wish, bag: [...]}` — the **full bag**, so the client never trims by count (F2) | — |

Lock order is fixed everywhere: giver item → host wish (advisory) → host
option row. No `SKIP LOCKED`.

### 6. Client

| file | change |
|---|---|
| `constants/satchel.ts` | tuning fallback gains `options`, `paidSwapsPerPairPerDay`, `paidSwapsPerPigPerDay` |
| `utils/satchel.ts` | `SatchelItem.source?`, `FriendWish.options: SatchelFindId[]`, `FriendWish.swapped_today`; `swapWithHost()` (generates the nonce with `expo-crypto`'s `randomUUID`, retries with the **same** nonce); `swapLine()` for every reason; `fetchSatchelSwapsFor` |
| `hooks/useSatchel.ts` | `removeItem(id)`; `applyBag(items)` from the server's full bag; drop `applyBagCount` |
| `hooks/useSwap.ts` (new) | owns tray open/close, the in-flight nonce, reason → copy, the `option_gone` / `wish_changed` redraws |
| `components/visit/OfferTray.tsx` (new) | the card: options as `Sticker` tiles with `FindArt`, *just give it* as a link `Button`, `EmptyState` when options are empty ("gift only") |
| `components/visit/SatchelStrip.tsx` | a lifted tap calls `onOpenTray(item)` instead of `onGive`; `delivered` → `swapped` |
| `components/visit/WishBubble.tsx` | second line *will swap* / *gift only* |
| `components/BarnVisitModal.tsx` | one mount point for the tray; `give` becomes `swap(item, take)`; receipt sheet shows both finds; nap card *Leave a find* → *Swap* |
| `components/satchel/SatchelSheet.tsx` | shelf section → "Swapped" (given / received counts, keepsakes); bag tiles show a small `from` mark on received finds |
| `components/Friends.tsx` | row mark hidden when `swapped_today` |
| `components/Inbox.tsx` | a row per swap received (the `satchel_swaps` host side, last 20) |
| `components/Leaderboard.tsx`, `hooks/useLeaderboard.ts` | "N swapped" via `satchel_swaps_for` |
| `utils/tickleBreakdown.ts` + test | `swaps` slice |
| `utils/notificationRouting.ts` | `routeForScreen` gains a `barn` entry (`/`) — `whileAway.ts` delegates to it, and `notificationRouting.test.ts` scans the migrations for every `screen` a server announcement emits, so a missing entry fails the suite (found by the client lane 2026-09-16) |

Taste: tokens and primitives only; the tray is the visit's dialog `Sticker`
with `TILT.dialog`; no new glyphs; copy in the dig-tally voice, host's gain
first.

### 7. Rollout sequence

| step | does | owner | done when |
|---|---|---|---|
| **T0 ratify** | Founder answers the questions in §10; Planner appends the decision-log entry (§11) and the glossary rows | Founder, Fable | entry committed |
| **T1 migration** | §3–§5 + F1/F3/F4/F6 fixes; `00v_swaps_prep.sql` + `95_swaps_smoke.sql` | Opus (server) | `scripts/db-harness/run.sh` green: the existing `90_satchel_smoke` still passes before the drop; the new smoke covers **replay nonce · wish_changed · already_today · option_gone · host_bag_full · not_friends · blocked · two visitors of one host · pair cap → 0 tickles · shelf migration · fulfil_pig_wish alias still answers** |
| **T2 client** | §6 in one PR; tests: `satchel.test.ts` (parsers, options shape), `offerTray.test.tsx` (copy per reason), `BarnVisitSatchel.test.tsx` (tap opens tray, option tap sends `wish_no` + nonce, `option_gone` redraws, `already_today` quiets the strip), `satchelCatalog.test.ts` (F5), `tickleBreakdown.test.ts` | Opus (client) | tests green; `npm run lint` scorecard 0; sim screenshots of tray / receipt / bubble |
| **T3 review** | Fable diffs the migration against the **latest** def of every replaced function (`tickle_breakdown`, `my_satchel`, `friend_wishes`, `fulfil_pig_wish`) — the carry-latest-def footgun — and the client against §5's reason list | Fable | PR comments resolved |
| **T4 push** | Founder "go" → `npx supabase db push --linked`; read-back with `db query --linked`: counts, one `friend_wishes` as demo2, one `fulfil_pig_wish` (alias) as demo2; open **build 190** against the pushed DB — no blank surface | Founder, Fable | prod answers; old binary still fine |
| **T5 two-account run** | demohelper1's wish + bag rigged via `db query --linked` (`set_config(request.jwt.claims)`); the sim as demo: row mark → visit → tray shows three options → swap → helper's bag holds the given find, the sim's the taken one; both breakdowns show +3; while-away line taps to the Barn; Inbox row; *1 swapped* on the Board; second attempt answers `already_today` | Fable + sim | screenshots + `satchel_swaps` row |
| **T6 build** | changelog `docs/builds/YYYY-MM-DD-build-N.md` **before** `eas build --local` (Sentry token sourced, 16 GB heap); Transporter | Founder | TestFlight; one real swap with a real friend |
| **T7 follow-up migration** (after the build that follows) | drop the `satchel_deliveries` view, `satchel_deliveries_for` and `fulfil_pig_wish` aliases | Opus | harness green |

### 8. Risks

| # | risk | mitigation |
|---|---|---|
| R1 | Carry-latest-def regression on `tickle_breakdown` / `my_satchel` / `friend_wishes` | T3 diff against `grep -l … \| tail -1`; the harness runs the whole chain |
| R2 | Build 190 in the wild calls `fulfil_pig_wish`, `friend_wishes` (old shape), `satchel_deliveries_for` | one-build aliases (§4); every client read is fail-soft; T4 opens 190 against the new DB |
| R3 | Two visitors race one host; a find duplicated or lost | advisory lock per host, `FOR UPDATE` on both rows, per-wish uniqueness, nonce replay; the smoke runs two sessions in one stream |
| R4 | Options rule diverges between server and client | one SQL function; client renders what `friend_wishes` returns; `not_offered` logs to Sentry |
| R5 | Alt-account laundering (move rares between own accounts) | swaps mint nothing; finds only come from crew-gated digs; paid tickles capped per pair / per pig / per day; `from_user_id` provenance makes any pattern auditable |
| R6 | The visit modal grows past 2,070 lines | the tray and the hook are their own files; `BarnVisitModal` gets one mount and one callback |
| R7 | Fabric overlay footgun: the tray eats taps on the pigs | the tray mounts in the strip's layer (already above the `box-none` stage), `pointerEvents` on the card only; the sim checkpoint taps both pigs with the tray open |
| R8 | Metro stale watcher lies about `OfferTray` | restart Metro per edit batch; grep the entry bundle for `OfferTray` before trusting a screenshot |

### 9. Deferred (named so it isn't rediscovered)

- **Owner-set ask** (want ×1–3, listed give-backs, holder pushes) — the wider spec §3.1; needs an Ask sheet and a push cap. Layer on `pig_wishes` (add `source`, `qty`, `give_mode`) without touching `satchel_swaps`.
- **Catalog 12 → 30** — 18 glyphs; the F5 test makes it safe.
- **The Stranger / Trading Hut** — needs the charter amendment; `satchel_items.source` and the ledger already give it what it needs.
- **Asking a stranger** (non-friends) — no; `are_friends` stays the gate, the wider spec agrees.

### 10. Questions for the founder (T0)

1. **Ship the swap alone first** (this plan), or the whole finds/swaps/Stranger bundle in one go? This plan assumes alone; the bundle adds the charter amendment, 18 glyphs and a sheep to the critical path.
2. **Options without opt-in?** The server picks ≤3 finds from the host's bag (largest stacks first) with no owner action. The alternative is the owner-set ask (§9), which means nobody can be swapped with until they've filled a form. This plan assumes no opt-in, with the guarantee that a bag is never shown beyond the three.
3. **Tickles on swaps**: flat 3 to both on swaps *and* gifts (assumed, with the pair/day cap), or 3 on gifts only and 0 on swaps (a swap is already its own reward)?
4. **One swap per (giver, host) per UTC day** as the server gate (assumed), or per visit window / per wish only as today?
5. **Received finds count toward `met`** (assumed yes — a swap is how a lone digger meets a rare)?

### 11. Draft decision-log entry (for `SKILL.md`, on ratification)

> **2026-09-1x — Finds swap in the barn; the shelf folds into the bag.** A visitor who hands a friend's pig the find it is hoping for may take one of up to three finds the host's bag can spare — chosen by the server from the host's biggest stacks so a bag is never on show — or just give it. Finds move 1:1 between bags and mint nothing; the flat 3 tickles a delivery already paid stay, capped per pair per day; a generous tick on gifts only; one swap per pair per day. A received find is in your bag — tossable, giveable on, counted toward the catalog — and the shelf retires. "Given, never sold" stands unchanged. Serves **Connect** (a specific reason to visit a specific friend), **Collect** (a swap is how a lone digger meets a rare), **Contend** ("N swapped" on the Board). Spec `docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md` Part 2.

---

## 12. Wire contract (pinned 2026-09-16 — server and client implementers build to this, not to each other)

Founder ruling 2026-09-16: **finds + swaps first; the Stranger bundle later.**
Questions 2–5 of §10 proceed on their stated assumptions.

Migration: `supabase/migrations/20260917100000_satchel_swaps.sql`. Harness:
`scripts/db-harness/00x_satchel_swaps_prep.sql` + `95_satchel_swaps_smoke.sql`,
chained at the tail of `run.sh` after `94_sounder_counter_buys_smoke.sql`.

### Tuning (`app_settings.satchel_tuning`, merged with `||`, compiled fallback in `constants/satchel.ts`)
`"options": 3, "paid_swaps_per_pair_per_day": 3, "paid_swaps_per_pig_per_day": 10` — everything else unchanged.

### `my_satchel()` → jsonb
```
{ ok:true, cap, items:[{id, find_id, source:'dig'|'swap'|'gift'|'migrated_shelf'}], met:[find_id],
  wish:{find_id, wish_no, rolled_at, expires_at, owner_rerolled},
  shelf: [],                       -- always empty; kept one build for build 190
  deliveries: <swaps_given>,       -- kept one build for build 190
  swaps_given:int, swaps_received:int, paid_left_today:int, keepsakes:[int] }
```

### `friend_wishes(p_targets uuid[])` → `{ok, wishes:[…]}`; each entry
```
{ target_id, find_id, wish_no, expires_at, fulfilled_by_me:bool,
  options:[find_id],      -- ≤ options, from _wish_options(target, wish_no); [] = gift only
  swapped_today:bool }    -- the per-pair-per-UTC-day gate already spent
```
`fulfilled_by_me` stays true only for the exact wish_no; `swapped_today` is what the row mark and the strip must honour.

### `_wish_options(p_host uuid, p_wish_no bigint)` → `text[]` (SECURITY DEFINER, revoked from clients)
Host's bag grouped by `find_id`, excluding the host's current wished find; order `count DESC, abs(hashtext(p_wish_no::text || find_id)) ASC`; `LIMIT options`. Deterministic per (wish_no, live bag): the tray only changes when the host's bag does, and `option_gone` is that answer. The client never recomputes it.

### `swap_with_host(p_host uuid, p_item_id bigint, p_take_find text, p_wish_no bigint, p_nonce uuid)` → jsonb
Success:
```
{ ok:true, replay:bool, gave_find_id, took_find_id|null, tickles:int, paid:bool,
  giver_tickled:int, host_tickled:int, swaps_given:int, keepsake:int|null,
  next_wish:{find_id, wish_no, expires_at, …}, bag:[{id, find_id, source}] }
```
Failure `{ ok:false, reason, wish?:{…}, options?:[find_id] }` with reasons, checked in this order:
`not_authenticated` · `bad_nonce` · `invalid_host` · `host_not_found` · `not_friends` · `blocked` · `not_in_bag` · `wish_changed` (+wish +options) · `already_today` (+wish) · `wrong_find` (+wish +options) · `not_offered` (+options) · `option_gone` (+options) · `host_bag_full`.
A replayed nonce returns the original success receipt with `replay:true` (built from the ledger row; `bag` is the live bag). Effects and lock order per Part 2 §5. Generous tick on gifts only. `tickles` is 0 and `paid:false` when either daily paid cap is spent — the swap still happens.

### Compat aliases (one build)
- `fulfil_pig_wish(p_host, p_item_id)` → `swap_with_host(p_host, p_item_id, NULL, <live wish_no of host>, gen_random_uuid())`, and on success also returns `find_id` (= gave_find_id), `deliveries` (= swaps_given), `bag_count` (= array_length(bag)). Failure reasons map: `already_today` → `already_fulfilled` (build 190 knows that one).
- `satchel_deliveries_for(p_targets)` → same answer as `satchel_swaps_for`.
- `satchel_deliveries` becomes a VIEW over `satchel_swaps` (columns id, giver_id, host_id, wish_no, find_id, created_at).

### `satchel_swaps_for(p_targets uuid[])` → `{ok, counts:{id: n}}` — gifts + swaps given.

### `my_satchel_swaps(p_limit int DEFAULT 20)` → `{ok, swaps:[…]}` newest first, both sides
```
{ id, direction:'given'|'received', partner_id, partner_username, partner_discriminator,
  gave_find_id, took_find_id|null, tickles, created_at }
```
(`gave`/`took` are always from the GIVER's point of view.)

### `tickle_breakdown` — carried from `20260803010000`, one new lane `swaps` = `SUM(tickles)` over `satchel_swaps` rows where the user is giver or host and `created_at > boundary`. Residual unchanged for a user with no swaps.

### While-away line (inlined INSERT into `system_announcements`)
kind `satchel_swap`, title `Your pig got a wish!`, body `<giver> swapped your pig the <find> it was hoping for and took the <find>.` / `<giver> brought your pig the <find> it was hoping for.` (gift), `data: {screen:"barn", find_id, took_find_id, giver_id}`.

### Client nonce
No uuid library and no native crypto module in the binary: build a v4-shaped uuid from `Math.random` (`utils/satchel.ts` `newSwapNonce()`); it is an idempotency key, not a secret. One nonce per tray-tap; a retry after a network failure reuses the same nonce.
