// The Friends list is orderly, and never misordered.
//
// Five rules, one comparator: pins float, names read the way a person reads
// them (case-blind, digits as numbers), a nameless friend sinks, and the two
// tie-breakers below the name mean no two friends can ever swap places between
// renders. The last test is the one that matters most — the same input in three
// different arrival orders must come out identical.

import { compareFriends, sortFriends } from "@/utils/friendOrder";

const NONE: ReadonlySet<string> = new Set();

const friend = (id: string, username: string | null, discriminator?: string) => ({
	id,
	username,
	discriminator,
});

const names = (list: { username: string | null }[]) =>
	list.map((f) => f.username);
const ids = (list: { id: string }[]) => list.map((f) => f.id);

describe("compareFriends", () => {
	test("pinned friends come first, alphabetical within each group", () => {
		const list = [
			friend("1", "zara"),
			friend("2", "alice"),
			friend("3", "mo"),
		];
		expect(names(sortFriends(list, new Set(["1"])))).toEqual([
			"zara",
			"alice",
			"mo",
		]);
		expect(names(sortFriends(list, new Set(["1", "3"])))).toEqual([
			"mo",
			"zara",
			"alice",
		]);
	});

	test("digits compare as numbers, so pig2 comes before pig10", () => {
		const list = [friend("a", "pig10"), friend("b", "pig2"), friend("c", "pig1")];
		expect(names(sortFriends(list, NONE))).toEqual(["pig1", "pig2", "pig10"]);
	});

	test("case does not decide the order — alpha comes before Beta", () => {
		const list = [friend("a", "Beta"), friend("b", "alpha"), friend("c", "Gamma")];
		expect(names(sortFriends(list, NONE))).toEqual(["alpha", "Beta", "Gamma"]);
	});

	test("the name is compared trimmed", () => {
		const list = [friend("a", "  beta"), friend("b", "alpha  ")];
		expect(names(sortFriends(list, NONE))).toEqual(["alpha  ", "  beta"]);
	});

	test("a null or empty username sorts last, inside its own group", () => {
		const list = [
			friend("a", null),
			friend("b", "zara"),
			friend("c", "   "),
			friend("d", "alice"),
		];
		expect(ids(sortFriends(list, NONE))).toEqual(["d", "b", "a", "c"]);
		// A pinned nameless friend is still pinned — it sinks within the pins.
		expect(ids(sortFriends(list, new Set(["a"])))).toEqual(["a", "d", "b", "c"]);
	});

	test("identical names break on the friend code, then on the id", () => {
		const same = [
			friend("id-b", "pig", "0010"),
			friend("id-a", "pig", "0002"),
			friend("id-c", "PIG", "0002"),
		];
		// #0002 before #0010 (numeric), and the two #0002s break on the id.
		expect(ids(sortFriends(same, NONE))).toEqual(["id-a", "id-c", "id-b"]);
		// The comparator is total: no pair of distinct friends ever ties.
		for (const a of same) {
			for (const b of same) {
				if (a.id === b.id) expect(compareFriends(a, b, NONE)).toBe(0);
				else expect(compareFriends(a, b, NONE)).not.toBe(0);
			}
		}
	});

	test("a missing friend code sorts before a present one, deterministically", () => {
		const list = [friend("a", "pig", "0001"), friend("b", "pig")];
		expect(ids(sortFriends(list, NONE))).toEqual(["b", "a"]);
	});

	test("three shuffles of the same friends land in the same order", () => {
		const list = [
			friend("id-5", "pig10", "0001"),
			friend("id-1", "Beta", "0003"),
			friend("id-4", "pig2", "0002"),
			friend("id-2", null),
			friend("id-3", "alpha", "0004"),
			friend("id-6", "beta", "0001"),
		];
		const favorites = new Set(["id-4"]);
		const shuffles = [
			[...list],
			[...list].reverse(),
			[list[3], list[0], list[5], list[2], list[4], list[1]],
		];
		const orders = shuffles.map((s) => ids(sortFriends(s, favorites)));
		expect(orders[0]).toEqual(["id-4", "id-3", "id-6", "id-1", "id-5", "id-2"]);
		expect(orders[1]).toEqual(orders[0]);
		expect(orders[2]).toEqual(orders[0]);
	});

	test("sorting never mutates the caller's array", () => {
		const list = [friend("b", "zara"), friend("a", "alice")];
		const before = ids(list);
		sortFriends(list, NONE);
		expect(ids(list)).toEqual(before);
	});
});
