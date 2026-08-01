// PROTOTYPE — pure in-memory state machine for leaderboard snout theft chains.
// Question: does 1→3→9 escalation with 8-hour response windows and bounded
// targeting stay understandable and fun once balances, timeouts, and caps meet?

const HOUR = 1;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const seedPlayers = () => [
	{ id: "you", name: "You", balance: 40, hidden: false, test: false },
	{ id: "ada", name: "Ada", balance: 15, hidden: false, test: false },
	{ id: "bo", name: "Bo", balance: 100, hidden: false, test: false },
	{ id: "cass", name: "Cass", balance: 500, hidden: false, test: false },
	{ id: "test", name: "Test Pig", balance: 999, hidden: true, test: true },
];

export function initialState() {
	return {
		now: 0,
		players: seedPlayers(),
		chains: [],
		starts: [],
		blockedPairs: [["you", "cass"]],
		nextChain: 1,
		message: "Ready. Start a 1-snout theft and see whether the chain survives.",
	};
}

const pairKey = (a, b) => [a, b].sort().join(":");
const player = (state, id) => state.players.find((entry) => entry.id === id);
const active = (chain) => chain.status === "active";
const recent = (rows, now, hours) => rows.filter((row) => row.at > now - hours);

function clone(state) {
	return structuredClone(state);
}

function reject(state, message) {
	return { ...state, message: `Blocked: ${message}` };
}

function expireDue(state) {
	for (const chain of state.chains) {
		if (active(chain) && state.now >= chain.deadline) {
			chain.status = "missed";
			chain.winner = chain.lastActor;
			chain.loser = chain.nextActor;
			chain.resolution = `${nameOf(state, chain.nextActor)} missed the 8h window`;
		}
	}
}

function nameOf(state, id) {
	return player(state, id)?.name ?? id;
}

export function startTheft(state, attackerId, targetId) {
	const next = clone(state);
	expireDue(next);
	const attacker = player(next, attackerId);
	const target = player(next, targetId);
	if (!attacker || !target) return reject(next, "unknown pig");
	if (attackerId === targetId) return reject(next, "a pig cannot steal from itself");
	if (attacker.hidden || attacker.test || target.hidden || target.test) {
		return reject(next, "hidden and test pigs cannot join a chain");
	}
	if (next.blockedPairs.some(([a, b]) => pairKey(a, b) === pairKey(attackerId, targetId))) {
		return reject(next, "these pigs are blocked");
	}
	if (target.balance < 1) return reject(next, `${target.name} has no snout to steal`);
	if (
		next.chains.some(
			(chain) => active(chain) && pairKey(chain.initiator, chain.firstTarget) === pairKey(attackerId, targetId),
		)
	) {
		return reject(next, "this pair already has an active chain");
	}

	const attackerDay = recent(
		next.starts.filter((row) => row.attacker === attackerId),
		next.now,
		DAY,
	);
	const targets = new Set(attackerDay.map((row) => row.target));
	if (!targets.has(targetId) && targets.size >= 2) {
		return reject(next, `${attacker.name} already targeted 2 unique pigs in 24h`);
	}

	const pairWeek = recent(
		next.starts.filter((row) => row.attacker === attackerId && row.target === targetId),
		next.now,
		WEEK,
	);
	if (pairWeek.length > 0) {
		return reject(next, `${attacker.name} must wait 7 days before targeting ${target.name} again`);
	}

	const targetDay = recent(
		next.starts.filter((row) => row.target === targetId),
		next.now,
		DAY,
	);
	const attackers = new Set(targetDay.map((row) => row.attacker));
	if (!attackers.has(attackerId) && attackers.size >= 3) {
		return reject(next, `${target.name} already faced 3 unique attackers in 24h`);
	}

	target.balance -= 1;
	attacker.balance += 1;
	const id = `H${next.nextChain++}`;
	next.starts.push({ attacker: attackerId, target: targetId, at: next.now });
	next.chains.push({
		id,
		initiator: attackerId,
		firstTarget: targetId,
		lastActor: attackerId,
		nextActor: targetId,
		lastAmount: 1,
		nextAmount: 3,
		deadline: next.now + 8,
		rounds: 1,
		status: "active",
		history: [{ at: next.now, from: targetId, to: attackerId, amount: 1 }],
	});
	next.message = `${attacker.name} stole 1 snout from ${target.name}. ${target.name} has 8h to catch them for 3.`;
	return next;
}

