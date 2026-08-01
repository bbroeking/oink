// Sim-kernel tests for Expedition v0 (Rosie's Ramble). Pure kernel — no React,
// no clock; every function takes nowMs from the caller. Mirrors the discipline
// of digSession.test.ts / rooting.test.ts (determinism, source-scan guard).

import * as fs from "fs";
import * as path from "path";

import {
	initialState,
	settle,
	drawHand,
	tuckCard,
	equipGear,
	tuckTraining,
	tickle,
	playCard,
	statTotals,
	predictFight,
	nextObstacle,
	cardAffectsFight,
	devWarp,
	GEAR,
	CARDS,
	ENEMIES,
	AWAY_CAP_H,
	ZOOMIES_MAX,
	START_TICKLES,
	TICKLE_REGEN_MS,
	type ExpeditionState,
} from "../utils/expedition";

const HOUR = 3_600_000;
const T0 = 1_750_000_000_000; // a fixed epoch so every fixture is deterministic

// Warp the pig back `hours` so a following settle() sees that much elapsed.
function withElapsed(s: ExpeditionState, hours: number): ExpeditionState {
	return devWarp(s, hours);
}

// Tickle repeatedly (charging Zoomies to burst) up to `n` times.
function tickleN(s: ExpeditionState, n: number): { state: ExpeditionState; bursts: number } {
	let state = s;
	let bursts = 0;
	for (let i = 0; i < n; i++) {
		const r = tickle(state);
		state = r.state;
		if (r.burst) bursts += 1;
	}
	return { state, bursts };
}

// Tickle only until the current wall falls (never over-draining the bank).
function clearWall(s: ExpeditionState): ExpeditionState {
	let state = s;
	let guard = 0;
	while (state.wallEnemyId && state.mockTickles > 0 && guard < 60) {
		state = tickle(state).state;
		guard += 1;
	}
	return state;
}

describe("initialState", () => {
	test("starters equipped + owned, deck has the three starter Tricks", () => {
		const s = initialState(T0);
		expect(s.loadout.head).toBe("saucepan_lid");
		expect(s.loadout.held).toBe("wooden_spoon");
		expect(s.gearOwned).toEqual(["saucepan_lid", "wooden_spoon"]);
		expect(Object.keys(s.deck).sort()).toEqual(
			["nose_for_shinies", "press_on", "study_the_wall"].sort()
		);
		expect(s.mockTickles).toBe(20);
		expect(s.segment).toBe(0);
		for (const id of Object.keys(s.bestiary)) expect(s.bestiary[id]).toBe("unseen");
	});
});

describe("determinism — same seed + same actions replay identically", () => {
	test("settle twice on the same state+now → deep-equal state and report", () => {
		const base = withElapsed(initialState(T0), 8);
		const a = settle(base, T0);
		const b = settle(base, T0);
		expect(a.state).toEqual(b.state);
		expect(a.report).toEqual(b.report);
	});

	test("a full replayed run (equip → settle → settle) is byte-identical", () => {
		function run(): ReturnType<typeof settle> {
			let s = equipGear(initialState(T0), "wooden_spoon");
			s = withElapsed(s, 8);
			const first = settle(s, T0);
			const second = settle(withElapsed(first.state, 8), T0);
			return second;
		}
		expect(run().state).toEqual(run().state);
		expect(run().report).toEqual(run().report);
	});
});

describe("away cap", () => {
	test("20h elapsed settles as 8h (cappedH === 8)", () => {
		const s = withElapsed(initialState(T0), 20);
		const { report } = settle(s, T0);
		expect(report).not.toBeNull();
		expect(report!.elapsedH).toBe(20);
		expect(report!.cappedH).toBe(AWAY_CAP_H);
	});

	test("under an hour walks nowhere (no report)", () => {
		const s = withElapsed(initialState(T0), 0.5);
		const { report, state } = settle(s, T0);
		expect(report).toBeNull();
		expect(state.segment).toBe(0);
	});
});

