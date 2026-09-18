# Finds, sets, and the scavenging pigs (2026-09-17)

Companion to `pig-search-2026-09-17.md` (Design A · the Errand, with B's corkboard as its inbox). This doc does four things: answers the four open questions, lists every item the search economy touches, proposes the pig stat system, and proposes set-collection mechanics. Every number marked *(tuned)* is server config with a compiled fallback, never a bare client constant.

Sources of truth today: `constants/satchel.ts` (catalog + `SATCHEL_TUNING`), `constants/trader.ts` + `20260917170000_ghost_sheep_trader.sql` (trader), `docs/satchel-spec.md`, `docs/barn-visiting-design.md` ("giving, not earning").

---

## 0. The four questions, resolved

| # | Question | Ruling | Why |
| --- | --- | --- | --- |
| 1 | Free lane | **Rosie is sendable; the yard is empty while she's out.** | Everyone can scavenge, so membership never buys a faucet. Rosie out is a *chosen* cost (no tickling until she's back — you send her at bedtime). A companion is the pig that lets Rosie stay home. A free companion for everyone would give away the membership's hook (2026-07-25) for nothing. The yard says it plainly: the mound, a hand line *Rosie's out till 7:40*, tap → the Pen. |
| 2 | Picker order | **Friends' wishes first**, then your own wish, then *anything*. | Connect is the pillar; "I sent Bandit for your feather" is the message. |
| 3 | What comes back | **Only a Find is ever minted by a search.** A first carry lifts its Field Guide silhouette (exists). Postcards are *receipts* of the homecoming, drawable and shareable, never items. Keepsakes come from **sets** (§3), not from searches. | Nothing new enters the economy; the Satchel stays the only bag. |
| 4 | Next step | **Yes — draw A on the canvas next**, after this doc: send sheet · out state · homecoming · corkboard · empty / full / recall states, plus the Pen's job segment. | The outline below is what the boards will draw. |

---

## 1. The items

### 1.1 The twelve Finds (the search economy)

Twelve pocketable countryside objects. Art: `assets/images/glyphs/finds/*.png` (all twelve exist). Server rows: `satchel_finds`. Rarity lives in Collect (catalog order, silhouettes) and in the Trader's price — never in a swap's payout.

New here: each Find belongs to a **family** — where it was found. Families are the unit of sets (§3) and of pig noses (§2). Four families of three.

| Family | Finds | Rarity mix | Character |
| --- | --- | --- | --- |
| **Brook** | river pebble · snail shell · glass marble | c · c · u | the water's edge; smooth, slow, glinting |
| **Hedge** | blue feather · pinecone · red berries | c · c · c | the wild edge; birds and trees; the easy set |
| **Meadow** | four-leaf clover · tuft of wool · honeycomb chip | c · c · u | green and growing; luck, sheep, bees |
| **Lost things** | brass button · old key · tin whistle | c · u · r | someone dropped it; the hard set |

Per item. *Now* = how it is obtained and used today. *Hooks* = what it could build into, each tied to a system that already exists or is designed. *Open* = what we must confirm.

