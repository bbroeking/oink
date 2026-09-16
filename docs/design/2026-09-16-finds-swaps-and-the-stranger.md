# Finds, Swaps and the Stranger — spec (proposal, 2026-09-16)

Status: **proposal, unratified.** Rewrites the find system shipped in build 185
(`docs/satchel-spec.md`, migration `20260915010000_satchel.sql`) and amends two
charter rulings (§0). Nothing here is built.

**One line:** *Digs fill your Satchel; your pig asks for one find and says what
it will swap; friends fill the ask on a visit and take one of three things back;
a hooded sheep at the hedge takes three of a kind for tickles.*

Pillars: **Collect** owns the catalog (30 finds, three rarities, families that
fill in as silhouettes lift). **Connect** owns the swap — every trade is two
pigs in one barn, and "you have what Maple's pig is asking for" is the reason to
visit *that* friend today. **Contend** owns the Stranger — the only place a find
turns into tickles, and tickles are the race.

---

## 0 · What this amends, and why it still passes the lens

Two rulings in `SKILL.md` stand in the way and are amended, not ignored:

| ruling (2026-09-14) | amendment | why it still holds up |
|---|---|---|
| *Satchel finds are given, never sold or paid for … never a currency of any kind.* | Finds are still never sold for Snouts and never bought. The **Stranger** pays *applied tickles* (`apply_tickles`: `tickles_earned` + `counter`, never the bank) for three of a kind — the same kind of number a dig find already pays since 2026-09-13. | The 09-13 ruling already made "everything you dig up pays tickles". A find is a *deferred* dig payout with a social step in the middle. No Snouts, no Golden Truffles, no bank. The faucet is bounded by dig cadence (§7). |
| *Rolled wishes, not a picker; a request economy takes.* | The pig still rolls a wish when the player hasn't said anything. The player may **set the ask** — one find, ×1–3 — and must say what they'll give back. | A request that names what it pays is a *swap*, not a take. The rolled wish survives as the default and as the pig's own voice ("Rosie fancies a pinecone"). |

Decision-lens check:

1. **Pillar** — all three, each owning one noun (find / swap / Stranger).
2. **One sentence** — the line at the top. Three nouns, no chain: find → swap → tickles is the whole depth. There is no fourth thing a find can become.
3. **Fair by construction** — swaps are pure 1:1 transfers that mint nothing; the only mint is the Stranger, server-priced, per-day capped, sourced from digs that are already crew-gated and once-per-feeding.
4. **Losing feels warm** — no ask is ever refused publicly, a full bag says what stayed in the mud, a filled ask is a gift on the while-away card, and the Stranger never says no — only "enough for today".
5. **Art pipeline** — one new sprite family (one sheep, five animations) and 18 new find glyphs, all one-shot ImageGen lanes we already run (§9).

---

## 1 · Vocabulary (technical → cozy)

| code | on screen | meaning |
|---|---|---|
| `find` | a find | one of 30 pocketable countryside objects |
| `satchel` / stack | the Satchel | the capped bag; same finds group into a stack with a count |
| `ask` | *what your pig is asking for* | the one live request per pig: `want` ×`qty`, plus what it will `give` |
| `rolled` ask | *Rosie fancies…* | the server-rolled default when the player has set nothing (the old Wish) |
| `swap` | a swap | a filler hands the asker their want and takes one of the asker's offered finds |
| `gift` | *just give it* | a swap that takes nothing back (the old Delivery) |
| `options` | *Maple's pig will swap…* | the up-to-three finds the filler may take |
| `match` | *you have it* | a friend's ask you can fill from your bag |
| `trader` | **the Stranger** | the hooded sheep at the hedge; three of a kind for tickles |
| `trader_want` | *today the Stranger fancies…* | the day's find that pays double |

`Wish`, `Delivery` and `pig_shelf` retire (migration in §4.6). The word *trade*
stays out of the UI — it belongs to the legacy `tickle_trades` (the Exchange)
and would collide.

---

## 2 · The find system, widened

### 2.1 The catalog: 12 → 30, in five families

Rarity still lives in the catalog, never in a payout. Families exist so the
Satchel sheet's "Every find" page reads as shelves that fill in, and so the
Stranger's daily want can be spoken ("something from the riverbank").

| family | common (20) | uncommon (7) | rare (3) |
|---|---|---|---|
| **Riverbank** | river pebble · snail shell · glass marble* · fish scale · driftwood twig | old key* · blue bottle-glass | — |
| **Hedgerow** | blue feather · four-leaf clover · red berries · pinecone · acorn cap · thistle head | honeycomb chip* · robin's egg (empty) | tin whistle* |
| **Farmyard** | brass button · tuft of wool · horseshoe nail · corn kernel · milk-bottle top | copper penny | — |
| **Attic** | chipped teacup · marble knight · red ribbon | pocket-watch face · music-box key | glass eye |
| **Wild** | — | — | fox-tooth charm |

`*` = one of the twelve shipped finds, re-homed into a family; the other eight
of the twelve keep their ids and gain a family. (The marble's tier drops
uncommon → common; nothing of a player's changes but the silhouette shelf it
sits on.) New ids in `constants/satchel.ts` mirror `satchel_finds`; glyphs go
through the same `assets/images/glyphs/finds/` lane as the first twelve.

### 2.2 What a dig drops

