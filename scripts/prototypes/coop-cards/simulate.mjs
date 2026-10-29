import { CARDS, INTENTS, createGame, discardForCleanup, finishCleanup, passTurn, playCard, resolveEnemy, resolvePendingChoice } from "./game.mjs";
const base = ["big_wind_up",
    "toy_sword",
    "snoot_boop",
    "root_around",
    "lantern_signal",
    "warm_tea",
    "bog_frog",
    "duck_into_the_mud"];
function pending(s) {
    while (s.pendingChoice) {
        const p = s.pendingChoice.pig;
        const uid = s.pendingChoice.type === "discard" ? s.players[p].hand[0]?.uid : null;
        s = resolvePendingChoice(s, { discardUid: uid });
    }
    return s;
}
function neededGuard(s) {
    const intent = INTENTS[s.round - 1];
    return intent.damages.reduce((sum, d) => sum + d, 0);
}
function order(s, pig, policy) {
    if (policy === "attack-first")
        return base;
    if (policy === "guard-first")
        return ["duck_into_the_mud", "bog_frog", ...base];
    const danger = Math.max(0, neededGuard(s) - s.guard);
    const low = Math.min(s.players.rosie.cheer, s.players.pepper.cheer);
    const cards = [];
    if (danger >= 3)
        cards.push("duck_into_the_mud");
    if (danger >= 5)
        cards.push("bog_frog");
    if (low <= 9)
        cards.push("warm_tea", "snoot_boop");
    cards.push("big_wind_up", "toy_sword", "root_around", "lantern_signal");
    return [...new Set(cards)];
}
function run(seed, policy) {
    let s = createGame(seed);
    while (s.status === "active") {
        while (s.status === "active" && s.phase === "playerTurn") {
            const pig = s.activeSeat;
            let played = false;
            for (const id of order(s, pig, policy)) {
                const c = s.players[pig].hand.find(x => x.cardId === id);
                if (!c || CARDS[id].energy > s.players[pig].energy)
                    continue;
                if ((id === "warm_tea" || id === "snoot_boop") && s.players.rosie.cheer === 12 && s.players.pepper.cheer === 12 && policy === "conditional-team")
                    continue;
                try {
                    s = playCard(s, {
                        pig,
                        uid: c.uid,
                        healTarget: s.players.rosie.cheer <= s.players.pepper.cheer ? "rosie" : "pepper"
                    });
                    s = pending(s);
                    played = true;
                    break;
                }
                catch { }
            }
            if (!played && s.status === "active")
                s = passTurn(s, pig);
        }
        if (s.status !== "active")
            break;
        const intent = INTENTS[s.round - 1];
        let guard = s.guard;
        const allocations = intent.damages.map(d => {
            const n = Math.min(d, guard);
            guard -= n;
            return n;
        });
        const args = { allocations };
        if (intent.target === "lower" && s.players.rosie.cheer === s.players.pepper.cheer)
            args.tieTarget = s.lead;
        if (intent.target === "chosen")
            args.chosenTarget = s.players.rosie.cheer >= s.players.pepper.cheer ? "rosie" : "pepper";
        s = resolveEnemy(s, args);
        if (s.status !== "active")
            break;
        for (const pig of ["rosie", "pepper"])
            while (s.players[pig].hand.length > 4)
                s = discardForCleanup(s, pig, s.players[pig].hand[0].uid);
        s = finishCleanup(s);
    }
    return s;
}
const runs = Number(process.argv[2] ?? 500);
for (const policy of ["attack-first", "guard-first", "conditional-team"]) {
    const results = Array.from({ length: runs }, (_, i) => run(i + 1, policy));
    const wins = results.filter(x => x.status === "won");
    console.log(JSON.stringify({
        policy: `${policy} (synthetic, not human balance evidence)`,
        seeds: runs,
        wins: wins.length,
        winRate: wins.length / runs,
        averageWinningRound: wins.length ? wins.reduce((a, x) => a + x.round, 0) / wins.length : null
    }, null, 2));
}