describe("cushion gating at the Bramble (segment 8)", () => {
	// Reach the Bramble by defeating the two road walls first, then walking on.
	function pastBothWalls(cushionGear: string | null): ExpeditionState {
		let s = initialState(T0);
		s = { ...s, mockTickles: 200 }; // a generous bank so clearing never starves
		// Give her enough bonk to clear the walls quickly.
		s = equipGear(s, "wooden_spoon");
		// Walk to the Gate Snail (segment 3).
		s = settle(withElapsed(s, 8), T0).state;
		expect(s.wallEnemyId).toBe("gate_snail");
		s = clearWall(s); // clear it
		expect(s.bestiary.gate_snail).toBe("defeated");
		// Walk to the Puddle Toad (segment 6).
		s = settle(withElapsed(s, 8), T0).state;
		expect(s.wallEnemyId).toBe("puddle_toad");
		s = clearWall(s); // clear it (opening hit + hp 5)
		expect(s.bestiary.puddle_toad).toBe("defeated");
		if (cushionGear) {
			s = { ...s, gearOwned: [...s.gearOwned, cushionGear] };
			s = equipGear(s, cushionGear);
		}
		return s;
	}

	test("stops at the Bramble edge with cushion 2 (lid only)", () => {
		let s = pastBothWalls(null); // lid = cushion 2
		expect(statTotals(s).cushion).toBe(2);
		s = settle(withElapsed(s, 8), T0).state;
		expect(s.segment).toBe(7); // waited at the edge of 8
		expect(s.bestiary.the_bramble).toBe("unseen");
	});

	test("passes the Bramble with the Quilted Vest (cushion 3+)", () => {
		let s = pastBothWalls("quilted_vest");
		expect(statTotals(s).cushion).toBeGreaterThanOrEqual(3);
		s = settle(withElapsed(s, 8), T0).state;
		expect(s.segment).toBeGreaterThanOrEqual(8);
		expect(s.bestiary.the_bramble).not.toBe("unseen"); // page lit on pass
	});
});

describe("fight math", () => {
	// Walk to the goose by clearing everything ahead of it, then stand at hp 9.
	function atGoose(): ExpeditionState {
		let s = initialState(T0);
		s = { ...s, mockTickles: 200, gearOwned: [...s.gearOwned, "quilted_vest"] };
		s = equipGear(s, "quilted_vest"); // pass the Bramble
		let guard = 0;
		while (s.wallEnemyId !== "tollbooth_goose" && guard < 10) {
			s = settle(withElapsed(s, 8), T0).state;
			if (s.wallEnemyId && s.wallEnemyId !== "tollbooth_goose") {
				s = clearWall(s); // clear the road walls
			}
			guard += 1;
		}
		expect(s.wallEnemyId).toBe("tollbooth_goose");
		expect(s.wallHp).toBe(ENEMIES.tollbooth_goose.hp);
		return s;
	}

	test("goose opening hit costs a tickle unless a lid/warm-tea blocks it", () => {
		// Lid is equipped by default → opening blocked → 5 tickles reach the first
		// burst. With no head gear, the opening eats one → 6 tickles.
		const blocked = atGoose();
		expect(blocked.openingHitPending).toBe(false); // lid blocked at wall-start
		const r5 = tickleN(blocked, 5);
		expect(r5.bursts).toBe(1);

		// Remove the lid: re-derive a goose stand with no head gear.
		let bare = atGoose();
		bare = { ...bare, loadout: { ...bare.loadout, head: null } };
		// Re-arm the opening pending flag as settle would with no block.
		bare = { ...bare, openingHitPending: true, zoomies: 0 };
		const five = tickleN(bare, 5);
		expect(five.bursts).toBe(0); // opening ate the first tickle
		const six = tickleN(bare, 6);
		expect(six.bursts).toBe(1);
	});

	test("spoon burst = 1 (base) + 2 (spoon) + 2 (on_zoomies) = 5", () => {
		const s = atGoose(); // lid + spoon + vest equipped
		expect(statTotals(s).bonk).toBe(3); // base 1 + spoon 2
		const r = tickleN(s, 5); // reach the first burst (lid blocked opening)
		expect(r.bursts).toBe(1);
		// Goose hp 9 − 5 = 4 remaining.
		expect(r.state.wallHp).toBe(4);
	});

	test("double_first_swing (Rolled Newspaper) fires exactly once", () => {
		let s = atGoose();
		s = { ...s, gearOwned: [...s.gearOwned, "rolled_newspaper"] };
		s = equipGear(s, "rolled_newspaper"); // held: newspaper (bonk 1, double first)
		// base 1 + newspaper 1 = bonk 2. First burst doubles → 4; next burst → 2.
		expect(statTotals(s).bonk).toBe(2);
		const first = tickleN(s, 5);
		expect(first.bursts).toBe(1);
		expect(first.state.wallHp).toBe(9 - 4); // first swing bonked twice
		const second = tickleN(first.state, 5);
		expect(second.state.wallHp).toBe(9 - 4 - 2); // second swing normal
	});
});