export function catchThief(state, chainId) {
	const next = clone(state);
	expireDue(next);
	const chain = next.chains.find((entry) => entry.id === chainId);
	if (!chain) return reject(next, `unknown chain ${chainId}`);
	if (!active(chain)) return reject(next, `${chainId} already ended: ${chain.resolution}`);

	const catcher = player(next, chain.nextActor);
	const payer = player(next, chain.lastActor);
	const wanted = chain.nextAmount;
	if (payer.balance < wanted) {
		const paid = payer.balance;
		payer.balance = 0;
		catcher.balance += paid;
		chain.history.push({ at: next.now, from: payer.id, to: catcher.id, amount: paid, bust: true });
		chain.status = "busted";
		chain.winner = catcher.id;
		chain.loser = payer.id;
		chain.resolution = `${payer.name} could not cover ${wanted}; ${catcher.name} took their last ${paid}`;
		next.message = `${payer.name} busted. ${catcher.name} took ${paid} remaining snouts and the chain ended.`;
		return next;
	}

	payer.balance -= wanted;
	catcher.balance += wanted;
	chain.history.push({ at: next.now, from: payer.id, to: catcher.id, amount: wanted });
	chain.lastActor = catcher.id;
	chain.nextActor = payer.id;
	chain.lastAmount = wanted;
	chain.nextAmount = wanted * 3;
	chain.deadline = next.now + 8;
	chain.rounds += 1;
	const balanceVerb = payer.id === "you" ? "have" : "has";
	next.message = `${catcher.name} caught ${payer.name} for ${wanted}. ${payer.name} now ${balanceVerb} 8h to answer for ${chain.nextAmount}.`;
	return next;
}

export function waitHours(state, hours) {
	const next = clone(state);
	const amount = Number(hours);
	if (!Number.isFinite(amount) || amount <= 0) return reject(next, "wait must be a positive number of hours");
	next.now += amount;
	const activeBefore = next.chains.filter(active).length;
	expireDue(next);
	const expired = activeBefore - next.chains.filter(active).length;
	next.message = `Advanced ${amount}h.${expired ? ` ${expired} chain${expired === 1 ? "" : "s"} expired.` : ""}`;
	return next;
}

export function setBalance(state, playerId, amount) {
	const next = clone(state);
	const target = player(next, playerId);
	const value = Number(amount);
	if (!target || !Number.isInteger(value) || value < 0) return reject(next, "use: balance <pig> <whole snouts>");
	target.balance = value;
	next.message = `${target.name}'s balance is now ${value}.`;
	return next;
}

export function toggleBlock(state, a, b) {
	const next = clone(state);
	if (!player(next, a) || !player(next, b) || a === b) return reject(next, "use two different known pigs");
	const key = pairKey(a, b);
	const index = next.blockedPairs.findIndex(([x, y]) => pairKey(x, y) === key);
	if (index >= 0) {
		next.blockedPairs.splice(index, 1);
		next.message = `${nameOf(next, a)} and ${nameOf(next, b)} are unblocked.`;
	} else {
		next.blockedPairs.push([a, b]);
		next.message = `${nameOf(next, a)} and ${nameOf(next, b)} are blocked.`;
	}
	return next;
}

export function dispatch(state, input) {
	const [command = "", ...args] = input.trim().toLowerCase().split(/\s+/);
	switch (command) {
		case "steal":
			return startTheft(state, args[0], args[1]);
		case "catch":
			return catchThief(state, args[0]?.toUpperCase());
		case "wait":
			return waitHours(state, args[0]);
		case "balance":
			return setBalance(state, args[0], Number(args[1]));
		case "block":
			return toggleBlock(state, args[0], args[1]);
		case "reset":
			return initialState();
		default:
			return reject(state, "try steal, catch, wait, balance, block, reset, or quit");
	}
}
