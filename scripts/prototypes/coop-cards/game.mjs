export const PROGRESS_TARGET = 20;
export const MAX_CHEER = 12;
export const FINAL_ROUND = 6;
export const CARDS = {
    toy_sword: {
        id: "toy_sword",
        name: "Toy Sword",
        kind: "attack",
        energy: 1
    },
    big_wind_up: {
        id: "big_wind_up",
        name: "Big Wind-Up",
        kind: "attack",
        energy: 2
    },
    snoot_boop: {
        id: "snoot_boop",
        name: "Snoot Boop",
        kind: "attack-support",
        energy: 3
    },
    duck_into_the_mud: {
        id: "duck_into_the_mud",
        name: "Duck Into the Mud",
        kind: "guard",
        energy: 1
    },
    bog_frog: {
        id: "bog_frog",
        name: "Bog Frog",
        kind: "guard-critter",
        energy: 2
    },
    warm_tea: {
        id: "warm_tea",
        name: "Warm Tea",
        kind: "support",
        energy: 2
    },
    root_around: {
        id: "root_around",
        name: "Root Around",
        kind: "support",
        energy: 1
    },
    lantern_signal: {
        id: "lantern_signal",
        name: "Lantern Signal",
        kind: "support",
        energy: 1
    },
};
export const STARTERS = {
    rosie: ["toy_sword",
        "toy_sword",
        "big_wind_up",
        "big_wind_up",
        "duck_into_the_mud",
        "duck_into_the_mud",
        "root_around",
        "root_around",
        "lantern_signal",
        "lantern_signal",
        "warm_tea",
        "snoot_boop"],
    pepper: ["toy_sword",
        "toy_sword",
        "duck_into_the_mud",
        "duck_into_the_mud",
        "duck_into_the_mud",
        "bog_frog",
        "bog_frog",
        "warm_tea",
        "warm_tea",
        "lantern_signal",
        "root_around",
        "snoot_boop"]
};
export const INTENTS = [{
        name: "Reaching Claw",
        damages: [5],
        target: "lower"
    },
    {
        name: "Bottomless Gulp",
        damages: [3, 3],
        target: "both"
    },
    {
        name: "Belly Flop",
        damages: [7],
        target: "chosen"
    },
    {
        name: "Reaching Claw",
        damages: [6],
        target: "lower"
    },
    {
        name: "Bottomless Gulp",
        damages: [4, 4],
        target: "both"
    },
    {
        name: "Final Gulp",
        damages: [5, 5],
        target: "both"
    }];