describe("send-off Zoomies carry into the first wall (P0)", () => {
	// Walk a fresh pig to the Gate Snail (segment 3, hp 3, no opening hit) so the
	// only variable is how charged she arrived.
	function walkToSnail(s: ExpeditionState): ExpeditionState {
		const arrived = settle(withElapsed(s, 8), T0).state;
		expect(arrived.wallEnemyId).toBe("gate_snail");
		return arrived;
	}

	test("Zoomies charged before the walk survive settle() (no arrival zero-out)", () => {
		let s = { ...initialState(T0), mockTickles: 200 };
		// Send-off tickles away from a wall just charge Zoomies (no burst).
		const charged = tickleN(s, 3);
		expect(charged.bursts).toBe(0);
		expect(charged.state.zoomies).toBe(3);
		const atWall = walkToSnail(charged.state);
		expect(atWall.zoomies).toBe(3); // carried through the walk, not reset
	});

	test("pre-charge reduces the taps needed at the wall", () => {
		const bank = 200;
		// Fresh (uncharged) pig: needs the full 5 taps to reach the first burst.
		const fresh = walkToSnail({ ...initialState(T0), mockTickles: bank });
		expect(fresh.zoomies).toBe(0);
		expect(tickleN(fresh, 4).bursts).toBe(0);
		expect(tickleN(fresh, 5).bursts).toBe(1);

		// Pre-charged with 3 send-off tickles: only 2 taps left to burst.
		const primed = walkToSnail(
			tickleN({ ...initialState(T0), mockTickles: bank }, 3).state
		);
		expect(primed.zoomies).toBe(3);
		const r = tickleN(primed, 2);
		expect(r.bursts).toBe(1);
		expect(r.state.bestiary.gate_snail).toBe("defeated"); // the head start won it
	});
});

describe("predictFight — the empty jar names itself (P1)", () => {
	test("a winning loadout with a dry jar blames the jar, never the gear", () => {
		// Default spoon+lid would clear the Gate Snail with a full bank — empty it.
		const s: ExpeditionState = { ...initialState(T0), mockTickles: 0 };
		const p = predictFight(s);
		expect(p.verdict).toBe("stuck");
		expect(p.why).toMatch(/jar is empty/i);
		expect(p.why).not.toMatch(/Spoon|Lid|Vest/i); // never blames a worn piece
	});

	test("a jar with enough for a burst still grades on gear, not emptiness", () => {
		// 5 tickles = exactly one burst → the honest gear-vs-hp verdict returns.
		const s: ExpeditionState = { ...initialState(T0), mockTickles: 5 };
		const p = predictFight(s);
		expect(p.why).not.toMatch(/jar is empty/i);
	});
});

describe("nextObstacle — the shared road scan", () => {
	test("fresh pig's first obstacle is the Gate Snail wall", () => {
		const o = nextObstacle(initialState(T0));
		expect(o?.kind).toBe("wall");
		if (o?.kind === "wall") {
			expect(o.enemyId).toBe("gate_snail");
			expect(o.hp).toBe(ENEMIES.gate_snail.hp);
		}
	});

	test("cardAffectsFight: fight-trigger cards yes, walking-only cards no", () => {
		expect(cardAffectsFight(CARDS.study_the_wall)).toBe(true); // on_wall_start
		expect(cardAffectsFight(CARDS.braveheart_oink)).toBe(true); // on_swing
		expect(cardAffectsFight(CARDS.press_on)).toBe(false); // on_segment_enter
		expect(cardAffectsFight(CARDS.nose_for_shinies)).toBe(false); // on_find
	});

	test("playCard refuses a walking-only card (no silent spend)", () => {
		let s = tuckCard(initialState(T0), "press_on"); // speed_up, on_segment_enter
		s = { ...s, wallEnemyId: "gate_snail", wallHp: 3 };
		const out = playCard(s);
		expect(out.result).toBeNull();
		expect(out.state.cardPlayedThisFight).toBe(false); // the tap was not eaten
	});
});

