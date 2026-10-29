# Five ways to play together

Started 2026-10-01; revised 2026-10-02. Status: **initial concepts with the user's required head-to-head leaderboard**; game rules remain proposals.

**Revised recommendation: prototype competitive Mud Volley first.** The user requires a leaderboard based on head-to-head wins/rating, with competitive and cooperative options. Mud Volley now supplies the competitive match; Tickle Duet, Truffle Trail and Picnic Relay remain cooperative, and Pig Pageant remains social. Use random matchmaking for the proposed first version; this is the default for the user's tentative “maybe only random” direction.

This exploration includes five original concept boards. Each shows an entry/lobby screen, an active gameplay screen, and an illustration of the feeling of play. They are future visual directions; their typography, props, and exact screen layouts need translation into the existing UI primitives. The written rules here take precedence over decorative details in the pictures.

- [Visual gallery](index.html)
- [Current ranked matchmaking specification](ranked-matchmaking-spec.md)
- [Demo setup and playtest plan](demo-plan.md)
- [Original Duet transport exploration](matchmaking-spec.md), superseded for first-mode/product scope
- [Art and generation prompts](../../../assets/concepts/matchmade-play/2026-10-01/README.md)

## What stays Tickle the Pig

The pigs are the protagonists: their coats, equipped looks, inward-facing poses, snorts, giggles, and little physical reactions. Players perform a simple gesture and see another pig respond immediately. Warm paper stickers frame a painted farm scene; they do not turn it into a competitive dashboard.

These proposals serve **Connect** first and **Collect** through optional earned keepsakes. None spends the Tickle bank, grants Snouts/Tickles/Motes/Finds, changes Happiness or Streak, or gives members stronger inputs. Minigame tickling is a gesture, not the existing economy action. A finished match may eventually earn a fixed scrapbook stamp, once per qualifying occasion; the first prototype needs only a result screen.

The current product log retires the herd race on 2026-09-21. The older charter headline and August multiplayer research describe earlier systems; this proposal uses today's code and the newer decision log. The Sounder remains the asynchronous crew, and a match is a temporary pair or small party. The existing personal Truffle Patch does not become a shared live board.

The earlier no-duel charter rule drove the original all-cooperative exploration. The user's 2026-10-02 direction explicitly calls for head-to-head rating, so it takes precedence for this new multiplayer feature. Rating is independent of cosmetics, care state and the currency economy.

## Cooperative, competitive, or one-way?

The original boards were **four cooperative games and one social showcase**. None was competitive as delivered. The revised mix is:

| Mode | Revised type | Direction of interaction | Head-to-head rating? |
| --- | --- | --- | --- |
| Tickle Duet | Cooperative | Create a phrase, then copy the partner's; roles alternate | No |
| Mud Volley | Competitive 1v1 | Attack/catch against the rival; equal turns in both roles | Yes |
| Truffle Trail | Cooperative | Sniffer informs Digger; swap roles across boards | No |
| Picnic Relay | Cooperative with different jobs | Picker passes to Mixer; swap jobs | No |
| Pig Pageant | Social showcase | One pig performs while others react; everybody gets a runway turn | No |

A gesture or handoff can be one-way **during a turn**, but none is a one-way mode overall. These are live sessions, not asynchronous visits to an absent pig. “Cooperative” does not require adding two independent tap totals: Duet changes a partner's prompt, while Trail/Picnic require information or actions from the other role.

The ranked leaderboard belongs to the competitive mode. A cooperative best-run board could be a separate future feature, but it must not mix shared scores with individual win/loss rating.

## The options

| Build order | Mode | Human players | Typical play | Other player's indispensable action | Added complexity after the matchmaking spine |
| --- | --- | --- | --- | --- | --- |
| 1 | **Mud Volley** | 2 | ~72 seconds | Secretly chooses a catch against your toss, then attacks you | Medium: private choices, rating/results, six tosses |
| 2 | **Tickle Duet** | 2 | ~72 seconds | Creates the pattern you copy; copies yours | Small: two gestures, alternating turns, reactions |
| 3 | **Truffle Trail** | 2 | ~90 seconds | Supplies the clue you lack, or digs where you signal | Medium: hidden information, board and role-specific views |
| 4 | **Picnic Relay** | 2 | ~90 seconds | Picks your requested ingredient, or mixes what you pass | Larger: two role UIs, recipes, handoffs |
| 5 | **Pig Pageant** | 3 | ~100–120 seconds | Becomes the audience for your runway turn | Larger: dress-up trunk, runway, reactions, three-player fill |

The order is a scope judgment, not a measured schedule. Five concepts should not become five launch queues.

## 1. Tickle Duet — cooperative option

**One sentence:** “Show your partner a tickle-boop, then copy theirs.”

**Feeling:** The intimacy and silliness of a Visit, with a person actually on the other end. A snort answers your snort. There is no opponent to beat.

