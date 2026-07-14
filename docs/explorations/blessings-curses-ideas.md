# Blessings & Curses — new-kinds exploration

*2026-07-12 · design ideation only, nothing here is committed. Charter lens: Connect · Collect · Contend (`SKILL.md`). Craft lens: `docs/design/taste-standard.md`. Current system: `docs/wiki/blessings-curses-effects.md`.*

## Where we are today

Blessings and curses are the Season 0 friend ritual, lightly reskinned for Season 2: one castable kind per day (`DOY % 4` rotation, mirrored client/server), one cast per (sender, receiver) per UTC day, 3 casts/sender/day, friends-only (blessings now reach crewmates too). The whole system runs on exactly **two mechanical verbs** — a regen multiplier (`warm_tea`/`mud_wrap` ×2 speed, `sluggish_snout` ×½, via `regen_secs_for`) and an instant currency nudge (`halo_kiss` +5 tickles, `bountiful_snouts` +5 snouts, `coin_pinch` −1..3 snouts, receiver-capped −10/day) — plus one cosmetic haze (`goblin_whisper`) and a lucky-pig primer (`sun_beam`). Anti-grief is solid (caps, blessing-clears-curses, 5-snout cleanse), and casting shifts alignment ±1. **Why it's thin:** the rotation means players never *choose* anything; the effects are private (nobody but the receiver ever sees a Hoofprint); and nothing casts touch what Season 1+ actually built — the Truffle Patch, the Dig-Off, the Burrow Book, happiness, visits. The ritual is a warm ping, but it's a ping into a system the game has outgrown.

## Design constraints (from the charter + economy reality)

- **No XP faucets** — season XP is mid-rebalance; no idea below prints XP.
- **No race-outcome effects** — the Dig-Off is fair-by-construction (finds per digging snout); blessings may move *timing and information*, never *finds*.
- **Curses are "a little mischief"** (release-notes voice), never griefing: cosmetic, brief, self-clearing, sometimes secretly kind. No shame states.
- **Grinder-proof** — every currency-touching idea carries a hard receiver-side daily cap, mirroring the `coin_pinch` pattern.
- One sentence per mechanic, or it dies here.

## The ideas

| # | name | type | mood | pillar | weight |
|---|------|------|------|--------|--------|
| 1 | warm straw | blessing | cozy | Connect | S |
| 2 | open gate | blessing | cozy | Connect | S |
| 3 | moonlit trough | blessing | rhythm | Connect | S |
| 4 | second sniff | blessing | helpful | Collect + Contend | M |
| 5 | rooster's favor | blessing | rhythm | Contend + Connect | M |
| 6 | trotter pact | blessing (paired) | social-pairing | Connect | M |
| 7 | carried on the wind | blessing (chain) | social-pairing | Connect | M |
| 8 | matching mud masks | blessing (paired) | social-pairing | Connect + Collect | M/L |
| 9 | squeaky floorboards | curse | mischief | Connect | S |
| 10 | mud mustache | curse | mischief | Connect + Collect | M |
| 11 | borrowed acorn | curse | mischief (secretly kind) | Connect | M |
| 12 | the hungerer's hiccup | curse | seasonal wildcard | Contend | S/M |
| 13 | blue moon | blessing | seasonal wildcard | Collect + Connect | M/L |

---