describe("cards — daily hand", () => {
	test("hand is stable per dateKey and holds only owned cards", () => {
		const s = initialState(T0);
		const h1 = drawHand(s, "2026-07-28");
		const h2 = drawHand(s, "2026-07-28");
		expect(h1).toEqual(h2);
		const owned = new Set(Object.keys(s.deck));
		for (const id of h1) expect(owned.has(id)).toBe(true);
		expect(drawHand(s, "2026-07-29")).toBeDefined();
	});

	test("no dupes in hand unless the owned count covers it", () => {
		// Three starters at count 1 → the three-card hand is exactly them, no dupe.
		const s = initialState(T0);
		const hand = drawHand(s, "seed-key");
		expect(new Set(hand).size).toBe(hand.length);
		// Give one card count 2 → a dupe becomes representable in some hands.
		const dup: ExpeditionState = { ...s, deck: { ...s.deck, press_on: 5 } };
		const found = [
			"a", "b", "c", "d", "e", "f",
		].some((k) => {
			const h = drawHand(dup, k);
			return h.filter((c) => c === "press_on").length >= 2;
		});
		expect(found).toBe(true);
	});
});

describe("training — dupe-only, capped, reflected in totals", () => {
	test("a dupe tuck grants a permanent +1 and consumes one copy", () => {
		let s = initialState(T0);
		s = { ...s, deck: { ...s.deck, press_on: 3 } };
		const before = statTotals(s).bonk;
		s = tuckTraining(s, "press_on", "bonk");
		expect(statTotals(s).bonk).toBe(before + 1);
		expect(s.deck.press_on).toBe(2);
		expect(s.training).toHaveLength(1);
	});

	test("cannot tuck the last copy (dupe-only)", () => {
		let s = initialState(T0); // press_on count 1
		const out = tuckTraining(s, "press_on", "cushion");
		expect(out).toBe(s); // no-op, same reference
		expect(out.training).toHaveLength(0);
	});

	test("capped at 5 tucks", () => {
		let s = initialState(T0);
		s = { ...s, deck: { ...s.deck, press_on: 20 } };
		for (let i = 0; i < 8; i++) s = tuckTraining(s, "press_on", "sparkle");
		expect(s.training).toHaveLength(5);
		expect(statTotals(s).sparkle).toBe(5);
	});
});

describe("drop table", () => {
	test("gear drops prefer unowned pieces; every find carries a name", () => {
		// A long walk with a fresh pig → some gear should drop, and it must be a
		// piece she didn't already own.
		let sawGear = false;
		for (let trip = 0; trip < 40; trip++) {
			const s: ExpeditionState = {
				...initialState(T0 + trip * HOUR),
				tripIndex: trip,
			};
			const walked = withElapsed(s, 8);
			const { report } = settle(walked, T0 + trip * HOUR);
			if (!report) continue;
			for (const f of report.finds) {
				expect(typeof f.name).toBe("string");
				expect(f.name.length).toBeGreaterThan(0);
				if (f.kind === "gear") {
					sawGear = true;
					// The dropped piece is a real catalog gear the starter didn't own.
					expect(GEAR[f.id]).toBeDefined();
					expect(["saucepan_lid", "wooden_spoon"]).not.toContain(f.id);
				}
			}
		}
		expect(sawGear).toBe(true);
	});
});