const other = p => p === "rosie" ? "pepper" : "rosie";
function randomFor(seed) {
    let v = seed >>> 0;
    return () => ((v = (Math.imul(v, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function shuffled(xs, seed) {
    const a = [...xs];
    const r = randomFor(seed);
    for (let i = a.length - 1; i; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function makeDeck(pig, seed) {
    return shuffled(STARTERS[pig].map((cardId, i) => ({
        uid: `${pig}-${i}`,
        cardId
    })), seed);
}
function drawOne(s, pig) {
    const p = s.players[pig];
    if (!p.deck.length && p.discard.length) {
        p.shuffleCount++;
        p.deck = shuffled(p.discard.splice(0), s.seed + p.shuffleCount * 1009 + (pig === "pepper" ? 97 : 0));
    }
    const c = p.deck.shift();
    if (c)
        p.hand.push(c);
    return c ?? null;
}
function draw(s, pig, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const c = drawOne(s, pig);
        if (!c)
            break;
        out.push(c);
    }
    return out;
}
function removeHand(s, pig, uid) {
    const p = s.players[pig];
    const i = p.hand.findIndex(c => c.uid === uid);
    if (i < 0)
        throw new Error("Choose a card currently in hand");
    return p.hand.splice(i, 1)[0];
}
function discardHand(s, pig, uid) {
    s.players[pig].discard.push(removeHand(s, pig, uid));
}
function active(s) {
    if (s.status !== "active")
        throw new Error("The encounter is already over");
    if (s.pendingChoice)
        throw new Error("Resolve the pending card choice first");
}
function prepareRound(s) {
    s.phase = "playerTurn";
    s.activeSeat = s.lead;
    s.passed = [];
    s.guard = 0;
    s.guardAdded = {
        rosie: 0,
        pepper: 0
    };
    for (const pig of ["rosie", "pepper"]) {
        const p = s.players[pig];
        p.energy = 3;
        p.pepperGuardUsed = false;
        p.rosieSupportUsed = false;
        draw(s, pig, Math.max(0, 4 - p.hand.length));
    }
}
export function createGame(seed = 1) {
    const s = {
        seed,
        status: "active",
        reason: null,
        round: 1,
        lead: "rosie",
        phase: "playerTurn",
        activeSeat: "rosie",
        passed: [],
        pendingChoice: null,
        progress: 0,
        guard: 0,
        guardAdded: {
            rosie: 0,
            pepper: 0
        },
        players: {
            rosie: {
                cheer: 12,
                energy: 0,
                deck: makeDeck("rosie", seed),
                hand: [],
                discard: [],
                shuffleCount: 0,
                rosieSupportUsed: false,
                pepperGuardUsed: false
            },
            pepper: {
                cheer: 12,
                energy: 0,
                deck: makeDeck("pepper", seed + 97),
                hand: [],
                discard: [],
                shuffleCount: 0,
                rosieSupportUsed: false,
                pepperGuardUsed: false
            }
        }
    };
    prepareRound(s);
    return s;
}
function queueRosie(s, actor) {
    const p = s.players.rosie;
    if (actor === "rosie" && !p.rosieSupportUsed) {
        p.rosieSupportUsed = true;
        draw(s, "rosie", 1);
        if (p.hand.length)
            s.pendingChoice = {
                type: "discard",
                pig: "rosie",
                reason: "rosie_support",
                after: null
            };
    }
}
function afterEffect(s, after) {
    if (after === "rosie_support")
        queueRosie(s, "rosie");
}
export function playCard(source, { pig, uid, healTarget } = {}) {
    active(source);
    if (source.phase !== "playerTurn")
        throw new Error("Cards can only be played during player turns");
    if (source.activeSeat !== pig)
        throw new Error("It is not that pig's turn");
    const s = structuredClone(source);
    const p = s.players[pig];
    const instance = p.hand.find(c => c.uid === uid);
    const card = instance && CARDS[instance.cardId];
    if (!card)
        throw new Error("Card is not in that pig's hand");
    if (p.energy < card.energy)
        throw new Error("Not enough Energy");
    if (["snoot_boop", "warm_tea"].includes(card.id) && !["rosie", "pepper"].includes(healTarget))
        throw new Error("A valid heal target is required");
    p.energy -= card.energy;
    p.discard.push(removeHand(s, pig, uid));
    if (card.id === "toy_sword")
        s.progress += 2 + (s.guardAdded[other(pig)] > 0 ? 1 : 0);
    if (card.id === "big_wind_up")
        s.progress += 4;
    if (card.id === "snoot_boop") {
        s.progress += 3;
        s.players[healTarget].cheer = Math.min(12, s.players[healTarget].cheer + 2);
    }
    if (card.id === "duck_into_the_mud" || card.id === "bog_frog") {
        let amount = card.id === "duck_into_the_mud" ? 3 : 5;
        if (pig === "pepper" && !p.pepperGuardUsed) {
            amount++;
            p.pepperGuardUsed = true;
        }
        s.guard += amount;
        s.guardAdded[pig] += amount;
    }
    if (card.id === "warm_tea")
        s.players[healTarget].cheer = Math.min(12, s.players[healTarget].cheer + 3);
    s.progress = Math.min(20, s.progress);
    if (s.progress === 20) {
        s.status = "won";
        s.reason = "The Great Hungerer was stopped";
        return s;
    }
    const after = pig === "rosie" && card.kind.includes("support") && !p.rosieSupportUsed ? "rosie_support" : null;
    if (card.id === "root_around") {
        draw(s, pig, 2);
        if (p.hand.length)
            s.pendingChoice = {
                type: "discard",
                pig,
                reason: "root_around",
                after
            };
        else
            afterEffect(s, after);
    }
    else if (card.id === "lantern_signal") {
        const ally = other(pig);
        draw(s, ally, 1);
        s.pendingChoice = {
            type: "optional_cycle",
            pig: ally,
            reason: "lantern_signal",
            after
        };
    }
    else
        afterEffect(s, after);
    return s;
}
export function resolvePendingChoice(source, { discardUid = null } = {}) {
    if (source.status !== "active" || !source.pendingChoice)
        throw new Error("There is no pending choice");
    const s = structuredClone(source);
    const c = s.pendingChoice;
    s.pendingChoice = null;
    if (c.type === "discard") {
        if (!discardUid)
            throw new Error("This effect requires a discard");
        discardHand(s, c.pig, discardUid);
    }
    else if (c.type === "optional_cycle") {
        if (discardUid) {
            discardHand(s, c.pig, discardUid);
            draw(s, c.pig, 1);
        }
    }
    else
        throw new Error("Unknown pending choice");
    afterEffect(s, c.after);
    return s;
}
export function passTurn(source, pig) {
    active(source);
    if (source.phase !== "playerTurn" || source.activeSeat !== pig)
        throw new Error("Only the active pig may pass");
    const s = structuredClone(source);
    s.passed.push(pig);
    if (s.passed.length === 2) {
        s.phase = "enemy";
        s.activeSeat = null;
    }
    else
        s.activeSeat = other(pig);
    return s;
}
function targetsFor(s, tieTarget, chosenTarget) {
    const intent = INTENTS[s.round - 1];
    if (intent.target === "both")
        return ["rosie", "pepper"];
    if (intent.target === "chosen") {
        if (!["rosie", "pepper"].includes(chosenTarget))
            throw new Error("Belly Flop requires a valid chosen target");
        return [chosenTarget];
    }
    const r = s.players.rosie.cheer;
    const p = s.players.pepper.cheer;
    if (r === p) {
        if (!["rosie", "pepper"].includes(tieTarget))
            throw new Error("The round leader must choose the tied lower-Cheer target");
        return [tieTarget];
    }
    return [r < p ? "rosie" : "pepper"];
}
export function resolveEnemy(source, { allocations, tieTarget, chosenTarget } = {}) {
    active(source);
    if (source.phase !== "enemy")
        throw new Error("The enemy acts only after both pigs pass");
    const s = structuredClone(source);
    const intent = INTENTS[s.round - 1];
    const targets = targetsFor(s, tieTarget, chosenTarget);
    if (!Array.isArray(allocations) || allocations.length !== intent.damages.length)
        throw new Error("Supply one Guard allocation per damage packet");
    if (allocations.some((n, i) => !Number.isInteger(n) || n < 0 || n > intent.damages[i]))
        throw new Error("Invalid Guard allocation");
    if (allocations.reduce((a, b) => a + b, 0) > s.guard)
        throw new Error("Guard allocation exceeds the shared pool");
    const cheer = {
        rosie: s.players.rosie.cheer,
        pepper: s.players.pepper.cheer
    };
    intent.damages.forEach((d, i) => cheer[targets[i] ?? targets[0]] -= d - allocations[i]);
    for (const pig of ["rosie", "pepper"])
        s.players[pig].cheer = Math.max(0, cheer[pig]);
    s.guard = 0;
    if (!s.players.rosie.cheer || !s.players.pepper.cheer) {
        s.status = "lost";
        s.reason = "A Legend ran out of Cheer";
    }
    else if (s.round === 6) {
        s.status = "lost";
        s.reason = "The encounter clock expired";
    }
    else {
        s.phase = "cleanup";
        s.activeSeat = null;
    }
    return s;
}
export function discardForCleanup(source, pig, uid) {
    active(source);
    if (source.phase !== "cleanup")
        throw new Error("Cleanup discards happen only during cleanup");
    if (source.players[pig].hand.length <= 4)
        throw new Error("That hand is already at the limit");
    const s = structuredClone(source);
    discardHand(s, pig, uid);
    return s;
}
export function finishCleanup(source) {
    active(source);
    if (source.phase !== "cleanup")
        throw new Error("It is not cleanup");
    if (["rosie", "pepper"].some(p => source.players[p].hand.length > 4))
        throw new Error("Both hands must be reduced to four");
    const s = structuredClone(source);
    s.round++;
    s.lead = s.round % 2 ? "rosie" : "pepper";
    prepareRound(s);
    return s;
}
export function cardCount(s, pig) {
    const p = s.players[pig];
    return p.deck.length + p.hand.length + p.discard.length;
}
