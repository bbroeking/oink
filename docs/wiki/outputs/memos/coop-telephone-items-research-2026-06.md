---
title: "Telephone Co-op & War-Item Systems — Research (June 2026)"
type: memo
date: 2026-06-14
tags: [research, co-op, async, items, mud-wars, miniclip]
---

# Telephone Co-op & War-Item Systems — Research (June 2026)

## TL;DR — Cross-cutting principles

Four research lenses (async/telephone mechanics, Miniclip/casual design, item systems, async fairness) converge on a single, coherent design for a cozy 5-person async crew war. The principles that show up in more than one lens:

1. **Parallelize, never serialize.** The fatal flaw of "telephone" chains is the single blocker — one no-show freezes everyone downstream (Diplomacy, Draw Something). Gartic Phone solves it with N concurrent chains so nobody waits idle; partner-events (Monopoly GO) solve it with a shared meter everyone fills from normal play. A 5-person crew has zero slack (Clash of Clans: inactives become dead slots at minimum war size), so the war must be a **collaborative artifact each member fills independently** — sum of parts, not a baton.

2. **The clock advances the war, never the slowest human.** Play-by-mail discipline: a fixed window (the proven casual sweet spot is **6-day partner events / week-long River Race**) resolves on schedule whether or not laggards respond. A missing member contributes 0 — graceful degradation, not a hard stall. Avoid griefable hard auto-skip.

3. **Low floor, flat ceiling.** This is the unifying fairness rule and it matches a cap-and-flatten economy. A **low, binary participation floor** ("log ≥1 action this war") kills the pure free-rider; a **flat/capped reward above the floor** kills both the whale-snowball and the DKP-gap snowball — and, per the collusion literature, capping payout is *itself* the strongest anti-alt tool because it starves alt-funneling of payoff.

4. **Everyone scores, win or lose; race, don't duel.** Clash Royale's "earn Fame win or lose" keeps casuals from being dead weight. A 3–5 crew *race* hides matchmaking lopsidedness (finishing 2nd of 5 feels fine; losing a duel feels bad). Pokémon GO's baseline-plus-nudge (everyone gets a floor reward, effort scales a small bonus) is the cozy-compatible compromise.

5. **The reveal/artifact is the reward.** Gartic's end-game album and Sky's "we made this together" prove no win/lose pressure is needed — authorship + surprise is the payoff, and it sidesteps Draw Something's "no win/lose → stale" trap by making the *novelty of the combined result* the hook.

6. **Volume of items comes from multiplier mechanics, not more unique art.** Rarity ladders, recolor/chroma variants, themed sets, battle-pass tracks, and seasonal vaulting turn a few dozen base assets into hundreds of desirable SKUs without devaluing the apex tier (where animation lives).

7. **Gift-framing, not guilt.** Snapchat-streak research is the cautionary tale (~70% of teens feel *obligated*; guilt becomes the motivator). Duolingo's ethical-streak playbook — forgiveness (freeze), earn-back through effort not money, collaboration over competition — is the antidote. Every payout reads as a gift the crew gives each other, never a debt the absent owe.

---

## Lens 1 — Async / "Telephone" mechanics

**The core pattern** is one shared artifact each player mutates in turn, seeing only the previous contribution — the digital descendant of *Exquisite Corpse* and *Eat Poop You Cat*. **Gartic Phone** is the mass-market reference: write a prompt → next player draws it → next re-captions the drawing, alternating text↔image. Two structural tricks to steal:

- **N parallel chains for N players** — each player starts their own chain and all advance in lockstep, so nobody waits idle. 5 players = 5 concurrent threads, each owned by one but built by all five. This is how the format hides latency.
- **The album/reveal is the product** — the payoff is the end-of-game reveal showing the original beside its warped final state.

**What makes it satisfying:** the "absurd evolution of information during transmission" — fun lives in the *gap* between intent and result. Skill disparity is mitigated by fellowship, *reframing failure as content* (mistakes are the entertainment). Fellowship over competition; the reveal as shared authorship.

**What makes it retentive:** time-shifting is the whole value prop (Words With Friends supported up to 40 simultaneous games; one study cited ~30% retention lift for async vs synchronous over six months). The **Zeigarnik / open-loop effect** — a pending turn is a literal unfinished task the brain wants to close. Anticipation during idle time (reviewing/planning, not dead air). **Push as the heartbeat** — open rates ~20% (10× email); best windows 8–9am and 6–8pm, plus a strong 9pm–midnight "nightly scroll" (~6.8% conversion); Tuesday (8.4%) and Sunday (8.1%) react best; emojis +20%, rich formats +25%, per-user send-time tailoring +40%.