describe("predictFight — the ±20% floor", () => {
	test("never 'wins' when the loadout genuinely can't clear the wall", () => {
		// Strip her to base bonk and drain the tickle bank → she cannot win.
		let s = initialState(T0);
		s = { ...s, loadout: { head: null, body: null, held: null, charm: null } };
		s = { ...s, mockTickles: 5 }; // one burst of base bonk 1 vs the snail hp 3
		const p = predictFight(s);
		expect(p.verdict).not.toBe("wins");
		expect(p.verdict).toBe("stuck");
		expect(typeof p.why).toBe("string");
	});

	test("a spoon-armed pig with a full bank wins the snail", () => {
		const s = initialState(T0); // spoon + lid, 20 tickles
		const p = predictFight(s);
		expect(p.verdict).toBe("wins");
	});

	test("verdict names a warm reason in words", () => {
		const p = predictFight(initialState(T0));
		expect(p.why.length).toBeGreaterThan(0);
	});
});

describe("tuckCard / equipGear routing", () => {
	test("equipGear routes to the piece's slot and requires ownership", () => {
		let s = initialState(T0);
		// Not owned → no-op.
		expect(equipGear(s, "quilted_vest")).toBe(s);
		s = { ...s, gearOwned: [...s.gearOwned, "quilted_vest"] };
		s = equipGear(s, "quilted_vest");
		expect(s.loadout.body).toBe("quilted_vest");
	});

	test("tuckCard only tucks an owned card", () => {
		let s = initialState(T0);
		expect(tuckCard(s, "warm_tea")).toBe(s); // not owned
		s = tuckCard(s, "press_on");
		expect(s.tuckedCardId).toBe("press_on");
	});

	test("playCard is once per fight", () => {
		let s = initialState(T0);
		s = tuckCard(s, "study_the_wall");
		s = { ...s, wallEnemyId: "gate_snail", wallHp: 3 };
		const first = playCard(s);
		expect(first.result).not.toBeNull();
		expect(first.state.cardPlayedThisFight).toBe(true);
		const second = playCard(first.state);
		expect(second.result).toBeNull();
	});
});

describe("chapter clear", () => {
	test("defeating the goose at segment 12 sets chapterCleared", () => {
		let s = initialState(T0);
		s = { ...s, mockTickles: 500, gearOwned: [...s.gearOwned, "quilted_vest"] };
		s = equipGear(s, "quilted_vest");
		let guard = 0;
		while (!s.chapterCleared && guard < 20) {
			const settled = settle(withElapsed(s, 8), T0);
			s = settled.state;
			if (s.wallEnemyId) s = clearWall(s);
			guard += 1;
		}
		expect(s.chapterCleared).toBe(true);
		expect(s.bestiary.tollbooth_goose).toBe("defeated");
	});
});

const MIN = 60_000;

describe("mock tickle regen (Fix 3)", () => {
	test("+1 tickle per 10 real minutes from a below-cap jar, sub-interval carried", () => {
		const s: ExpeditionState = {
			...initialState(T0),
			mockTickles: 0,
			tickleRegenRemainderMs: 0,
		};
		// 25 minutes elapsed → 2 whole tickles, 5 minutes carried over.
		const { state } = settle(devWarp(s, 25 / 60), T0);
		expect(state.mockTickles).toBe(2);
		expect(state.tickleRegenRemainderMs).toBe(5 * MIN);
		expect(TICKLE_REGEN_MS).toBe(10 * MIN);
	});

	test("caps at START_TICKLES and never reduces an over-cap bank", () => {
		// From 19, an 8h absence mints only the single tickle that reaches the cap.
		const near: ExpeditionState = { ...initialState(T0), mockTickles: 19 };
		expect(settle(devWarp(near, 8), T0).state.mockTickles).toBe(START_TICKLES);
		// A test rig above the cap is left untouched (regen is skipped, never clamps down).
		const big: ExpeditionState = { ...initialState(T0), mockTickles: 200 };
		expect(settle(devWarp(big, 8), T0).state.mockTickles).toBe(200);
	});

	test("sub-interval remainder carries across settles (no time is lost)", () => {
		let s: ExpeditionState = {
			...initialState(T0),
			mockTickles: 0,
			tickleRegenRemainderMs: 0,
		};
		// 15 min → 1 tickle + 5 min carried.
		s = settle(devWarp(s, 15 / 60), T0).state;
		expect(s.mockTickles).toBe(1);
		expect(s.tickleRegenRemainderMs).toBe(5 * MIN);
		// Another 5 min meets the carried 5 → a whole tickle, remainder back to 0.
		s = settle(devWarp(s, 5 / 60), T0).state;
		expect(s.mockTickles).toBe(2);
		expect(s.tickleRegenRemainderMs).toBe(0);
	});

	test("deterministic — same state + now regens byte-identically", () => {
		const s: ExpeditionState = {
			...initialState(T0),
			mockTickles: 3,
			tickleRegenRemainderMs: 123_456,
		};
		const warped = devWarp(s, 1);
		const a = settle(warped, T0);
		const b = settle(warped, T0);
		expect(a.state.mockTickles).toBe(b.state.mockTickles);
		expect(a.state.tickleRegenRemainderMs).toBe(b.state.tickleRegenRemainderMs);
	});

	test("the jar refills even while she waits at a wall", () => {
		const s: ExpeditionState = {
			...initialState(T0),
			wallEnemyId: "gate_snail",
			wallHp: 3,
			mockTickles: 0,
		};
		const { state, report } = settle(devWarp(s, 1), T0); // waits, no report
		expect(report).toBeNull();
		expect(state.mockTickles).toBe(6); // 60 min / 10
	});
});

