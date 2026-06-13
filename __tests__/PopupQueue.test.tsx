// PopupQueue state-machine tests. The queue must SERIALIZE every native-modal
// presentation: a slot's visible may only flip true after the previously
// presented modal was hidden AND the full POPUP_HANDOFF_GAP_MS drain elapsed —
// including PREEMPTION (higher-priority want arriving while a lower-priority
// modal is presented), which used to swap visibles in the same commit and
// trigger the iOS invisible-modal wedge (facebook/react-native#50152).
//
// Scenarios mirror the boot-wedge audit: release handoff, drain-then-admit
// preemption, mid-gap arrivals waiting, achievements advance, want flicker
// without deadlock, same-tick priority ties, and the truffleSheet(5) vs
// releaseNotes(45) round trip.

import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
	PopupQueueProvider,
	usePopupSlot,
	POPUP_HANDOFF_GAP_MS,
	POPUP_TEARDOWN_MS,
} from "../components/ui/PopupQueue";

type SlotSpec = { want: boolean; priority: number };
type Slots = Record<string, SlotSpec>;
type SlotHandle = { visible: boolean; release: () => void };

// Latest {visible, release} per slot id, written during Probe render. Probes
// re-render on every ctx/want change, so these never go stale.
const reg: Record<string, SlotHandle> = {};

function Probe({
	id,
	want,
	priority,
}: {
	id: string;
	want: boolean;
	priority: number;
}) {
	const slot = usePopupSlot(id, want, priority);
	reg[id] = slot;
	return null;
}

let setSlots: React.Dispatch<React.SetStateAction<Slots>> = () => {};

function Harness({ initial }: { initial: Slots }) {
	const [slots, set] = useState(initial);
	setSlots = set;
	return (
		<PopupQueueProvider>
			{Object.entries(slots).map(([id, s]) => (
				<Probe key={id} id={id} want={s.want} priority={s.priority} />
			))}
		</PopupQueueProvider>
	);
}

let renderer: TestRenderer.ReactTestRenderer | null = null;

function mount(initial: Slots) {
	act(() => {
		renderer = TestRenderer.create(<Harness initial={initial} />);
	});
}

function setWant(id: string, want: boolean) {
	act(() => {
		setSlots((s) => ({ ...s, [id]: { ...s[id], want } }));
	});
}

// Flip several wants inside ONE commit (same-tick multi-arrival).
function setWants(wants: Record<string, boolean>) {
	act(() => {
		setSlots((s) => {
			const next = { ...s };
			for (const [id, want] of Object.entries(wants)) {
				next[id] = { ...next[id], want };
			}
			return next;
		});
	});
}

function advance(ms: number) {
	act(() => {
		jest.advanceTimersByTime(ms);
	});
}

function release(id: string) {
	act(() => {
		reg[id].release();
	});
}

function visibleIds(): string[] {
	return Object.keys(reg).filter((id) => reg[id].visible);
}

function expectOnlyVisible(id: string | null) {
	expect(visibleIds()).toEqual(id === null ? [] : [id]);
}

// The standard consumer dismiss: release() hides now, the backing state (the
// want) clears a POPUP_TEARDOWN_MS beat later, the gap finishes after that.
function dismissTwoPhase(id: string) {
	release(id);
	expectOnlyVisible(null); // hidden immediately, nothing admitted yet
	advance(POPUP_TEARDOWN_MS);
	setWant(id, false);
	advance(POPUP_HANDOFF_GAP_MS - POPUP_TEARDOWN_MS);
}

beforeEach(() => {
	jest.useFakeTimers();
	for (const k of Object.keys(reg)) delete reg[k];
});

afterEach(() => {
	if (renderer) {
		act(() => {
			renderer!.unmount();
		});
		renderer = null;
	}
	jest.useRealTimers();
});

test("timing contract: teardown beat is shorter than the handoff gap", () => {
	// Load-bearing: dismiss handlers clear their want at the beat, which must
	// land BEFORE the gap re-admits, or a released slot re-presents itself.
	expect(POPUP_TEARDOWN_MS).toBeLessThan(POPUP_HANDOFF_GAP_MS);
});

