# The Satchel — spec

Status: **built 2026-09-14** (build 185). Migration `20260915010000_satchel.sql`.
Charter: `SKILL.md` decision 2026-09-14 *"Satchel finds are given, never sold
or paid for."* Depends on the visit rules in `barn-visit-facing-spec.md`.

**One line:** a Dig fills your Satchel with small finds; friends' pigs each
want one of them; handing a pig what it is looking for tickles both pigs and
leaves the giver a count, a generous tick and — at 10 / 50 / 100 — a keepsake.

Pillar: **Connect** (a reason to visit a *specific* friend), fed by **Collect**
(finds are things; rarity lives in the catalog), with a **Contend** hook (the
delivery count sits beside tickles on the Board).

## The spine

`docs/barn-visiting-design.md`: **visiting is giving, not earning.** Written
into the shape:

- Finds come only from your own Dig (and no other source). Nothing on the
  visit screen produces a find.
- A delivery pays **tickles to both pigs, flat** — the same kind of tickles a
  visit tap already pays. No Snouts, no Golden Truffles, no currency of any
  kind to the giver. Rarity never changes the payout; it only changes what
  the catalog looks like.
- The giver's extras are a **count**, a **generous alignment tick**, the
  **catalog reveal** and a **keepsake** drawn from the finds themselves.
- With no currency there is nothing to farm, so there are no per-day caps:
  the only rule is **one delivery per (giver, host) per wish**.

## 1. Spec

- **Satchel** — a capped bag of finds on the profile (cap **6**, server-tuned).
  Visible from the Barn button's fan ("Satchel · 3 of 6 finds") and as a strip
  on the visit screen.
- **Search** = a **Dig**. Every submitted Dig rolls **0 / 1 / 2** finds
  (30 / 50 / 20 %) into the bag alongside its normal finds. The receipt says
  *"your Satchel got heavier: a river pebble."* A full bag says *"Satchel's
  full — the pinecone stayed in the mud."* — the roll still happens, overflow
  is discarded, never queued.
- **Find** — one of **12** pocketable objects: river pebble · blue feather ·
  four-leaf clover · snail shell · brass button · tuft of wool · red berries ·
  pinecone (common) · old key · honeycomb chip · glass marble (uncommon) · tin
  whistle (rare). Painted glyphs in `assets/images/glyphs/finds/`, ids in
  `constants/satchel.ts` mirroring `satchel_finds`.
- **Wish** — every profile has exactly **one live wish**, server-rolled
  (70 / 25 / 5 by rarity), 48h before it rerolls on its own. The owner sees it
  in the Satchel sheet with one free **"Not this one"** per wish — never a
  picker. Visitors see it as a thought bubble over the host pig.
- **Delivery** — a visitor taps the lifted (matching) find in the strip; the
  server moves it from the giver's bag to the host's **shelf**, tickles both,
  rerolls the wish (never to the find just received), and writes the host's
  while-away line.

## 2. Flow

1. Dig → receipt line → bag badge on the Barn button's fan.
2. Friends list: a row shows a **wish mark** (the find's art + "you have it")
   only when the bag holds what that pig wants and you haven't brought it.
   That is the entire discovery surface.
3. Visit: host pig faces the visitor; the wish bubble floats over it; the
   Satchel strip sits above the action bar with the matching find lifted.
4. Tap the lifted find → `fulfil_pig_wish(p_host, p_item_id)`.
5. Success: host pig `surprise` → `happy`, visitor pig `happy`, both tallies
   +tickles, the receipt sheet: *"Maple's pig is beaming — Maple's pig got the
   blue feather it was hoping for — you both got 3 tickles."* The bubble now
   shows the pig's next wish under "next time".
6. Host on return: the while-away modal's system row *"Jen brought your pig
   the blue feather it was hoping for."* (The guestbook was retired 2026-09-12;
   this line is the trace.)

## 3. Item passing rules