describe("tickle refusal — the CTA never lies (Fix 1)", () => {
	test("full charge on the open road refuses the spend (no decrement)", () => {
		const s: ExpeditionState = {
			...initialState(T0),
			zoomies: ZOOMIES_MAX,
			mockTickles: 5,
		};
		const r = tickle(s);
		expect(r.refusal).toBe("full_open_road");
		expect(r.burst).toBeNull();
		expect(r.state).toBe(s); // untouched — the jar is not spent
		expect(r.state.mockTickles).toBe(5);
	});

	test("an empty jar refuses with the empty signal", () => {
		const s: ExpeditionState = { ...initialState(T0), mockTickles: 0 };
		const r = tickle(s);
		expect(r.refusal).toBe("empty");
		expect(r.state).toBe(s);
	});

	test("a quiet journal tickle at a wall caps at ZOOMIES_MAX-1 and never bursts", () => {
		let s: ExpeditionState = {
			...initialState(T0),
			wallEnemyId: "gate_snail",
			wallHp: 3,
			mockTickles: 20,
			zoomies: 0,
			openingHitPending: false,
		};
		let bursts = 0;
		for (let i = 0; i < 10; i++) {
			const r = tickle(s, { quiet: true });
			if (r.burst) bursts += 1;
			s = r.state;
		}
		expect(bursts).toBe(0);
		expect(s.zoomies).toBe(ZOOMIES_MAX - 1); // charged to the cap, no further
		const capped = tickle(s, { quiet: true });
		expect(capped.refusal).toBe("full_at_wall_quiet");
		expect(capped.state).toBe(s);
	});

	test("the same wall bursts normally from the fight view (non-quiet)", () => {
		const s: ExpeditionState = {
			...initialState(T0),
			wallEnemyId: "gate_snail",
			wallHp: 3,
			mockTickles: 20,
			zoomies: ZOOMIES_MAX - 1,
			openingHitPending: false,
		};
		const r = tickle(s);
		expect(r.burst).not.toBeNull();
		expect(r.burst!.defeated).toBe(true); // hp 3 vs the spoon burst
	});
});

