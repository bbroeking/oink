# The pig searches — what the Pen is for (2026-09-17)

Founder: *"We should rethink the Pen. What is it really, and what's the point of the other pigs? … the pig should be able to search for items."*

## What the Pen is

Today the Pen is a one-time purchase screen: pick a companion, then a toggle for who greets you at home. After the pick it has no reason to be opened again. The other pigs have no job.

**The Pen becomes the errand board.** Rosie is Home — the pig you tickle, whose mood you read. The other pigs are the ones who *go*: each can be sent out to look for something and comes back hours later with it, or without it. The Pen is where you send them and where they report back. This is the one-sentence version of Beyond the Hedge / Rosie's Ramble (both designed and prototyped, neither shipped, both too deep): no Tools, Packs, Intentions or fights — a pig, a thing to look for, a clock, a return.

**What they search for: Finds.** The twelve pocketable countryside objects (`Find`, `Satchel`) — river pebble, blue feather, four-leaf clover, old key… The Find economy already has the right shape and, crucially, the right *sinks*: a Find is only ever given to a friend whose pig wishes for it (`Swap`/`Gift`), traded to the Ghost Sheep Trader, or tossed. It never becomes currency for the finder. So a second faucet for Finds is safe in a way a second faucet for Snouts or furnishings would not be. Not furnishings (Furnish stays the shop for those; the Barn Draw and Trough are their random lane already), not cosmetics (bought or earned on the pass), not Snouts (a closed mint).

Charter check: *Connect* — the strongest version of this sends a pig to find what a **friend's** pig is wishing for; the return is a text message ("Bandit found Maya's blue feather"). *Collect* — the Field Guide's find silhouettes lift on first carry; a searcher lifts them for you. *Contend* — deliberately none: nothing a searching pig brings back touches the dig, the race or the season board (the "dig helper" variant is rejected below). Fair by construction: server-rolled, one search per pig per day, results only ever *move* to friends. Losing still warm: an empty-trotters return is a muddy postcard, never a fail. Reward pipeline: no new art per find — the twelve glyphs exist; one new sprite family per pig (walking away / walking back, from the Lounge walk strips) is the whole art bill.

**The membership problem, stated plainly.** Companions are Slop Club's hook. If only companions search, members buy a faucet — pay-for-advantage in a costume. Every design below therefore has a **free lane**: a non-member can send **Rosie** (the yard is empty while she's out, and you can't tickle her — a real cost you choose to pay, usually overnight). Membership then buys what it should: a second pig, so Rosie can stay home; a pig with its own personality on the errand. Expression and convenience, never a thing a free player can't do.

---

## Design A · The Errand — "go and find this"

*A pig is sent for one specific Find, usually one a friend is wishing for.*

**1. What the user sees / trigger.** The Pen's paddock shows who's home. Each pig's card carries one action: **Send Bandit to look for…** → a sheet lists the open wishes in your sounder, friend first ("Maya's Pickles wishes for a blue feather"), then your own pig's wish, then *anything* (a server-rolled target). Pick one → a confirm ticket: *Bandit will look for a blue feather · back in about 4h · one errand a day.* The same door exists on the Friends row where a wish is already marked ("you have it" today; "send a pig for it" tomorrow).