test("release handoff: next waiter admitted only after the full gap", () => {
	mount({
		releaseNotes: { want: true, priority: 45 },
		luckyTitle: { want: true, priority: 50 },
	});
	expectOnlyVisible("releaseNotes");

	release("releaseNotes");
	expectOnlyVisible(null); // draining — hidden, nothing admitted

	advance(POPUP_TEARDOWN_MS);
	setWant("releaseNotes", false); // two-phase state clear at the beat
	advance(POPUP_HANDOFF_GAP_MS - POPUP_TEARDOWN_MS - 1);
	expectOnlyVisible(null); // 1ms before gap end: still quiet

	advance(1);
	expectOnlyVisible("luckyTitle");
});

test("preemption while presented drains before admitting — never a same-commit swap", () => {
	mount({
		releaseNotes: { want: true, priority: 45 },
		schism: { want: false, priority: 10 },
	});
	expectOnlyVisible("releaseNotes");

	// Higher-priority want arrives while releaseNotes is presented. The old
	// queue flipped releaseNotes false and schism true in the same commit —
	// the invisible-modal wedge. Now: hide, hold the gap, then admit.
	setWant("schism", true);
	expectOnlyVisible(null);

	advance(POPUP_HANDOFF_GAP_MS - 1);
	expectOnlyVisible(null);
	advance(1);
	expectOnlyVisible("schism");
});

test("preemptor arriving during a release drain waits for gap end", () => {
	mount({
		releaseNotes: { want: true, priority: 45 },
		schism: { want: false, priority: 10 },
	});
	release("releaseNotes");
	advance(200);
	setWant("schism", true); // lands mid-drain
	expectOnlyVisible(null);

	advance(300); // t=500: consumer beat clears the released want
	setWant("releaseNotes", false);
	advance(POPUP_HANDOFF_GAP_MS - 500 - 1);
	expectOnlyVisible(null); // t=699: still quiet
	advance(1);
	expectOnlyVisible("schism"); // t=700: admitted, exactly one drain later
});

test("admission re-picks the priority winner from mid-drain arrivals", () => {
	mount({
		releaseNotes: { want: true, priority: 45 },
		schism: { want: false, priority: 10 },
		finale: { want: false, priority: 20 },
	});
	release("releaseNotes");
	advance(100);
	setWant("finale", true);
	advance(100);
	setWant("schism", true);
	advance(POPUP_TEARDOWN_MS - 200);
	setWant("releaseNotes", false);
	advance(POPUP_HANDOFF_GAP_MS - POPUP_TEARDOWN_MS);
	expectOnlyVisible("schism"); // 10 beats 20 regardless of arrival order
});

test("achievements advance: release with want still true re-presents after the gap", () => {
	// The achievements slot keeps want=true while more unlocks remain; each
	// release() must hide, hold the gap, then show the SAME slot again.
	mount({ achievements: { want: true, priority: 40 } });
	expectOnlyVisible("achievements");

	release("achievements");
	expectOnlyVisible(null);
	advance(POPUP_HANDOFF_GAP_MS - 1);
	expectOnlyVisible(null);
	advance(1);
	expectOnlyVisible("achievements"); // next achievement, fresh presentation
});

test("want flicker during drain does not deadlock; queue falls back or goes idle", () => {
	mount({
		releaseNotes: { want: true, priority: 45 },
		schism: { want: false, priority: 10 },
		allegiance: { want: false, priority: 70 },
	});
	// Preemptor arrives, then its want dies mid-drain — the still-wanting
	// (drained) slot is re-admitted instead of the queue hanging.
	setWant("schism", true);
	expectOnlyVisible(null);
	advance(300);
	setWant("schism", false);
	advance(POPUP_HANDOFF_GAP_MS - 300);
	expectOnlyVisible("releaseNotes");

	// Now EVERY want dies mid-drain — the machine must go idle...
	setWant("schism", true);
	expectOnlyVisible(null);
	setWants({ schism: false, releaseNotes: false });
	advance(POPUP_HANDOFF_GAP_MS);
	expectOnlyVisible(null);

	// ...and a later want presents directly from idle (no stale drain state).
	setWant("allegiance", true);
	expectOnlyVisible("allegiance");
});