| | shipped | proposed |
|---|---|---|
| finds per submitted dig | 0 / 1 / 2 at 30 / 50 / 20 % | **1 / 2 / 3 at 30 / 50 / 20 %** — every dig drops at least one |
| rarity roll | 70 / 25 / 5 | 70 / 25 / 5, unchanged in v1 (layer bias deferred — §12) |
| bag cap | 6 | **12** (server-tuned) |
| overflow | discarded, receipt says what stayed in the mud | same |

Expected supply per active pig: ~1.9 finds/dig × up to 3 feedings/day ≈ **6
finds/day at the ceiling, ~3 typical**.

### 2.3 Why trading is necessary, not optional (the balance argument)

Twenty commons and a bag of twelve: a digger who never tosses fills the bag
with singletons and stalls. A digger who **curates** (hold-to-Toss the singles
they aren't collecting) gets there alone, slowly; friends roughly double the
pace. `tools/balance_finds.py` (Monte Carlo, 2 feedings/day, curating tosses,
each pig asking for its most-held find and offering anything):

| catalog | alone | 2 friends | 4 friends | 7 friends | swaps/pig/day @4 |
|---|---|---|---|---|---|
| 20 (14/4/2) | 2.6 days/set | 1.3 | 1.1 | 1.0 | 0.64 |
| **30 (20/7/3)** | **3.3** | **1.9** | **1.4** | **1.1** | **0.63** |
| 45 (32/10/3) | 4.9 | 2.8 | 2.1 | 1.4 | 0.43 |

Thirty is the size where a social pig sells a set **every day or two** and
the friendless pig **every three** — the feeding cadence, not a grind — while
a swap visit happens most days. That is the loop: **dig → ask → swap → set →
Stranger**, and the middle two steps are visits.

---

## 3 · The three flows

### 3.1 Ask — "request wool"

The Satchel sheet (Barn button's fan → *Satchel · 7 of 12 finds*) leads with
the pig's speech bubble. Two states:

- **Rolled** — *"Rosie fancies a pinecone."* The 48-hour reroll and the one
  free *Not this one* stay exactly as shipped. This is what every pig shows
  until its owner speaks.
- **Set** — the player taps the bubble → **Ask sheet**:
  1. **What?** the 30-find catalog as a chip grid; silhouettes (not yet met)
     are pickable too — you can ask for a thing you've never held, and the
     journal fills in when it arrives. Finds already in the bag show their count.
  2. **How many?** ×1 · ×2 · ×3 (defaults to what completes a set: bag holds
     one wool → ×2).
  3. **What will you swap?** *Anything in my bag* (default) or *Let me pick* →
     the bag's stacks as toggles. The wanted find itself is never offerable.
  4. *Ask* → `set_my_ask`. The bubble now reads *"Wool ×2 — I'll swap anything."*

Changing or clearing the ask is free and instant; each change bumps `ask_no`
(the idempotency key of every fill, §4.2). An ask with nothing offerable —
listed finds all gone, or an empty bag on *anything* — renders on friends'
screens as **gift only** ("just give it" is the sole option), never disappears.

### 3.2 Match — "you have it"

Discovery is **holder-driven**: the asker never sees who holds their want; the
holder sees whose ask they can fill.

- **Friends row mark** (shipped surface, kept): the asked find's art + *you
  have it* when the bag holds it and this pair hasn't exhausted the ask.
- **Swaps segment** on the Satchel sheet: every friend you can help, one row
  each — pig, name, *asking for wool ×2*, the three option glyphs the tray will
  show. Tap → their Barn opens in **swap mode** (§3.3). Sorted: Sounder-mates
  first, then by visit streak.
- **One push per (ask, holder)**: *"Maple's pig is asking for wool — you have
  one."* Sent at ask time via `send_push_to_user` to friends whose bag holds it
  (max 5 holders, Sounder first), never repeated for the same `ask_no`, and
  **at most two ask pushes per holder per UTC day** — TTP has no push
  preference or quiet-hours layer (only the feeding push has its own opt-in),
  so the cap is the courtesy.
- Nothing about your bag is visible to anyone except the ≤3 options you've
  offered, and only to a friend who is about to fill your ask.

### 3.3 Swap — a barn visit *is* the trade flow

The visit screen keeps its 2026-09-12 shape (plaque · status row · scene ·
strip · one pill). Two changes:

1. The **thought bubble** over the host pig shows the ask: find art, ×N when
   more than one remains, and a tiny *anything* / *3 things* hint.
2. Tapping a **lifted find** in the strip no longer fires the server. It opens
   the **offer tray** — a Sticker card rising from the strip:

   > *Maple's pig will swap for your wool:*
   > [ old key ] [ river pebble ×3 ] [ acorn cap ]
   > *…or just give it.*

   Tap an option → `swap_with_host(host, my_item_id, take_find_id, ask_no,
   nonce)`. Tap *just give it* → same call with `take_find_id = null`.

**Options** are chosen server-side and frozen per `ask_no` so the tray is the
same three things on every refresh: if the asker listed finds, the first three
listed that the bag still holds, in the asker's order; if *anything*, the
asker's **largest stacks first** (duplicates are what an asker values least),
ties broken by a hash of `ask_no` — so a filler can't shuffle for a better
tray, and the asker never leaks a whole bag.

**Ceremony**: host pig `surprise` → `happy`, guest pig `happy`; the taken find
flies from the tray into the strip; receipt sheet in the dig-tally voice:
*"Swapped — Maple's pig got the wool it was asking for; you took the old key.
You both got 3 tickles."* A gift reads *"…you gave it away. You both got 3
tickles, and a generous tick."*

The host, on return, gets the while-away line: *"Jen swapped your pig the wool
it asked for and took the old key."* Inbox keeps the row.

Rules carried from the shipped visit: the host pig is the only tickle target;
the swap works after the tickles are spent and from the nap card (*Leave a
find* → *Swap*); swap mode never opens a barn against the visit window — a
row from the Swaps segment enters a **swap-only visit** (no tickle taps, the
pig dozes) when the window is spent, and a normal visit otherwise.

### 3.4 The Stranger — three of a kind for tickles

A hooded sheep at the hedge on the Exterior — right edge, behind the fence
line, on every background, facing Rosie (§9). **It is there only when it has
business with you**: the bag holds a stack of three (or more) and you have
sets left today. It walks in from the right edge when the first set completes
(a dig receipt, a swap), takes the sets you hand it, and wanders off when none
remain or the day's three are sold. The rest of the time the yard is Rosie's
— the same rule as the buried-truffle mound (2026-09-13: the home is Rosie's
stage, two corners and one button; the mound and the Stranger are yard
*states*, not fixtures). No schedule, no clock to hold: the sheep appearing
**is** the notice that you have a set. What it fancies changes at 00:00 UTC.

Tap → **Stranger sheet**:

> *"Three of a kind, little pig. Today I fancy honeycomb."*
> [bag as stacks; stacks of ≥3 lifted, others dimmed with "×2 — one more"]
> *2 of 3 for today*

Tap a lifted stack → confirm pill *Hand over 3 river pebbles · +5 tickles* →
`trade_with_stranger(find_id, nonce)` → the sheep's `take` animation, the
coin's count-up tally (the dig's pattern: *38 before → 43 tickled now*).

| rarity | tickles per set | day's want (×2) |
|---|---|---|
| common | 5 | 10 |
| uncommon | 12 | 24 |
| rare | 30 | 60 |

**Per pig per UTC day: 3 sets** (server-tuned). Selling the third set plays
the `shake` and the sheep walks off; the Satchel sheet's set-ready tag then
reads *"the Stranger's had enough for today — back at midnight"* — never a
refusal of *you*, a refusal of *more*. The day's want is one find, rolled
server-side from a date seed, weighted toward commons (so the herd can
actually hit it), never the same two days running. Once a pig has met the
Stranger it shows in the Field Guide's entry and as a line on the Satchel
sheet, so "it's honeycomb day" is a text message; before the first meeting
there is no line — the first arrival is a discovery, and the Field Guide
silhouette lifts on the first sale.

What the Stranger never does: buy singles, buy mixed threes, sell anything,
pay Snouts, or appear on a visit screen (it is *your* hedge).

---

## 4 · Data models

All state is Postgres in the `public` schema, RLS-closed with zero client
policies except the read-only catalog; every mutation is a `SECURITY DEFINER`
RPC. Tuning lives in `app_settings` with a compiled fallback (the server-config
rule) and every number below is a default, not a constant.

### 4.1 Catalog — `satchel_finds` (extended)

```sql
ALTER TABLE public.satchel_finds
  ADD COLUMN family  text NOT NULL DEFAULT 'hedgerow'
    CHECK (family IN ('riverbank','hedgerow','farmyard','attic','wild')),
  ADD COLUMN retired boolean NOT NULL DEFAULT false,   -- never rolled, still tradable
  ADD COLUMN flavor  text;                              -- one whimsy line for the journal
-- + 18 INSERTs, + UPDATE family on the twelve, + marble → common.
```

### 4.2 Bag — `satchel_items` (unchanged) + a stack view

Row-per-item stays the source of truth (provenance: `found_window_index`,
`created_at`, and now `source` ∈ `dig | swap | gift | migrated_shelf`). Stacks
are an aggregate, never a table:

```sql
CREATE VIEW public.satchel_stacks AS
  SELECT user_id, find_id, count(*) AS count, min(created_at) AS oldest_at
  FROM public.satchel_items GROUP BY user_id, find_id;
```

Consumption is always **oldest first** (`ORDER BY created_at, id … FOR UPDATE
SKIP LOCKED` is *not* used — a swap must fail loudly, not skip).

### 4.3 Ask — `pig_asks` (replaces `pig_wishes`)

```sql
CREATE TABLE public.pig_asks (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  want_find_id   text NOT NULL REFERENCES public.satchel_finds(id),
  qty_wanted     int  NOT NULL DEFAULT 1 CHECK (qty_wanted BETWEEN 1 AND 3),
  qty_filled     int  NOT NULL DEFAULT 0 CHECK (qty_filled >= 0 AND qty_filled <= qty_wanted),
  give_mode      text NOT NULL DEFAULT 'any' CHECK (give_mode IN ('any','listed')),
  give_find_ids  text[] NOT NULL DEFAULT '{}',          -- only read when give_mode='listed'
  source         text NOT NULL DEFAULT 'rolled' CHECK (source IN ('rolled','set')),
  ask_no         bigint NOT NULL DEFAULT 1,             -- monotonic per profile; the fill key
  rolled_at      timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz,                           -- rolled asks only (48h); NULL when set
  owner_rerolled boolean NOT NULL DEFAULT false,        -- the one free "not this one" per rolled ask
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pig_asks_want_not_offered CHECK (NOT (want_find_id = ANY (give_find_ids)))
);
```

`ask_no` bumps on: set, clear, reroll, timeout, and on the fill that reaches
`qty_wanted` (after which the row is re-rolled as `source='rolled'`). A
partially filled set-ask keeps its `ask_no` — a second friend can bring the
second wool against the same key; the `(giver, asker, ask_no)` uniqueness in
§4.4 is therefore **per unit**, not per ask.

### 4.4 Swaps — `satchel_swaps` (replaces `satchel_deliveries`)

```sql
CREATE TABLE public.satchel_swaps (
  id             bigserial PRIMARY KEY,
  nonce          uuid NOT NULL UNIQUE,                  -- client idempotency
  giver_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asker_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ask_no         bigint NOT NULL,
  unit_no        int  NOT NULL,                         -- 1..qty_wanted at fill time
  gave_find_id   text NOT NULL REFERENCES public.satchel_finds(id),
  took_find_id   text REFERENCES public.satchel_finds(id),   -- NULL = gift
  giver_tickles  int  NOT NULL DEFAULT 0,               -- 0 when the pair's daily paid cap is spent
  asker_tickles  int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT satchel_swaps_not_self CHECK (giver_id <> asker_id),
  CONSTRAINT satchel_swaps_one_per_unit UNIQUE (giver_id, asker_id, ask_no, unit_no)
);
CREATE INDEX satchel_swaps_giver_day ON public.satchel_swaps (giver_id, created_at DESC);
CREATE INDEX satchel_swaps_asker_day ON public.satchel_swaps (asker_id, created_at DESC);
```

The tickle breakdown (2026-07-17 glass box) has **no ledger table** — each
lane is summed from its source table and `home_taps` is the residual
(`tickle_breakdown`, latest def `20260803010000`). So this table *is* the
swaps lane: `SUM(giver_tickles) WHERE giver_id = p_user` + `SUM(asker_tickles)
WHERE asker_id = p_user`, carried into a new `tickle_breakdown` def from the
latest base (the carry-latest-def footgun). The existing *trades* slice keeps
meaning the Exchange. (Today's delivery and dig-find tickles already fall
into the residual — this migration gives the swap side a real lane.)

### 4.5 The Stranger — `trader_days` + `trader_sales`

```sql
CREATE TABLE public.trader_days (
  day           date PRIMARY KEY,                       -- UTC
  want_find_id  text NOT NULL REFERENCES public.satchel_finds(id),
  multiplier    numeric NOT NULL DEFAULT 2
);
-- Materialised lazily by _trader_today(): first reader of a day inserts it
-- (ON CONFLICT DO NOTHING) from a seeded roll, so every client sees one truth.

CREATE TABLE public.trader_sales (
  id           bigserial PRIMARY KEY,
  nonce        uuid NOT NULL UNIQUE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day          date NOT NULL,
  find_id      text NOT NULL REFERENCES public.satchel_finds(id),
  qty          int  NOT NULL DEFAULT 3 CHECK (qty = 3),
  tickles      int  NOT NULL CHECK (tickles >= 0),
  was_want     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trader_sales_user_day ON public.trader_sales (user_id, day);
```

Tickle breakdown lane **stranger** = `SUM(tickles) FROM trader_sales WHERE
user_id = p_user AND created_at > boundary`, in the same carried def.

### 4.6 Retired + migrated

- `pig_wishes` → `pig_asks` (`INSERT … SELECT`, `source='rolled'`, ask_no carried).
- `satchel_deliveries` → `satchel_swaps` (`took_find_id = NULL`, `unit_no = 1`, tickles as recorded).
- `pig_shelf` → each `(user, find, count)` becomes `count` rows in
  `satchel_items` with `source='migrated_shelf'`, up to the new cap of 12;
  any overflow is dropped. In practice this is nothing: prod on 2026-09-16
  holds **one** shelf item and one delivery (build 185 is two days old), so
  no line, no ceremony — the find is simply in the bag. The table is dropped.
- `satchel_met` and `satchel_keepsakes` unchanged; the keepsake count now
  counts **gifts + swaps given** (the giver's side), thresholds unchanged.

### 4.7 Tuning — `app_settings`

```jsonc
// satchel_tuning (extends the shipped row)
{"cap": 12,
 "find_odds": {"one": 0.30, "two": 0.50, "three": 0.20},
 "rarity_weights": {"common": 70, "uncommon": 25, "rare": 5},
 "wish_reroll_hours": 48,
 "tickles": 3,                       // per pig per paid swap or gift
 "paid_swaps_per_pair_per_day": 3,   // beyond this a swap still happens, unpaid
 "paid_swaps_per_pig_per_day": 10,
 "options": 3,
 "ask_push_max_holders": 5,
 "keepsake_thresholds": [10, 50, 100]}

// trader_tuning (new row)
{"sets_per_day": 3,
 "set_size": 3,
 "tickles_by_rarity": {"common": 5, "uncommon": 12, "rare": 30},
 "want_multiplier": 2,
 "want_rarity_weights": {"common": 80, "uncommon": 18, "rare": 2}}
```

Compiled fallbacks: `constants/satchel.ts` (extended) and a new
`constants/trader.ts`; the config cell in `utils/satchel.ts` grows a sibling
`utils/trader.ts`.

---

## 5 · Server surface

| RPC | who | does |
|---|---|---|
| `my_satchel()` | owner | bag as stacks (with `oldest_at` and `set_ready` per stack), the ask, `met` list, keepsakes, **today's Stranger** (`met`, want — only once met —, sets sold today, cap; the client derives presence from `set_ready ∧ sets_left`), and the paid-swap headroom for today |
| `set_my_ask(p_find, p_qty, p_give_mode, p_give_finds)` | owner | validates, bumps `ask_no`, clears `qty_filled`, `source='set'`, `expires_at=NULL`; fans out the holder push |
| `clear_my_ask()` | owner | rolls a fresh `rolled` ask (bumps `ask_no`) |
| `reroll_my_wish()` | owner | kept — the one free reroll on a `rolled` ask |
| `friend_asks(p_targets uuid[])` | any | per friend: the ask (want, qty remaining), `you_have`, the frozen options preview, `pair_paid_left`. Omits blocked/unfriended; hides asks whose `qty_filled = qty_wanted` |
| `my_matches()` | any | the Swaps segment: every friend whose ask the caller can fill, sorted |
| `swap_with_host(p_host, p_item_id, p_take_find, p_ask_no, p_nonce)` | visitor | the trade or gift (§6.2) |
| `trader_today()` | any | `{day, want_find_id, multiplier, sets_sold, sets_cap}` |
| `trade_with_stranger(p_find, p_nonce)` | owner | three of a kind → tickles (§6.3) |
| `satchel_swaps_for(p_targets)` | any | counts for the Board's *N swapped* slice |
| trigger `rooting_receipts_roll_satchel` | dig | rewritten for 1–3 finds + layer bias; still a BEFORE INSERT trigger on `rooting_receipts`, still leaves the 470-line submit core alone (the carry-latest-def footgun) |

Reads are fail-soft on the client exactly as today: a server without these
functions means no bubble, no tray, no sheep.

---

## 6 · Server-side validation rules

### 6.1 Every mutation

- `auth.uid()` present; `p_nonce` is a well-formed uuid; a replayed nonce
  returns the **original receipt** (`ok:true, replay:true`), never a second
  effect.
- All amounts, caps and odds read from tuning **inside** the transaction; the
  client sends none of them.
- Unknown or `retired` find ids in an *ask* → `unknown_find` / `retired_find`
  (retired finds may still be swapped and sold — a player who holds one keeps
  its uses).

### 6.2 `swap_with_host`

Order matters; each check is answered by name so the client can say something
honest, and the whole thing runs under
`pg_advisory_xact_lock(hashtext('ask:' || p_host))` so two fillers of one ask
serialise.

1. `p_host ≠ uid`, host exists → else `invalid_host` / `host_not_found`.
2. `are_friends` and not `are_blocked` → `not_friends` / `blocked`.
3. The giver's item: `SELECT … FROM satchel_items WHERE id = p_item_id AND user_id = uid FOR UPDATE` → `not_in_bag`.
4. The host's ask row `FOR UPDATE`; `ask_no` must equal `p_ask_no` → else
   `ask_changed` with the live ask (client redraws bubble + tray).
5. `qty_filled < qty_wanted` → else `ask_filled` (someone got there first).
6. `item.find_id = ask.want_find_id` → else `wrong_find` with the live ask.
7. `unit_no := qty_filled + 1`; the `(giver, asker, ask_no, unit_no)` unique
   makes a double submit answer `already_filled`.
8. If `p_take_find` is not null:
   - it must be in the **frozen options** for this `ask_no` (recomputed
     server-side from the same deterministic rule — never trusted from the
     client) → else `not_offered`;
   - the host must still hold one: oldest `satchel_items` row for
     `(host, take_find)` `FOR UPDATE` → else `option_gone` **with fresh
     options** (the tray redraws; the giver's find has not moved).
   - The swap is 1:1, so neither bag's count changes — no cap check.
9. If `p_take_find` is null (gift): the host's bag must have room
   (`count < cap`) → else `host_bag_full` (the ask stays open; the client
   says *"Maple's bag is full — try the swap instead"*).
10. Move: giver's row → host (`user_id`, `source='swap'|'gift'`, `created_at=now()`);
    host's option row → giver (`source='swap'`). Rows move; they are never
    deleted-and-reinserted, so provenance survives.
11. Tickles: if the pair's paid swaps today < `paid_swaps_per_pair_per_day`
    **and** the giver's paid swaps today < `paid_swaps_per_pig_per_day`, both
    get `tickles` via `apply_tickles` (the swap row itself is the ledger);
    else both get 0 and the receipt says *"(no tickles — you two have swapped
    plenty today)"*. Happiness (giver 1.0 · host 0.25), the giver's generous
    tick **on gifts only**, the pair visit-streak credit, and the keepsake
    threshold check follow the shipped delivery code paths.
12. `qty_filled += 1`; if it now equals `qty_wanted`, roll a new `rolled` ask
    excluding the find just received and bump `ask_no`.
13. While-away line for the host; push to the host (rate-limited with the
    existing visit push).

### 6.3 `trade_with_stranger`

Under `pg_advisory_xact_lock(hashtext('trader:' || uid))`:

1. `find_id` known (retired allowed).
2. `sets sold today (UTC, tx now())` < `sets_per_day` → else `enough_for_today` with `resets_at`.
3. Exactly `set_size` oldest rows for `(uid, find)` locked `FOR UPDATE`; fewer → `short_stack` with the real count (the sheet dims the stack to *×2 — one more*).
4. Price from tuning by rarity; `was_want` when `find = trader_days.want_find_id` for the tx day; multiply.
5. Delete the three rows, insert `trader_sales` (the ledger), `apply_tickles`, Field Guide *met* for the Stranger on first sale.
6. Return the tally: `{before, after, tickles, was_want, sets_left}`.

### 6.4 `set_my_ask`

- `qty ∈ [1,3]`; `give_mode='listed'` requires 1–12 distinct known find ids
  not equal to `want`; `give_mode='any'` ignores the list.
- No cooldown on changing — but the push fan-out is **once per `ask_no`
  per holder**, and the paid-swap caps make ask-flipping worthless (§8).
- The ask is not required to be fillable: an empty bag can ask (gift only).

### 6.5 Dig trigger

- Rolls `1 | 2 | 3` by `find_odds`, each find by rarity weights. (The stored
  `rooting_receipts.receipt` does not carry the layer reached — adding it means
  editing the 470-line submit core, so the layer bias waits, §12.)
- Inserts up to `cap - held`; the rest is listed under `lost`. The roll always
  runs so a full bag still writes `satchel.found` for the receipt line.

---

## 7 · Economy bounds (why this can't run away)

- **Supply** ≤ 3 finds × 3 feedings = 9/day, realistically ~3–6. Digs are
  crew-gated and once per feeding; nothing else makes a find.
- **Swaps mint nothing.** 1:1 transfers; the only tickles are the flat 3 per
  pig, capped at 3 paid swaps per pair per day and 10 per pig per day → at most
  **30 tickles/day** from swapping, and that requires ten friends with matching
  asks. A visit tap already pays ~1; a dig pays 3–25 per find.
- **The Stranger** ≤ 3 sets/day × (rare 30 × 2) = **180/day** absolute
  ceiling, which needs nine rares in a day (rare odds 5 %, ~6 finds/day → one
  rare every ~3 days). Typical: 1 common set/day ≈ **5–10 tickles**. Against
  the weekly purse and the dig tally this is a garnish, not a faucet — which
  is the point: the Stranger is there so a set *means* something, not so
  anyone plays for it.
- **No arbitrage loop**: Stranger is one-way (finds → tickles), tickles are
  not spendable, and nothing sells a find.

---

## 8 · Edge cases

| case | rule |
|---|---|
| **Partial stack** at the Stranger (2 of 3) | `short_stack`; the sheet shows *×2 — one more*; the Ask sheet's default qty becomes 1 for that find |
| **Partial ask** (×3, one filled) | same `ask_no`; the bubble shows *×2 left*; a giver who filled unit 1 may fill unit 2 (`unit_no` differs) |
| Option **gone** (asker tossed / swapped it between tray and tap) | `option_gone` + fresh options; nothing moved; tray redraws with a *"Maple's pig changed its mind"* line |
| Asker's give-list **all gone** | ask renders gift-only; `friend_asks.options = []` |
| Asker **changes ask** while a visitor has the tray open | `ask_changed` + live ask; bubble and tray swap; no move |
| **Ask filled by someone else** a moment earlier | `ask_filled`; the bubble shows the pig's next (rolled) fancy under *next time* |
| **Two fillers at once** | advisory lock on the asker; second sees `ask_filled` or takes `unit_no+1` if qty remains |
| **Retry / double tap** | `nonce` unique → original receipt, `replay:true` |
| **Gift to a full bag** | `host_bag_full`; the ask stays; the client suggests the swap |
| **Giver's own bag full** | never blocks a 1:1 swap; blocks nothing at the Stranger (bag shrinks) |
| **Unfriended / blocked mid-visit** | `not_friends` / `blocked`; the find stays put; the visit screen's existing refusal toast |
| **UTC midnight mid-Stranger-tap** | the tx `now()` decides the day; `trader_today()` is re-read on every sheet open; a sale answered with a new `day` redraws the want |
| **Want-of-the-day rolls a find nobody holds** | tolerated — `want_rarity_weights` is 80 % common; the seed is deterministic so a stale client and the server agree |
| **Cap lowered by tuning** below a bag's size | nothing enters until under cap; swaps still work (1:1); Stranger still works |
| **Catalog find retired** | never rolled as a find, an ask or a want; still swappable and sellable; silhouette stays on the journal shelf |
| **Client with the old 12-find catalog** | unknown ids render as the *unknown find* glyph; `set_my_ask` with an id the client can't render is impossible (the grid is server-fed) |
| **Season rollover** | bag, ask, swaps, sales persist; `tickles_earned` resets as it always does |
| **Alt accounts** | swaps mint nothing to move; each alt's finds come from its own crew-gated digs; the per-pair and per-pig paid caps bound the 3-tickle sweetener; a pair that only ever swaps with each other looks exactly like two friends, which is fine |
| **Ask-flipping to farm pushes/tickles** | pushes once per `ask_no` per holder and capped at 5 holders; tickles per pair capped per day; changing an ask costs the qty progress |
| **Tray-shuffling for a better option** | options are a pure function of `(ask_no, asker's bag)`; refreshing shows the same three until the asker's bag changes |
| **Server without the feature** | every read fail-soft: no bubble, no Swaps segment, no sheep at the hedge, dig receipt without the satchel line |
| **Shelf migration overflow** | impossible at today's data (1 item in prod); the rule is still "drop past cap 12" and the swap ledger keeps the count |
| **Stranger presence is stale** (set completed on another device, or sold from another device) | presence is derived client-side from `my_satchel().stacks[].set_ready` ∧ `stranger.sets_left > 0`, refreshed on focus and after every dig receipt / swap receipt; a tap on a sheep the server no longer honours answers `short_stack` / `enough_for_today` and the sheep walks off |
| **Set completes while the Exterior is off-screen** | the sheep is already there on return — the walk-in plays only when the state flips while the yard is visible |

---

## 9 · Art direction — the Stranger

**Who.** A hooded sheep. Fleece the cream of Rosie's palette family, a dusky
hood (a faded indigo — the one cool colour on the Exterior) that hides the
eyes entirely; only the muzzle, a nose, and two ear-tips poking through the
hood read. A small satchel slung across the chest, the strap the same brass
as the button find. No face is ever shown: the mystery is a silhouette rule,
not a lore beat. Never named on screen; the plaque says *the Stranger*.

**Style lock.** Same lane as every pig (memory: *pig animation family
pipeline*): Codex ImageGen, style + camera anchored on
`assets/images/sprites/rosie/idle_1.png`, body reference a sheep in Rosie's
proportions (chunky, three-quarter, hooves on the baseline, no ground disc),
4×N grid on flat magenta `#FF00FF`, wide gutters, same size and camera in
every cell. Slice with `scripts/pig-tweens/slice_sheet.py` onto the 370×383
canvas; `strip_ground_disc.py` + `strip_foot_specks.py`; a fleece-band
normaliser sibling of `normalize_body_pink.py` (`normalize_body_cream.py`,
one Lab shift per frame onto the idle family's band mean). Palette hexes go
*in the prompt*, not "same colours as reference".

**Not a pig.** `PigId` is the six-pig union bound by `Record<PigId, …>` into
the Rive contract, `PigPortrait`, the Pen and the companion picker; adding
`trader` there would put a sheep in every pig picker. The Stranger gets its
own frame map (`constants/strangerFrames.ts`) and its own small cycler inside
`components/StrangerAtHedge.tsx` — the `_neutral` / lounge-sprite precedent —
and never passes through `PigStage`. No cosmetic anchors: nothing is ever worn
by the Stranger.

**Families** (4 frames each unless noted):

| family | beats | used for |
|---|---|---|
| `idle` (12) | breath in / hold / out, hood sway, one ear twitch, one strap shift — no blink (no eyes) | at the hedge, sheet open |
| `walk` | four-step cycle, right-facing and mirrored | arriving from / leaving to the right edge (the lounge walk-strip lane) |
| `take` | hoof out, palm up → closes → tucks into the satchel; ends on a slow dip of the hood | a set accepted |
| `shake` | one slow head shake, hood stays | `short_stack`, `enough_for_today`, and the exit beat |
| `face` | three-quarter turn toward Rosie (the 2026-09-15 turn family) | resting on the Exterior, since it faces her |

It stands where the Exterior already has a right-edge rule (the barn owns the
left): behind the fence, feet on Rosie's ground plane, `pointerEvents` on the
sprite only — the full-screen layer stays `box-none` (the Fabric overlay
footgun). It is a conditional yard element like `BuriedMound` — a
`components/StrangerAtHedge.tsx` that mounts on `set_ready ∧ sets_left`, walks
in on mount when the yard is visible, and walks out on unmount. Tapping it
opens the sheet with a `HabitatDoorTransition`-tempo rise, not a modal.

**Find glyphs.** Eighteen new painted glyphs through the same lane and
placement as the first twelve (`assets/images/glyphs/finds/`); a family
watermark on each journal shelf (a reed, a hawthorn sprig, a horseshoe, a
cobweb, a paw print) painted once.

**Copy.** The Stranger speaks in short trades-talk, never explains, never
thanks. Lines rotate from a small server list so the sheet isn't identical
twice: *"Three of a kind, little pig."* · *"Sets. Only sets."* · *"Honeycomb
today. Don't ask why."* · *"Enough. Come back when the moon's moved."*

---

## 10 · UI/UX inventory

| surface | change |
|---|---|
| **Dig receipt** | *"your Satchel got heavier: a river pebble, a tuft of wool"*; full: *"…and the pinecone stayed in the mud"* — one line, glyphs inline |
| **Barn button fan** | *Satchel · 7 of 12 finds*; a small dot when a stack is set-ready or a match exists |
| **Satchel sheet** | segments **Bag · Swaps · Every find**; the ask bubble pinned above all three; Bag shows stacks with counts, set-ready stacks lifted with a Stranger tag; hold-to-Toss stays |
| **Ask sheet** | §3.1 — chip grid, ×1–3, anything / pick; one *Ask* button; *Let Rosie pick* clears to a rolled ask |
| **Friends row** | the *you have it* mark, unchanged in shape; the actions panel's Visit door opens swap mode when a match exists |
| **Visit screen** | bubble with ×N; strip lifts matches; **offer tray** on tap; receipt sheet; nap card *Swap* |
| **Exterior** | the Stranger at the hedge **only while you hold a set and have sets left today**; walk-in / walk-out; tap → Stranger sheet |
| **Stranger sheet** | line · stacks · confirm pill · tally; cap state |
| **Inbox** | a row per swap received (*Jen swapped your pig the wool it asked for and took the old key*) |
| **Board** | the *N delivered* slice becomes *N swapped* (gifts + swaps given) |
| **Tickle breakdown** | slices *swaps* and *the Stranger* |
| **Field Guide** | entries: *the Satchel* (extended), *the Stranger* (silhouette until the first sale), *a swap* (silhouette until the first) — numbers from tuning |
| **Pushes** | *asks* (once per ask per holder, ≤2 per holder per day) and *swap received* (rides the visit push's rate limit); `send_push_to_user` — there is no preference layer to honour |

Every surface reaches for the tokens (`SPACE`, `TYPE`, `RADII`, sticker
shadows) and the primitives (`Sticker`, `Button`, `SectionHeader`,
`EmptyState`); glyphs via `Glyph`/`Icon`; no emoji anywhere (the Stranger's
lines are text, its face is a sprite).

---

## 11 · Rollout

1. **Migration** `2026091712xxxx_finds_swaps_stranger.sql`: catalog extension,
   `pig_asks`, `satchel_swaps`, `trader_*`, the three data migrations (§4.6),
   the rewritten dig trigger, all RPCs, tuning rows. Validate in the
   plain-Postgres harness (`scripts/db-harness/00v_finds_swaps_prep.sql` +
   `95_finds_swaps_stranger_smoke.sql`): partial stack, option gone, ask
   changed, two fillers, nonce replay, cap day rollover, shelf overflow.
   **Push on the founder's "go" only.**
2. **Art**: the Stranger sheet + 18 glyphs (parallel with 1).
3. **Client, three PRs**: (a) catalog + bag + Ask sheet + dig receipt; (b)
   visit tray + Swaps segment + pushes; (c) the Stranger + Field Guide + Board
   slice. Each fail-soft against a server without the next.
4. **Tests**: `satchelStacks.test.ts` (aggregate + set-ready), `askOptions.test.ts`
   (the frozen-options rule as a pure function, pinned against the SQL's
   ordering), `swapReceipt.test.ts` (copy for every refusal reason),
   `traderDay.test.ts` (UTC boundary), plus the sprite-count locks for the
   `trader` family in `pigFrames.test.ts`.
5. **Build changelog** before the build, per convention.

---

## 12 · Deferred (named so they aren't rediscovered)

- **Three different for one up** — a Stranger deal that takes three different
  finds of a rarity for one mystery find a rarity up. Deliberately out of v1:
  it is a second Stranger rule (lens #2), and it gives the friendless pig a
  solo sink for singles — which is exactly the job the swap is meant to do,
  so it would compete with **Connect** at the moment the loop is being
  learned. For tickles it is dominated anyway (27 commons → one rare → 30
  tickles, vs. nine common sets → 45), so it could only ever be a Collect
  hook. Revisit trigger: after four weeks, if tossed singles outnumber
  swapped ones in the ledger, singles need a second door.
- **Layer-biased rarity** — deeper digs shading the roll toward uncommon /
  rare. Needs the layer in the stored receipt, which means a change to the
  submit core; do it the next time that core is opened for its own reasons,
  not for this.
- **Sounder asks** — a crew-wide "we need" board. Contend-flavoured; wait for
  the Sounder rooms.
- **Ask history / who filled it** — the swap ledger already has it; surface
  only if players ask.

---

## Resolved while drafting (2026-09-16)

Four open questions, answered by the numbers and the charter rather than left
to the founder:

1. **Catalog size — 30.** `tools/balance_finds.py`: at 45 the friendless pig
   waits five days for a set and each rare is one in fifteen (a rare set
   becomes a month's project); at 20 sets are daily and the Stranger's cap
   binds — it starts to read as a faucet. At 30 friends double the pace, the
   lone digger still gets there, and a swap visit happens most days. Growth
   path: **one new family (six finds) per season**, never a mid-season swell
   — the `retired` flag and the family shelves exist so the catalog can
   breathe without a migration of players' bags.
2. **Shelf — fold into the bag, drop the table.** Prod holds one shelf item
   after two days of build 185; the "overflow" case cannot occur. A second
   home for finds would be a second rule for no one.
3. **Presence — the Stranger comes when it has business, not on a schedule.**
   The 09-13 ruling makes the home Rosie's stage, and the buried-truffle
   mound is the precedent for a yard element that exists only while there's
   something to do. A schedule would add a second clock beside the feeding
   clock and punish the hours between (the charter's *rendezvous* rule is
   about being called at human intervals, not about gating); an always-there
   fixture would be furniture on the stage. Appearing on the first completed
   set is also the better discovery: the sheep arriving *is* the reveal.
4. **"Three different for one up" — deferred**, with the trigger written in
   §12.

## Draft decision-log entry (for `SKILL.md`, on ratification)

> **2026-09-16 — Finds swap, the Stranger buys sets, and the wish becomes an
> ask you can set.** Amends 2026-09-14 in two places: (1) a pig's one live
> wish may be **set by its owner** (one find, ×1–3) but only alongside what it
> will **give back** — anything in the bag or a listed few — so a request is a
> swap, not a take; the rolled wish stays as the default voice. (2) Finds are
> still never sold for Snouts, but a **hooded sheep at the hedge** takes
> **three of a kind for applied tickles** (5/12/30 by rarity, the day's want
> ×2, three sets a day), the same score-not-bank number a dig find has paid
> since 09-13 — and it is at the hedge only while the pig holds a set, a yard
> state like the buried mound, never a fixture on Rosie's stage. A **swap happens in the barn**: the visitor hands the asked
> find and takes one of up to three things the host pre-offered, chosen by
> the server from the host's biggest stacks so a bag is never on show;
> "just give it" survives as the gift. Catalog 12 → 30 in five families;
> every dig drops 1–3; the bag holds 12; the shelf retires into the bag.
> Serves **Connect** (a specific reason to visit a specific friend today, and
> "it's honeycomb day" as a text message), **Collect** (families as shelves
> that fill in), **Contend** (a bounded garnish on the race that makes a set
> mean something). Spec `docs/design/2026-09-16-finds-swaps-and-the-stranger.md`.