| Find | One line | Meaning / theme | Now | Hooks | Open |
| --- | --- | --- | --- | --- | --- |
| **river pebble** (c) | A stone worn round by the brook. | Patience; the thing you keep in a pocket for no reason. | Dig drop; Trader 3 (6 when fancied); gift/swap; toss. | Brook set; a pebble-count on the Barn shelf keepsake; skimming (a Lounge idle). | None — fully wired. |
| **snail shell** (c) | An empty spiral, its owner long moved on. | A home carried; slowness. | As above. | Brook set; ties to *Tired*/naps (a snail nap sprite?). | Lore line for the Field Guide. |
| **glass marble** (u) | A child's marble, glinting in the silt. | Someone played here once; a glint. | Dig drop (25% of a roll's rarity); Trader 8 / 16; swap. | Brook set; the **Mote Machine** (marbles are already its visual language) — a marble could be a cosmetic skin for a Reveal, never a Mote. | Confirm the Mote Machine never takes a marble as fuel (economy wall). |
| **blue feather** (c) | A jay's tail feather. | Luck of looking up; the most-wished Find in copy. | Dig drop; Trader 3 / 6; swap. | Hedge set; a feather in the hat (a cosmetic *bow* slot piece earned by the Hedge set). | — |
| **pinecone** (c) | Closed tight, seeds inside. | Woods; something that will grow. | As above. | Hedge set; **Beyond the Hedge Seeds** (a pinecone is the obvious first Seed source when farming ships). | Whether Finds ever convert to Farm stock (a second bag) — default **no**. |
| **red berries** (c) | Hedge berries, sweet-sharp. | Birds' food; autumn. | As above. | Hedge set; a Provision (BtH); the Hungerer's diet (Season 1 flavour). | — |
| **four-leaf clover** (c) | The lucky one. | Luck; already the Lucky Pig's motif. | As above. | Meadow set; Lucky Pig odds are **not** touched (no power); a clover *stamp* on the profile. | — |
| **tuft of wool** (c) | Caught on the fence wire. | The sheep; the Trader is a Ghost *Sheep*. | As above. | Meadow set; **the Trader's own** — he could refuse it, or pay double always ("that's mine"). | Decide the Trader's stance on wool (flavour rule). |
| **honeycomb chip** (u) | A broken corner of comb. | Bees; sweetness; work. | Dig drop; Trader 8 / 16; swap. | Meadow set; Compost/Provision (BtH); a Trough sweetener? (no — Trough is snouts). | — |
| **brass button** (c) | Off somebody's coat. | Lost things; a person passed here. | Dig drop; Trader 3 / 6; swap. | Lost set; buttons as the Closet's keepsake currency? (**no** — no second currency). | — |
| **old key** (u) | It opens something, somewhere. | The question every player asks. | Dig drop; Trader 8 / 16; swap. | Lost set; the **Barn**: a locked shelf keepsake / a chest furnishing the key unlocks once (a set reward, not a gate on play). | What it opens — pick one, forever. |
| **tin whistle** (r) | Two notes and a rattle. | Music; the rare one (5% of a rarity roll). | Dig drop; Trader 20 / 40; swap. | Lost set capstone; a Lounge ambient (the whistle plays when placed); the Trader's fancy at ×2 = 40 tickles — the biggest single payout in the Find economy. | 40 applied tickles for one find is large next to the swap's flat 3 — confirm against `tools/balance_trader.py`. |

### 1.2 Other collectibles the sets may touch (not searchable)

| Item | One line | Now | Relation to sets |
| --- | --- | --- | --- |
| **Dig Find** (truffle cluster · shimmer pocket · junk · relic) | What a Truffle Patch banks. | The dig's own payout; relics fill the Burrow Book. | Separate. A search never returns a Dig Find (Contend stays untouched). |
| **Relic** | A season's unique catch (Burrow Book). | Set completion pays the season cosmetic. | The Burrow Book is the model for a *seasonal* set; Finds are the *evergreen* one. |
| **Mote** | Earned consumable; one guaranteed Reveal. | Shimmer pockets; Wallow rank 3+. | Never a set reward (economy wall). |
| **Keepsake** (swap keepsakes at 10/50/100; Wallow shelf keepsakes) | A permanent shelf object with an inscription. | Exists; the Barn's `shelf` position. | **The set reward type.** Family sets pay a shelf keepsake each. |
| **Title** | A worn line under the name. | Earned only. | The herd set (§3.3) pays a title. |
| **Bunting / postcards** | Barn decor from events; the homecoming's receipt. | Bunting exists; postcards exist in the expedition slice. | Postcards are receipts, never items. |

---

## 2. The pig stat system

**Rule:** specialisation, never superiority. Every pig has the same number of pips; they are spent differently. Rosie is the generalist and the free lane; no companion out-scavenges her overall, each out-scavenges her *somewhere*. Stats are shown as pips (`StatPips`, from the expedition slice) — never a decimal.

### 2.1 Four stats, seven pips each

| Stat | What it changes (tuned) | 1 pip | 2 pips | 3 pips |
| --- | --- | --- | --- | --- |
| **Nose** | Odds of finding the *target* — but only inside the pig's family; outside it, base odds. | base | +10 pts | +20 pts |
| **Trot** | How long the errand takes. | 6 h | 4 h | 2 h |
| **Pockets** | How many Finds can come home (a second is *anything*, rolled). | 1 | 1, +25% chance of a 2nd | up to 2 |
| **Glint** | Rarity tilt on an *anything* roll. | 70/25/5 | 60/30/10 | 50/35/15 |

Base target odds *(tuned)*: common 60 · uncommon 40 · rare 20 (points, before Nose). An errand rolls once, server-side, from the committed seed at `ends_at`.

### 2.2 The six pigs

