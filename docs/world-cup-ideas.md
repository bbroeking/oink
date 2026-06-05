# World Cup Ideas

> **Status: BUILDING — standalone day-one add-in.** Not Season 2, not tied to
> alignment. A self-contained, fun World Cup drop shipped for opening day.
> Lives on its own isolated branch (`world-cup-event`) so it can be built and
> pushed independently, a couple of days **before** the tournament kicks off.

## Ship plan

- **Branch:** `world-cup-event` (isolated, so the build is clean of unrelated
  in-flight work).
- **Target:** build + push **~June 9–10, 2026** — a day or two before the
  **World Cup opens June 11**, so it's live for day one.
- **Scope discipline:** day-one fun, not a season system. Country cosmetics +
  a special World Cup shop are the must-haves; the pick'em and meta-board are
  stretch.

## Why now

The **men's FIFA World Cup 2026 runs ~June 11 – July 19, 2026** (USA / Canada
/ Mexico, 48 teams). That's *right now* — a real-world tentpole with built-in
national pride and daily drama. We surf it with a cozy add-in, independent of
Season 1 / Judgement Day (Jul 8–15) — no entanglement, just a parallel good
time.

Cozy-pig framing: a barnyard "Hog Cup" / "Snout Cup" riding the real
tournament — pigs in tiny kits, fan scarves, a ball to nudge around the
pasture. Keep it whimsical, not a licensed FIFA reskin (no real badges,
anthems, or team marks — see Legal notes).

---

## 1. Country identity — "Fly Your Colors"

The ask: let users **show off a specific country all the time**, not just a
one-off cosmetic.

- **Allegiance** — a persistent country pledge, parallel to [[Alignment]].
  You pick a country and it rides with you everywhere: a flag chip next to
  your name in the Sounder, Leaderboard, and on Visits; a little flag planted
  in your Barn exterior. Identity, like Generous/Greedy — durable, visible,
  social.
- **Flag cosmetics** (equippable, route to existing cosmetic slots):
  - Flag **cape / banner** on the pig's back
  - Flag **face paint** (two stripes on the snout)
  - Country **kit / jersey** (body cosmetic in national colors)
  - Fan **scarf** held up between hooves (very cozy, very football)
  - Flag **bunting** strung across the Barn interior (habitat slot)
- **Switching cost** — allegiance is free to set once, small snout cost to
  switch (so it means something), OR locked for the tournament once chosen
  ("ride or die with your country").
- **Asset scope — ALL countries.** *(Decided.)* Every FIFA nation (~211), not
  just the 48 qualified teams — anyone can represent their country. Each
  country gets:
  - its **flag** (cosmetic), and
  - **one unique signature item beyond the flag** — a culturally/footballing-
    iconic accessory (cuisine, fauna, landmark, traditional dress, team
    heritage), in cozy-pig style. The full per-country list of signature items
    + titles is generated in **`world-cup-countries.md`**.
- **Country titles** — an earnable/representable title per nation alongside
  the cosmetics (e.g. "Samba Star", "Albiceleste Faithful").

## 2. The pick'em — "Pundit Pig" / "The Prediction Pen"

The ask: pseudo-gamble on matches, make picks, earn an extra tickle/sound/etc.

**Core loop (the safe version):**
- Each matchday, surface the day's real fixtures. Player **predicts** the
  winner (or scoreline for bonus). **Free to enter.**
- Correct pick → reward in **tickles** (great fit: these can be **over-cap**
  rewards — same `GREATEST` regen-clamp fix the [[Trough]] needs, so the two
  features share the plumbing). Could also pay snouts or a cosmetic token.
- **Streak bonus** — N correct picks in a row escalates the reward (mirrors
  the Devotion/streak feel already in the game).
- **Bracket mode** — for the knockout rounds, predict the whole bracket up
  front for a big cosmetic payout (e.g. a Golden Ball hat).
- **Sounder pick'em** — a friends leaderboard of prediction records. Pure
  social bragging, no stakes. "briguy went 6-for-6 on matchday 3."

**Why this is allowed (the Apple question):**
- It's **free-to-play prediction**, not gambling. No real money in, no cash
  out, rewards are in-game only. This is exactly how ESPN/Yahoo/official FIFA
  pick'em games operate — they carry no 17+ gambling gate.
