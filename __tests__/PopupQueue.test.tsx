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

// ── ceremony gate — flip-day stacking ceiling (SKILL.md 2026-07-11) ──
// A ceremony (season-end recap pri 25 / Great Hunger intro pri 27) presenting
// this session must suppress the housekeeping popups (achievements 40, release
// notes 45) for the rest of the session — they surface next login. The gate is
// an in-memory module flag; the real slots set it when they present and read it
// in their `want`. This test wires a housekeeping Probe exactly that way.
import {
	markCeremonyShown,
	ceremonyShownThisSession,
	__resetCeremonyGate,
} from "../utils/ceremonyGate";

// A ceremony Probe that latches the gate the moment it becomes visible (mirrors
// the `if (slot.visible) markCeremonyShown()` effect on the real ceremony slots).
function CeremonyProbe({ want, priority }: { want: boolean; priority: number }) {
	const slot = usePopupSlot("ceremony", want, priority);
	reg.ceremony = slot;
	React.useEffect(() => {
		if (slot.visible) markCeremonyShown();
	}, [slot.visible]);
	return null;
}

// A housekeeping Probe whose want is gated on the session flag (as the real
// achievements/releaseNotes slots are).
function HousekeepingProbe({ baseWant }: { baseWant: boolean }) {
	const slot = usePopupSlot(
		"housekeeping",
		baseWant && !ceremonyShownThisSession(),
		45
	);
	reg.housekeeping = slot;
	return null;
}

describe("ceremony gate (flip-day stacking ceiling)", () => {
	beforeEach(() => __resetCeremonyGate());
	afterEach(() => __resetCeremonyGate());

	it("a ceremony presenting suppresses a later housekeeping want this session", () => {
		let setBase: React.Dispatch<React.SetStateAction<boolean>> = () => {};
		function Wrap() {
			const [base, sb] = useState(false);
			setBase = sb;
			return (
				<PopupQueueProvider>
					<CeremonyProbe want={true} priority={27} />
					<HousekeepingProbe baseWant={base} />
				</PopupQueueProvider>
			);
		}
		act(() => {
			renderer = TestRenderer.create(<Wrap />);
		});
		// Ceremony presents at login and latches the gate.
		expect(reg.ceremony.visible).toBe(true);
		expect(ceremonyShownThisSession()).toBe(true);

		// Housekeeping's backing state goes true AFTER the ceremony fired — but
		// the gate keeps its `want` false, so it never presents this session.
		act(() => setBase(true));
		expect(reg.housekeeping.visible).toBe(false);

		// Even after the ceremony hides and the queue drains, housekeeping stays
		// suppressed for the rest of the session (it would surface next login).
		release("ceremony");
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS * 2);
		});
		expect(reg.housekeeping.visible).toBe(false);
	});
});

// ── same-slot re-present race: a want flips true mid-teardown of that SAME slot ──
// The two-phase dismiss clears the want a beat AFTER release(); a slot whose want
// re-arms during its OWN drain (e.g. a fresh trigger lands while it's animating
// out) must be re-admitted at gap end, not lost or double-presented. reqsRef is
// read live at admission, so the final membership at gap end wins.
describe("same-slot re-present during its own drain", () => {
	it("re-arming the want mid-drain re-presents the same slot after the gap", () => {
		mount({ luckyPig: { want: true, priority: 55 } });
		expectOnlyVisible("luckyPig");

		// Dismiss: release() hides it, drain begins. The want is still true.
		release("luckyPig");
		expectOnlyVisible(null);
		advance(200); // mid-drain

		// The two-phase state clear lands (want → false)…
		setWant("luckyPig", false);
		advance(50);
		// …and then a fresh trigger re-arms the SAME slot before the gap ends.
		setWant("luckyPig", true);

		// At gap end the live membership (want true again) is re-admitted — the
		// slot re-presents rather than the queue losing it or going idle.
		advance(POPUP_HANDOFF_GAP_MS - 250);
		expectOnlyVisible("luckyPig");
	});

	it("a want that re-arms then dies again mid-drain leaves the queue idle, not wedged", () => {
		mount({ truffleSheet: { want: true, priority: 5 } });
		expectOnlyVisible("truffleSheet");

		release("truffleSheet");
		advance(100);
		setWant("truffleSheet", false); // beat clears the want
		advance(50);
		setWant("truffleSheet", true); // flickers back…
		advance(20);
		setWant("truffleSheet", false); // …and dies again before gap end
		advance(POPUP_HANDOFF_GAP_MS);
		expectOnlyVisible(null); // no phantom re-present, no deadlock

		// The queue is healthy: a later want presents directly from idle.
		setWant("truffleSheet", true);
		expectOnlyVisible("truffleSheet");
	});
});

// ── quiet-login Sounder nudge: the fallback that only fires on an empty queue ──
// The sounder slot's want ANDs with !anyPopupPresentedThisSession(): if ANY other
// popup presents this session the nudge is suppressed; only on a genuinely quiet
// login (nothing else wanted) does it fire. PopupQueue calls markPopupPresented()
// (excluding the sounderLaunch id) on every presenting edge; the tracker is an
// in-memory module flag, exactly as the real slot reads it.
import {
	anyPopupPresentedThisSession,
	__resetPopupSession,
} from "../utils/popupSession";

// A sounder Probe wired like the real slot: crewless want ANDs with the
// queue-empty gate. Low priority so it can never preempt a real dialog.
function SounderProbe({ crewless }: { crewless: boolean }) {
	const slot = usePopupSlot(
		"sounderLaunch",
		crewless && !anyPopupPresentedThisSession(),
		90
	);
	reg.sounderLaunch = slot;
	return null;
}

describe("quiet-login Sounder nudge (fallback)", () => {
	beforeEach(() => __resetPopupSession());
	afterEach(() => __resetPopupSession());

	it("fires when NOTHING else presented this session", () => {
		act(() => {
			renderer = TestRenderer.create(
				<PopupQueueProvider>
					<SounderProbe crewless={true} />
				</PopupQueueProvider>
			);
		});
		// Empty queue: the fallback presents.
		expect(reg.sounderLaunch.visible).toBe(true);
		// Its own presentation must NOT count as "a popup presented" (else it would
		// retroactively suppress itself). markPopupPresented excludes the slot id.
		expect(anyPopupPresentedThisSession()).toBe(false);
	});

	it("never fires this session once another slot presents first", () => {
		let setReal: React.Dispatch<React.SetStateAction<boolean>> = () => {};
		let setCrewless: React.Dispatch<React.SetStateAction<boolean>> = () => {};
		function Wrap() {
			const [real, sr] = useState(false);
			const [crewless, sc] = useState(false);
			setReal = sr;
			setCrewless = sc;
			return (
				<PopupQueueProvider>
					<Probe id="schism" want={real} priority={10} />
					<SounderProbe crewless={crewless} />
				</PopupQueueProvider>
			);
		}
		act(() => {
			renderer = TestRenderer.create(<Wrap />);
		});

		// A real dialog presents first — the session flag latches.
		act(() => setReal(true));
		expectOnlyVisible("schism");
		expect(anyPopupPresentedThisSession()).toBe(true);

		// The crewless condition only becomes known afterward. The nudge's want
		// ANDs with the (now true) presented-flag's negation, so it stays false —
		// it never fires this session even after the real dialog is dismissed.
		act(() => setCrewless(true));
		expect(reg.sounderLaunch.visible).toBe(false);

		release("schism");
		act(() => {
			jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS * 2);
		});
		expect(reg.sounderLaunch.visible).toBe(false);
	});
});