| Pig | Motif | Family (Nose applies here) | Nose · Trot · Pockets · Glint | The one line |
| --- | --- | --- | --- | --- |
| **Rosie** | heart | — (generalist) | 1 · 2 · 2 · 2 | goes anywhere, comes back with something |
| **Copper** | leaf | Hedge | 2 · 3 · 1 · 1 | fast; back before you've missed him |
| **Pepper** | spark | Brook | 2 · 1 · 1 · 3 | slow, but what she finds glints |
| **Bandit** | mask | Lost things | 2 · 1 · 3 · 1 | keeps whatever he finds — sometimes two |
| **Pickles** | pickle | Meadow | 3 · 1 · 2 · 1 | patient; the best nose in the Pen |
| **Biscuit** | wheat | *the friend's wish* — his family is whichever family the target belongs to when the errand is **for a friend** | 3 · 2 · 1 · 1 | the gentle one; finds what others are hoping for |

Reading it: a friend wishes for a tin whistle → Biscuit is the pig (Nose 3 on any friend errand). You want the Brook set → Pepper. You want it before lunch → Copper. Every column sums to 7; Rosie's spread is the free lane's honest generalist.

### 2.3 What a pig's type decides (the "specialisation-aware" contract)

- **What it can search:** any pig can be sent for any target. Family only decides where Nose applies. (A hard "Copper can't look for a marble" is a dead-end generator; a soft "Copper isn't the best pig for a marble" is a choice.)
- **What it produces:** exactly what the stats say — one or two Finds, at those odds, in that time. No pig produces anything but Finds.
- **Growth:** none in v1. Pips are fixed and legible. A later **Nose +1 at ten completed family errands** is the only growth worth considering, and only if the Trader's saturation (≈6 tickles/day) still holds with it — otherwise growth is a faucet.
- **Members:** own one companion → two errands a day (Rosie + one). That is the whole membership advantage: a second *worker*, at the same per-pig rate as everyone's Rosie. Fair by construction because every payout downstream (swap 3 flat, trader 6/visit cap, satchel 6) is already capped per pig, not per errand.

---

## 3. Set-collection mechanics

The Satchel is a **hand of six**; the twelve Finds are a small, finite deck. Three mechanics, each a different kind of set; they compose. All three keep the wall: set rewards are keepsakes, decor, titles — never Motes, snouts, dig power, or a faucet.

### 3.1 Family sets — the Shelf (permanent, Collect)

- **Defined:** the four families of three (§1.1). Completion = **all three carried at once** in the Satchel (a real puzzle at cap 6: two families at most). First carry alone lifts the silhouette (exists); *holding the set* is the new act.
- **Working toward it:** send a pig with Nose for the family; wish for the missing one (your wish is rolled, but the roll can be **biased toward a family you are two-of-three on** — *(tuned)* +15 pts); swap for it on a visit; trade up duplicates at the Trader (§4). The Pen's card shows the family tally under each pig: *Brook 2 of 3*.
- **Reward, instant on completion, once per family:** a **shelf keepsake** for the Barn (a jar of pebbles, a feather-and-cone wreath, a honey-and-clover posy, the key on a nail) — one furnishing each, in the `shelf` position, inscribed with the date. All four → the **Hedgerow** interior background (a room, the biggest single Furnish reward) and the Field Guide's *Countryside* plate.
- **After completion:** the three Finds are still yours to give or trade — the set is a *moment*, not a vault. Nothing is locked away.
- **Dead-ends:** Lost things hinges on the tin whistle (5%). Three fixes, all sinks: the wish bias above; Biscuit/Bandit Nose; and the Trader's **trade-up** (§4). A set is never gated on a friend having it.
- **Runaway:** one reward per family per profile, ever. Two pigs finish it faster; they cannot finish it twice.

### 3.2 Hands — showing the Trader a set (repeatable, gentle)

- **Defined:** poker-shaped, on the hand of six, judged when you hand finds to the Trader in one visit: **pair** (2 alike) · **three of a kind** · **flush** (3 of one family) · **full house** (3 of a kind + a pair) · **the countryside** (one from each of the four families). Rarity is *not* a hand — the flat-swap spine stays.
- **Working toward it:** duplicates stop being dead weight — a pair is a hand. Pockets-3 pigs (Bandit) are the pair-makers. The Trader's daily **fancy** becomes *the hand he'd like to see* on some days ("a flush from the brook") instead of a single find.
- **Reward, gradual:** a multiplier on that visit's payout *(tuned)*: pair ×1.25 · three ×1.5 · flush ×1.5 · full house ×2 · countryside ×2, capped by the existing six-finds-per-visit and applied-tickles rules, so his ≈6/day saturation moves to ≈9 at the very top and no further. First time each hand is shown → a **Field Guide** hand page (Collect, not power).
- **Dead-ends:** none — every hand is made from commons.
- **Runaway:** the per-visit cap and the once-a-day visit bound it; the multiplier is on applied tickles (score), never the bank.

