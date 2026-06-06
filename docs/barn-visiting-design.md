# Barn visiting — mechanic design (depth)

Status: **design / building.** Branch `social-barn-visiting`. The MVP (visit a
profile → see their pig → tickle it for them, `tickle_at_barn` RPC) is built;
this doc works out the full mechanic so we build toward something with legs.

## The spine (the one decision everything hangs off)

**Visiting is GIVING, not earning.** A visitor *spends* a little (their
generosity, a small cost, or a bounded daily budget) to leave something for the
host. The host benefits; the visitor's "reward" is social + identity + soft
progression, not raw currency.

Why this is the right spine:
- **Kills farming at the root.** If a visit minted free currency for the
  visitor, sockpuppets + tap-bots would drain it. If a visit *gives*, the only
  way to "farm" is to give away your own stuff — self-defeating.
- **Feeds the existing alignment axis.** Giving = generous acts → raises
  `alignment_score`. Barn visiting becomes the game's most natural, repeatable
  source of generosity. Hoarders who never visit drift goblin. Free synergy
  with the Season-1 alignment teeth. See [[alignment-teeth-spec]].
- **Makes "being visited" the reward for playing well.** Popular/active pigs get
  visited more → get more gifts → a gentle rich-get-loved loop that rewards
  showing up, not whaling.

Everything below serves that spine.

---

## 1. What you SEE on a visit

The "barn" is their identity made visible:
- Their pig wearing their full loadout (hat / aura / held / flag / background).
- Their **vibe**: alignment (angel/goblin), active title, lifetime tickles.
- **Barn state** signals that invite an action:
  - tickle bank fullness ("their pig looks ready for a tickle" vs "well-fed")
  - last-active ("tickled 3h ago")
  - an **open Trough** (→ one-tap chip-in right there)
  - World Cup allegiance flag flying
- **Guestbook**: the last N visitors + their stamps/notes. Being visited leaves
  a visible trace — that's the payoff for the host.

## 2. What you can DO (interaction menu)

Tiered by build cost; MVP first.

- **Tickle their pig** *(MVP, built)* — top off their tickle bank (+N, over-cap).
  The social version of the tickle-trade.
- **Leave a gift** — the core "little reward" loop (see §3).
- **Leave a stamp / reaction** — a sticker on their guestbook ("🐷 was here",
  a hoof-print, a themed stamp). Cheap, expressive, collectible.
- **Bury / dig a truffle** — the charming pig-native twist (see §3).
- **Bless them** — route into the existing bless ritual from the barn.
- **Chip in to their Trough** — if one's open, fund it in one tap.

## 3. The gift / reward loop (the heart of it)

Three layers, increasing richness:

### a) Visit gift (the baseline warmth)
On a visit you leave a small gift the host claims later. Funded so it can't be
farmed — pick one model:
- **Generosity model (preferred):** the gift is granted to the host and the
  *visitor* earns a sliver of `alignment_score` (generous). No currency minted
  to the visitor. Bounded by the daily visit budget (§4).
- **Transfer model:** the gift comes out of the visitor's snouts (you literally
  give them 2 snouts). Pure transfer, zero-sum, unfarmable. Warmer if small.

Host experience: on return, the **while-away modal** says *"3 friends visited
your barn and left gifts — claim 9 tickles 🐷"* (reuses the existing
`send_system_announcement` + WhileAwayModal plumbing).

### b) Buried truffle (the surprise — pig-native + self-limiting)
The host **buries a truffle** in their barn (costs them a little). The **first
visitor that day digs it up** for a real reward. Self-limiting (one truffle,
first-come-first-served), creates a *reason to visit early + often*, and a
*reason to keep your barn worth visiting*. Truffle hunting is on-theme for pigs.
- Host sets it (optional, daily).
- First digger wins; everyone after sees "already dug — come back tomorrow."
- Could escalate: rarer truffles for higher-alignment hosts.

### c) Reciprocity & streaks (the push-pull)
- **Visit-back bonus:** if the host visits the visitor within X hours, *both*
  get a bonus. Turns a one-way gift into a back-and-forth.
- **Friendship streak:** visiting the same friend on consecutive days builds a
  streak → escalating rewards + maybe a friendship title. The "I visit you, you
  visit me" warmth made mechanical.

## 4. Limiting visits (economy + anti-abuse)

Layered levers — use as many as needed; the spine (§0) already removes the main
incentive to abuse.

- **Per-(visitor, host) cooldown** *(built: 1h)* — can't re-tickle the same barn
  repeatedly. For gifts, likely **once per host per day**.
- **Daily visit budget ("visit tickets"):** you get a regenerating pool (e.g.
  5–10/day) of *rewarded* visits. Beyond it you can still look + tickle, but no
  gift/alignment. A natural, legible rate-limit (mirrors the tickle bank).
- **Per-host distinct-visitor cap/day:** a host only gets *rewarded* visits from
  M distinct visitors/day, so they can't be sockpuppet-farmed and the gift pool
  is bounded.
- **Friends full / strangers reduced:** visiting friends pays full warmth;
  visiting strangers is "exploring" — collection-only (a passport stamp), no
  economy. Keeps the loop inside the real social graph and starves bot rings.
- **Diminishing returns:** repeat visits to the same barn in a window give less.
- **Alignment as soft governor:** since the payoff is generosity, not currency,
  there's little to gain by gaming it — the ceiling is "how generous can I look,"
  which is *fine* to maximize.

## 5. Tie-ins (why this glues the game together)

- **Alignment:** visiting + gifting is the cleanest generosity source. [[alignment-teeth-spec]]
- **The Trough:** visits drive Trough funding (one-tap chip-in from a barn). [[trough-pool-spec]]
- **Teams (push-pull):** a visit counts toward your team's collective "pull."
  Barn-visiting becomes a way to fight for your side. [[social-layer-ideas]]
- **World Cup:** see their allegiance flag; same-team visits could bonus.
- **While-away modal:** "friends visited while you were away" is pure delight on
  return, with plumbing that already exists.

## 6. Progression & collection

- **Barn passport:** a stamp per *unique* barn visited → milestones (10 / 50 /
  100 barns → titles, cosmetics). Gives stranger-visiting a point without an
  economy.
- **Guestbook on your own barn:** the running log of who visited + their stamps.
  Being visited is the reward for being active/decorated.
- **Friendship streaks:** per-friend visit streaks → friendship levels/titles.

## 7. Suggested staging

- **MVP (built):** visit a profile → see their pig → tickle it for them
  (+3 tickles, 1h cooldown, in-app notify).
- **v2 — the warmth loop:** visit gift (generosity model) + the while-away
  "friends visited" claim + the daily visit budget + per-host cap. Wire visiting
  into `alignment_score`. Add the Friends-tab entry point.
- **v3 — depth:** buried truffle, guestbook + stamps, reciprocity/streaks,
  barn passport, Trough chip-in from the barn.
- **v4 — meta:** visits feed Teams pull; WC same-team bonus.

## 8. Open questions

- Gift funding: **generosity model** (alignment + bounded grant) vs **transfer
  model** (out of your snouts)? (Leaning generosity — warmer, ties to alignment.)
- Visit budget size + regen rate (5/day? refill like tickles?).
- Friends-only economy vs strangers-reduced — how hard a line?
- Does the gift top off **tickles** (bank) or **snouts** (shop currency)? Tickles
  keeps it playful + uses the over-cap `grant_tickles` we already built.
- Is the **buried truffle** v3, or pull it earlier — it might be the single most
  "interesting" hook and worth fast-tracking.