describe("keepable flinch advice (Fix 2)", () => {
	const goosePeck: ExpeditionState = {
		...initialState(T0),
		wallEnemyId: "tollbooth_goose",
		wallHp: 9,
		mockTickles: 20,
		zoomies: 0,
		openingHitPending: true,
		loadout: { head: null, body: null, held: "wooden_spoon", charm: null },
	};

	test("equipping a lid at a pending peck negates it — the tickle charges, not eaten", () => {
		const s = equipGear(goosePeck, "saucepan_lid"); // owned by default
		const r = tickle(s);
		expect(r.state.openingHitPending).toBe(false); // re-checked and negated
		expect(r.state.zoomies).toBe(1); // charged instead of being eaten
		expect(r.state.mockTickles).toBe(19);
	});

	test("an unblocked pending peck still eats the first tickle", () => {
		const r = tickle(goosePeck);
		expect(r.state.openingHitPending).toBe(false);
		expect(r.state.zoomies).toBe(0); // eaten, no charge
	});

	test("playCard refuses a block card whose block is already satisfied", () => {
		let s: ExpeditionState = {
			...initialState(T0),
			deck: { ...initialState(T0).deck, warm_tea: 1 },
		};
		s = tuckCard(s, "warm_tea");
		// Lid equipped (blocks) at a no-opening wall → Warm Tea is a no-op.
		s = { ...s, wallEnemyId: "gate_snail", wallHp: 3, openingHitPending: false };
		const out = playCard(s);
		expect(out.result).toBeNull();
		expect(out.state.cardPlayedThisFight).toBe(false); // the play was not burned
	});

	test("playCard allows a block card when a peck is pending", () => {
		let s: ExpeditionState = {
			...initialState(T0),
			deck: { ...initialState(T0).deck, warm_tea: 1 },
			loadout: { head: null, body: null, held: "wooden_spoon", charm: null },
		};
		s = tuckCard(s, "warm_tea");
		s = { ...s, wallEnemyId: "tollbooth_goose", wallHp: 9, openingHitPending: true };
		const out = playCard(s);
		expect(out.result).not.toBeNull(); // Warm Tea can block the pending peck
		expect(out.state.cardPlayedThisFight).toBe(true);
	});
});