### 3.3 The herd's wishbook — a set of people (weekly, Connect)

- **Defined:** the sounder's eight live wishes are the week's set. Completion is **fulfilling wishes for five different pigs** in one week, by anyone in the sounder, counted per giver.
- **Working toward it:** the Friends row already marks *you have it*; the Pen's picker puts friends' wishes first; a gift counts (it takes nothing back).
- **Reward:** the **title** *Good Neighbour* (earned only, worn under the name), and at the herd level a strip of **wish bunting** in every member's Barn for the week — the herd's own decor, gone Monday like the race.
- **Dead-ends:** a sleeping herd (few wishes) counts what it has; a solo player's set is simply unreachable this week, never named as a failure.
- **Runaway:** wishes are one per pig and reroll on 48 h — the set's size is the herd's size, so it cannot be farmed by a whale; a gift pays the giver alignment, not tickles beyond the flat 3.

### 3.4 Duplicates, everywhere

Three fates for a duplicate, all existing or in §4: give it (a friend's wish), pair it (a hand), trade it up (three alike → one of the next rarity, at the Trader). Toss stays for the impatient. Never a "sell".

---

## 4. The Trader

**What he is today:** the Ghost Sheep Trader arrives once per pig per local day (a seeded hour in 08–22, stays 6 h); a `Trader` row on the Barn button's fan; takes up to six Finds a visit from the Satchel for **applied tickles** (score, never the bank): 3 / 8 / 20 by rarity, ×2 on the one Find he fancies that day (rolled 70/25/5 like a wish). He is a **sink** — the only place a Find becomes a number, and a small one on purpose (≈6 tickles/day saturation).

**How the items relate to him:** every Find has exactly two exits — a friend (swap/gift) or the Trader — and one drain (toss). The set mechanics above never add an exit; they add reasons to hold before exiting (a hand, a family) and, once, a way to convert *sideways*:

**What he should offer (proposed, in order):**
1. **The fancy, as now** — one Find at ×2. Keep.
2. **Hands** (§3.2) — he pays the hand's multiplier on the whole visit. Some days his fancy is a hand.
3. **Trade-up** — *three alike for one of the next rarity*, his choice of which (seeded per day, shown on the sheet: "three pebbles and I'll give you a marble"). A sink (3 → 1), never a faucet; it is the Lost-things dead-end fix and the only way he ever *hands over* a Find. Rare has no trade-up (nothing above it).
4. **Never:** selling Finds for snouts or tickles, buying with money, rerolling wishes, taking anything but Finds. He does not offer furnishings, cosmetics, or Motes — those have their own homes.

**Open on the Trader:** (a) the wool rule (§1.1); (b) 40 tickles for a fancied whistle vs the swap's flat 3 — re-run `tools/balance_trader.py` with two errands a day per member and the hand multipliers; (c) whether the fancy should ever be a *family* ("anything from the brook, double") — cheap, and it teaches families.

---

## 5. Server shape (sketch)

- `pig_errands (id, user_id, pig_id, target_find_id?, for_user_id?, started_at, ends_at, seed, status out|back|kept|given|recalled, result_find_ids text[], nonce)`, UNIQUE (user_id, pig_id, local_day).
- `pig_stats` are **catalog**, not rows: `constants/pigs.ts` gains `nose/trot/pockets/glint` + `family`; the server mirrors them in `app_settings.errand_tuning.pigs` so odds are server-owned.
- Family membership: `satchel_finds.family` column (migration adds it; the client catalog mirrors it).
- Set completion: `find_sets (user_id, set_id, completed_at)` written by the same RPC that moves a Find into the bag (dig receipt, errand claim, swap) — checked on every bag write, granted once, idempotent.
- Hands: judged inside `trade_with_trader` over the finds handed in that visit; multiplier applied to the applied-tickles total.
- Trade-up: `trade_up_with_trader(find_id, nonce)` — deletes three rows, inserts one, ledgered in `trader_sales` with `kind = 'trade_up'`.

---

## 6. What this leaves open

1. The family assignments and the four keepsakes' art (four shelf pieces + one room) — the reward pipeline lens: budget before promising.
2. Whether the Hedgerow room is the right "all four" prize, or a title is enough.
3. The wish bias toward a two-of-three family: fun, or does it make wishes feel rigged? (It is invisible unless we say it; I'd say it: *"Rosie's been thinking about the brook."*)
4. Growth (§2.3): none in v1 — confirm.
5. The Trader's fancy as a hand or a family: yes to both, or keep him simple for one more build?
