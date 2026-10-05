// The hub's watch for the table a search finds (components/play/useTableFound)
// and the claims other screens put on tables they open themselves
// (components/play/tableClaims): a fresh table opens once; one that was
// already there, one another screen claimed, or one found after the player
// stopped looking does not.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { RoomSummary } from "@/multiplayer/protocol";
import { claimTable, isTableClaimed, resetTableClaimsForTests } from "@/components/play/tableClaims";
import { useTableFound, type TableFound } from "@/components/play/useTableFound";

function summary(roomId: string, over: Partial<RoomSummary> = {}): RoomSummary {
	return { roomId, game: "rootle", pace: "live", phase: "starting", yourTurn: false, opponents: [], deadline: null, updatedAt: 0, ...over };
}

let handle: TableFound | null = null;
function Probe({ games, searching, onFound }: { games: RoomSummary[]; searching: boolean; onFound: (id: string) => void }) {
	const found = useTableFound(games, searching, onFound);
	React.useEffect(() => {
		handle = found;
	});
	return null;
}

function mount(onFound: jest.Mock) {
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(<Probe games={[]} searching={false} onFound={onFound} />);
	});
	const set = (games: RoomSummary[], searching: boolean) =>
		act(() => {
			r.update(<Probe games={games} searching={searching} onFound={onFound} />);
		});
	return { r, set };
}

describe("useTableFound", () => {
	beforeEach(() => {
		resetTableClaimsForTests();
		handle = null;
	});

	it("opens the first fresh table a search finds, once", () => {
		const onFound = jest.fn();
		const { set } = mount(onFound);
		act(() => handle?.arm());
		set([], true);
		set([summary("a1")], false);
		set([summary("a1")], false);
		expect(onFound).toHaveBeenCalledTimes(1);
		expect(onFound).toHaveBeenCalledWith("a1");
	});

	it("leaves alone a table that was already there", () => {
		const onFound = jest.fn();
		const { set } = mount(onFound);
		set([summary("old")], false);
		act(() => handle?.arm());
		set([summary("old")], true);
		set([summary("old")], false);
		expect(onFound).not.toHaveBeenCalled();
	});

	it("leaves a claimed table to the screen that claimed it", () => {
		const onFound = jest.fn();
		const { set } = mount(onFound);
		act(() => handle?.arm());
		set([], true);
		claimTable("invited");
		expect(isTableClaimed("invited")).toBe(true);
		set([summary("invited", { phase: "lobby" })], false);
		expect(onFound).not.toHaveBeenCalled();
		// A real match found in the same window still opens.
		set([summary("invited", { phase: "lobby" }), summary("matched")], false);
		expect(onFound).toHaveBeenCalledWith("matched");
	});

	it("stops watching when the player stops looking", () => {
		const onFound = jest.fn();
		const { set } = mount(onFound);
		act(() => handle?.arm());
		set([], true);
		act(() => handle?.disarm());
		set([summary("late")], false);
		expect(onFound).not.toHaveBeenCalled();
	});

	it("a claim lapses on its own", () => {
		const now = 1_000_000;
		claimTable("t1", now);
		expect(isTableClaimed("t1", now + 1)).toBe(true);
		expect(isTableClaimed("t1", now + 60_000)).toBe(false);
		claimTable(null, now);
		expect(isTableClaimed("null", now)).toBe(false);
	});
});
