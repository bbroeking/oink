---
title: "Co-op Interaction Mechanics — Research (June 2026)"
type: memo
date: 2026-06-14
tags: [research, co-op, mud-wars, social, design]
---

# Co-op Interaction Mechanics — Research (June 2026)

A synthesis of four research passes (synchronized bursts, shared-goal contribution, pairwise/asymmetric help, and fairness/anti-abuse) into one brief for designing a cozy 5-person crew-war feature in Tickle the Pig.

## TL;DR — the cross-cutting principles

Across every cooperation type studied, the same handful of principles separate co-op that delights a small cozy crew from co-op that breeds anxiety, burnout, and resentment.

1. **Make togetherness *strictly better*, never *required*.** The thrill comes from multiplicative — not additive — payoff for acting together (WoW's offensive cooldowns multiply, so aligning them inside Bloodlust produces dramatically higher damage than spreading them out — [Warcraft Wiki](https://warcraft.wiki.gg/wiki/Bloodlust_effect), [alittlemorelikethis](https://alittlemorelikethis.com/wow-raiding-dps-cooldown-management-and-bursting-strategies/)). But the entry fee must stay low: reward presence, don't punish absence. Required synchronous attendance is the single biggest cozy-killer ([diaryofaguildleader](https://diaryofaguildleader.wordpress.com/2020/04/01/wow-classic-raiding-front-loading-efforts-and-burnout/)).

2. **Render co-presence; don't infer it.** The best sync systems make "we are doing this together right now" *visible* — Destiny's glowing Well of Radiance you physically gather in, Pokémon GO's filling raid lobby, Sea of Thieves' anchor turning faster with each hand ([gamerant](https://gamerant.com/destiny-2-buff-debuff-stack-damage/), [Sea of Thieves](https://www.seaofthieves.com/sail-together)). The shared-goal version is the same: a visibly *filling* bar is the most motivating UI state in the genre, because the goal-gradient effect only fires when progress is legible ([LogRocket](https://blog.logrocket.com/ux-design/goal-gradient-effect/)).

3. **Async + local-time beats global-now.** Hard real-time windows turn coordination into homework and disadvantage timezone-spread crews; whole tools exist just to paper over it ([gametyrant](https://gametyrant.com/news/strategic-time-management-for-maximizing-wow-tbc-raid-readiness), [planetcalc](https://planetcalc.com/10808/)). The cozy-correct pattern is Pokémon GO Community Day's *local* 2pm and Clash Royale's *local-midnight* deck reset — every player acts on their own clock inside a long rolling window ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Community_Day), [Supercell](https://supercell.com/en/games/clashroyale/blog/release-notes/clan-wars-2-is-here/)). Synchronous siege windows are the anti-pattern ([Cpt Hedgehog](https://cpt-hedge.com/guides/season-5-alliance-safe-time)).

4. **One person's prep is a gift to the table.** Mega-evolution buffing every same-type teammate in a raid lobby, dropping the Well, calling Lust — individual setup that buffs *everyone* converts "I prepared" into a present, not a flex ([Theria](https://theriagames.com/guide/pokemon-go-raid-battles/)).

5. **A generous floor + soft cap.** Tier-5 Pokémon GO raids are beatable by 3–6 of a 20-trainer cap, so nobody's night is ruined by low turnout ([Switchblade](https://www.switchbladegaming.com/pokemon-go/raid-strategy-guide/)). Cozy demands an even softer floor: one absent member must never sink the crew — the documented Fall Guys failure mode where a single slacker tanks the whole team and makes team rounds the most-hated mode ([ginx](https://www.ginx.tv/en/fallguys/what-are-team-rounds-fall-guys)).

6. **The free-rider problem is solved by visibility + a low participation gate, not by punishment.** Social loafing breeds when individual contribution is anonymous or unimportant; the consensus fix is smaller teams, visible individual contribution, and a hybrid individual+group reward ([Wikipedia: free-rider](https://en.wikipedia.org/wiki/Free-rider_problem), [Profit.co](https://www.profit.co/blog/behavioral-economics/adverse-effects-of-social-loafing-in-the-workplace/)). Clash of Clans' "contribute ≥1 point to claim any reward" is the cleanest gate — it punishes total absentees while costing casuals nothing ([Fandom](https://clashofclans.fandom.com/wiki/Clan_Games)).

7. **The obligation should have a face — but be a bonus, not a debt.** 1:1 bonds re-engage harder than anonymous leaderboards because lapsing means letting *a named friend* down, not watching a number drop (Duolingo's shared streaks make learners 22% more likely to finish their daily lesson — [Medium/Rajput](https://medium.com/@rajputgrishma/how-duolingos-friend-streak-increased-its-user-engagement-by-22-db34e403c533)). But the same lever, framed as loss, becomes a documented dark pattern: ~70% of Snapchat streak-keepers feel trapped maintaining bonds they don't value ([Screenwise](https://screenwiseapp.com/guides/the-psychology-of-snapchat-streaks), [Wikipedia: dark pattern](https://en.wikipedia.org/wiki/Dark_pattern)). Reward when both show up; never penalize when one doesn't.

8. **Leave a persistent artifact behind.** The most durable loops end with the filled bar becoming a *thing you keep*: FarmVille's bigger barn on your farm, Helldivers' Meridia black hole permanently scarring the galaxy map ([farmville wiki](https://farmville.fandom.com/wiki/Barn_Raising), [Kotaku](https://kotaku.com/helldivers-2-black-hole-meridia-major-order-1851515722)). The artifact is a standing monument — trophy, social proof, and the seed of the next event.

---

## Synchronized & coordinated-burst co-op

**The pattern:** acting at the same moment is made mechanically *louder* than acting alone — the result is bigger than the sum.

**Named systems & numbers:**
- **Pokémon GO Raids** — up to 20 trainers focus-fire one boss; tier-5 beatable by 3–6; 300s fuse for legendary/Mega. The "Ready" button collapses the lobby countdown from 120s to 10s when all tap it. Mega-evolution buffs every same-type teammate's damage for the whole lobby. Rewards split by damage share, +4 balls for raiding with Best Friends ([serebii](https://www.serebii.net/pokemongo/raidbattles.shtml), [Theria](https://theriagames.com/guide/pokemon-go-raid-battles/), [Switchblade](https://www.switchbladegaming.com/pokemon-go/raid-strategy-guide/)).
- **Pokémon GO Community Day** — a fixed 3-hour *local-time* window of elevated spawns; no global timezone war ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Community_Day), [pokemongohub](https://pokemongohub.net/post/article/opinion/our-thoughts-on-the-three-hour-community-day-window/)).
- **WoW Bloodlust/Heroism** — +30% haste to the whole raid for 40s on a 10-min cooldown; multiplicative cooldown stacking makes "wait, then everyone go at once" the entire game. Multiplicative stacking is what makes sync *strictly* better than spreading out — additive bonuses make sync optional ([Warcraft Wiki](https://warcraft.wiki.gg/wiki/Bloodlust_effect), [gmpcc](https://gmpcc.org.uk/the-discipline-of-waiting-for-major-cooldowns-becomes-the-strategic-pause-separating-maximized-burst-from-fragmented-attempts/)).
- **Destiny 2 Well of Radiance** — a placed zone, +35% weapon damage for 30s; a *spatial* sync object is more legible than a timer (its boss DR was later cut 40%→10% to curb dominance) ([gamerant](https://gamerant.com/destiny-2-buff-debuff-stack-damage/), [sportskeeda](https://www.sportskeeda.com/mmo/news-well-radiance-nerfed-destiny-2-the-final-shape)).
- **Monster Hunter mount/topple** — combined attacks fill a shared gauge that topples the monster, opening an *emergent* free-damage window; but uncoordinated hits stagger allies (why "Flinch Free" exists). Sync rewarded, un-sync punished ([Capcom](https://game.capcom.com/manual/MH_Gen/en-UK/page-26.html), [Game8](https://game8.co/games/Monster-Hunter-Wilds/archives/500303), [Fextralife](https://monsterhunterworld.wiki.fextralife.com/Flinch+Free)).
- **Sea of Thieves** — "raise the anchor more quickly" with more hands; "more roles than players." Synchronized can mean *different interlocking actions that only work simultaneously*, not the same action at once ([Sea of Thieves](https://www.seaofthieves.com/sail-together), [Kotaku](https://kotaku.com/how-rares-chaotic-co-op-pirate-game-sea-of-thieves-work-1782033340)).
- **Puyo Puyo Quest Guild Rush** (closest analog) — enter battle within 10 minutes of the previous guildmate and the combo holds, giving everyone +20% Attack. This *asynchronous synchronization* — a rolling window, not the literal same second — is the single most transferable mechanic for a small timezone-spread crew ([Puyo Nexus](https://puyonexus.com/wiki/Category:PPQ:Guild_Rush_Events)).
- **Fall Guys Egg Scramble** — short chaotic team rounds create belonging without burden, but are the most-disliked mode because one slacker tanks the team — the free-rider tax made visible ([Fandom](https://fallguysultimateknockout.fandom.com/wiki/Egg_Scramble), [Dexerto](https://www.dexerto.com/fall-guys/fall-guys-team-mini-game-guide-egg-scramble-hoopsie-daisy-1408056/), [ginx](https://www.ginx.tv/en/fallguys/what-are-team-rounds-fall-guys)).

**What makes it great:** multiplicative stacking; visible co-presence; a short legible fuse (30–40s); a generous floor; one player's prep buffing the table; local-time anchoring.

**What kills it:** timezone coordination as homework ([gametyrant](https://gametyrant.com/news/strategic-time-management-for-maximizing-wow-tbc-raid-readiness)); burnout from mandatory front-loaded windows ([diaryofaguildleader](https://diaryofaguildleader.wordpress.com/2020/04/01/wow-classic-raiding-front-loading-efforts-and-burnout/)); free-riders ([LeadershipIQ](https://www.leadershipiq.com/blogs/leadershipiq/the-free-rider-problem)); server thrash from a global "everyone act NOW" spike (a real Supabase concern — Pokémon GO staggers Community Day by local time precisely to spread the load); friendly-fire griefing from un-coordination.

**Transfer — the "Crew Surge":** a rolling async combo window (stretch Puyo's 10 min to ~30–60 for a cozy crew of 5), each contributing act *extending* the window like a relay; an escalating capped streak multiplier (1st ×1.0 → all-5 ×2.5, then cap); a visible "3 of 5 surging — 7 min left" banner with an opt-in push when a crewmate opens a surge; one "stoke the hearth" prep act that buffs the table; individual contribution-share credit so a quiet member still earns; and a weekly "Power Hour" scheduled in *each player's local time*, with the core surge fully async. Sync is the bonus on top, never the entry fee.

---

## Shared-goal / collective-contribution co-op

**The pattern:** one shared target — a single bar, HP, or structure — that the whole crew fills together, where every member's small action moves the *same* bar. Powered by the goal-gradient effect: motivation rises as the gap to a visible goal shrinks ([Medium/Design Bootcamp](https://medium.com/design-bootcamp/goal-gradient-effect-and-the-psychology-of-progress-bars-df6fd889fd8e), [LogRocket](https://blog.logrocket.com/ux-design/goal-gradient-effect/)).

**Named systems & numbers:**
- **Clash of Clans Clan Games** (gold standard for fair contribution) — clan-pooled points unlock a 6-tier reward ladder (~3k/7.5k/12k/18k/30k/50k); a per-player cap of 10,000 (raised from 4,000 in Dec 2025) stops one tryhard soloing the bar; each tier offers 3-items-pick-1; and a member must contribute ≥1 point to claim *any* reward — the cleanest free-rider gate in the genre ([Sportskeeda](https://www.sportskeeda.com/mobile-games/all-clash-clans-clan-games-rewards-points-required-january-2025), [Fandom](https://clashofclans.fandom.com/wiki/Clan_Games)).
- **FarmVille Barn Raising** — need 10 neighbors to click "help" within 3 days or it *fails and resets*; helpers earn 100 coins each (so asking isn't pure begging); the upgraded barn is a persistent visible artifact you keep ([FarmVille Wiki](https://farmville.fandom.com/wiki/Barn_Raising), [AOL](https://www.aol.com/2010-01-14-farmville-barn-raising-the-storage-solution-youve-been-waiting.html)).
- **Helldivers 2 Galactic War** — every squad's operation adds to a planetary liberation %; completing the Meridia order collapsed the planet into a *permanent black hole on the shared map*, and planets can be *lost*. A bar that can be lost and that permanently changes the world generates far more drama than one that only fills ([GameRant](https://gamerant.com/helldivers-2-how-does-liberation-percentage-work-automaton/), [Dot Esports](https://dotesports.com/helldivers-2/news/helldivers-2-galactic-war-progress-explained), [Kotaku](https://kotaku.com/helldivers-2-black-hole-meridia-major-order-1851515722), [Helldivers Wiki](https://helldivers.wiki.gg/wiki/Meridian_Black_Hole), [Sportskeeda](https://www.sportskeeda.com/esports/helldivers-2-latest-major-order-involves-weaponized-dark-fluid)).
- **Pokémon GO Global Catch Challenge** — 3 billion catches in 7 days, milestone-laddered; the 1.5B milestone unlocked double XP + Stardust *mid-event* (a compounding loop), the 3B finish unlocked Farfetch'd globally. Individual counts never mattered, so nobody could free-ride or resent ([Game Informer](https://www.gameinformer.com/b/news/archive/2017/11/26/pokemon-go-new-event-asks-players-to-catch-3-billion-pokemon-in-a-week-.aspx), [Pokémon GO Wiki](https://pokemongo.fandom.com/wiki/Global_Catch_Challenge), [Nintendo Everything](https://nintendoeverything.com/pokemon-go-players-catch-3-billion-pokemon-during-global-catch-challenge-all-rewards-unlocked/)).
- **Destiny 2 Empyrean Foundation** — donate Fractaline to rebuild a Tower location; personal 5,000+ → exclusive emblem, *and* a community-total unlock gives everyone a shader. The **dual-track reward** (personal badge + collective unlock) makes both the heavy lifter and the casual feel seen ([TheGamer](https://www.thegamer.com/destiny-2-empyrean-foundation-guide/), [Fanbyte](https://www.fanbyte.com/destiny-2/guides/destiny-2-empyrean-foundation-guide-community-goals-rewards-more)).

**What makes it motivating:** a visible filling shared bar; milestone laddering (not one far finish line) — Irrational Labs' meta-analysis of 32 experiments found progress bars *hurt* completion when early advancement lags or the finish looks distant, so design for fast early wins and show the *next* milestone ([Irrational Labs](https://irrationallabs.com/blog/knowledge-cuts-both-ways-when-progress-bars-backfire/)); compounding mid-event bonuses; and real stakes / possible failure.

**Free-rider fixes (this axis):** participation gate (CoC's ≥1); per-member contribution leaderboard to defeat the "my effort is invisible" trigger ([patent US9007189](https://patents.justia.com/patent/9007189), [IdleMMO](https://wiki.idle-mmo.com/guilds/conquest)); contribution cap (CoC's 10,000); dual-track rewards (Destiny).

**Transfer:** one shared *structure* per crew (barn, festival stage, monument) built from member contributions, framed so the "war" is *whose crew builds biggest/fastest* — collective inside, competitive outside, cozy because you race to *build* not destroy. One crew bar with 4–6 milestone tiers, each unlocking a cosmetic stage so the structure *visibly grows* (the growing structure *is* the progress bar); a per-member cap; a participation gate so anyone who contributed shares the permanent crew cosmetic ("Spring Festival Barn, built by Crew Mudlarks"); dual-track recognition (per-crew contribution leaderboard + a "top builder" badge); soft cozy stakes (a gentle reset/decay or a plainer structure if the crew falls short, never punishing); and a compounding halfway treat to pull stragglers back. End state: the crew opens the app on the final day, sees the barn at 90% with every name on the meter, and shows up to lay the last planks — then keeps the barn forever.

---

## Pairwise / buddy / asymmetric-help co-op

**The pattern:** 1:1 cooperation is stickier than group cooperation because the obligation has a name — letting a named friend down is a *relationship* cost, far more durable than a numeric one.

**Named systems & numbers:**
- **Snapchat Snapstreaks** (the canonical pairwise loop, and the cautionary tale) — daily reciprocal exchange, a flame + day-count, an hourglass warning. Runs on reciprocity, loss aversion (past ~100 days the motive flips to "I cannot let this investment vanish"), and identity. The dark side: ~70% of middle-schoolers feel *obligated* to keep streaks alive even with people they dislike ([Screenwise](https://screenwiseapp.com/guides/the-psychology-of-snapchat-streaks), [Evolve](https://evolvetreatment.com/blog/snapchat-streaks-addicted-teens/), [StrategicEdTech](https://www.strategicedtech.com/blog/could-snap-streaks-be-responsible-for-long-term-stress-and-anxiety-in-teens)).
- **Duolingo Friend Streaks** (the productized, measured version — most transferable) — a shared streak increments only when *both* practice the same day, up to 5 friends; learners with ≥1 shared streak are **22% more likely** to complete their daily lesson; and the "nudge" push notification appears to come *from your friend, not the app* — structurally un-muteable. Streaks roughly 2× daily retention ([duoplanet](https://duoplanet.com/duolingo-friend-streaks/), [Medium/Rajput](https://medium.com/@rajputgrishma/how-duolingos-friend-streak-increased-its-user-engagement-by-22-db34e403c533), [deconstructoroffun](https://duolingo.deconstructoroffun.com/mechanics/streaks)). Accountability research backs the magnitude: stating a goal yields ~65% success; scheduled partner check-ins push it to ~95%; gym-buddy pairing drove ~35% more attendance — the partner is the multiplier ([GoalsWon](https://www.goalswon.com/blog/23-apps-that-will-keep-you-accountable-and-motivated-to-achieve-all-your-personal-goals/)).
- **Monster Hunter Palico + SOS flare** (the asymmetric model) — the Palico is active only in 2-player co-op, so the *pair* is mechanically privileged (a duo brings a third body); the SOS flare broadcasts a help-request and, if no human answers, NPC Support Hunters auto-fill so you're never stranded. The principle: *the absent slot gets filled, so the pair never fully dies* ([Fextralife World](https://monsterhunterworld.wiki.fextralife.com/Multiplayer), [Fextralife Wilds](https://monsterhunterwilds.wiki.fextralife.com/Online_%26_Multiplayer), [Push Square](https://www.pushsquare.com/guides/monster-hunter-wilds-how-to-play-co-op-with-npc-bots)).
- **Carry without resentment (Borderlands)** — per-player enemy scaling (a lvl-20 and lvl-30 each fight enemies at their own level) + instanced loot (helping a friend costs the helper nothing) together solve the carry tax: the strong player keeps their reward *and* lifts the weak one ([Windows Central](https://www.windowscentral.com/how-does-co-op-level-scaling-work-borderlands-3), [Sportskeeda](https://www.sportskeeda.com/esports/tiny-tina-s-wonderlands-two-co-op-options-tweak-loot-enemy-scaling)).
- **FFXIV Mentor Roulette** (the prestige lever, and a warning) — mentorship gates on max level + 1,000 duties + 1,500 commendations, a status badge; but the roulette prioritizes the *longest-waiting* queue, not genuinely-new players, so mentors farm easy clears. Lesson: reward the *act of helping a specific real person*, not a clear-count proxy ([Destructoid](https://www.destructoid.com/how-to-become-an-ffxiv-mentor-and-unlock-the-mentor-roulette/), [FFXIV Wiki](https://ffxiv.consolegameswiki.com/wiki/Mentor_System_and_Novice_Network), [Kotaku](https://kotaku.com/final-fantasy-xiv-battle-mentor-roulette-1851478857)).
- **Animal Crossing Best Friends** (the gentlest, most on-brand) — become Best Friends only after visiting each other's islands; the bond unlocks destructive tools (axe, shovel) strangers can never use, plus status visibility and DMs. The cozy move: the bond is a *trust grant, not an obligation timer* — asymmetric capability, zero punishment ([Game8](https://game8.co/games/Animal-Crossing-New-Horizons/archives/284493), [TheGamer](https://www.thegamer.com/animal-crossing-new-horizons-how-add-players-best-friends-list-guide/)).
- **Sea of Thieves interdependence** — Sloop for 2, Galleon for 3–4; ships are designed so you never have a free crew member for every task, forcing role hand-offs. Rare tested 5 and pulled back to 4 — past ~4, players get left behind. Keep the cooperating unit tiny so every member is load-bearing ([Gamepur](https://www.gamepur.com/guides/maximum-crew-size-and-solo-play-in-sea-of-thieves), [GameRant](https://gamerant.com/why-sea-of-thieves-ship-crews-only-support-4-players/)).

**Risks to design out:** the *dead pair* (a quit buddy orphans the live player into a daily guilt-reminder — mitigate with re-pairing + NPC slot-cover + capping how much one buddy's absence can hurt you); obligation→anxiety→resentment (streaks are now classed as a dark pattern — make the bond a *bonus when both show*, never a *loss when one doesn't* — [Wikipedia](https://en.wikipedia.org/wiki/Dark_pattern), [UX Collective](https://uxdesign.cc/game-design-dark-patterns-that-keep-you-hooked-a3988395533c)); exclusion (the "I have no one to add" problem — auto-matchmake the slot, NPC fallback, rotating not locked pairs); gaming the helper metric (reward the paired interaction, not aggregate volume); carry resentment (per-player scaling + instanced loot).

**Transfer:** war buddies inside each crew sharing a small bonus that triggers only when *both* contribute that day (Duolingo's shared streak reskinned, framed as gain-when-both-show); cover-for-the-absent via an NPC stand-in / fractional carry so a dead buddy never strands you; costless carry of a weaker pig (per-player scaling + instanced reward + a prestige token tied to helping *this specific buddy*); trust-scoped buddy perks (see status, send a personal nudge, use a "helping hand" action — warmth via privilege, not pressure via timer); and a tiny, re-pairable, auto-matched unit.

---

## Fairness & anti-abuse in crew-war scoring

**The two-front war:** stop a bigger/whalier/more-coordinated crew from trivially winning (the *dominance* problem) while stopping the mode from being farmed by alts and free-riders (the *integrity* problem). The mechanics that fix one often worsen the other; the best systems pick a scoring shape that resolves both at once.

**The scoring shape is the whole ballgame.** Total-sum scoring rewards headcount and whales (one whale carries 20 dead accounts, invisibly). Bounded-per-slot scoring is the dominant fix: Marvel Strike Force Alliance War scores a fixed 10,000 per cleared room on a fixed grid, so the ceiling is set by the *map*, not the wallet; Hero Wars gives a flat 20 points per fortification slot capping the guild at 1,200–1,400 total ([Scopely](https://scopely.helpshift.com/hc/en/46-marvel-strike-force/faq/7289-what-are-the-rules-for-participating-in-war/), [gaming-fans](https://gaming-fans.com/marvel-strike-force/msf-alliance-wars/offensive-strategy/), [Hero Wars support](https://support-hwa.nexters.com/hc/en-us/articles/6094698021266-Guild-War), [theriagames](https://theriagames.com/guide/hero-wars-alliance-guild/)). **Per-capita/average scoring is the explicit anti-snowball move (and what TTP already does)** — adding a weak/idle member drags the mean *down*, neutralizing roster-size advantage. But its known dark side: a flat average *punishes participation*, because a below-mean player lowers the score, so the rational move becomes "don't play unless above average" — itself a free-rider incentive. Every average-scoring game compensates with a quorum + per-member floor.

**Contribution caps (universal anti-whale, anti-carry):** Clash Royale gives each player 4 War Decks usable once per 24h on a local-midnight reset — a hard daily Fame cap nobody can out-grind; boat repair needs ~19 distinct deck-uses (you literally can't solo it); MSF splits 100 toons 60/40 offense/defense forcing roster *breadth*; Hero Wars gives each champion exactly 2 attacks ([Supercell](https://supercell.com/en/games/clashroyale/blog/release-notes/clan-wars-2-is-here/), [zeusx](https://www.blog.zeusx.com/post/clash-royale-top-5-questions-on-clan-wars-2), [Clash Royale Wiki](https://clashroyale.fandom.com/wiki/Clan_Wars), [Nerds on Earth](https://nerdsonearth.com/2020/11/marvel-strike-force-lets-win-this-war/), [Hero Wars Wiki](https://hero-wars.fandom.com/wiki/Guild/Guild_War)). The cap is per-account-per-window, low enough that an extra alt is nearly worthless, and breadth requirements convert "one strong account" into "many active humans."

**Quorum / roster-mirroring (defuse size at matchmaking):** Clash of Clans wars are strictly mirrored 15v15 or 30v30, position-by-position by strength; Hero Wars can't enter without ≥5 champions ([CoC CWL](https://clashofclans.fandom.com/wiki/Clan_War_Leagues), [clasher.us](https://www.clasher.us/guide/clan-war-matchmaking), [theriagames](https://theriagames.com/guide/hero-wars-alliance-guild/)). For a "5v5 crew war," strict mirroring + a field-quorum is the cleanest guarantee the bigger crew can't bring more bodies.

**Matchmaking fairness & its exploits:** CoC War Weight is gamed by engineered ".5" bases (low defense weight, max offense) — ~80% of the community still believed they worked after patches; Supercell's fix was to weigh offense *and* defense and *pool engineered clans against each other* rather than detect-and-ban ([allclash](https://www.allclash.com/clan-war-matchmaking/), [Oreate](https://www.oreateai.com/blog/unpacking-the-war-weight-in-clash-of-clans-more-than-just-numbers/e32e97edf4a6f0f26e80ddc8ecd3a385), [Supercell 2017](https://supercell.com/en/games/clashofclans/blog/news/clan-war-matchmaking-improvements/), [player.one](https://www.player.one/clash-clans-update-engineered-bases-clan-wars-2017-hack-builder-base-cheats-118219)). CWL later made league the sole input, closing the loophole but creating a cold-start problem ([CWL FAQ](https://clashofclans.fandom.com/wiki/Clan_War_Leagues_FAQ)). MSF's ELO backfires both ways: winning streaks push you into "ELO hell" vs far-higher-power opponents, and "shelling" alliances *intentionally lose* to tank ELO and farm easy matchups ([theriagames](https://theriagames.com/guide/marvel-strike-force-alliance-war-events/)). The lesson: every matchmaker is gamed by sandbagging or weight-engineering; the two industry responses are (a) rate on outcomes/ELO and accept some sandbag leakage, or (b) *segregate exploiters into their own pool*. Outcome-based ELO is more sandbag-resistant than static weight.

**Free-rider defenses (this axis):** participation floors/eligibility gates (RAID requires ≥10 Tag-Team Arena series/week to be reward-eligible — [Plarium](https://raid-support.plarium.com/hc/en-us/articles/360014696359-Guide-Tag-Team-Arena)); "earn whether you win or lose" (Clash Royale grants Fame on a loss, removing the free-ride excuse); per-participant reward gating (only River Race participants get the victory chest); social/leadership enforcement (MSF exposes per-member war points so leaders kick under-performers — [Scopely](https://scopely.helpshift.com/hc/en/46-marvel-strike-force/faq/7289-what-are-the-rules-for-participating-in-war/), [MSF tool](https://marvelstrikeforce.com/en/updates/introducing-the-alliance-recruitment-tool)); and positive per-member recognition (Hero Wars' "Marks of Distinction" for the top 3 daily contributors — a visible mini-leaderboard, a well-documented anti-loafing lever — [theriagames](https://theriagames.com/guide/hero-wars-alliance-guild/)).

**Alt & collusion defenses:** per-account caps make alts a labor cost not a cheat; roster mirroring means alts can't out-number; smurf-detection literature flags abnormal win-rate/KDA/progression-vs-age and converges ratings fast then segregates outliers (Riot's TrueSkill2 places high-skill players in ~5 matches, 3× faster) — converge-and-segregate, not ban ([BitTopup](https://bittopup.com/article/MLBB-Smurf-Detection-Avoid-Low-Priority-Queue-2025), [Turbosmurfs](https://turbosmurfs.gg/article/what-are-smurf-accounts-a-league-of-legends-guide)); win-trading/sandbagging is the residual hole in any outcome matchmaker — flatten the win/loss reward gradient (Fame-on-a-loss) so there's little to gain from throwing.

**Timezone fairness:** fixed real-time attack windows disadvantage spread crews — Last War: Survival's 3 fixed daily windows force picking one "safe time" and an active leader in every timezone you span ([Cpt Hedgehog](https://cpt-hedge.com/guides/season-5-alliance-safe-time), [Last War support](https://firstfungroup.zendesk.com/hc/en-us/articles/45137396113939-S5-Alliance-Battle-Time-Rest-Time)). The async fix is Clash Royale's per-player local-midnight reset / MSF's 24h offensive phase: no global "be-online-now" spike. **A cozy crew war should be fully async, multi-day, local-time reset — never a synchronous siege window** — for both fairness and the relaxed feel.

**Transfer:** keep TTP's per-capita-average sling as the anti-dominance spine, and bolt on — a participation quorum + per-member floor (count the crew only if K-of-N each clear a small floor; reward *participation*, not excess-over-mean, killing the "don't play unless above average" trap); a low, breadth-forcing per-account daily cap with at least one objective that mathematically needs several distinct humans; strict 5v5 roster mirroring; a bounded win/loss reward gradient (earn on a loss, participation-gated chest); outcome/ELO matchmaking that converges fast and pools outliers rather than detect-and-ban; a fully async multi-day local-time window; and gentle per-member contribution recognition. This keeps a small/poor crew competitive against a big/whaley one *and* makes alts and free-riders worthless — without a punitive ban layer.

---

## Design rules for a cozy 5-person crew war — checklist

A consolidated, cross-axis spec. Each rule cites the principle it encodes.

**Cooperation feel**
- [ ] Make togetherness *strictly better* via a **multiplicative** (not additive) bonus — escalating, capped streak that climbs as more crew act in-window (Crew Surge: 1st ×1.0 → all-5 ×2.5, then cap). *(synchronized)*
- [ ] Never *require* synchronous attendance. Sync is the bonus; the core loop is fully playable solo/async. *(synchronized, fairness)*
- [ ] Render co-presence: a live "**3 of 5 surging — 7 min left**" banner and a visibly *growing* shared structure that doubles as the progress bar. *(synchronized, shared-goal)*
- [ ] One prep act ("stoke the hearth") buffs the whole crew's surge — "I prepared" becomes a gift. *(synchronized)*

**Goal structure**
- [ ] One shared crew structure (barn/festival stage/monument) built from contributions, framed as *whose crew builds biggest/fastest* — cooperative inside, competitive outside, cozy because you build not destroy. *(shared-goal)*
- [ ] 4–6 milestone tiers, each unlocking a visible cosmetic stage; design fast early wins and show the *next* milestone, never the distant finish. *(shared-goal)*
- [ ] A compounding mid-event treat at the halfway mark to pull stragglers back into the back half. *(shared-goal, synchronized)*
- [ ] The finished structure becomes a **permanent crew cosmetic**, season-tagged ("built by Crew Mudlarks") — the kept artifact. *(shared-goal)*

**Pairwise warmth**
- [ ] Optional war-buddy pairing inside each crew; a small bonus that triggers **only when both contribute that day**, framed as gain-when-both-show, never loss-when-one-doesn't (avoid the streak dark pattern). *(pairwise)*
- [ ] Cover-for-the-absent: an NPC stand-in / fractional carry tops up an offline buddy's slot so a dead pair never strands or guilts anyone. *(pairwise)*
- [ ] Costless carry: per-player scaling + instanced rewards so helping a weaker pig never subtracts from your own haul; a prestige token tied to helping *this specific buddy* (not a help-counter). *(pairwise)*
- [ ] Trust-scoped buddy perks (see status, send a personal nudge, "helping hand" action) — warmth via privilege, not pressure via timer; auto-match the friendless, allow re-pairing. *(pairwise)*

**Fairness & anti-abuse**
- [ ] Keep TTP's per-capita-average scoring as the anti-dominance spine. *(fairness)*
- [ ] Add a **participation quorum + per-member floor** so the average rewards *participation*, not excess-over-mean — defuses the "don't play unless above average" trap. *(fairness)*
- [ ] Low, breadth-forcing **per-account daily cap** (Clash Royale's 4-per-24h logic) + at least one objective that mathematically needs several distinct humans — alts and whales both become near-worthless. *(fairness)*
- [ ] **Strict 5v5 roster mirroring** so a bigger crew literally can't field more bodies. *(fairness)*
- [ ] **Bounded win/loss reward gradient** (earn on a loss; participation-gated reward only for contributors) — defangs sandbagging/win-trading. *(fairness, shared-goal)*
- [ ] If matchmaking by rating, use **outcome/ELO that converges fast and pools outliers**, not static weight (which invites engineered under-representation); never try to detect-and-ban. *(fairness)*

**Timezone & cadence**
- [ ] Fully **async, multi-day window, local-time reset** — no synchronous siege window. *(synchronized, fairness)*
- [ ] Any "Power Hour" is scheduled in **each player's local time** (Community Day model). *(synchronized)*
- [ ] Stagger writes across local time to avoid a backend spike from a global "everyone act NOW" instant (Supabase load concern). *(synchronized)*

**Cozy-soft stakes**
- [ ] A **generous floor**: one absent member never sinks the crew (avoid the Fall Guys slacker-tanks-the-team failure). *(synchronized, shared-goal)*
- [ ] Soft failure: a gentle reset/decay or a plainer structure if the crew falls short — enough to rally near the deadline, never punishing. *(shared-goal)*
- [ ] **Gentle, positive per-member recognition** (a soft in-crew contribution list + a "top builder" badge) — the lowest-pressure free-rider deterrent and the most on-brand for cozy. *(shared-goal, fairness)*

---

## Sources

**Synchronized**
- [serebii — Raid Battles](https://www.serebii.net/pokemongo/raidbattles.shtml)
- [Theria — PoGO Raid Battles](https://theriagames.com/guide/pokemon-go-raid-battles/)
- [Switchblade — PoGO Raid Strategy](https://www.switchbladegaming.com/pokemon-go/raid-strategy-guide/)
- [Bulbapedia — Community Day](https://bulbapedia.bulbagarden.net/wiki/Community_Day)
- [Pokémon GO Hub — 3-hour window opinion](https://pokemongohub.net/post/article/opinion/our-thoughts-on-the-three-hour-community-day-window/)
- [Warcraft Wiki — Bloodlust effect](https://warcraft.wiki.gg/wiki/Bloodlust_effect)
- [alittlemorelikethis — WoW cooldown/burst](https://alittlemorelikethis.com/wow-raiding-dps-cooldown-management-and-bursting-strategies/)
- [gmpcc — waiting for cooldowns](https://gmpcc.org.uk/the-discipline-of-waiting-for-major-cooldowns-becomes-the-strategic-pause-separating-maximized-burst-from-fragmented-attempts/)
- [Game Rant — Destiny 2 buff/debuff stacking](https://gamerant.com/destiny-2-buff-debuff-stack-damage/)
- [Sportskeeda — Well of Radiance nerf](https://www.sportskeeda.com/mmo/news-well-radiance-nerfed-destiny-2-the-final-shape)
- [Capcom — MH Generations manual (mounting)](https://game.capcom.com/manual/MH_Gen/en-UK/page-26.html)
- [Game8 — MH Wilds flinch prevention](https://game8.co/games/Monster-Hunter-Wilds/archives/500303)
- [Fextralife — MHW Flinch Free](https://monsterhunterworld.wiki.fextralife.com/Flinch+Free)
- [Sea of Thieves — Sail Together](https://www.seaofthieves.com/sail-together)
- [Kotaku — how SoT co-op works](https://kotaku.com/how-rares-chaotic-co-op-pirate-game-sea-of-thieves-work-1782033340)
- [Puyo Nexus — Guild Rush Events (combo window +20%)](https://puyonexus.com/wiki/Category:PPQ:Guild_Rush_Events)
- [Fall Guys Wiki — Egg Scramble](https://fallguysultimateknockout.fandom.com/wiki/Egg_Scramble)
- [Dexerto — Fall Guys team mini-game guide](https://www.dexerto.com/fall-guys/fall-guys-team-mini-game-guide-egg-scramble-hoopsie-daisy-1408056/)
- [GINX — Fall Guys team rounds](https://www.ginx.tv/en/fallguys/what-are-team-rounds-fall-guys)
- [GameTyrant — WoW raid time management](https://gametyrant.com/news/strategic-time-management-for-maximizing-wow-tbc-raid-readiness)
- [Diary of a Guild Leader — raiding burnout](https://diaryofaguildleader.wordpress.com/2020/04/01/wow-classic-raiding-front-loading-efforts-and-burnout/)
- [PlanetCalc — Gaming Raid Time Converter](https://planetcalc.com/10808/)

**Shared-goal**
- [Clash of Clans Clan Games rewards & points — Sportskeeda](https://www.sportskeeda.com/mobile-games/all-clash-clans-clan-games-rewards-points-required-january-2025)
- [Clan Games — Clash of Clans Wiki](https://clashofclans.fandom.com/wiki/Clan_Games)
- [Barn Raising — FarmVille Wiki](https://farmville.fandom.com/wiki/Barn_Raising)
- [FarmVille barn raising — AOL (2010)](https://www.aol.com/2010-01-14-farmville-barn-raising-the-storage-solution-youve-been-waiting.html)
- [How liberation works in Helldivers 2 — GameRant](https://gamerant.com/helldivers-2-how-does-liberation-percentage-work-automaton/)
- [Galactic War progress explained — Dot Esports](https://dotesports.com/helldivers-2/news/helldivers-2-galactic-war-progress-explained)
- [Meridia black hole — Kotaku](https://kotaku.com/helldivers-2-black-hole-meridia-major-order-1851515722)
- [Meridian Black Hole — Helldivers Wiki](https://helldivers.wiki.gg/wiki/Meridian_Black_Hole)
- [Helldivers 2 dark fluid major order — Sportskeeda](https://www.sportskeeda.com/esports/helldivers-2-latest-major-order-involves-weaponized-dark-fluid)
- [Global Catch Challenge — Pokémon GO Wiki](https://pokemongo.fandom.com/wiki/Global_Catch_Challenge)
- [Players catch 3 billion Pokémon — Nintendo Everything](https://nintendoeverything.com/pokemon-go-players-catch-3-billion-pokemon-during-global-catch-challenge-all-rewards-unlocked/)
- [3-billion catch event — Game Informer](https://www.gameinformer.com/b/news/archive/2017/11/26/pokemon-go-new-event-asks-players-to-catch-3-billion-pokemon-in-a-week-.aspx)
- [Empyrean Foundation guide — TheGamer](https://www.thegamer.com/destiny-2-empyrean-foundation-guide/)
- [Empyrean Foundation community goals — Fanbyte](https://www.fanbyte.com/destiny-2/guides/destiny-2-empyrean-foundation-guide-community-goals-rewards-more)
- [Goal-gradient effect & progress bars — Medium/Design Bootcamp](https://medium.com/design-bootcamp/goal-gradient-effect-and-the-psychology-of-progress-bars-df6fd889fd8e)
- [Goal gradient effect for engagement — LogRocket](https://blog.logrocket.com/ux-design/goal-gradient-effect/)
- [When progress bars backfire — Irrational Labs](https://irrationallabs.com/blog/knowledge-cuts-both-ways-when-progress-bars-backfire/)
- [Leaderboards for in-game events (retention) — US Patent 9007189](https://patents.justia.com/patent/9007189)
- [Guild Conquest contribution — IdleMMO Wiki](https://wiki.idle-mmo.com/guilds/conquest)

**Pairwise / asymmetric**
- [Screenwise — streak psychology](https://screenwiseapp.com/guides/the-psychology-of-snapchat-streaks)
- [Evolve — streaks/addiction](https://evolvetreatment.com/blog/snapchat-streaks-addicted-teens/)
- [StrategicEdTech — streak stress](https://www.strategicedtech.com/blog/could-snap-streaks-be-responsible-for-long-term-stress-and-anxiety-in-teens)
- [duoplanet — Friend Streaks](https://duoplanet.com/duolingo-friend-streaks/)
- [Medium/Rajput — 22% lift](https://medium.com/@rajputgrishma/how-duolingos-friend-streak-increased-its-user-engagement-by-22-db34e403c533)
- [deconstructoroffun — streak retention](https://duolingo.deconstructoroffun.com/mechanics/streaks)
- [Medium/Smith — streak psychology](https://medium.com/@patricia-smith/the-psychology-behind-duolingos-addictive-learning-streak-system-ce29c5374d36)
- [Fextralife — MH World multiplayer](https://monsterhunterworld.wiki.fextralife.com/Multiplayer)
- [Fextralife — MH Wilds online](https://monsterhunterwilds.wiki.fextralife.com/Online_%26_Multiplayer)
- [Push Square — Wilds NPC co-op](https://www.pushsquare.com/guides/monster-hunter-wilds-how-to-play-co-op-with-npc-bots)
- [FFXIV Wiki — Mentor system](https://ffxiv.consolegameswiki.com/wiki/Mentor_System_and_Novice_Network)
- [Destructoid — becoming a mentor](https://www.destructoid.com/how-to-become-an-ffxiv-mentor-and-unlock-the-mentor-roulette/)
- [Kotaku — mentor roulette](https://kotaku.com/final-fantasy-xiv-battle-mentor-roulette-1851478857)
- [Game8 — AC Best Friends](https://game8.co/games/Animal-Crossing-New-Horizons/archives/284493)
- [TheGamer — AC Best Friends tools](https://www.thegamer.com/animal-crossing-new-horizons-how-add-players-best-friends-list-guide/)
- [Gamepur — SoT crew size](https://www.gamepur.com/guides/maximum-crew-size-and-solo-play-in-sea-of-thieves)
- [GameRant — SoT 4-player design](https://gamerant.com/why-sea-of-thieves-ship-crews-only-support-4-players/)
- [Windows Central — Borderlands co-op scaling](https://www.windowscentral.com/how-does-co-op-level-scaling-work-borderlands-3)
- [Sportskeeda — co-op loot/scaling](https://www.sportskeeda.com/esports/tiny-tina-s-wonderlands-two-co-op-options-tweak-loot-enemy-scaling)
- [GoalsWon — accountability stats](https://www.goalswon.com/blog/23-apps-that-will-keep-you-accountable-and-motivated-to-achieve-all-your-personal-goals/)
- [Wikipedia — Dark pattern](https://en.wikipedia.org/wiki/Dark_pattern)
- [UX Collective — gamification dark patterns](https://uxdesign.cc/game-design-dark-patterns-that-keep-you-hooked-a3988395533c)

**Fairness / anti-abuse**
- [Supercell — Clan Wars 2 Is Here (release notes)](https://supercell.com/en/games/clashroyale/blog/release-notes/clan-wars-2-is-here/)
- [Clash Royale Top 5 Questions on Clan Wars 2 — boat hammer numbers](https://www.blog.zeusx.com/post/clash-royale-top-5-questions-on-clan-wars-2)
- [Clash Royale Wiki — Clan Wars](https://clashroyale.fandom.com/wiki/Clan_Wars)
- [CoC Wiki — Clan War Leagues](https://clashofclans.fandom.com/wiki/Clan_War_Leagues)
- [CoC Wiki — CWL FAQ](https://clashofclans.fandom.com/wiki/Clan_War_Leagues_FAQ)
- [Clasher.us — Clan War Matchmaking](https://www.clasher.us/guide/clan-war-matchmaking)
- [AllClash — Clan War Matchmaking](https://www.allclash.com/clan-war-matchmaking/)
- [Supercell — Clan War Matchmaking Improvements (2017)](https://supercell.com/en/games/clashofclans/blog/news/clan-war-matchmaking-improvements/)
- [player.one — engineered bases update](https://www.player.one/clash-clans-update-engineered-bases-clan-wars-2017-hack-builder-base-cheats-118219)
- [Oreate — Unpacking War Weight](https://www.oreateai.com/blog/unpacking-the-war-weight-in-clash-of-clans-more-than-just-numbers/e32e97edf4a6f0f26e80ddc8ecd3a385)
- [Scopely Help Center — rules for participating in War](https://scopely.helpshift.com/hc/en/46-marvel-strike-force/faq/7289-what-are-the-rules-for-participating-in-war/)
- [gaming-fans.com — MSF Alliance War offensive strategy](https://gaming-fans.com/marvel-strike-force/msf-alliance-wars/offensive-strategy/)
- [Nerds on Earth — Let's Win this WAR](https://nerdsonearth.com/2020/11/marvel-strike-force-lets-win-this-war/)
- [theriagames — MSF Alliance War Events (ELO/shelling)](https://theriagames.com/guide/marvel-strike-force-alliance-war-events/)
- [MSF — Alliance Recruitment Tool](https://marvelstrikeforce.com/en/updates/introducing-the-alliance-recruitment-tool)
- [Plarium — RAID Tag Team Arena guide](https://raid-support.plarium.com/hc/en-us/articles/360014696359-Guide-Tag-Team-Arena)
- [Hero Wars support — Guild War](https://support-hwa.nexters.com/hc/en-us/articles/6094698021266-Guild-War)
- [Hero Wars Wiki — Guild War](https://hero-wars.fandom.com/wiki/Guild/Guild_War)
- [theriagames — Hero Wars guide](https://theriagames.com/guide/hero-wars-alliance-guild/)
- [Cpt Hedgehog — Last War Safe Time](https://cpt-hedge.com/guides/season-5-alliance-safe-time)
- [Last War support — Battle/Rest Time](https://firstfungroup.zendesk.com/hc/en-us/articles/45137396113939-S5-Alliance-Battle-Time-Rest-Time)
- [BitTopup — MLBB Smurf Detection](https://bittopup.com/article/MLBB-Smurf-Detection-Avoid-Low-Priority-Queue-2025)
- [Turbosmurfs — TrueSkill2 / smurfs](https://turbosmurfs.gg/article/what-are-smurf-accounts-a-league-of-legends-guide)

**Cross-cutting (free-rider / social-loafing)**
- [Wikipedia — Free-rider problem](https://en.wikipedia.org/wiki/Free-rider_problem)
- [LeadershipIQ — The Free-Rider Problem](https://www.leadershipiq.com/blogs/leadershipiq/the-free-rider-problem)
- [Unrubble — What is social loafing](https://unrubble.com/blog/what-is-social-loafing)
- [Profit.co — Adverse effects of social loafing](https://www.profit.co/blog/behavioral-economics/adverse-effects-of-social-loafing-in-the-workplace/)