**Play:** Six exchanges alternate Leader and Follower. The Leader chooses a two-gesture phrase using **Tickle** and **Boop**. The Follower watches the partner's pig perform it, then echoes it. Both pigs respond to every gesture. A matching phrase produces a big shared giggle; a mismatch makes a goofy hiccup and still moves the pair forward. The final exchange gives the two pigs a little laughing finale. Prototype two inputs before considering a third or longer phrases.

The person chooses every phrase. A server-generated pattern would make this a synchronized solo memory game and weaken the reason to match with someone.

**UI:** Two large equipped pigs share one ground line. Two broad thumb controls sit below them. A small turn cue reads “Your little pattern” or “Copy Clover.” Six paper pips track exchanges; they are minigame progress, never a mood meter. The phrase can replay through an accessible pictogram sequence. Match-only reactions do not change the pig's persistent Mood.

**Art:** [Tickle Duet board](../../../assets/concepts/matchmade-play/2026-10-01/01-tickle-duet.png).

**Why it belongs:** The defining verb becomes reciprocal. It reuses facing and reactions from Visits and makes a stranger feel like a pig you just met.

**Main risk:** Four possible two-gesture patterns may become repetitive. The prototype should test whether expressive reactions and reciprocal authorship are enough before increasing input complexity.

**Scope cut:** Two gestures, six exchanges, one environment, raster PigStage, fixed deadlines, no chat, no currency, no ranking.

## 2. Mud Volley

**One sentence:** “Guess where your rival will catch, then catch their next toss.”

**Feeling:** A small barnyard rivalry: remembering the rival's remaining moves, a satisfying catch, and a goofy harmless splat.

**Play:** Three rounds contain six exchanges; each pig throws once in each round. Attacker and Defender secretly commit a lane: Left, Middle or Right. The server reveals only after both lock. Matching lanes make a catch; different lanes give the attacker one Splat. Each pig has one card for each toss lane and each catch lane, spent after use and visible after reveal. Higher Splats after six exchanges wins; equal Splats draw. Both pigs get three attacks and three defenses.

The arc performs the accepted result; it does not decide physics or timing points. Spent lane cards are the initial strategy experiment. Unlimited lane guessing would make the board largely reflect luck, so the prototype must test whether the constrained choices create meaningful reads and rematches.

**UI:** One pasture, two pigs, individual Splat counts, three large lane cards with spent states, “Choose your toss/catch,” and Lock it in. Entry offers Find a rival and Leaderboard. Result shows Win/Draw/Loss, rating change and current season rank. No paid modifiers, health bar or speed grade.

**Art:** [Ranked Mud Volley revision](../../../assets/concepts/matchmade-play/2026-10-01/02-mud-volley-ranked-v2.png). The original [cooperative board](../../../assets/concepts/matchmade-play/2026-10-01/02-mud-volley.png) is retained as an earlier alternative.

**Why it belongs:** Mess is a pig-specific joke, and bodies make the consequences legible. This adds anticipation rather than another memory game.

**Main risk:** The tiny card game may still have too little skill depth for a lasting rating. Test repeated decisions before building a full ladder. A ranked disconnect also needs a forfeit policy; otherwise a likely loser can erase the result by leaving.

**Scope cut:** Three zones and alternating exchanges; no free-form physics, projectile simulation, damage, or continuous movement.

## 3. Truffle Trail

**One sentence:** “You sniff, I dig, and we fill the basket together.”

**Feeling:** Two muddy detectives solving a tiny mystery.

**Play:** Three small 3×3 boards hide one truffle each. The Sniffer receives a private scent clue and marks a suggested patch; the Digger sees the ground and chooses where to dig. They swap roles between boards. Every dig gives visible feedback, so a wrong choice teaches rather than destroys the round. A few broad pictogram clues replace text chat.

**UI:** The board dominates; the local role card shows either a scent clue and point control or a shovel and selected tile. The other pig's face and latest signal stay visible. One shared basket counts discoveries.

**Art:** [Truffle Trail board](../../../assets/concepts/matchmade-play/2026-10-01/03-truffle-trail.png).

**Why it belongs:** Sniffing and mud are already game language, but this requires one live partner's information. It is separate from Sounder Feedings and their personal Truffle Patch copies.

**Main risk:** A public match payload containing both role states would destroy the puzzle. The server must project different snapshots and channels for the two roles.

**Scope cut:** Three tiny boards, pictogram clues, no collectible Find mint, persistent map, or Hungerer penalty.

## 4. Picnic Relay

**One sentence:** “Ask for an apple, pass the clover, and stir up lunch together.”

**Feeling:** A little useful cooperation with harmless kitchen chaos, at a pace that stays cozy.

**Play:** One pig is Mixer and sees a two-ingredient recipe; the other is Picker and controls four ingredients. The Mixer sends a pictogram request, the Picker passes an ingredient, and the Mixer accepts it and stirs. Three dishes complete the picnic, with a role swap after the first dish. Wrong ingredients make a funny bowl of slop and can be sent back.

