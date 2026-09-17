# The Satchel — spec

Status: **the bag and the wish shipped in build 186** — `20260915010000_satchel.sql`,
pushed 2026-09-15. **The swap was authored 2026-09-16** — migration
`20260917100000_satchel_swaps.sql`, **not pushed**; this spec describes it, and
the wire contract both implementers build to is
`docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md` §12 (Part 2 for
the reasoning; the audit of what shipped is Part 1). Charter: `SKILL.md`
decision 2026-09-14 *"Satchel finds are given, never sold or paid for"*,
extended 2026-09-16 *"Finds swap in the barn; the shelf folds into the bag."*
Depends on the visit rules in `barn-visit-facing-spec.md`.

**One line:** a Dig fills your Satchel with small finds; friends' pigs each
want one of them; handing a pig what it is looking for tickles both pigs, lets
you take one find its owner's bag can spare — or just give it — and leaves the
giver a count and, at 10 / 50 / 100, a keepsake.

Pillar: **Connect** (a reason to visit a *specific* friend), fed by **Collect**
(finds are things; a swap is how a lone digger meets a rare), with a **Contend**
hook (the swap count sits beside tickles on the Board).

## The spine

`docs/barn-visiting-design.md`: **visiting is giving, not earning.** Written
into the shape:

- Finds come only from your own Dig (and no other source). Nothing on the
  visit screen produces a find.
- A swap pays **tickles to both pigs, flat** — the same kind of tickles a
  visit tap already pays. No Snouts, no Golden Truffles, no currency of any
  kind to the giver. Rarity never changes the payout; it only changes what
  the catalog looks like.
- Finds **move 1:1 between bags**; nothing is minted and nothing is sold. The
  giver's extras are a **count**, a **generous alignment tick** (on a gift
  only), the **catalog reveal** and a **keepsake** drawn from the finds
  themselves.
- With no currency there is nothing to farm, so the caps are about pace, not
  scarcity: **one swap per (giver, host) per UTC day**, server-enforced, and
  the flat tickles stop being *paid* past the daily paid caps — the swap
  itself still happens, unpaid.

## 1. Spec

- **Satchel** — a capped bag of finds on the profile (cap **6**, server-tuned).
  Visible from the Barn button's fan ("Satchel · 3 of 6 finds") and as a strip
  on the visit screen.
