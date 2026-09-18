import {
	INITIAL_RETURN,
	advanceReturn,
	canGrant,
	flyKeyframes,
	flyPoint,
	grantFailureLine,
	returnScript,
	type ReturnEvent,
	type ReturnState,
} from "@/utils/rewardReturn";

const run = (events: ReturnEvent[], from: ReturnState = INITIAL_RETURN) =>
	events.reduce((s, e) => advanceReturn(s, e), from);

describe("the reward return — phase machine", () => {
	it("walks the happy path in order: open → arrive → reveal → granting → granted → done", () => {
		let s = advanceReturn(INITIAL_RETURN, { type: "open" });
		expect(s.phase).toBe("arrive");
		s = advanceReturn(s, { type: "arrived" });
		expect(s.phase).toBe("reveal");
		expect(canGrant(s)).toBe(true);
		s = advanceReturn(s, { type: "grant" });
		expect(s.phase).toBe("granting");
		expect(s.attempts).toBe(1);
		expect(canGrant(s)).toBe(false);
		s = advanceReturn(s, { type: "grantOk" });
		expect(s.phase).toBe("granted");
		s = advanceReturn(s, { type: "dismiss" });
		expect(s.phase).toBe("done");
	});

	it("a refused grant lands on failed with the reason, and retry goes again", () => {
		let s = run([{ type: "open" }, { type: "arrived" }, { type: "grant" }]);
		s = advanceReturn(s, { type: "grantFail", reason: "bag_full", retryable: true });
		expect(s.phase).toBe("failed");
		expect(s.failure).toEqual({ reason: "bag_full", retryable: true });
		expect(canGrant(s)).toBe(true);
		s = advanceReturn(s, { type: "retry" });
		expect(s.phase).toBe("granting");
		expect(s.failure).toBeNull();
		expect(s.attempts).toBe(2);
	});

	it("ignores events that don't belong to the phase (a double tap never wedges it)", () => {
		const reveal = run([{ type: "open" }, { type: "arrived" }]);
		expect(advanceReturn(reveal, { type: "arrived" })).toBe(reveal);
		expect(advanceReturn(reveal, { type: "grantOk" })).toBe(reveal);
		const granting = advanceReturn(reveal, { type: "grant" });
		expect(advanceReturn(granting, { type: "grant" })).toBe(granting);
		expect(advanceReturn(granting, { type: "skip" })).toBe(granting);
		expect(advanceReturn(INITIAL_RETURN, { type: "grant" })).toBe(INITIAL_RETURN);
	});

	it("skip leaves from reveal or failed without granting", () => {
		expect(run([{ type: "open" }, { type: "arrived" }, { type: "skip" }]).phase).toBe("done");
		expect(
			run([{ type: "open" }, { type: "arrived" }, { type: "grant" }, { type: "grantFail", reason: "x" }, { type: "skip" }]).phase
		).toBe("done");
	});

	it("open is only honoured from closed, and resets a stale failure", () => {
		const failed = run([{ type: "open" }, { type: "arrived" }, { type: "grant" }, { type: "grantFail", reason: "x" }]);
		expect(advanceReturn(failed, { type: "open" })).toBe(failed);
		const reopened = advanceReturn({ ...failed, phase: "closed" }, { type: "open" });
		expect(reopened).toEqual({ ...INITIAL_RETURN, phase: "arrive" });
	});
});

describe("the reward return — script", () => {
	it("cuts the walk and the flight under Reduce Motion but keeps the beats that are pauses", () => {
		const cut = returnScript({ reduceMotion: true });
		expect(cut.cuts).toBe(true);
		expect(cut.walkMs).toBe(0);
		expect(cut.flyMs).toBe(0);
		expect(cut.celebrateMs).toBeGreaterThan(0);
		expect(cut.grantedHoldMs).toBeGreaterThan(0);
		const full = returnScript({ reduceMotion: false });
		expect(full.cuts).toBe(false);
		expect(full.walkMs).toBeGreaterThan(full.flyMs);
	});
});

describe("the reward return — flight", () => {
	it("hops: starts at from, ends at to, and lifts in the middle", () => {
		const from = { x: 100, y: 500 };
		const to = { x: 340, y: 90 };
		expect(flyPoint(from, to, 0)).toEqual(from);
		expect(flyPoint(from, to, 1)).toEqual(to);
		const mid = flyPoint(from, to, 0.5, -48);
		expect(mid.x).toBe(220);
		expect(mid.y).toBe(295 - 48);
		expect(flyPoint(from, to, 2)).toEqual(to); // clamped
	});

	it("keyframes are relative to the origin so translateX/Y can interpolate them", () => {
		const kf = flyKeyframes({ x: 10, y: 20 }, { x: 110, y: 20 }, -40);
		expect(kf.input).toEqual([0, 0.25, 0.5, 0.75, 1]);
		expect(kf.x[0]).toBe(0);
		expect(kf.x[4]).toBe(100);
		expect(kf.y[2]).toBe(-40);
		expect(kf.y[4]).toBe(0);
	});
});

describe("the reward return — copy", () => {
	it("names the refusals it knows and stays warm on the ones it doesn't", () => {
		expect(grantFailureLine("bag_full")).toMatch(/Satchel is full/);
		expect(grantFailureLine("wish_moved")).toMatch(/beat him to it/);
		expect(grantFailureLine("network")).toMatch(/reach the Barn/);
		expect(grantFailureLine("something_new")).toMatch(/Give it another go/);
	});
});
