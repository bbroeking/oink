# Multiplayer demo plan

2026-10-02. **Proposal, not a built demo.** The concept gallery contains art; it does not yet run these games.

**Recommendation: build one throwaway browser Multiplayer Lab, starting with Mud Volley and then Truffle Trail.** Use the existing plain-browser prototype approach from [Adventures](../../../scripts/prototypes/adventures/README.md). Open it on two phones to test real private decisions. Keep all state in a temporary local process; no accounts, Supabase migrations, economy or live rankings are needed to answer whether these games are fun.

The question is gameplay feel and dependence on another person, rather than choosing a screen layout. The demo therefore needs playable rules and pig reactions, not another set of static screens. Five concepts are candidates to compare, not five queues to launch.

## Ways to test

| Setup | What the tester does | What it can establish | Limit |
| --- | --- | --- | --- |
| Paper rehearsal | Two people play with cards or private clue sheets; a facilitator reveals results | Whether the rules create interesting decisions before code | Does not test UI, animation or networking |
| Solo practice | Choose a game and play against a plainly labeled Practice Pig | Learnability, controls, feedback and length | Cannot establish human rivalry, cooperation or skill depth |
| Developer split view | See Player A and Player B beside each other; step through actions | Debug role changes, state transitions and reveal rules | Seeing both secrets invalidates a genuine gameplay test |
| **Two-device play** | Each person opens their own private player URL on a phone; both share one temporary room | Real hidden choices, thumb controls, partner dependence and waiting | Tests the local prototype transport, not production matchmaking |
| Matchmaking rehearsal | Try a scripted queue/ready/result/leaderboard journey, then a small human test pool | Whether the flow and ranking explanation make sense; later, whether strangers can enter and finish | Sample queues prove no fill rate; a small pool cannot establish launch concurrency or ranking integrity |

Two tabs are useful for one developer. Two people need separate private views for the actual playtest. Hot-seat play with a “hand over / hide my choice” screen is an acceptable early rules check, but it changes simultaneous pacing.

Controlled host/join links are **demo tools**. The proposed released experience still uses random matching. A tester should never need to wait for an unknown population just to try a rule.

## Smallest playable version of each game

| Game | Demo setup | Include | Main question |
| --- | --- | --- | --- |
| **Mud Volley — first** | Two private phones; solo practice for learning | Six alternating toss/catch exchanges, separate lane hands, hidden lock, simultaneous reveal, catches/splats, final W/D/L | Does the rival change my decisions, and does winning feel deserved? |
| **Truffle Trail — second** | Two private phones with different role screens | Three 3×3 boards, private scent clue, pictogram/marker signal, dig feedback, shared basket; swap roles | Can we solve something together without text or voice, and do both jobs matter? |
| Tickle Duet | Solo tutorial, then two people | Six human-authored two-gesture phrases, copy/replay, role swap, giggle/hiccup reactions | Is answering a real person's tickle/boop noticeably better than copying a scripted pig? |
| Picnic Relay | Two private phones | Four ingredients, one pending pass, three two-ingredient dishes, return wrong items, swap jobs | Are handoffs satisfying, or is one person simply following instructions? |
| Pig Pageant | One-person preview first; three humans to validate the experience | One theme, equal six-prop trunk, ready, three runway turns and preset reactions | Does a real audience make the dressing and waiting worthwhile? |

Trail comes before Duet in the **testing order** because it provides a stronger comparison with competition: each person has information or an action the other lacks. Duet remains the smallest alternative if the immediate question is whether live tickling feels warm enough.

Keep two large recognizable pigs, equipped-look silhouettes, one pasture, a catch/splat or giggle reaction and readable thumb controls. Use existing sprite assets and simple animation; full Rive integration can follow after the interaction works. Concept art stays beside the game as a reference, rather than becoming a screenshot with clickable hotspots.

## Mud Volley: compare rules before building its ladder

The current one-use hands are a hypothesis. Each pig uses three toss cards and three catch cards; its third action in each role is forced, and the rival can infer it. That may create an interesting early read, or it may feel like bookkeeping followed by a predetermined finish.

Put these three explicit rules variants behind a **facilitator control**, outside the player UI. Every match shows its variant; changing it resets the match. These are comparisons, not approved changes to the ranked specification.

| Variant | Rule | Reason to compare |
| --- | --- | --- |
| Free lanes | All three lanes are available on every toss/catch | Baseline: does repeated human prediction alone feel like guessing? |
| One-use cards | Each lane can be used once per role over the match | Current concept: does visible spent history improve decisions enough to justify forced final moves? |
| Rest a lane | A lane cannot be used on the next action in the same role; it then returns | Keeps two options after the first action, without forcing the final lane; tests a simpler constraint |

Use identical six-exchange scoring and pig feedback across variants. Start untimed or step-through for explanation, then try the proposed 12-second slots. Separately compare fixed slots with moving on shortly after both lock/reveal; record the pacing setting so rules and waiting are not confused.

For an immediate paper version of the current concept, give each person a toss set and a catch set of Left/Middle/Right cards. Alternate attacker six times. Each secretly selects the relevant card, both reveal together, matching lanes catch and different lanes score an attacking Splat. Leave spent cards visible; most Splats wins. Play several matches, rather than judging the rule after the tutorial.

The practice pig must choose from its own legal hand **before seeing the player's locked lane**. Offer a random policy and a visibly patterned policy. A bot that reacts to a secret choice would make the mechanic look smarter or less fair than it is.