describe("tuck lifecycle — survives arrival, comes home on a completed walk (Fix 4)", () => {
	// A stand just before the Bramble with both road walls cleared; lid = cushion 2.
	function atBrambleEdge(): ExpeditionState {
		return {
			...initialState(T0),
			segment: 7,
			bestiary: {
				...initialState(T0).bestiary,
				gate_snail: "defeated",
				puddle_toad: "defeated",
			},
			deck: { ...initialState(T0).deck, mud_mask: 1 },
		};
	}

	// A bare-headed stand before the Bramble (Vest passes the gate, so a live peck
	// reaches the Goose), one droppable card in the deck to tuck on the open road.
	function beforeBrambleBareHead(cardId: string): ExpeditionState {
		return {
			...initialState(T0),
			segment: 7,
			loadout: { head: null, body: "quilted_vest", held: "wooden_spoon", charm: null },
			bestiary: {
				...initialState(T0).bestiary,
				gate_snail: "defeated",
				puddle_toad: "defeated",
			},
			deck: { ...initialState(T0).deck, [cardId]: 1 },
		};
	}

	test("a morning-tucked Warm Tea blocks the peck it walks into (advice keepable)", () => {
		// The keepability guarantee: Warm Tea tucked on the open road rides into the
		// Goose fight and its block passive negates the opening peck at arrival.
		const s = tuckCard(beforeBrambleBareHead("warm_tea"), "warm_tea");
		const { state: arrived, report } = settle(devWarp(s, 8), T0);
		expect(arrived.wallEnemyId).toBe("tollbooth_goose");
		expect(arrived.tuckedCardId).toBe("warm_tea"); // survives into the fight
		expect(arrived.openingHitPending).toBe(false); // its trip passive blocked the peck
		expect(report!.gearMoments).toContain(
			"Warm Tea steadies her against the opening hit."
		);
		expect(report!.tuckedHome).toBeNull(); // still tucked, not home → no postcard line
	});

	test("a fight-only card survives arrival at a wall and is playable in that fight", () => {
		// Braveheart Oink has no trip passive, so it survives the walk unspent and the
		// peck stays live — it must be PLAYED in the fight, which survival makes possible.
		const s = tuckCard(beforeBrambleBareHead("braveheart_oink"), "braveheart_oink");
		const { state: arrived, report } = settle(devWarp(s, 8), T0);
		expect(arrived.wallEnemyId).toBe("tollbooth_goose");
		expect(arrived.tuckedCardId).toBe("braveheart_oink"); // survived the walk in
		expect(arrived.openingHitPending).toBe(true); // not a blocker → peck stays live
		expect(report!.tuckedHome).toBeNull(); // did not come home — no postcard line
		const played = playCard(arrived);
		expect(played.result).not.toBeNull(); // playable in THIS fight
		expect(played.state.cardPlayedThisFight).toBe(true);
	});

	test("the tuck comes home only when a trip completes on the open road (after victory)", () => {
		// Parked at the Gate Snail with Warm Tea tucked; clear it, then walk a short
		// wall-free stretch → the trip completes in the open and the card comes home.
		let s: ExpeditionState = {
			...initialState(T0),
			segment: 3,
			wallEnemyId: "gate_snail",
			wallHp: 3,
			openingHitPending: false,
			mockTickles: 200,
			deck: { ...initialState(T0).deck, warm_tea: 1 },
		};
		s = tuckCard(s, "warm_tea");
		s = clearWall(s); // defeat the snail — a tickle loop, not a settle, so no untuck
		expect(s.wallEnemyId).toBeNull();
		expect(s.tuckedCardId).toBe("warm_tea"); // still tucked at the cleared wall
		// Next wall (Puddle Toad) is at seg 6; a 2h walk ends at seg 5, open road.
		const { state, report } = settle(devWarp(s, 2), T0);
		expect(state.wallEnemyId).toBeNull(); // completed in the open
		expect(state.tuckedCardId).toBeNull(); // came home
		expect(report!.tuckedHome).toBe("Warm Tea");
	});

	test("the tucked passive shapes the trip it rode (Mud Mask carries her past the Bramble)", () => {
		const base = atBrambleEdge();
		const withMask = tuckCard(base, "mud_mask");
		const rMask = settle(devWarp(withMask, 8), T0);
		expect(rMask.state.segment).toBeGreaterThanOrEqual(8); // cushion 3 → past the gate

		// Control: same stand, nothing tucked → stuck at the Bramble edge (cushion 2).
		const rBare = settle(devWarp(base, 8), T0);
		expect(rBare.state.segment).toBe(7);
	});

	test("no double-application: the passive is spent once the trip completes", () => {
		let s = tuckCard(atBrambleEdge(), "mud_mask");
		// A 2h walk clears the Bramble into the open (seg 9) → the trip completes.
		s = settle(devWarp(s, 2), T0).state;
		expect(s.tuckedCardId).toBeNull(); // completed open → came home
		expect(s.segment).toBeGreaterThanOrEqual(8);
		// Rewind to the Bramble edge WITHOUT re-tucking — the mask's cushion is gone.
		const rewound: ExpeditionState = { ...s, segment: 7, wallEnemyId: null, wallHp: null };
		expect(settle(devWarp(rewound, 2), T0).state.segment).toBe(7); // stuck again
	});

	test("play-then-untuck doesn't double-apply or crash", () => {
		let s: ExpeditionState = {
			...initialState(T0),
			segment: 3,
			wallEnemyId: "gate_snail",
			wallHp: 3,
			openingHitPending: false,
			deck: { ...initialState(T0).deck, study_the_wall: 1 },
			mockTickles: 200,
		};
		s = tuckCard(s, "study_the_wall"); // a fight card
		const played = playCard(s);
		expect(played.result).not.toBeNull();
		s = played.state;
		expect(s.cardPlayedThisFight).toBe(true);
		s = clearWall(s); // burst clears the wall
		expect(s.wallEnemyId).toBeNull();
		// A 2h walk completes in the open (seg 5) → the already-played card comes
		// home, no double-apply, no crash.
		const { state } = settle(devWarp(s, 2), T0);
		expect(state.wallEnemyId).toBeNull();
		expect(state.tuckedCardId).toBeNull();
		expect(state.cardPlayedThisFight).toBe(false);
	});
});

describe("purity guard — no Date.now() in utils/expedition.ts", () => {
	test("the kernel never reads the clock itself (callers pass nowMs)", () => {
		const src = fs.readFileSync(
			path.join(process.cwd(), "utils/expedition.ts"),
			"utf8"
		);
		expect(src).not.toMatch(/Date\.now\s*\(/);
		expect(src).not.toMatch(/new Date\s*\(/);
		// No react-native / AsyncStorage imports either.
		expect(src).not.toMatch(/from ["']react-native["']/);
		expect(src).not.toMatch(/async-storage/);
	});
});