test("drop-while-presented (want dies without release) still drains before the next admit", () => {
	// E.g. a background refresh clears the presented modal's state, or its
	// owner unmounts — the native teardown is already in flight detached, so
	// the next popup must still wait out the gap.
	mount({
		releaseNotes: { want: true, priority: 45 },
		luckyTitle: { want: true, priority: 50 },
	});
	expectOnlyVisible("releaseNotes");

	setWant("releaseNotes", false);
	expectOnlyVisible(null);
	advance(POPUP_HANDOFF_GAP_MS - 1);
	expectOnlyVisible(null);
	advance(1);
	expectOnlyVisible("luckyTitle");
});

test("same-tick multi-arrival: lowest priority number wins before anything presents", () => {
	mount({
		rituals: { want: false, priority: 30 },
		achievements: { want: false, priority: 40 },
		schism: { want: false, priority: 10 },
	});
	// All three wants land in one commit (the boot race, collapsed): the
	// winner is decided by priority BEFORE any visible flips true, so the
	// losers never present-then-get-evicted.
	setWants({ rituals: true, achievements: true, schism: true });
	expectOnlyVisible("schism");
});

test("same-tick ties keep arrival order (stable)", () => {
	mount({
		first: { want: true, priority: 30 },
		second: { want: true, priority: 30 },
	});
	expectOnlyVisible("first");
});

test("truffleSheet(5) preempts releaseNotes(45) via drain; releaseNotes returns after", () => {
	mount({
		releaseNotes: { want: true, priority: 45 },
		truffleSheet: { want: false, priority: 5 },
	});
	expectOnlyVisible("releaseNotes");

	// User taps the truffle while release notes are up: hide notes, gap,
	// then the sheet — never both in one commit.
	setWant("truffleSheet", true);
	expectOnlyVisible(null);
	advance(POPUP_HANDOFF_GAP_MS);
	expectOnlyVisible("truffleSheet");

	// Dismissing the sheet brings the still-wanting release notes back,
	// again only after a full drain.
	dismissTwoPhase("truffleSheet");
	expectOnlyVisible("releaseNotes");
});

test("release from a non-presented slot is a no-op (no spurious drain)", () => {
	mount({
		releaseNotes: { want: true, priority: 45 },
		luckyTitle: { want: true, priority: 50 },
	});
	expectOnlyVisible("releaseNotes");
	release("luckyTitle"); // waiter misfires its dismiss handler
	expectOnlyVisible("releaseNotes"); // presented modal unaffected
});

// ── usePopupHold — the pre-shell gate (auth/username/onboarding screens) ──
import { usePopupHold } from "../components/ui/PopupQueue";

let setHoldActive: React.Dispatch<React.SetStateAction<boolean>> = () => {};

function HoldProbe() {
	const [active, set] = useState(true);
	setHoldActive = set;
	usePopupHold(active);
	return null;
}

function mountWithHold(initial: Slots) {
	act(() => {
		renderer = TestRenderer.create(
			<PopupQueueProvider>
				<HoldProbe />
				{Object.entries(initial).map(([id, s]) => (
					<Probe key={id} id={id} want={s.want} priority={s.priority} />
				))}
			</PopupQueueProvider>
		);
	});
}

describe("usePopupHold (pre-shell gate)", () => {
	it("blocks admission while held, presents the queued winner on release", () => {
		mountWithHold({
			schism: { want: true, priority: 10 },
			achievements: { want: true, priority: 40 },
		});
		// Hold active from mount: nothing presents no matter how long we wait.
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS * 3);
		});
		expect(reg.schism.visible).toBe(false);
		expect(reg.achievements.visible).toBe(false);
		// Gate lifts (player lands in the shell): priority winner presents.
		act(() => setHoldActive(false));
		expect(reg.schism.visible).toBe(true);
		expect(reg.achievements.visible).toBe(false);
	});

	it("drains an already-presented popup when a hold engages, re-presents after release", () => {
		mountWithHold({ rituals: { want: true, priority: 30 } });
		act(() => setHoldActive(false));
		expect(reg.rituals.visible).toBe(true);
		// Gate re-engages (e.g. sign-out → auth screen): presented modal drains.
		act(() => setHoldActive(true));
		expect(reg.rituals.visible).toBe(false);
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS + 50);
		});
		expect(reg.rituals.visible).toBe(false); // still held
		act(() => setHoldActive(false));
		expect(reg.rituals.visible).toBe(true); // want persisted, re-presents
	});
});
