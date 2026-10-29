import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, cardCount, createGame, discardForCleanup, finishCleanup, passTurn, playCard, resolveEnemy, resolvePendingChoice } from "./game.mjs";
const find = (s, p, id) => s.players[p].hand.find(c => c.cardId === id)?.uid;
function force(s, p, ids) {
    const n = structuredClone(s);
    const x = n.players[p];
    const all = [...x.hand, ...x.deck, ...x.discard];
    x.hand = ids.map(id => all.splice(all.findIndex(c => c.cardId === id), 1)[0]);
    x.deck = all;
    x.discard = [];
    return n;
}
const toEnemy = s => {
    let n = passTurn(s, s.activeSeat);
    return passTurn(n, n.activeSeat);
};
test("deterministic setup conserves twelve cards", () => {
    const a = createGame(4);
    assert.deepEqual(a, createGame(4));
    assert.equal(cardCount(a, "rosie"), 12);
    assert.equal(cardCount(a, "pepper"), 12);
});
test("turns, passes, and phases gate commands without mutation", () => {
    let s = force(createGame(1), "pepper", ["toy_sword"]);
    let before = structuredClone(s);
    assert.throws(() => playCard(s, {
        pig: "pepper",
        uid: find(s, "pepper", "toy_sword")
    }));
    assert.throws(() => resolveEnemy(s, {
        allocations: [0],
        tieTarget: "rosie"
    }));
    assert.throws(() => discardForCleanup(s, "rosie", s.players.rosie.hand[0].uid));
    assert.deepEqual(s, before);
    s = passTurn(s, "rosie");
    assert.equal(s.activeSeat, "pepper");
    s = passTurn(s, "pepper");
    assert.equal(s.phase, "enemy");
});
test("draw choices expose drawn hand and block other commands", () => {
    let s = force(createGame(2), "rosie", ["root_around", "toy_sword"]);
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "root_around")
    });
    assert.equal(s.pendingChoice.reason, "root_around");
    assert.ok(s.players.rosie.hand.length >= 3);
    assert.throws(() => passTurn(s, "rosie"));
    const drawn = s.players.rosie.hand.at(-1).uid;
    s = resolvePendingChoice(s, { discardUid: drawn });
    assert.equal(s.pendingChoice.reason, "rosie_support");
    s = resolvePendingChoice(s, { discardUid: s.players.rosie.hand[0].uid });
    assert.equal(s.pendingChoice, null);
});
test("Lantern optional cycle may skip then chains Rosie trigger", () => {
    let s = force(createGame(3), "rosie", ["lantern_signal", "toy_sword"]);
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "lantern_signal")
    });
    assert.equal(s.pendingChoice.type, "optional_cycle");
    s = resolvePendingChoice(s, {});
    assert.equal(s.pendingChoice.reason, "rosie_support");
    s = resolvePendingChoice(s, { discardUid: s.players.rosie.hand[0].uid });
    assert.equal(s.pendingChoice, null);
});
test("Pepper bonus once, Toy Sword only rewards ally Guard, reset next round", () => {
    let s = passTurn(force(createGame(5), "pepper", ["duck_into_the_mud", "duck_into_the_mud"]), "rosie");
    s = playCard(s, {
        pig: "pepper",
        uid: find(s, "pepper", "duck_into_the_mud")
    });
    s = playCard(s, {
        pig: "pepper",
        uid: find(s, "pepper", "duck_into_the_mud")
    });
    assert.equal(s.guard, 7);
    s = passTurn(s, "pepper");
    s = resolveEnemy(s, {
        allocations: [5],
        tieTarget: "rosie"
    });
    s = finishCleanup(s);
    assert.equal(s.players.pepper.pepperGuardUsed, false);
    assert.equal(s.guardAdded.pepper, 0);
});
test("Toy Sword ally condition and Energy validation", () => {
    let s = force(createGame(6), "rosie", ["toy_sword", "toy_sword", "big_wind_up"]);
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "toy_sword")
    });
    assert.equal(s.progress, 2);
    s.guardAdded.pepper = 3;
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "toy_sword")
    });
    assert.equal(s.progress, 5);
    const before = structuredClone(s);
    assert.throws(() => playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "big_wind_up")
    }));
    assert.deepEqual(s, before);
});
test("Guard splits across simultaneous packets", () => {
    let s = createGame(7);
    s.round = 2;
    s.guard = 4;
    s = toEnemy(s);
    s = resolveEnemy(s, { allocations: [3, 1] });
    assert.equal(s.players.rosie.cheer, 12);
    assert.equal(s.players.pepper.cheer, 10);
    assert.equal(s.phase, "cleanup");
});
test("lower-Cheer tie requires explicit leader choice", () => {
    let s = toEnemy(createGame(8));
    let before = structuredClone(s);
    assert.throws(() => resolveEnemy(s, { allocations: [0] }));
    assert.deepEqual(s, before);
    s = resolveEnemy(s, {
        allocations: [0],
        tieTarget: "pepper"
    });
    assert.equal(s.players.pepper.cheer, 7);
});
test("immediate win prevents enemy resolution", () => {
    let s = force(createGame(9), "rosie", ["big_wind_up"]);
    s.progress = 16;
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "big_wind_up")
    });
    assert.equal(s.status, "won");
    assert.throws(() => passTurn(s, "rosie"));
});
test("simultaneous defeat, no resurrection, and round-six clock", () => {
    let s = createGame(10);
    s.round = 2;
    s.players.rosie.cheer = 3;
    s.players.pepper.cheer = 2;
    s = toEnemy(s);
    s = resolveEnemy(s, { allocations: [0, 0] });
    assert.equal(s.status, "lost");
    assert.equal(s.players.rosie.cheer, 0);
    assert.equal(s.players.pepper.cheer, 0);
    assert.throws(() => finishCleanup(s));
    let t = createGame(11);
    t.round = 6;
    t.guard = 10;
    t = toEnemy(t);
    t = resolveEnemy(t, { allocations: [5, 5] });
    assert.match(t.reason, /clock/);
});
test("cleanup only discards excess and partial draw is legal", () => {
    let s = createGame(12);
    s = toEnemy(s);
    s = resolveEnemy(s, {
        allocations: [0],
        tieTarget: "rosie"
    });
    assert.throws(() => discardForCleanup(s, "rosie", s.players.rosie.hand[0].uid));
    s.players.rosie.hand.push(s.players.rosie.deck.shift());
    assert.throws(() => finishCleanup(s));
    s = discardForCleanup(s, "rosie", s.players.rosie.hand[0].uid);
    s.players.pepper.deck = [];
    s.players.pepper.discard = [];
    s.players.pepper.hand = s.players.pepper.hand.slice(0, 3);
    s = finishCleanup(s);
    assert.equal(s.players.pepper.hand.length, 3);
});
test("round-two cooperation replay resolves through public commands", () => {
    let s = createGame(30);
    s.round = 2;
    s.lead = "pepper";
    s.activeSeat = "pepper";
    s = force(s, "pepper", ["duck_into_the_mud"]);
    s = force(s, "rosie", ["toy_sword", "big_wind_up"]);
    s = playCard(s, {
        pig: "pepper",
        uid: find(s, "pepper", "duck_into_the_mud")
    });
    assert.equal(s.guard, 4);
    s = passTurn(s, "pepper");
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "toy_sword")
    });
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "big_wind_up")
    });
    assert.equal(s.progress, 7);
    s = passTurn(s, "rosie");
    s = resolveEnemy(s, { allocations: [3, 1] });
    assert.equal(s.players.rosie.cheer, 12);
    assert.equal(s.players.pepper.cheer, 10);
});
test("winning Snoot Boop cuts off Rosie's post-card trigger", () => {
    let s = force(createGame(31), "rosie", ["snoot_boop", "toy_sword"]);
    s.progress = 17;
    const before = cardCount(s, "rosie");
    s = playCard(s, {
        pig: "rosie",
        uid: find(s, "rosie", "snoot_boop"),
        healTarget: "rosie"
    });
    assert.equal(s.status, "won");
    assert.equal(s.pendingChoice, null);
    assert.equal(cardCount(s, "rosie"), before);
    assert.equal(s.players.rosie.rosieSupportUsed, false);
});
test("seeded whole game preserves every card UID and resource bounds", () => {
    let s = createGame(8675309);
    const expected = new Set([...Array(12)].flatMap((_, i) => [`rosie-${i}`, `pepper-${i}`]));
    const audit = () => {
        const cards = ["rosie", "pepper"].flatMap(p => [...s.players[p].deck, ...s.players[p].hand, ...s.players[p].discard]);
        const ids = cards.map(c => c.uid);
        assert.equal(ids.length, 24);
        assert.equal(new Set(ids).size, 24);
        assert.deepEqual(new Set(ids), expected);
        assert.ok(s.progress >= 0 && s.progress <= 20);
        assert.ok(s.guard >= 0);
        for (const p of ["rosie", "pepper"]) {
            assert.ok(s.players[p].energy >= 0 && s.players[p].energy <= 3);
            assert.ok(s.players[p].cheer >= 0 && s.players[p].cheer <= 12);
        }
    };
    audit();
    while (s.status === "active") {
        while (s.status === "active" && s.phase === "playerTurn") {
            const pig = s.activeSeat;
            const play = s.players[pig].hand.find(c => CARDS[c.cardId].energy <= s.players[pig].energy);
            if (!play) {
                s = passTurn(s, pig);
                audit();
                continue;
            }
            s = playCard(s, {
                pig,
                uid: play.uid,
                healTarget: "rosie"
            });
            audit();
            while (s.pendingChoice) {
                const choice = s.pendingChoice;
                const discardUid = choice.type === "discard" ? s.players[choice.pig].hand[0]?.uid : null;
                s = resolvePendingChoice(s, { discardUid });
                audit();
            }
        }
        if (s.status !== "active")
            break;
        const damages = [5,
            [3, 3],
            [7],
            [6],
            [4, 4],
            [5, 5]][s.round - 1];
        const packets = Array.isArray(damages) ? damages : [damages];
        let guard = s.guard;
        const allocations = packets.map(d => {
            const n = Math.min(d, guard);
            guard -= n;
            return n;
        });
        s = resolveEnemy(s, {
            allocations,
            tieTarget: s.lead,
            chosenTarget: "rosie"
        });
        audit();
        if (s.status !== "active")
            break;
        for (const pig of ["rosie", "pepper"])
            while (s.players[pig].hand.length > 4) {
                s = discardForCleanup(s, pig, s.players[pig].hand[0].uid);
                audit();
            }
        s = finishCleanup(s);
        audit();
    }
    assert.notEqual(s.status, "active");
});