**UI:** Mixer sees a recipe, bowl, request stamps and Stir; Picker sees an ingredient tray, incoming request and Pass. Both see their partner's pig performing its job. The art illustrates the Picker's view and a passed apple.

**Art:** [Picnic Relay board](../../../assets/concepts/matchmade-play/2026-10-01/04-picnic-relay.png).

**Why it belongs:** One player helps another do something tangible, and the resulting mess is shared. It adds role asymmetry without changing existing feeding schedules or inventories.

**Main risk:** Repeated wrong handoffs can become griefing. Limit pending items, use a gentle reset, and let either pig leave with no loss. Avoid frantic countdown pressure.

**Scope cut:** Four ingredients, three recipes, one pending handoff, no moving conveyor, order queue, consumable inventory, or real-time gesture streaming.

## 5. Pig Pageant

**One sentence:** “Dress for a silly theme, take a turn, and cheer for the other pigs.”

**Feeling:** Being seen in a tiny county-fair show, with encouragement rather than judgment.

**Play:** Three pigs receive one theme and the same temporary loaner trunk. They have about 30 seconds to dress, then each takes a short runway turn while the others send three preset reaction stamps. The finale gives each pig a positive match-only rosette, such as “Best puddle strut.” No last place, zero-vote display, money prize, or permanent popularity rating.

**UI:** Big local pig preview, one theme banner, six borrowed props, a few costume slots, and Ready. On the runway, the wardrobe collapses into three reaction buttons. Owned clothing can be shown in the entry lobby, but every participant gets equal themed pieces in the game.

**Art:** [Pig Pageant board](../../../assets/concepts/matchmade-play/2026-10-01/05-pig-pageant.png).

**Why it belongs:** It puts collection and pig identity on a shared stage. A uniform temporary trunk prevents spending or membership from becoming an advantage.

**Main risk:** Three-person fill is harder, and dress-up adds substantial UI/content work. Reaction stamps inform warm temporary labels only; collusion must never control currency or durable status. No global style score or full-wardrobe tagging system is needed.

**Scope cut:** One six-prop theme trunk, no public voting, persistent ranking, purchased props, or style-scoring engine.

## The shared experience

Entry belongs behind one **Play together** door on Friends, opening a dedicated full-screen route. The Barn keeps its existing primary action hierarchy. For the revised first release it opens ranked Mud Volley, with a Leaderboard door. The five options here are candidates; cooperative modes can follow without sharing a rating formula.

Flow: entry → random search → ready → live play → result and rating → search again or leave. No friend code, selected opponent or same-person rated rematch in the proposed first release. Search again returns to the pool. The original cooperative boards' friend buttons are historical entry ideas, not the revised queue scope.

After about 12 seconds waiting, offer **Practice with Practice Pig**. Explain that it is practice. Accepting it cancels the human queue atomically before starting a separate local session. If a human match already won the race, return that match and its ready check instead. Do not invent a population count, promise a wait time without data, or quietly replace a person with a bot.

Rated play uses a proposed 20-second reconnect grace: leaving or a single missing pig after play starts can give that pig a loss. Before play, or during a verified service incident/mutual loss, no rating changes. The result says “Round ended early” because bad connectivity and deliberate quitting are indistinguishable. Cooperative play can retain the original warm incomplete result. No bot takes a ranked seat. Block/report remains available; matching checks blocks in both directions.

## What to learn before committing

Prototype Mud Volley's six hidden-choice exchanges locally, then on two physical devices. Ask whether the rival changes a decision, whether spent lane cards create useful anticipation, and whether players want another random opponent. Duet remains a smaller cooperative feel prototype.

Collect queue time, human fill, ready completion, match completion, disconnect/forfeit rate, distinct opponents, placement completion and repeated searches. Separate practice from rated human sessions. Do not treat a local bot session as proof that live multiplayer works.

If Mud Volley's choices feel mostly random, revisit its rules before investing in the leaderboard UI; the rating formula cannot manufacture skill depth. If partner communication is the appealing part, Truffle Trail is the stronger cooperative direction. These remain experiments, not a promise to build all five.

## Source anchors

- [Current product charter and newer decision log](../../../SKILL.md)
- [Domain vocabulary](../../../CONTEXT.md)
- [Design system](../../design/design-system-spec.md) and [taste standard](../../design/taste-standard.md)
- [Prior Rive multiplayer research](../../research/rive-multiplayer-experiments.md), with historical runtime claims checked against current package.json
- [Existing two-pig Visit](../../../components/BarnVisitModal.tsx) and [PigStage](../../../components/ui/PigStage.tsx)
- [Existing Lounge transport](../../../hooks/useLoungePeers.ts), a prototype whose client authority should not be reused for game state