- Real-money gaming (Guideline 5.3.3/5.3.4) needs licensing, geo-restriction,
  and a 17+ rating **only when real money is wagered or won**. None here.
- Keep the **language clean**: "predict / pick / bracket," never
  "bet / wager / odds / stake." No casino styling.
- Reward must be **deterministic for a correct prediction** (skill), not a
  randomized payout you bought — that would stray into loot-box odds-
  disclosure territory. Picks are free and reward-on-correct, so we're clear.

**The riskier variant (flag for legal review, probably NOT v1):**
- "**Stake** snouts on a pick, win more if right." Wagering virtual currency
  on the outcome of real sporting events — even with no cash-out — can be
  read as sports betting and is a compliance gray zone. Same family as the
  raffle problem we dodged on the Trough. Recommend **shelve it**; ship the
  free reward-on-correct version, which gets ~all the fun without the risk.

## 3. Soccer cosmetics (drop-in, like any other item)

- **Soccer ball** — a held item, *and* a ball in the Barn exterior that Rosie
  can nudge (ambient toy, like the Garden).
- **Cleats for your hooves** ("cleats for your peg") — foot cosmetic.
- **Goalie gloves**, **captain's armband**, **sweatband**, **fan scarf**,
  **mini-trophy** (habitat centerpiece), **vuvuzela / fan horn** (doubles as
  a sound cosmetic — see below).
## 3b. The special World Cup Shop *(must-have)*

A dedicated, themed **World Cup shop** — a distinct surface (or a takeover
section of the existing Shop) that goes live for opening day and houses the
whole event drop in one place:

- **Country racks** — flag + signature item + title for each nation (see
  `world-cup-countries.md`).
- **Neutral soccer gear** — ball, cleats, scarf, gloves, armband, trophy.
- Snout-priced, with maybe a premium "support your country" bundle.
- Themed dressing (stadium/pitch motif) so it feels like an event, not just
  new rows in the normal shop.

This is the centerpiece of the day-one drop — the place players go to kit out
for the tournament.

## 4. Sounds

- **Crowd roar / goal cheer** SFX on a big action during the event (a goal
  when your picked team wins, a correct bracket, etc.).
- **Fan horn** as an equippable tickle sound.
- ⚠ **No real national anthems** (licensing). Use generic stadium ambience /
  an original cozy "hog cup" jingle.

## 5. Country collective / meta-leaderboard

- Aggregate all players by allegiance → "**which country's sounder is most
  generous / most active**" global board. Cross it with [[Alignment]] for a
  fun meta ("Brazil's pigs are the most generous in the world"). National
  pride = strong belonging hook, very [[evoke-online-game-feel]].

## 6. Live-ops cadence

- Anchor to the **real fixture calendar**: daily matchday picks (group stage),
  bracket lock before knockouts, a **Final-day** crescendo.
- A countdown + daily "matchday is live" nudge (reuse push plumbing).
- Decide the Judgement-Day interaction: does the Hog Cup **pause/blend** with
  the finale, or run as a distinct overlay event?

---

## Day-one scope (what actually ships ~June 9–10)

**Must-have (the drop):**
1. **All-country cosmetics** — flag + one signature item + title per nation
   (`world-cup-countries.md`), with an **allegiance** pick so you represent
   your country everywhere.
2. **The special World Cup Shop** — the themed surface housing it all.
3. **Neutral soccer gear** — ball, cleats, scarf, gloves, trophy.

**Stretch (only if it fits the timeline):**
- Free pick'em with tickle rewards (shares the over-cap plumbing).
- Country meta-leaderboard, custom event sounds.

**Explicitly out for day one:** staked picks, full bracket mode, mini-pass.

## Open threads

- Allegiance: lock-for-tournament vs free-switch-with-cost?
- Signature items: one tier/price for all, or rarity-vary by nation?
- Pick'em (if it makes the cut): tickles vs snouts vs cosmetic tokens?
- Shop: a separate surface, or a takeover section of the existing Shop?
- Premium "support your country" bundle — yes, and at what price?