## Truffle Trail: make the clue genuinely cooperative

Do not give the Sniffer an exact location and then ask the Digger to tap a marked answer. For the first rules rehearsal, try a split clue: the Sniffer knows a region such as “north row,” while the Digger sees soil markings and a separate hint such as “under clover.” Neither clue alone identifies the patch; their intersection does. The Sniffer sends a region pictogram and the Digger interprets it against their own ground. Both need information from their role. Give wrong digs public miss/found feedback and a gentle retry. Keep clue quality and the dig allowance fixed within a comparison.

Use this as a **demo rule proposal**, since the initial concept did not define its clue vocabulary. A small facilitator setting can compare an exact-tile marker with the split-clue version. If the Digger feels like a button-presser in the exact-tile version, the split-clue version gives that role an interpretation to make. If that still feels automatic after a few boards, revise the puzzle before adding more boards or art.

First play without talking, using only the intended signals. Then allow conversation for a second run. This separates what the in-game communication supports from what a nearby friend supplies verbally. Reverse roles and use a different board so memory does not solve the second run.

## The proposed browser harness

Locate throwaway sources under `scripts/prototypes/multiplayer-lab/`, following the existing browser prototypes. Add one launcher, **`npm run prototype:multiplayer`**, when it is built; this command does not exist yet.

The launcher should print a desktop URL and a same-Wi-Fi phone URL. A small host screen creates a test room and displays separate A/B links or QR codes. Pageant later adds C. The existing `qrcode` dependency can produce the QR images.

Use plain HTML/CSS/JavaScript plus a Node local HTTP server. A small rules module owns phases and scoring. The local process owns room state, accepts commands and returns each seat's projected snapshot; HTTP commands and a server-sent event stream are enough for these discrete games. Match state disappears on restart. Refresh can recover an existing seat using its demo link while the server remains running.

For Mud, a player snapshot includes their own selection, remaining hands, public spent history and whether the rival has locked. It excludes the rival's current lane until reveal. For Trail, the Digger snapshot excludes the Sniffer's private clue and the hidden truffle. Do not send every secret to both browsers and merely conceal it with CSS. The developer's full-state view lives in a separate facilitator screen.

Include only the controls that answer the question:

- Game and rules variant; new match, swap starting seat and reset.
- Untimed explanation, normal timing and facilitator step-through.
- Fixed board seed for reproduction; a fresh seed for repeat-play tests.
- Facilitator-only last exchange, remaining hands and event timeline.
- Adjustable message delay, temporarily disconnect one seat, reconnect and refresh.
- Copy/download a session report on request. No automatic analytics or player identity needed.

Use stable room/exchange IDs and action sequence numbers so duplicate clicks cannot resolve an exchange twice. A simulated disconnect should pause or end with a clear prototype result; it should not quietly replace the other person with a bot. Full ranked forfeit/security/settlement behavior belongs to the later implementation.

The report needs game/rules/pacing version, seed, accepted choices and remaining hands after reveal, score, action/reveal times, completion and whether each tester chose another match. Feedback notes stay separate. No real account credentials or persistent ratings are required.

## Demo the leaderboard without confusing it with real ranking

Mud's mechanics demo ends with W/D/L and Splats. Add an optional **sample ranking journey**: random-search screen → ready check → match → sample rating change → placements/leaderboard → Find another pig. Keep a visible “Prototype · sample rankings” label on that journey.

For example, two sample pigs at 1000 show +12/−12 after a win and 0/0 after a draw, following the proposed [ranked spec](ranked-matchmaking-spec.md). Seed a few fictional entries and a viewer row to test whether rating, wins and “3 of 5 placements” are understood. The leaderboard is separate from cooperative results and solo practice.

A scripted queue may demonstrate success, cancellation and a long wait with an explicit practice offer. It must not present made-up human availability as real. Once the core match passes a human test, use the same ephemeral server with 4–6 invited testers in a shared random pool to test real ready checks and “Find another pig.” Repeated pairs in that small demo are expected; their sample ratings never touch the live ladder.

## A useful first testing session

Plan about 15–20 minutes per pair for Mud, followed by a separate Trail comparison. Treat timing as a session budget, not a development estimate.

1. Teach with the solo catch/splat tutorial, or one untimed human match. Exclude this from repeat-play observations.
2. Play three human matches using the current one-use rule. Alternate the starting attacker. Ask after each match what changed a choice and whether each person wants another opponent.
3. Try two matches with each alternative lane rule. Rotate variant order across pairs; practice otherwise favors whichever goes last. Keep timing identical during this comparison.
4. Replay the preferred rule at normal pace. Watch for waiting, accidental locks, difficulty finding remaining cards and role confusion. Then try one refresh or brief disconnect.
5. For Trail, play three boards, swap roles, and ask whether each job was consequential. Keep the first run free of voice coaching.

The decisive observations are: independent understanding of the next action; a choice changed because of the other pig; understandable results; little idle waiting; and an unprompted willingness to play again. Record uncertainty rather than declaring a winner from a single pair. Repeated improvement against varied humans is needed before claiming skill depth; successful taps, bot wins or a working Elo formula cannot establish it.

**Next implementation slice:** Mud browser rules + practice + two private human seats + pig feedback + reset/report. Add the Trail slice after that comparison is runnable. Add sample queue/leaderboard flow after the match itself is worth repeating. The production authority, matchmaking, rating ledger and release work remain described in the ranked spec.