- **Search** = a **Dig**. Every submitted Dig rolls **0 / 1 / 2** finds
  (30 / 50 / 20 %) into the bag alongside its normal finds. The receipt
  DRAWS the roll as the tally's last beat (2026-09-16): the bag glyph, each
  find dropping onto its own paper tile, and one hand line — *"a river
  pebble and an old key · 3 of 6 finds"*. A full bag shows the turned-away
  find on a ghost tile (the catalog's never-carried grammar) under *"the
  satchel's full"* — *"a pinecone stayed in the mud · full — 6 finds"* —
  the roll still happens, overflow is discarded, never queued. The one
  sentence (*"your Satchel got heavier: a river pebble."*) survives as the
  block's accessibility label.
- **Find** — one of **12** pocketable objects: river pebble · blue feather ·
  four-leaf clover · snail shell · brass button · tuft of wool · red berries ·
  pinecone (common) · old key · honeycomb chip · glass marble (uncommon) · tin
  whistle (rare). Painted glyphs in `assets/images/glyphs/finds/`, ids in
  `constants/satchel.ts` mirroring `satchel_finds`.
- **Wish** — every profile has exactly **one live wish**, server-rolled
  (70 / 25 / 5 by rarity), 48h before it rerolls on its own. The owner sees it
  in the Satchel sheet with one free **"Not this one"** per wish — never a
  picker. Visitors see it as a thought bubble over the host pig.
- **Swap** — a visitor taps the lifted (matching) find in the strip and an
  **offer tray** rises: up to **3 options** the host's bag can spare, plus
  *just give it*. The server moves the wished find into the host's **bag** and
  the taken option (if any) back into the giver's, tickles both, rerolls the
  wish (never to the find just received), and writes the host's while-away line
  and Inbox row. A swap that takes nothing is a **gift**.
- **Options** — the ≤3 finds shown in the tray, chosen by the server
  (`_wish_options`: the host's biggest stacks first, never the wished find,
  ties by a hash of `wish_no`) and frozen for the life of that wish, so a bag
  is never on show and the tray is the same on every refresh. Empty = gift
  only. The client never recomputes them.

## 2. Flow

1. Dig → the receipt's bag beat → bag badge on the Barn button's fan.
2. Friends list: a row shows a **wish mark** (the find's art + "you have it")
   only when the bag holds what that pig wants and you haven't brought it.
   That is the entire discovery surface.
3. Visit: host pig faces the visitor; the wish bubble floats over it; the
   Satchel strip sits above the action bar with the matching find lifted.
4. Tap the lifted find → the offer tray rises from the strip: *"Maple's pig
   can spare one of these for your blue feather"*, the options as tiles, and
   *…or just give it*.
5. Tap an option → `swap_with_host(p_host, p_item_id, p_take_find, p_wish_no,
   p_nonce)`; *just give it* sends the same call with `p_take_find = null`.
6. Success: host pig `surprise` → `happy`, visitor pig `happy`, both tallies
   +tickles, the taken find slides into the strip, the receipt sheet:
   *"Swapped — Maple's pig got the blue feather it was hoping for; you took the
   old key. You both got 3 tickles."* (a gift reads *"…you gave it away. You
   both got 3 tickles, and a generous tick."*). The bubble now shows the pig's
   next wish under "next time" — you are done at this barn today.
7. Host on return: the while-away modal's system row *"Jen swapped your pig the
   blue feather it was hoping for and took the old key."*, tappable to the
   Barn, and an Inbox row. (The guestbook was retired 2026-09-12; these are the
   trace.)

## 3. Item passing rules

- Only the **visitor** gives; only the **host pig** receives the wish. What
  comes back is a find from the **host's bag**, never a payment.
- What the visitor may take is the server's **options** — ≤3, a pure function
  of the wish number and the host's live bag (the same three on every read
  until that bag changes; `option_gone` is that answer). A take outside them is `not_offered` (a Sentry error: it means
  the rule diverged, never a toast).
- **One swap per (giver, host) per UTC day**, enforced on the server
  (`already_today`), on top of the per-wish uniqueness. The same visitor comes
  back tomorrow.
- Every swap carries a client **nonce**; a retry reuses it and replays the
  original receipt rather than moving anything twice.
- Rows **move** between bags with `source` + `from_user_id` provenance — never
  delete-and-reinsert. The shelf is retired: a received find is simply in your
  bag, tossable, giveable on, and counted toward the catalog.
- A **gift** takes nothing back and is the only swap that pays the giver a
  generous alignment tick.
- **Wrong find → bounce**: the pig sniffs it (`surprise`), a toast names the
  bubble, nothing leaves the bag, no server call. Free to try.
- **Tap, not drag.** The visit's controls float over a `box-none` stage on the
  new architecture; a lifted find that reads "give this" is the same decision
  with one motion fewer.
- Swapping is **allowed after the tickles are spent** and from the nap card
  (*Leave a find* becomes *Swap*), so a sleeping barn is never a dead end. It never opens a
  barn against the 3-barn visit window — it rides whichever visit you are in.

## 4. Tickles and rewards

| | amount | note |
|---|---|---|
| Host pig | **+3 tickles** (flat) | `apply_tickles` — count + snouts, never the bank |
| Giver pig | **+3 tickles** (flat) | same |
| …past the caps | **0** | once the pair's or the giver's paid swaps for the day are spent, `tickles: 0`, `paid: false` — the swap still happens and the receipt says so |
| Happiness | giver 1.0 · host 0.25 | the visit's friend-act rate |
| Alignment | giver +1 generous, **gifts only** | `shift_alignment`; a swap takes something back, so it isn't generosity |
| Visit streak | pair credit | `_credit_visit_streak`, idempotent per day |
| Count | +1 swap given | Board slice "N swapped"; Satchel sheet (given / received) |
| Keepsake | at 10 / 50 / 100 | gifts + swaps given; drawn from the finds, no currency |
| Catalog | silhouette lifts on first carry **or first receipt** | the Satchel sheet's "Every find" — a swap is how a lone digger meets a rare |

Every number is `app_settings.satchel_tuning` with the compiled fallback in
`constants/satchel.ts` (`utils/satchel.ts` config cell):

```json
{"cap": 6, "find_odds": {"none": 0.30, "one": 0.50, "two": 0.20},
 "rarity_weights": {"common": 70, "uncommon": 25, "rare": 5},
 "wish_reroll_hours": 48, "tickles": 3, "keepsake_thresholds": [10, 50, 100],
 "options": 3, "paid_swaps_per_pair_per_day": 3, "paid_swaps_per_pig_per_day": 10}
```

## 5. Edge cases

- **Wrong item** — bounce (above).
- **Full bag** — the receipt's bag beat shows what stayed in the mud on a
  ghost tile and says so; the sheet's only action on a find is **Toss**
  (hold). No selling.
- **Empty bag on a visit** — strip says "dig to fill it"; the bubble still
  shows what to bring back.
- **Gift-only host** — the host's bag has nothing to spare: `options: []`, the
  bubble reads *gift only*, the tray offers only *just give it*.
- **Already swapped here today** — the strip goes quiet and the bubble reads
  *next time*; a stale client gets `already_today` (build 190's binary reads it
  as `already_fulfilled` through the alias).
- **Stale bubble** — server answers `wrong_find` with the live wish; the
  client swaps the bubble and says the pig changed its mind.
- **Wish moved under an open tray** — `wish_changed` with the live wish and
  fresh options; bubble and tray redraw, nothing moved.
- **The option went** (the host gave it away first) — `option_gone` with fresh
  options; the tray redraws with *"Maple's pig changed its mind"*.
- **Host's bag full on a gift** — `host_bag_full`; the wish stays and the
  client suggests taking something instead. A swap is 1:1, so it never fills.
- **Retry after a dropped reply** — the same nonce returns the original
  receipt with `replay: true`; nothing moves twice.
- **Resting / tickled-out barn** — strip stays live; nap card offers *Leave a
  find* when the bag holds a match.
- **Multiple pigs in one Barn** (future Sounder rooms) — a wish belongs to a
  profile; a drop targets the pig under the finger; never auto-assign.
- **Host changes pig** — the wish belongs to the profile; the bubble moves.
- **Blocked / unfriended** — `friend_wishes` omits them; `swap_with_host`
  refuses `not_friends` / `blocked`; the find stays in the bag.
- **Season rollover** — bags and the swap ledger persist.
- **Server without the Satchel** — every read is fail-soft: no fan row, no
  strip, no bubble, no row marks, no receipt line.
- **Double submit** — the nonce replays first; `satchel_swaps_one_per_wish`
  (giver, host, wish_no) is the backstop.

## Server surface

`my_satchel()` · `toss_find(p_item_id)` · `reroll_my_wish()` ·
`friend_wishes(p_targets)` (each entry now carries `options` +
`swapped_today`) · `_wish_options(p_host, p_wish_no)` (SECURITY DEFINER,
revoked from clients — the one place the options rule lives) ·
`swap_with_host(p_host, p_item_id, p_take_find, p_wish_no, p_nonce)` ·
`satchel_swaps_for(p_targets)` (Board counts) ·
`my_satchel_swaps(p_limit)` (both sides, newest first, for the Inbox) ·
`tickle_breakdown` (carried, with a `swaps` lane). Kept for **one build** so
build 190 keeps answering against the pushed DB: `fulfil_pig_wish` (a gift
through `swap_with_host`), `satchel_deliveries_for`, and `satchel_deliveries`
as a view. Field names, reason order and return shapes: the plan doc's §12 —
do not restate them here.

The Dig hook is unchanged: a BEFORE INSERT trigger on `rooting_receipts`
(`rooting_receipts_roll_satchel`) writes `receipt.satchel = {found, lost,
count, cap}` — the 470-line submit core is untouched (the carry-latest-def
footgun). Harness: `scripts/db-harness/00u_satchel_prep.sql` +
`90_satchel_smoke.sql`, then `00x_satchel_swaps_prep.sql` +
`95_satchel_swaps_smoke.sql`.