**2. What the pig does, step by step.**
1. `send_pig(pig_id, target_find_id, for_user_id?, nonce)` — server writes `pig_errands` (status `out`, `ends_at = now + duration`, a committed seed), one per (user, pig, local day) like `trader_visits`.
2. Bandit walks out of the paddock (the Lounge walk strip, then he's gone); the medallion wears a **dashed** ring and a hand line "out looking · back ~7:40pm". On Home, if Bandit was the greeter, Rosie greets instead and the fan shows a **Bandit · out** row.
3. Nothing happens in between. No mid-way taps, no mini-game. Rendezvous over grind.
4. At `ends_at` a push fires ("Bandit's back") via the existing notification routing; the result is rolled from the seed at that moment (`resolve_errand`), never on the client.
5. Odds are server-tuned (`app_settings.errand_tuning`, compiled fallback): a first cut of 65% for a common target, 45% uncommon, 25% rare, and a small chance of a *different* find instead ("he got distracted"). Honest, small numbers.

**3. How results come back.** Opening the Pen after the return plays the **homecoming**: Bandit walks back into the paddock carrying the find in his mouth (the find glyph anchored to `snout`), a tape-note sticker: *"blue feather — for Maya's Pickles"*. One button: **Give it to Maya** (does the `Swap` gift, one tap, the pair's tickles and the alignment tick as today) or **Keep it** (Satchel). An *anything* errand lands in the Satchel with **Keep**. The while-away modal gets a `pig_errand` line, the Barn button's fan a **Bandit · back** row, and the Field Guide lifts the silhouette if it's a first.

**4. Pen and Furnish.** The Pen's card action changes from "who greets you at home" to "what is this pig doing" — the home toggle folds into the card as a second row (At home / Out looking / In the Pen). Medallions read status at a glance (solid = home, dashed = out, sun dot = back with something). Furnish untouched.

**5. Edge cases.**
- *Empty hands:* Bandit returns with muddy trotters and a hand line ("looked everywhere; the feather wasn't there today"). No consolation currency (that would be a faucet). The wish stays open; tomorrow's errand is free again.
- *Satchel full:* he holds it — the sticker says *he's keeping it in his mouth until there's room* — Give still works because a gift never enters your bag.
- *Wish already fulfilled while he was out:* the find lands in the Satchel with a warm line ("someone beat him to it"). Never lost.
- *Loading:* the send is optimistic (he walks out at once); if the RPC fails he turns around at the gate and a toast says so. Return resolution is a server read on open; until it arrives the paddock keeps him out and the fan row says *back — opening the gate…*
- *Errors:* `errand_already_out`, `errand_used_today`, `target_not_wished` (the friend rerolled) all resolve to one toast each in the roster-message voice.
- *Cancel:* **Call him home** ends the errand at once, empty-handed, and *does not* refund the day (a recall is a choice, not a retry).
- *Retry:* a failed send never consumes the day. Two searches a day is the members' upsell? No — one per pig per day, full stop; members simply have two pigs.

**Tradeoffs.** Strongest social loop; the picker sheet is a real UI surface; a sounder with no open wishes falls back to *anything*, which is the weaker version.

---

## Design B · The Rounds — a standing job, no daily ask

*You don't send the pig; you give it a job once, and it keeps at it.*

**1. Trigger.** The pig's card has a **job** segment — At home · In the Pen · On the rounds — the same place the home toggle lives today. Set it to *On the rounds* once; that's the whole ask. This is the Contraption pattern (`Auto-Tickler`): one verb, a policy, a limit, a stopping condition.

**2. What the pig does.** Every feeding tick (8h, server cron) a pig on the rounds may bring back one Find (server-rolled, no target; rarity from the wish-roll distribution 70/25/5). Results pin to the Pen's **board** — a corkboard sticker under the paddock — up to **three** unclaimed pins, then he stops (the stopping condition) until you visit. He's drawn in the paddock walking in and out on a loop while on the rounds.

**3. Results.** The board holds postcards: the find glyph, when, one hand line. Tap a pin → **Keep** (Satchel) or, if a friend's pig wishes for it, **Give to Maya** (the same one-tap gift). A pin with nothing on it is a muddy pawprint ("nothing this time"). The fan's row shows *Bandit · 2 on the board*; the while-away modal counts them.

**4. Pen and Furnish.** The Pen becomes a place you come back to (the board fills), which the current Pen is not. The membership toggle and job segment are one control. Furnish untouched.

**5. Edge cases.** Board full → he rests (no loss, no shame). Satchel full → pins wait on the board; nothing is dropped. Cancel → set the segment to *At home* / *In the Pen*; unclaimed pins stay. Errors → the segment snaps back with a toast. Loading → the board shows a `LoadingBeat` ("checking the board"); pins never render from a guess.

**Tradeoffs.** Zero daily friction, fits the game's "calls you at human intervals" belief, and needs no picker. But no target means no "I sent him for *your* feather" moment — it is a Collect loop that happens to feed Connect, not a Connect loop. It is also closer to an idle-income faucet, so the board cap and the once-per-tick rate are load-bearing.

---

## Design C · The Foray — pick a place, not a thing

*Three places at pig height — the hedge, the brook, the orchard — each with its own find table.*

**1. Trigger.** The card's action is **Send Bandit to…** → three place tiles (painted, in the Barn background style). Each tile shows the finds that live there as silhouettes/lifted glyphs (so the Field Guide and the map are one thing) and a duration (hedge 2h · brook 4h · orchard 8h; longer = rarer table).

**2–3. The pig and the return.** As A, but the return is a **postcard from the place** (the expedition slice's `PostcardModal`, already built): one painted scene, the find, one comedy beat. Keep / Give as in A.

**4. Pen and Furnish.** The Pen grows a map row; the place art is the Adventure universe's first shipped pixels. Furnish untouched.

**5. Edge cases.** As A. A place with every find already lifted in the Guide still pays (finds are for giving) but says so.

**Tradeoffs.** The most *world* per tap — it makes Beyond the Hedge real without its depth — but it costs three painted places and a postcard per place (the reward-pipeline lens says budget this before promising it), and "where" is a weaker question than "for whom".

---

## Rejected · the Dig Helper

A companion that comes into the Truffle Patch and sniffs a tile or banks a Dig Find. Rejected by lens #3/#4: it hands members power in the competitive dig — pay-for-advantage in a costume — and it makes a search out of the one surface that must stay fair by construction.

## Recommendation

**Build A, with B's board as its inbox.** A is the design that makes the Pen a Connect surface — "I sent Bandit for your feather" is the text message the charter asks every feature to produce — and it reuses the whole Find/Wish/Swap/Trader machinery without a new economy. Use B's corkboard as where returns wait (so a return never needs to be caught live), and keep C's places as the *next* layer if the errand earns it: a place is a nice reason for a find to be somewhere, but "for whom" is the reason to send a pig at all.

Server sketch: `pig_errands (id, user_id, pig_id, target_find_id?, for_user_id?, started_at, ends_at, seed, status out|back|kept|given|recalled, result_find_id?, nonce)`, UNIQUE (user_id, pig_id, local_day); RPCs `send_pig`, `pig_errands()` (materialises returns lazily like `trader_status()`), `claim_errand(id, action keep|give)`, `recall_pig(id)`; tuning in `app_settings.errand_tuning` with a compiled fallback (server config over constants). Push at `ends_at` through the existing routing. Art: one *walk out / walk in* pass per pig from the Lounge strips; the find rides the `snout` anchor.

Free lane in every design: a non-member sends **Rosie** (Home is empty while she's out, and the yard says so). A member's companion is the pig that lets Rosie stay.