### 1 · warm straw — blessing, cozy, **S**
- **Player line:** "Tucked in warm — your pig's happiness won't slip tonight."
- **Effect:** pauses happiness *decay* on the receiver for 12h. Never raises it. One active at a time (re-casts refresh, don't stack).
- **Pillar:** Connect — the blessing for the friend who's traveling / busy; caring for someone's pig while they're away.
- **Anti-abuse:** moves no currency; can't push happiness above where play put it, so there's nothing to farm — it only slows a loss.
- **Weight:** S — one `EXISTS` check in the happiness-decay read path, same shape as `regen_secs_for`.

### 2 · open gate — blessing, cozy, **S**
- **Player line:** "The gate's propped open — two extra visits today."
- **Effect:** receiver's daily barn-visit budget goes 5 → 7 until UTC midnight. Doesn't stack past 7.
- **Pillar:** Connect — a blessing whose *payout is more social play*; the effect literally spends itself on friends.
- **Anti-abuse:** visits already cost a tickle per tap and carry per-target cooldowns + Tired; extra budget adds ceiling, not currency.
- **Weight:** S — the visit-budget check reads one more table.

### 3 · moonlit trough — blessing, rhythm, **S**
- **Player line:** "The trough glows tonight — your tickle bank holds ten more while you sleep."
- **Effect:** receiver's tickle-bank cap +10 for the next 8h (25→35, VIP 50→60). Regen rate unchanged.
- **Pillar:** Connect — the "sleep well" blessing; it respects rendezvous-over-grind by paying the hours *between* sessions.
- **Anti-abuse:** no mint — the pig still regenerates at the same speed; the cap bonus only prevents overnight overflow waste. Cap: one active per receiver.
- **Weight:** S — cap term joins `regen_secs_for`'s sibling read; the three tickle RPCs already centralize cap logic.

### 4 · second sniff — blessing, helpful, **M**
- **Player line:** "A friend's nose on your side — one mystery tile on your next dig comes into focus."
- **Effect:** on the receiver's next Truffle Patch board, exactly one server-chosen silhouette resolves (truffle vs unique) before they commit a dig. Consumed on board entry; one per feeding per receiver, further casts queue for the next feeding (max queue 1).
- **Pillar:** Collect (feeds the Burrow Book hunt) + Contend (better choices under the 60–70%-diggable pressure) — and it's information, never an extra find, so the race math stays fair-by-construction.
- **Anti-abuse:** reveals knowledge, mints nothing; the board's contents are unchanged; 1/feeding cap kills alt-account stacking.
- **Weight:** M — a flag on the patch-session row + one reveal in the board payload.

### 5 · rooster's favor — blessing, rhythm, **M**
- **Player line:** "The rooster crows early for you — your next feeding opens an hour sooner."
- **Effect:** receiver's next 8h feeding cooldown is shortened by 1h (floor 0). One per feeding per receiver; doesn't grant extra digs, only shifts *when*.
- **Pillar:** Contend + Connect — "we dig at 8, I bought you the early bell" is a text message; it lets a crew synchronize a feeding around one member's schedule.
- **Anti-abuse:** total digs/day is unchanged (the cooldown chain just phase-shifts); 1/feeding cap prevents chaining multiple −1h from different senders.
- **Weight:** M — an offset column on the patch cooldown read, honored in one RPC.

### 6 · trotter pact — blessing (paired), social-pairing, **M**
- **Player line:** "Link trotters — you both brew tickles faster while you both keep showing up."
- **Effect:** sender *and* receiver get regen ×1.33 speed (interval ×0.75) for 24h — but the boost is only live during hours where **both** have tickled that UTC day. One pact active per player; a new pact replaces the old.
- **Pillar:** Connect — the first blessing that costs the *sender* presence too; "did you tickle yet? our pact's asleep" is the loop.
- **Anti-abuse:** regen multiplier only (no mint), weaker than warm_tea's ×2 and mutually gated on activity — an idle alt gives you nothing.
- **Weight:** M — a `pacts` pair-row + two-sided condition folded into `regen_secs_for`.

### 7 · carried on the wind — blessing (chain), social-pairing, **M**
- **Player line:** "A blessing on the wind — take its warmth, then send it onward."
- **Effect:** landing grants +3 tickles; the receiver may forward it **once** within 24h to any friend who hasn't held this gust. Chain caps at 5 hops; the Hoofprint shows the hop count and first sender's name ("3rd gust of maple's wind").
- **Pillar:** Connect — a blessing that travels *across* the friend graph, giving strangers-of-friends a shared artifact; the origin-name is a tiny reason to remember someone.
- **Anti-abuse:** total mint bounded at 15 tickles per gust (5×3), one forward per holder, no revisits — a ring of alts exhausts it in 5 hops for less than three halo_kisses.
- **Weight:** M — a `gust_id` + `hop` on the blessings row and a forward RPC.

### 8 · matching mud masks — blessing (paired), social-pairing, **M/L**
- **Player line:** "Matching mud masks for you two — dig the same feeding and the Burrow Book remembers it."
- **Effect:** both pigs wear the mask cosmetic 24h (visible to visitors). If both maskholders dig during the same feeding window, each earns a margin stamp in the Burrow Book (pure cosmetic collectible, seasonal stamp art, no currency). One mask pair active per player.
- **Pillar:** Connect (a visible two-player artifact) + Collect (the Book gains a social page — proof you were there *together*).
- **Anti-abuse:** the stamp is uncounted cosmetics — nothing to grind; digs themselves are unmodified.
- **Weight:** M/L — overlay art + a Book page; mechanically just a pair-row and a stamp check on dig.

### 9 · squeaky floorboards — curse, mischief, **S**
- **Player line:** "Every tap in their barn goes *honk* for a while."
- **Effect:** 4h; all taps on the cursed pig (owner's *and* visitors') play a silly squeak/honk + a wobble. Zero mechanical change.
- **Pillar:** Connect — goblin_whisper's proven "spooky but harmless" shape, but *funny and audible to guests*, which finally makes a curse visible to someone besides the receiver.
- **Anti-abuse:** purely cosmetic; nothing to farm.
- **Weight:** S — one kind string + a sound/animation branch in the tap handler.

### 10 · mud mustache — curse, mischief, **M**
- **Player line:** "Paints a magnificent mud mustache on their pig — ten quick tickles scrub it off."
- **Effect:** 6h cosmetic overlay on Rosie, visible to visitors; 10 taps within the window wash it early (taps still bank normally). Washing early plays a splash; letting it ride is equally fine.
- **Pillar:** Connect + Collect-adjacent — the curse *is* a temporary cosmetic, and the wash-off gives the receiver a tiny playful verb instead of a cleanse fee.
- **Anti-abuse:** cosmetic; the wash-off consumes taps the receiver was banking anyway, so cursing someone actually nudges them to play.
- **Weight:** M — one overlay sprite (RelSpec via placement studio) + a tap-counter on the effect row.

### 11 · borrowed acorn — curse, mischief that's secretly kind, **M**
- **Player line:** "Pinches one snout and buries it in their mud — dug back up, it's grown into two."
- **Effect:** takes 1 snout from the receiver now; a buried-acorn marker sits in their patch mud, and their next patch visit within 48h digs it up for 2 snouts (net +1). Unclaimed after 48h it just returns the original 1. Cap: one acorn per receiver per day; the net +1 counts inside the existing −10/+10 daily receiver envelope.
- **Pillar:** Connect — the goblin-coded cast whose punchline is generosity; "someone buried something in your mud" is a warm push notification wearing a mask.
- **Anti-abuse:** net mint hard-capped at +1 snout/receiver/day; requires the *receiver* to show up at the patch, so alt-rings can't idle-farm it; sender gains nothing.
- **Weight:** M — a marker row + a claim branch on patch entry; snout moves ride the existing counter idiom.

### 12 · the hungerer's hiccup — curse, seasonal wildcard, **S/M**
- **Player line:** "The Hungerer's shadow falls on their barn — but pigs dig angriest in the dark."
- **Effect (Season of the Hunger only):** 4h green-shadow haze (goblin_whisper's visual family); while shadowed, each of the receiver's Truffle Patch finds drains **+1 extra Hunger from the world boss**. No personal payout of any kind.
- **Pillar:** Contend — a curse that conscripts its victim into the herd's war; being cursed makes your next dig *matter more*, which is the warmest possible sting.
- **Anti-abuse:** the bonus hits only the global boss meter (no truffles, no finds, no race score, no XP); bounded by the receiver's own dig cooldowns; caps at 3 shadowed pigs per sounder per feeding so a big crew can't chain-curse the boss down.
- **Weight:** S/M — one term in the boss-drain write + reuse of the haze presentation. Rotates out with the season, which keeps the rotation feeling alive.

### 13 · blue moon — blessing, seasonal wildcard, **M/L**
- **Player line:** "Once in a blue moon, the blessing is the moon itself."
- **Effect:** on full-moon UTC dates the daily blessing slot is overridden by `blue_moon`: the receiver's pig trails moonglow for 24h (cosmetic), and every moonglow pig that digs that night lights one lantern on a shared season-page tableau — a once-a-month collective picture, redrawn each moon. No currency, no XP.
- **Pillar:** Collect (a rare, dated, earned-only visual — "I was there for the July moon") + Connect (the tableau is the whole barnyard in one image).
- **Anti-abuse:** purely cosmetic + a shared mural; scarcity is calendar-driven and identical for everyone.
- **Weight:** M/L — a rotation override (same shape as the `world_boss` flag skew), trail FX via the animated-cosmetic pipeline, one tableau surface.

---

## Start here — the three I'd ship first

1. **squeaky floorboards (#9)** — S-weight, zero economy surface, and it fixes the deepest current flaw (curses nobody can see) by making mischief audible to visitors. Instant tone-setter.
2. **second sniff (#4)** — the first ritual that touches the Truffle Patch; it makes blessings matter inside the loop the game actually revolves around now, and information-not-finds keeps the race provably fair.
3. **trotter pact (#6)** — pure Connect with a daily-rhythm heartbeat; it converts a one-tap ritual into a standing two-player promise, and its activity gate is grinder-proof by construction.

*(Honorable mention: warm straw (#1) is the cheapest pure-warmth win if an S-only patch is wanted.)*

Open questions for the founder, collected:
- Should new kinds join the `DOY % 4` rotation (growing it to `% N`), or is it time for a small *choice* (pick 1 of 2 each day)? The rotation is why the system feels samey — but choice adds a decision the one-sentence lens must survive.
- Does `blue_moon` overriding the daily slot conflict with "the whole barnyard casts the same blessing on the same day"? (I'd argue it *is* that principle, intensified.)
- For `borrowed acorn`: comfortable with a curse that's net-positive for the receiver, or does that muddy what "curse" means for alignment (−1 to sender for a kindness)?