- Only the **visitor** gives; only the **host pig** receives.
- **One delivery per (giver, host) per wish**, keyed on `wish_no`. The same
  visitor may fulfil the *next* wish on a later visit.
- The find is **consumed** into the host's shelf. Pure transfer.
- **Wrong find → bounce**: the pig sniffs it (`surprise`), a toast names the
  bubble, nothing leaves the bag, no server call. Free to try.
- **Tap, not drag.** The visit's controls float over a `box-none` stage on the
  new architecture; a lifted find that reads "give this" is the same decision
  with one motion fewer.
- Fulfilment is **allowed after the tickles are spent** and from the nap card
  (*Leave a find*), so a sleeping barn is never a dead end. It never opens a
  barn against the 3-barn visit window — it rides whichever visit you are in.

## 4. Tickles and rewards

| | amount | note |
|---|---|---|
| Host pig | **+3 tickles** (flat) | `apply_tickles` — count + snouts, never the bank |
| Giver pig | **+3 tickles** (flat) | same |
| Happiness | giver 1.0 · host 0.25 | the visit's friend-act rate |
| Alignment | giver +1 generous | `shift_alignment` |
| Visit streak | pair credit | `_credit_visit_streak`, idempotent per day |
| Count | +1 delivery | Board slice "N delivered"; Satchel sheet |
| Keepsake | at 10 / 50 / 100 | drawn from the finds; no currency |
| Catalog | silhouette lifts on first carry | the Satchel sheet's "Every find" |

Every number is `app_settings.satchel_tuning` with the compiled fallback in
`constants/satchel.ts` (`utils/satchel.ts` config cell):

```json
{"cap": 6, "find_odds": {"none": 0.30, "one": 0.50, "two": 0.20},
 "rarity_weights": {"common": 70, "uncommon": 25, "rare": 5},
 "wish_reroll_hours": 48, "tickles": 3, "keepsake_thresholds": [10, 50, 100]}
```

## 5. Edge cases

- **Wrong item** — bounce (above).
- **Full bag** — receipt says what stayed in the mud; the sheet's only
  action on a find is **Toss** (hold). No selling.
- **Empty bag on a visit** — strip says "dig to fill it"; the bubble still
  shows what to bring back.
- **Already brought this one** — strip says so; nothing lifts; server answers
  `already_fulfilled` if the client is stale.
- **Stale bubble** — server answers `wrong_find` with the real wish; the
  client swaps the bubble and says the pig changed its mind.
- **Resting / tickled-out barn** — strip stays live; nap card offers *Leave a
  find* when the bag holds a match.
- **Multiple pigs in one Barn** (future Sounder rooms) — a wish belongs to a
  profile; a drop targets the pig under the finger; never auto-assign.
- **Host changes pig** — the wish belongs to the profile; the bubble moves.
- **Blocked / unfriended** — `friend_wishes` omits them; `fulfil_pig_wish`
  refuses `not_friends` / `blocked`; the find stays in the bag.
- **Season rollover** — bag, shelf, deliveries persist.
- **Server without the Satchel** — every read is fail-soft: no fan row, no
  strip, no bubble, no row marks, no receipt line.
- **Double submit** — `satchel_deliveries_one_per_wish` unique; the second
  answer is `already_fulfilled`.

## Server surface

`my_satchel()` · `toss_find(p_item_id)` · `reroll_my_wish()` ·
`friend_wishes(p_targets)` · `fulfil_pig_wish(p_host, p_item_id)` ·
`satchel_deliveries_for(p_targets)`; the Dig hook is a BEFORE INSERT trigger
on `rooting_receipts` (`rooting_receipts_roll_satchel`) that writes
`receipt.satchel = {found, lost, count, cap}` — the 470-line submit core is
untouched (the carry-latest-def footgun). Harness:
`scripts/db-harness/00u_satchel_prep.sql` + `90_satchel_smoke.sql`.