**The social nudge:** system push ("it's your turn") is the baseline; **player-initiated nudge** (Words With Friends' tap-to-remind, streak-aware) is the underrated lever — peer pressure as a feature, cozy-compatible if framed as encouragement.

**The pitfalls (where chains die):**
- **Single-blocker problem** — Diplomacy hangs if one player neglects a turn.
- **Ghosting / mid-match abandonment** — mitigated by participation rewards.
- **Skip mechanics are double-edged** — Board Game Arena's auto-skip is exploitable (opportunists skip active players); any auto-skip needs guardrails.
- **Turn-deadline discipline (play-by-mail)** — fixed per-turn deadlines, game resolves on schedule regardless of laggards. The clock, not the slowest human, advances the game.
- **The Draw Something collapse** — the canonical cautionary tale: shed ~4M daily users in one month (14.3M→10.4M, Apr→May 2012). Causes: no win/lose loop (games "went on forever… became stale"), social overload (willingness to keep up declined as friends piled on), content exhaustion (ran out of 900 words), crashes + ToS change.

**Cozy framing:** Sky: Children of the Light is built on mutual assistance not rivalry — gift candles, guide spirits, no losing. The gifting/help verbs are the retention loop.

---

## Lens 2 — Miniclip / casual design

**The headline:** async **partner/co-op events** are the highest-leverage social format in casual mobile right now — explicitly async (your normal play feeds a shared meter, no scheduling) and the strongest monetizers in the category.

- **Monopoly GO "Tycoon Racers"** (June 2024): +48.8% revenue, +71% ARPDAU, top-five monetization event in all of mobile gaming. Key moves: expanded pairs → larger teams, added **real-time team-vs-team** on top of pure co-op (this is what lifted ARPDAU 71% over the co-op-only predecessor), shorter tournaments requiring daily participation, choice-based rewards, and **bankable pre-event resources**.
- Predecessor **"Baking Partners"**: 4 players, monthly, **6-day** event, ~55% revenue spike. The format generalized fast (Royal Match "Dragon Nest" 10-day; Project Makeover "Camping With Friends" 6-day). PocketGamer calls partner events "the latest trend" because they bolt co-op on *without* a standing guild or scheduled play.

**The canonical async clan war — Clash Royale River Race** (the mechanics to copy): 5 clans race down a river over a week; **you earn Fame win OR lose** (the casual-friendliness valve); individual Fame sums into the clan total; **Training Days** (low-stakes) precede **Battle Days** (scoring); **4 War Decks = 32 unique cards** with daily-reset cooldown — an elegant "ticket" that caps how much one whale can carry per day. Borrow: win-or-lose-you-still-contribute, daily-reset participation token, separate warm-up from scoring days, and a **race of 5** rather than a duel.

**Async tickets — Brawl Stars Club League:** clubs shrank 100 → 30 for legibility; each member gets ~4–6 tickets/day; spending them in normal matches generates Club Coins scaled by club tier + personal activity. A per-day ticket allotment turns "I played 3 matches" into a fixed crew contribution, caps solo-carry, and gives casuals a completable daily ask.

**The Miniclip retention playbook (8 Ball Pool, Carrom, Football Strike, Agar.io):** dual-track season pass (free + premium); **Flashback Seasons** re-run old exclusive passes (the FOMO-relief valve); **Collections** as a set-completion meta over items; tiny stacked daily asks (free spin, daily missions, free gifting); leagues with promotion/relegation but **Brass/Bronze protected from relegation** (casual safety net). Crucially, Miniclip's own analysis found **1:1 friend tools (gifting, challenges, online-now nudges) out-retained the formal club** — "hardly any value addition" from clubs/chat/leagues. Football Strike's pass gives **identical rewards on both tracks** (premium = faster/extras only) — fairness as the cozy-positioning move.

**The cosmetic economy numbers:** cosmetics are ~80% of revenue in Fortnite/Roblox/LoL ("players pay to be *seen*"); average user spends ~$102/yr on cosmetics; 1 in 3 Gen Z gamers would rather buy a $20 limited skin than a standalone game. Driver = identity/status + scarcity. The prestige reward must be a **visible, wearable flex** (banner, barn skin, profile title) that others see.

**Battle-pass conventions:** 66% of top-quartile games run a battle pass, almost all dual-track. Guild/co-op passes (Top War's communal meter; SimCity's Vu Pass pitched as the **non-intimidating alternative** to its competitive mode) are directly relevant to a cozy low-pressure track. Catch-up/FOMO-relief via "piggy bank" banking and archived-reward access.

---

## Lens 3 — Item systems / generating lots of items

The goal — **many** war-exclusive cosmetics that stay desirable — is never solved by "make more unique items." It's a stack of **multiplier mechanics** over a small pool of base art, plus **scarcity/pacing** systems to protect perceived value.

1. **Rarity ladder (primary anti-devaluation tool).** Low tiers are cheap recolors, high tiers are bespoke animated art, read as different *classes* of object so the cheap tier never cannibalizes the expensive one. LoL: Budget (recolors) → Epic (new model/VFX) → Legendary (re-imagining + VO) → Ultimate (*evolving* skins, Elementalist Lux's 10 forms). Brawl Stars gates *effects* to higher tiers (Mythic = takedown effects; Legendary = spawning effects). **For the crew war: 4–5 mud tiers (Muddy → Caked → Prize → Champion → Heirloom); reserve animation/particles for the top two.**

2. **Recolors / chromas / variants (cheapest volume multiplier).** Ship N color/material variants of one base asset — art cost is a palette swap, catalog grows by a multiple. LoL had **6,357 chromas** (patch 25.16) at 290 RP each, thousands of SKUs from a few hundred base models (a $200 Jhin chroma drew "gacha" criticism — a caution on how far to monetize). **Crew war: one mud-hat mesh in 6–10 mud-tones = 10 floor-rarity SKUs.**

3. **Themed sets + set-completion rewards (the collection engine).** Split a reward into parts, grant a bonus only on completion (players hit ~50–60% and become determined to finish). Tiered bonuses multiply desire (Diablo 4: 2/3/5-piece; Diablo 3: 2/4/6). Cozy precedent: Heartopia set completion grants gameplay buffs; Apex Collection Events gate a capstone behind the whole ~24-item set. **Crew war: "Swamp King" = hat + boots + splatter trail + animated bog bg; completing it unlocks a set-exclusive animated effect you can't buy à la carte.**

4. **Battle-pass / season tracks (pacing 100+ items).** Fortnite's premium pass = 100+ rewards/season; scarcity + deadline drives engagement ("only available a short period → perceived as uniquely valuable"). **Crew war: a 30–50 tier War Pass carries the bulk of war-exclusive items, with the marquee animated background at the final tier as the "you finished the war" trophy.**

5. **Gacha / loot pools + pity (desirability via controlled randomness).** Weighted rarity pools (legendary ~0.5%); Genshin's 5-star 0.6% with soft pity ~75 / hard pity ~90. The cozy template is Animal Crossing: Pocket Camp Fortune Cookies — themed-set pulls **with a duplicate-protection stamp card** (full card → a specific missing item). **Crew war: a "Mud Bucket" pull from a themed set with a dig-stamp dupe-insurance card — cozy, not predatory.**

6. **Limited / seasonal / vaulted drops (manufacturing scarcity).** Volume without scarcity = devaluation. Fortnite flags items not seen in 365+ days as a scarcity signal; limited skins become status symbols of early adoption. **Crew war: tie cosmetics to a named war ("Season 4 Mud Derby — never re-issued") with a "last seen N seasons ago" badge that turns old loot into a flex.**

7. **Animated / evolving / upgradeable cosmetics (the premium ceiling).** Put *motion* at the top because it's what players can't fake. LoL Ultimate skins evolve during play; Valorant skins upgrade via Radianite; Apex Prestige unlocks variants by hitting a damage threshold; Genshin namecards are an animated profile track costing nothing in core art. **Crew war: animated backgrounds and evolving hats as apex rarity — a hat that gains a mud-splatter layer per war won; a bog bg that animates richer at higher completion.**

8. **Producing volume cheaply (themed prompt-variation pipeline).** Treat cosmetics as constrained batch generations off a locked style anchor: (1) lock a style anchor from 10–20 concepts, (2) batch 4–8 variations per asset against the anchor + fixed palette, (3) edit-in-place for recolors/material-swaps, (4) mass-variation pass + background removal. **The math: one mud-hat anchor × 8 palettes × 5 set themes = 40 style-consistent entries per base prompt; image-to-video sprite sheets for the animated apex tier.** Net: hundreds of cosmetics from a few dozen base assets.

---

## Lens 4 — Async fairness & distribution

**The async free-rider problem is structurally worse than synchronous.** Contribution is temporally smeared (A acts at 9am, B at 2pm, C never logs in, payout fires at the end) so slackers aren't visible in real time. A documented guild-event autopsy: one author personally contributed **44% of the guild's score** while being "let down by the number of players who did not log a single battle" — a flat per-guild reward let non-participants collect on one whale's labor. Assume this is the default failure mode.

**The "who gets the item" models and what each breaks:**

| Model | Who earns | Failure mode |
|---|---|---|
| **Flat / whole-crew** | Everyone equally regardless of effort | Maximal free-riding; one carry funds the lurkers |
| **Personal / instanced loot** (Diablo 3) | Each player their own drop | Removes theft, not free-riding — a lurker still gets a drop |
| **Contribution-gated** (Dokkan personal-mission gate; Lords Mobile Guild Fest) | Only those past a participation threshold | The sweet spot, but threshold height is a knife edge |
| **Proportional / DKP** | Reward scales with logged effort | The **"DKP gap"** — members fear falling permanently behind with no catch-up; snowballs |
| **Winner-take / placement bands** | By leaderboard rank | Pay-to-win (top guilds spent $8.5k–$10k); anti-cozy |
| **Performance-weighted participation** (Pokémon GO raids) | Baseline for all who show + bonus for contribution | The cozy-compatible compromise — nobody leaves empty-handed, effort visibly pays |

**Consensus lesson:** no system is objectively fair — DKP-style systems are "political/economic… nobody has ever found a system that works for everyone." What makes one *land* is that the crew agreed to it and it's **transparent**, not that it's optimal.

**Contribution-gating done right — the participation floor, not ceiling:** (1) a **low eligibility floor** you must clear to claim *anything* (kills the pure lurker); (2) a reward that **does NOT scale steeply above the floor** (kills the whale-snowball and DKP-gap simultaneously). The floor is a **binary "did you show up" check** clearable in one short casual session — not a graded grind. Pair with **anti-snowball / catch-up** mechanics from gacha pity (soft + hard pity; a member who's missed wars gets a *rising* personal odds bump so falling behind self-corrects) and comeback mechanics so early luck can't make anyone unstoppable.

**Anti-alt / anti-collusion (async is the friendliest environment for alts):** expect chip-dumping/soft-play (an alt feeds a main), info-sharing across accounts, sock-puppet crews. Cheap detection signals first (device fingerprint + IP overlap + reused phone/email; **graph analysis** of who-helps-whom — a ring that only contributes to each other lights up as a dense subgraph). But **design-level prevention beats detection for a small team**: because a flat/capped reward doesn't scale with concentrated effort, the *economic incentive to run alts collapses*. **Capping payout and flattening the curve is itself the strongest anti-collusion tool** — it starves the attack of payoff before any fingerprinting.

**Keeping it fun, not pressured (no Snapchat-streak guilt):** ~70% of middle-schoolers feel *obligated* to maintain streaks; "guilt becomes the main motivator," a broken streak "feels like a personal rejection" — loss aversion weaponized (losing felt ~2× a gain), turning community into a compliance mechanism. The Duolingo ethical-streak antidotes (refined over 600+ experiments): **forgiveness over punishment** (Streak Freeze / "rest war"), **earn-back through effort not money**, **separation of concerns** (minimal action keeps you in; ambition is separate and optional = low floor / flat ceiling), **collaboration over competition** (Friend Streaks reward mutual participation, both benefit equally). This maps to Kitfox's three pillars of coziness — Safety, Abundance, Softness — and their rule that cozy activity is opt-in, intrinsically satisfying, non-transactional, help given expecting no reciprocation. **The whole-crew reward must read as a gift the crew gives each other, never a debt a slacker owes.**

---

## Design rules for a cozy async crew war + its item pool — checklist

**Structure & cadence**
- [ ] Crew size **4–6** (legibility; every member is noticed).
- [ ] **6-day fixed war window**, one war per week; first ~2 days low-stakes warm-up (Training Days), remaining days score.
- [ ] **The clock resolves the war on schedule** — a missing member contributes 0 (graceful degradation), no griefable hard auto-skip.
- [ ] **Parallel contribution, not a serial baton** — each member fills their own slice of a shared artifact; progress = sum of parts.
- [ ] **Race of 3–5 crews, not a 1v1 duel** — losing a race-place feels softer; one shared milestone meter + one light leaderboard (the Tycoon Racers combo that beat pure co-op by 71% ARPDAU).
- [ ] **Daily contribution tickets (~4–6/day)** — one match/day is a complete, satisfying crew contribution; caps whale solo-carry.
- [ ] **Bankable pre-war resources** so players show up with ammo.

**Fairness & reward**
- [ ] **Everyone scores win or lose** — casuals are never dead weight.
- [ ] **Low binary participation floor** ("log ≥1 action this war") gates the whole-crew reward — kills the pure lurker, clearable in one short session.
- [ ] **Flat/capped ceiling above the floor** — no steep DKP-style curve (the cap already solves snowball + alts; flattening defangs collusion incentive).
- [ ] **Small capped "effort seen" bonus** (Pokémon GO style) — a cosmetic or a little soft currency for above-floor effort; visible appreciation without a status ladder.
- [ ] **Pity / freeze forgiveness layer** — a crew that lost last war, or a member who missed one, gets a rising odds bump / free "rest war"; deficits self-correct.
- [ ] **Light who-helps-whom graph check** for alts (a member who only ever pairs with the same one account) rather than gambling-grade biometrics.
- [ ] **Gift-framing in all copy/UI** — celebrate the crew ("your crew pulled together"), never shame the absent ("Greg didn't show"). No red streak-broken emoji.

**The artifact & content well**
- [ ] **The assembled artifact is the reward — reveal it** with each member's fragment attributed (authorship + surprise = satisfaction; sidesteps the "no win/lose → stale" trap via novelty of the combined result).
- [ ] **Rotating themes / seasonal artifacts** so the output stays novel war-over-war (refill the well — Draw Something died on running out of 900 prompts).
- [ ] **Cozy nudge as encouragement** ("poke your crewmate — your totem's waiting"), optional, streak-aware, peer-driven; gentle crew streak for open-loop pull but never individual blame.
- [ ] **Notification cadence tuned**: opening nudge in a high-CTR window (6–8pm or 9pm–midnight scroll), mid-war reminder only if a member hasn't acted, reveal push at resolution; one emoji, per-user timing, no daily spam.

**Item pool**
- [ ] **4–5 rarity tiers** (Muddy → Caked → Prize → Champion → Heirloom); animation/particles reserved for the top two.
- [ ] **Recolor variants as the floor** — one mud-hat anchor in 6–10 tones = ~10 bottom-rarity SKUs.
- [ ] **Themed mud sets** with a set-exclusive animated completion bonus you can't buy piecemeal.
- [ ] **War Pass** (30–50 tiers, dual-track with identical rewards, premium = faster/extras) carrying the bulk of war-exclusive items; marquee animated background at the final tier.
- [ ] **Mud Bucket gacha** (weighted, legendary ~0.5%) with a **dig-stamp dupe-insurance card** — cozy, not predatory.
- [ ] **Named-season scarcity** ("never re-issued") + a "last seen N seasons ago" badge; a **Flashback** mechanic to resell later and relieve FOMO.
- [ ] **Evolving apex items** — a hat that gains a mud-splatter layer per war won; a bog background that animates richer at higher completion.
- [ ] **Set-collection meta** over the cosmetics (Collections → Collection Points → Missions) for a second progression life.
- [ ] **Keep all war power cosmetic / non-pay-to-win** — cosmetics are ~80% of revenue in the games that flex hardest; visibility (profile, crew roster, next to your name) is the whole engine.
- [ ] **Asset pipeline**: lock one mud-style anchor, then `8 palettes × 5 set themes` = 40 style-consistent entries per base prompt; image-to-video sprite sheets for the animated apex tier.

**One-line synthesis:** a *low-pressure, time-shifted, collaboratively-built shared artifact* (Gartic's parallel chains + reveal) that *resolves on a fixed clock* (play-by-mail), *degrades gracefully when someone's quiet* (no single blocker, low floor / flat ceiling, everyone scores), wrapped in *gift/encouragement framing* (Sky + Duolingo + Kitfox), monetized only through a *large-but-durable cosmetic pool* (rarity ladder + variants + sets + War Pass + named-season scarcity over a few dozen base assets) — and kept alive by *open-loop "your piece is missing" pushes* in proven windows with rotating content.

---

## Sources

### Async / telephone mechanics
- Gartic: [all modes explained](https://medium.com/gartic/the-ultimate-gartic-phone-guide-all-modes-explained-805404f94948) · [Wiki: Drawing & writing](https://gartic-phone.fandom.com/wiki/Drawing_and_writing) · [Game Rules](https://gamerules.com/rules/gartic-phone-the-online-telephone-game/) · [Fortress of Solitude](https://www.fortressofsolitude.co.za/gartic-phone-what-is-it-how-do-you-play/) · [Critical Play (Mechanics of Magic)](https://mechanicsofmagic.com/2024/04/16/critical-play-gartic-phone/)
- [n+1: Eat Poop You Cat](https://www.nplusonemag.com/issue-48/essays/eat-poop-you-cat/) · [Nate Angell: EPYC 2021](https://xolotl.org/epyc-2021/) · [exquisite.monster (GitHub)](https://github.com/JonathanHarford/exquisite.monster)
- [Wikipedia: Words With Friends](https://en.wikipedia.org/wiki/Words_with_Friends) · [Pocket Gamer: top async 2012](https://www.pocketgamer.com/features/top-10-best-asynchronous-multiplayer-games-on-iphone-and-ipad-2012/) · [Playbite: nudge](https://www.playbite.com/q/how-to-nudge-someone-in-words-with-friends) · [WWF nudge (Facebook)](https://www.facebook.com/WordsWithFriends/videos/670240440433372/)
- [Draw Something decline (Game Informer)](https://gameinformer.com/b/news/archive/2012/05/02/millions-stop-playing-draw-something.aspx) · [Kotaku](https://kotaku.com/remember-draw-something-millions-of-people-dont-like-i-5908975) · [GameAnalytics: 10 reasons players quit](https://www.gameanalytics.com/blog/ten-reasons-why-players-quit)
- [Wayline: async multiplayer reclaiming time](https://www.wayline.io/blog/asynchronous-multiplayer-reclaiming-time-mobile-gaming) · [Game Developer: asynchronicity in game design](https://www.gamedeveloper.com/game-platforms/analysis-asynchronicity-in-game-design) · [OneSignal: push for game devs](https://onesignal.com/blog/push-notifications-messaging-for-game-developers/)
- [BGA forum: skip out-of-time](https://forum.boardgamearena.com/viewtopic.php?t=18074) · [BGA: remove skip in tournaments](https://forum.boardgamearena.com/viewtopic.php?t=31083) · [Wikipedia: Play-by-mail game](https://en.wikipedia.org/wiki/Play-by-mail_game) · [RayB's PBEM guide](https://aow.heavengames.com/strategy/pbemtips/)
- [Zeigarnik in game design (Design Bootcamp)](https://medium.com/design-bootcamp/product-design-and-psychology-the-zeigarnik-effect-in-video-game-design-81cb97133af7) · [Learning Loop: Zeigarnik](https://learningloop.io/plays/psychology/zeigarnik-effect)
- [Business of Apps: push stats](https://www.businessofapps.com/marketplace/push-notifications/research/push-notifications-statistics/) · [MobiLoud: push statistics](https://www.mobiloud.com/blog/push-notification-statistics) · [Netmera: best send time](https://netmera.com/how-to-choose-the-best-push-send-time-based-on-user-behavior/)
- [Sky: Children of the Light (Indie Game Origin)](https://indiegameorigin.com/blog/cozy-mobile-game-sky-the-children-of-light) · [MiniReview: best cozy mobile](https://minireview.io/top-mobile-games/best-cozy-games-mobile)
- [Clash of Clans Wiki: Clan Wars FAQ](https://clashofclans.fandom.com/wiki/Clan_Wars_FAQ) · [Games Learning Society: min war requirements](https://www.gameslearningsociety.org/wiki/what-are-the-minimum-requirements-for-clan-wars/)

### Miniclip / casual design
- Monopoly GO! co-op events: [AppMagic](https://appmagic.rocks/research/monopoly-go-revenue-spike/) · [Gamigion](https://www.gamigion.com/extraordinary-results-from-monopoly-gos-tycoon-racers-event/) · [PocketGamer.biz](https://www.pocketgamer.biz/partner-events-are-the-latest-trend-in-monopoly-go-royal-match-and-project-makeover/) · [Scopely/Sensor Tower](https://www.scopely.com/en/news/sensor-tower-scopelys-monopoly-go-hit-6-billion-revenue-milestone-in-2025-in-record-time) · [GameRevolution](https://www.gamerevolution.com/guides/963784-monopoly-go-partner-event-schedule-february-2024-next-co-op-partners-when)
- Clash Royale Clan Wars 2 / River Race: [Supercell release notes](https://supercell.com/en/games/clashroyale/blog/release-notes/clan-wars-2-is-here/) · [Supercell support](https://support.supercell.com/clash-royale/en/articles/about-clan-wars-1.html) · [Dotesports](https://dotesports.com/mobile/news/everything-you-need-to-know-about-clan-wars-2-in-clash-royale) · [Clash.world](https://clash.world/guides/clan-wars/) · [gamingonphone](https://gamingonphone.com/guides/clash-royale-clan-wars-2-tips-and-guide/) · [Fandom](https://clashroyale.fandom.com/wiki/Clan_Wars) · [Sportskeeda](https://www.sportskeeda.com/esports/clash-royale-clan-wars-all-need-know)
- Brawl Stars Club League: [gamingonphone](https://gamingonphone.com/guides/brawl-stars-club-league-guide-club-shop-golden-tickets-and-more/) · [NamuWiki](https://en.namu.wiki/w/%EB%B8%8C%EB%A1%A4%EC%8A%A4%ED%83%80%EC%A6%88/%ED%81%B4%EB%9F%BD/%ED%81%B4%EB%9F%BD%20%EB%A6%AC%EA%B7%B8)
- 8 Ball Pool: [Pool Pass guide](https://support.miniclip.com/hc/en-us/articles/360036840073--Pool-Pass-Elite-Pass-Your-Ultimate-Guide-8-Ball-Pool) · [Flashback Seasons](https://support.miniclip.com/hc/en-us/articles/4414419603217--Flashback-Seasons-in-8-Ball-Pool) · [Cue Collections](https://8ballpool.com/news/cue-collections) / [Miniclip](https://support.miniclip.com/hc/en-us/articles/29216213803025-Cue-Collections-8-Ball-Pool) · [Leagues](https://support.miniclip.com/hc/en-us/articles/4410782445201--8-Ball-Pool-Leagues) · [Gifting](https://support.miniclip.com/hc/en-us/articles/34212511439249-Chat-Emojis-Gifting-Take-your-social-game-to-the-next-level-8-Ball-Pool) · [Free daily cue pieces](https://8ballpool.com/en/news/free-daily-cue-pieces) · [Om Tandon analysis (LinkedIn)](https://www.linkedin.com/pulse/miniclips-8-ball-pool-melting-pot-skill-chance-based-2-om-tandon) · [ActivePlayer stats](https://activeplayer.io/8-ball-pool/) · [GameWorldObserver downloads](https://gameworldobserver.com/2022/03/28/8-ball-pool-publisher-miniclip-surpassed-4-billion-downloads-across-its-portfolio-of-mobile-games)
- Carrom Pool: [Miniclip strikers/pucks/trails](https://support.miniclip.com/hc/en-us/articles/360011901674-Strikers-Powers-Pucks-and-Trails-Carrom) · [Google Play](https://play.google.com/store/apps/details?id=com.miniclip.carrom)
- Football Strike: [Season Pass](https://support.miniclip.com/hc/en-us/articles/360046480773-What-is-the-Season-Pass-in-Football-Strike)
- Agar.io: [Skins wiki](https://agario.fandom.com/wiki/Skins) · [Wikipedia](https://en.wikipedia.org/wiki/Agar.io)
- Cosmetic economy / battle pass: [Udonis cosmetic monetization](https://www.blog.udonis.co/mobile-marketing/mobile-games/cosmetic-monetization) · [GameRefinery battle passes](https://www.gamerefinery.com/12-ways-to-take-battle-passes-to-the-next-level-in-mobile-games/) · [GameAnalytics battle passes](https://www.gameanalytics.com/blog/designing-battle-passes-in-mobile-games-the-whats-whys-and-hows)
- Retention/social: [Playio DAU & retention](https://blog.playio.co/dau-retention-analysis-mobile-games-2026)

### Item systems / generating lots of items
- [accountshark.net (LoL tiers)](https://accountshark.net/blog/league-of-legends-skin-tiers-explained) · [1v9.gg (LoL tiers/Ultimate)](https://1v9.gg/blog/league-of-legends-lol-all-skins-tiers-and-types-explained) · [wiki.leagueoflegends.com (Chroma)](https://wiki.leagueoflegends.com/en-us/Chroma) · [turbosmurfs.gg (chromas)](https://turbosmurfs.gg/article/lol-chroma-skins-and-how-to-get-them) · [pcgamesn.com ($200 chroma)](https://www.pcgamesn.com/league-of-legends/jhin-erasure-chroma-cost) · [boosting-ground.com (rarity/prices)](https://boosting-ground.com/marvel-rivals/guides/events-and-cosmetics/skin-rarity-chart-and-prices)
- [brawlstars.fandom.com (Catalog)](https://brawlstars.fandom.com/wiki/Catalog) · [supercell.com (BS Apr 2026 notes)](https://supercell.com/en/games/brawlstars/blog/release-notes/release-notes-april-2026/)
- [yukaichou.com (Collection Sets)](https://yukaichou.com/advanced-gamification/game-design-technique-collection-sets/) · [games.gg (Diablo 4 sets)](https://games.gg/diablo-iv/guides/diablo-4-talisman-system-guide-seals-charms-and-set-bonuses/) · [diablo.fandom.com (Set Items)](https://diablo.fandom.com/wiki/Set_Items) · [games.gg (Heartopia sets)](https://games.gg/heartopia/guides/heartopia-furniture-bonus-guide/) · [sportskeeda (Apex Collection)](https://www.sportskeeda.com/esports/all-rewards-apex-legends-lunar-rebirth-collection-event-unlock)
- [fortnite.fandom.com (Battle Pass)](https://fortnite.fandom.com/wiki/Battle_Pass) · [beebom.com (Fortnite Ch.7 S1)](https://beebom.com/fortnite-chapter-7-season-1-battle-pass-rewards/) · [accountshark.net (Fortnite shop/vault)](https://accountshark.net/blog/fortnite-item-shop-explained)
- [loot-box-probability-mechanics (drop rates)](https://loot-box-probability-mechanics.pages.dev/blog/the-science-of-gacha-understanding-drop-rates-and-fairness) · [mwm.ai (pity)](https://mwm.ai/glossary/pity-system) · [sportskeeda (Genshin pity)](https://www.sportskeeda.com/esports/genshin-impact-pity-soft-pity-systems-explained) · [gamezebo.com (AC:PC fortune cookies)](https://www.gamezebo.com/walkthroughs/animal-crossing-pocket-camp-fortune-cookies-guide/) · [animalcrossingpocketcamp.fandom.com (Fortune Cookies)](https://animalcrossingpocketcamp.fandom.com/wiki/Fortune_Cookies)
- [codashop.com (rare-skin appeal)](https://news.codashop.com/us/why-rare-skins-feel-so-valuable-the-hidden-appeal-of-limited-skins-in-games/) · [redharegames (FOMO)](https://redharegames.wordpress.com/2025/05/16/simple-article-the-allure-of-fomo-in-games/) · [zonapk (limited-edition skins)](https://www.zonapk.org/clothes/limited-edition-skins/)
- [sportskeeda (Apex Prestige upgrades)](https://sportskeeda.com/esports/pathfinder-prestige-skin-apex-legends-everything-we-know) · [game8.co (Genshin cosmetics)](https://game8.co/games/Genshin-Impact/archives/351296) · [genshin-impact.fandom.com (Namecard)](https://genshin-impact.fandom.com/wiki/Namecard)
- Asset pipeline: [imagetoprompt.dev (AI art pipeline)](https://www.imagetoprompt.dev/blog/image-to-prompt-for-game-art/) · [scenario.com (AI sprite generator)](https://www.scenario.com/blog/ai-sprite-generator) · [github.com/lx-0/restyle-sprites](https://github.com/lx-0/restyle-sprites) · [ludo.ai](https://ludo.ai/) · [spriteflow.io](https://spriteflow.io/)

### Async fairness & distribution
- [Game Developer: pay-to-win guild-vs-guild events](https://www.gamedeveloper.com/business/paying-to-win---guild-vs-guild-events) · [GameSkinny: loot distribution dilemma](https://www.gameskinny.com/pj81c/guild-guide-the-loot-distribution-dilemma) · [Wikipedia: Dragon Kill Points](https://en.wikipedia.org/wiki/Dragon_kill_points) · [WoWWiki: DKP](https://wowwiki-archive.fandom.com/wiki/Dragon_kill_points) · [WoW Guild Relations Wiki: loot distribution systems](https://guildrelationswow.fandom.com/wiki/Guild_Loot_Distribution_Systems) · [MMORPG.com: how to make a DKP system work](https://forums.mmorpg.com/discussion/239047/how-to-make-a-dkp-system-work)
- [Dokkan Info: co-op mission reward distribution](https://glben.dokkaninfo.com/news/104329) · [Lords Mobile Wiki: Guild Fest](https://lordsmobile.fandom.com/wiki/Guild_Fest) · [Gems of War: guild event scoring/rewards](https://community.gemsofwar.com/t/guild-event-scoring-rewards/81418)
- [Pokémon GO Hub: raid rewards](https://pokemongohub.net/post/featured/raid-rewards/) · [Bulbapedia: Raid Battle (GO)](https://bulbapedia.bulbagarden.net/wiki/Raid_Battle_(GO))
- [Diablo 3 forums: personal loot](https://us.forums.blizzard.com/en/d3/t/fine-you-can-have-personal-loot/35255) · [Game Developer: psychology of Diablo III loot](https://www.gamedeveloper.com/design/the-psychology-of-i-diablo-iii-i-loot) · [Diablo Wiki: Legendary Pity Timer](https://www.diablowiki.net/Legendary_Pity_Timer) · [Game Anatomy: pity timers explained](https://gameanatomy.blog/2025/05/03/pity-timers-in-games-explained/) · [TV Tropes: Bad Luck Mitigation Mechanic](https://tvtropes.org/pmwiki/pmwiki.php/Main/BadLuckMitigationMechanic)
- [Games24x7: prevent fraud and collusion — the graph way](https://medium.com/@Games24x7Tech/prevent-fraud-and-collusion-the-graph-way-503984bb3133) · [LexisNexis Risk: multi-accounting fraud](https://risk.lexisnexis.com/insights-resources/article/multi-accounting-fraud) · [Verisoul: preventing multi-accounting fraud](https://www.verisoul.ai/articles/preventing-multi-accounting-fraud-in-online-gambling) · [Veriff: prevent multi-accounting](https://www.veriff.com/fraud/learn/multi-accounting) · [IntelligentHQ: gaming fraud detection](https://www.intelligenthq.com/leveling-up-security-how-gaming-fraud-detection-stops-bonus-abuse-and-multi-accounting/) · [USPTO: conditional-behavior collusion detection](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7604541)
- [UX Magazine: hot streak design without shame](https://uxmag.com/articles/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame) · [Screenwise: Snapchat streaks and social obligation](https://screenwiseapp.com/guides/snapchat-streaks-and-social-obligation) · [Mobicip: Snapchat streaks risks](https://www.mobicip.com/blog/snapchat-streaks-benefits-risks) · [Medium: FOMO as behavioral manipulation in game design](https://medium.com/design-bootcamp/product-design-and-psychology-the-exploitation-of-fear-of-missing-out-fomo-in-video-game-design-5b15a8df6cda)
- [Kitfox Games: designing for coziness](https://medium.com/kitfox-games/designing-for-coziness-d33d2519a59e) · [GameSpot: best cozy co-op games](https://www.gamespot.com/gallery/best-cozy-co-op-games/2900-7426/) · [Wikipedia: cozy game](https://en.wikipedia.org/wiki/Cozy_game)
