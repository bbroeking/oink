# Idle-game power-ups and social loops

**Date:** 2026-08-27  
**Purpose:** Inputs for redefining the Mote and rebuilding the Mote Machine as an earned slot-machine-style ritual without wagering economics.  
**Method:** Compact comparison of first-party game sites, developer posts, and official support documentation. “Source facts” below describe the referenced games; “TTP implications” are design inferences, not claims made by those sources.

## Findings from official sources

### Idle Champions: automation as a configurable system

**Source facts**

- Modron Automation can automatically reset adventures, restore formations, and farm resources. Its Modron Core adds a strategy/puzzle layer for optimizing bonuses rather than functioning only as an on/off skip. Multi-Party Play lets several adventures run concurrently. [Codename Entertainment: 2020 in review](https://www.codenameentertainment.com/?page=idle_champions&post_id=1152)
- Trials of Mount Tiamat is a seven-day asynchronous co-op campaign for up to five players. Players select distinct trials and nominate a champion who becomes unavailable to them but buffs the whole party. Individual progress damages one shared boss, and distinct first-time completions grant rewards. [Codename Entertainment: Trials of Mount Tiamat](https://www.codenameentertainment.com/?page=idle_champions&post_id=1271)

**TTP implications (inference)**

- An auto-tickler should be something the player configures and improves, not merely a passive percentage.
- Automation can create a second play layer: choosing a helper, its policy, its target, and the resources it may consume.
- Sounder play can remain asynchronous while giving members distinct roles that feed one shared objective.

### Hay Day: role-specific helpers with quotas and stop conditions

**Source facts**

- Rose automates animal feed, care, and collection up to player-set quantities. She offers three policies: feed animals and stock extra feed, stock feed without feeding every animal, or make feed only when needed.
- Ernest automates a different production domain. Both helpers stop when their quota is met or required inputs run out, and their output uses separate helper storage.
- Helper service is time-bounded; helper boosters can provide between 6 and 72 hours of service. [Supercell Support: Rose & Ernest](https://support.supercell.com/hay-day/en/articles/farm-helpers-rose-ernest.html)
- Hay Day bonus events reward actions players already perform, while boost events temporarily accelerate crops or production machines. [Supercell Support: Regular Events](https://support.supercell.com/hay-day/en/articles/regular-events.html)

**TTP implications (inference)**

- Auto-actions need visible quotas, reserve floors, and stop reasons so they never silently exhaust Tickles or other scarce resources.
- Different helper types should own different verbs or policies rather than being skins over the same rate multiplier.
- Limited events should enrich existing tickling, visiting, ritual, Feeding, and Adventure behavior before introducing additional daily chores.

### Pokémon Sleep: helpers with identity and a bundled temporary boon

**Source facts**

- Helper Pokémon have different skills, Berries, and ingredients, giving passive contributors distinct identities. [The Pokémon Company: Pokémon Sleep](https://www.pokemon.com/uk/pokemon-video-games/pokemon-sleep)
- A Good Camp Set lasts seven days and combines several legible benefits: one extra hungry research encounter, 50% more cooking capacity, 20% faster helpers, and 20% more helper carrying capacity. [Pokémon Sleep Support: Good Camp Set](https://app-psl.pokemon-support.com/hc/en-us/articles/29517911255065-My-Good-Camp-Set-isn-t-taking-effect)

**TTP implications (inference)**

- Named helpers should express personality through what they do, not only through appearance.
- A temporary reward can be a small, coherent bundle whose duration and effects are known in advance.
- A won duration should preferably remain stored until activation; immediately starting a timer can turn a delightful spin into pressure.

### AFK Journey: seasonal experimentation and optional minigames

**Source facts**

- Magic Charms provide seasonal stat bonuses and special effects. Daily trials favor different heroes and can award random charms; heroes also unlock seasonal skills.
- The same season introduced optional exploration activities including obstacle-dodging, limited-attempt treasure detection, and a battle rule in which filling a Fury meter grants a battle-long buff. [Farlight Games: Song of Strife season highlights](https://afkjourney-news.farlightgames.com/en/detail/15)
- A later developer note described phased seasonal progression and an endless-stage server event in which early clears generate bonus rewards for everyone on the server. [Farlight Games: designer preview](https://afkjourney-news.farlightgames.com/en/detail/83)

**TTP implications (inference)**

- Separate permanent collection growth from seasonal build experimentation. Seasonal powers can be stranger and stronger because their boundary is explicit.
- Machine results can open optional side activities without making those activities mandatory for the core economy.
- A community goal can reward all participants without requiring live synchronous play.

### Brawl Stars: earned random rewards with disclosed rates and fallbacks

**Source facts**

- Starr Drops are surprise rewards earned primarily through daily wins. Supercell lists rarity rates of 50% Rare, 28% Super Rare, 15% Epic, 5% Mythic, and 2% Legendary.
- If a player already owns or is ineligible for a rolled reward, the game supplies a fallback reward. [Supercell Support: Starr Drops](https://ingame.support.supercell.com/brawl-stars/en/articles/starr-drops-5.html) and [Supercell Support: Drop Chances](https://support.supercell.com/brawl-stars/en/articles/drop-chances.html)

**TTP implications (inference)**

- The Mote Machine should never produce an unusable duplicate or a null result by accident; every duplicate needs a defined fallback.
- The theatrical machine surface can avoid casino language while a separate honest information surface discloses the reward pool and behavior.
- Random rewards should be paired with deterministic progress toward a player-chosen result so a bad streak cannot indefinitely block a desired system.

### Coin Master: a close structural comparison and a useful boundary

**Source facts**

- Spinner results branch into secondary actions: three pig symbols open a raid/dig choice, while three hammer symbols trigger an attack against a generated, friend, or revenge target. [Coin Master Support: Raids](https://support.coinmastergame.com/hc/en-us/articles/360001257933-What-are-Raids) and [Coin Master Support: Attacks](https://support.coinmastergame.com/hc/en-us/articles/360001264874-What-are-Attacks)
- Pets specialize in different parts of that loop: Foxy expands raid digging, Tiger increases attack proceeds, and Rhino can block attacks. Shields automatically absorb one attack and are won from the spinner rather than bought directly. [Coin Master Support: Pets](https://support.coinmastergame.com/hc/en-us/articles/360001264694-What-are-Pets) and [Coin Master Support: Shields](https://support.coinmastergame.com/hc/en-us/articles/360001258013-What-are-Shields)
- Better Together gives two friends separate tasks that fill a shared milestone bar. Community Challenge aggregates a larger group’s activity into shared milestones. [Coin Master Support: Better Together](https://support.coinmastergame.com/hc/en-us/articles/25207344080018-What-is-the-Better-Together-Event) and [Coin Master Support: Community Challenge](https://support.coinmastergame.com/hc/en-us/articles/24439148690578-What-is-the-Community-Challenge)
- Coin Master also sells Spins, supports reward multipliers, lets attacks degrade another player’s progress, and supports targeted revenge. [Coin Master Support: Getting Spins](https://support.coinmastergame.com/hc/en-us/articles/4404737856274-How-do-I-get-Spins) and [Coin Master Support: Attacks](https://support.coinmastergame.com/hc/en-us/articles/360001264874-What-are-Attacks)

**TTP implications (inference)**

- A spin that branches into a short activity, social choice, or helper unlock has more systemic value than a currency payout alone.
- Pair and community progress bars are strong references for cozy asynchronous interaction.
- Purchased plays, escalating spin multipliers, destructive attacks, revenge targeting, and offline vulnerability are boundaries to reject.

## Reusable design patterns

### One Mote, one named manifestation

A working definition to test:

> A Mote is an earned key that awakens the Mote Machine once. The server chooses one named manifestation from a disclosed pool; the machine reveals it, and the player later deploys or configures it.

This retains the rare Shimmer Pocket → special ritual relationship while expanding the outcome beyond bonus Tickles. “Manifestation” is provisional language; the important constraint is that results are understandable tools, helpers, boons, or invitations rather than an abstract rarity color alone.

### Result families

- **Helper or contraption:** Auto-tickler, Blessing Bell, Curse Imp, Happiness Tender, visit assistant, or Sounder helper.
- **Policy chip:** Changes a helper’s quota, reserve floor, timing, target priority, or trigger condition.
- **Temporary boon:** A stored 6-, 24-, or 72-hour effect with explicit behavior and player-chosen activation.
- **Permanent blueprint:** Unlocks a helper archetype, policy slot, cosmetic treatment, or new configuration option. Prefer new choices over compounding raw power.
- **Side-door ticket:** Opens an optional minigame, one-off scene, or event path. Core content must not be randomly gated.
- **Sounder project piece:** Contributes to a shared asynchronous milestone or equips one distinct group role.

### Possible helper differentiation

- **Steady Paw:** Spends regenerated Tickles but always preserves a chosen reserve.
- **Happiness Tender:** Acts only when Mood crosses a configured threshold.
- **Combo Crank:** Concentrates a small tickle burst inside a chosen window.
- **Visiting Glove:** Assists the first eligible visit but never bypasses visit caps.
- **Blessing Bell / Curse Imp:** Queues a chosen valid ritual and performs it only when an ordinary manual cast would be legal. It never creates extra daily casts, bypasses target cooldowns, or stacks effects beyond existing limits.

### Three progression horizons

1. **Immediate:** a one-use action, charm, or minigame ticket.
2. **Seasonal:** a build modifier that encourages experimentation and expires at a clearly stated boundary.
3. **Permanent:** a blueprint, collection entry, helper, policy, or slot that increases choice more often than output.

Keeping these horizons separate limits runaway idle compounding and makes each reward’s value easier to understand.

### Bounded social effects

- Prefer opt-in pair goals, Sounder-wide bars, distinct co-op roles, and limited helper lending.
- Keep interference reversible, capped, non-stacking, shieldable through existing systems, and unable to destroy earned progress.
- Auto-curse should automate an already-valid ritual, not manufacture additional attacks.
- Consider a consolation or immunity residue for the recipient so mischief creates a story beat instead of only a setback.

### Honest random-reward rules

- The server commits the outcome before Rive begins the result reveal.
- The reward pool, eligibility rules, and fallbacks are documented outside the theatrical surface.
- Duplicate and ineligible results always convert into something useful.
- Each play advances deterministic choice progress—for example, after a fixed number of Motes the player chooses one blueprint.
- The player can inspect a receipt/history.
- Motes cannot be purchased, multiplied into higher-stakes plays, cashed out, or lost to a client failure.

### Reel-stop interaction

Do not imply that a button changes a result already fixed by the server.

- **Recommended first version:** the lever starts one automatic, staggered three-reel reveal.
- **Possible later experiment:** a separately named Brake Challenge where timing adds a small deterministic bonus or progress pip but never reduces or rerolls the base reward.
- **Presentation-only alternative:** buttons may shorten the reveal if plainly framed as “stop the show,” not as prize control.

## Anti-patterns to reject

- Purchasable Motes or plays.
- Variable stake or spin multipliers.
- Spin outcomes that primarily award more spins and create an endless action loop.
- Engineered near misses after the outcome is known.
- Destructive raids, revenge ladders, friend targeting, or punishment while offline.
- Consumable defense required to preserve already-earned progress.
- Helpers that silently spend scarce resources or have invisible stop conditions.
- Reward timers that begin before the player chooses to use them.
- Duplicates that resolve to nothing.
- Random access to mandatory or core game modes.
- Permanent multiplicative bonuses that compound without a ceiling.
- Three independent combinatorial reels whose noun × verb × duration permutations create incoherent or unbalanceable rewards. Use a curated receipt table; the reels should visually spell a pre-authored result.

## Recommended direction for the next specification

Treat the Mote Machine as the reveal and deployment gateway for a small idle-tool ecosystem. The excitement comes from depositing a rare earned Mote, waking the machine, pulling the lever, watching three reels brake, and receiving a legible named result. The long-term depth comes afterward: configuring helpers, selecting safe automation policies, deciding when to activate boons, and deploying results toward self, friend, rival, or Sounder contexts.

For the first shippable reward pool, favor a deliberately small set of curated outcomes spanning one helper, one policy upgrade, one stored temporary boon, one social action, and one optional side activity. Add deterministic choice progress from the beginning. Defer manual reel braking, broad auto-curse behavior, and combinatorial reward construction until the base loop has demonstrated that it is understandable, trusted, and fun.
