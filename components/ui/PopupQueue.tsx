// Global popup queue. iOS can only reliably present ONE native <Modal> per
// window — presenting a second while the first is up (or mid-dismiss) attaches
// it INVISIBLY while its touch-blocking host stays in the hierarchy, so the
// whole app reads as frozen. Open RN new-arch bug: facebook/react-native#50152.
// The launch + home popups live in two different component trees (root _layout
// vs the Barn tab), so a local guard in either one can't see the other.
//
// This provider is the single arbiter: every popup declares "I want to show"
// via usePopupSlot(id, want, priority); only the slot currently PRESENTED is
// told it's `visible`. The queue is an explicit state machine that SERIALIZES
// every presentation — the presented id may only move to a new slot after the
// previous modal has been hidden (visible -> false) AND a full teardown gap
// has elapsed. There is no path that flips one modal's visible false and
// another's true in the same commit.
//
// THE MACHINE:
//
//	          +--------------------- gap timer fires, a slot wants ---------+
//	          v                                                             |
//	   [idle] --- a slot wants ---> [presenting] --- hide event ---> [draining]
//	     ^                                                                  |
//	     +----------------- gap timer fires, nothing wants -----------------+
//
//	- idle:       nothing presented. The first want (or the priority winner of
//	              several wants landing in the same commit) presents directly.
//	- presenting: exactly one slot is visible. EVERY way it can stop being
//	              visible funnels into 'draining':
//	                * release()  — its dismiss handler ran (the normal path);
//	                * drop       — its `want` died without a dismiss (unmount,
//	                               state cleared by a background refresh);
//	                * preemption — a LOWER-priority-number want arrived. The
//	                               preemptor does NOT present; it queues, the
//	                               presented modal is hidden, and the winner
//	                               is admitted only after the gap.
//	- draining:   visible is false for everyone while the outgoing native
//	              dismissal runs. One POPUP_HANDOFF_GAP_MS timer, armed once
//	              per drain and never restarted, then ONE admission decision.
//
// WHY PREEMPTION MUST DRAIN: a higher-priority want used to swap the active id
// in the same render commit — the presented modal started its ~300-450ms
// native dismissal while the preemptor's presentViewController fired at t=0 of
// that teardown, which is exactly the #50152 invisible-modal wedge. At boot
// this was the COMMON case: ~10 slots are fed by independent async sources
// (RPCs, AsyncStorage, fetches) whose arrival order is nearly INVERSE to their
// priority order, so early arrivers presented and were then evicted by slower,
// higher-priority wants. Preemption is still honored — the better popup shows
// next — but only through the same hide -> gap -> admit drain as a dismissal.
//
// ADMISSION IS RECOMPUTED, NOT LATCHED: the machine stores no pendingWinner.
// At gap end it re-picks the lowest-priority-number slot from whatever still
// wants to show (ties keep arrival order). A preemptor whose want flickered
// away during the drain can therefore never wedge the queue — the next
// requester is admitted, or the machine goes idle. A drained-but-still-wanting
// slot simply stays queued and returns when it next wins (this is also what
// advances the achievements carousel: release() with `want` still true
// re-presents the same slot, with its next payload, after the gap).
//
// TIMING CONTRACT (consumers):
//	- Drive the native Modal's `visible` from slot.visible; keep it mounted.
//	- Dismiss handlers are two-phase: call release() first (hides the modal),
//	  then clear the backing state a POPUP_TEARDOWN_MS beat later. The beat is
//	  deliberately < the gap, so the want is gone before the gap re-admits —
//	  a slot whose state clears slower than the gap re-presents its own popup.
//	- The gap is 700ms because the native dismissal runs ~300ms (fade) to
//	  ~450ms (slide), and at app launch the JS + main threads are saturated
//	  enough to stretch it; 700ms = worst-case slide dismissal + headroom.
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { markPopupPresented } from "@/utils/popupSession";

// See the timing contract above for how these two relate. The gap is the quiet
// window after ANY hide (release, drop-of-presented, preemption) before the
// next popup may present; the beat is how long dismiss handlers wait after
// release() before clearing state / unmounting the (now hidden) modal.
// Beat < gap is load-bearing.
export const POPUP_HANDOFF_GAP_MS = 700;
export const POPUP_TEARDOWN_MS = 500;

type Req = { id: string; priority: number };

type Phase = "idle" | "presenting" | "draining";

// presentedId is only non-null while phase === "presenting"; during a drain
// nothing is presented (the outgoing modal is animating out natively).
type Machine = { phase: Phase; presentedId: string | null };

interface QueueApi {
	request: (id: string, priority: number) => void;
	drop: (id: string) => void;
	release: (id: string) => void;
	/** Pre-shell gate (see usePopupHold). +1/-1 reference count. */
	hold: () => void;
	unhold: () => void;
	activeId: string | null;
}

const PopupCtx = createContext<QueueApi | null>(null);

// Lowest priority number wins; ties keep arrival order (stable sort).
function pickWinner(reqs: Req[]): Req | null {
	if (reqs.length === 0) return null;
	return [...reqs].sort((a, b) => a.priority - b.priority)[0];
}

export function PopupQueueProvider({ children }: { children: ReactNode }) {
	// The wanting set lives in a ref, mutated synchronously by request/drop —
	// membership alone never changes what's on screen (only the machine does),
	// and a ref is always current inside the drain timer's admission callback.
	const reqsRef = useRef<Req[]>([]);
	const [machine, setMachine] = useState<Machine>({
		phase: "idle",
		presentedId: null,
	});
	const machineRef = useRef(machine);
	// Bumped on every membership change so the settle effect runs once per
	// commit AFTER all slot effects in that commit have recorded their wants —
	// this is what makes same-commit multi-arrival pick the priority winner
	// instead of whichever slot's effect happened to run first, and what folds
	// a slot's same-commit drop+re-request churn into a no-op.
	const [, setVersion] = useState(0);
	const drainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Pre-shell holds (auth / username setup / onboarding screens). While any
	// hold is active the machine admits NOTHING — wants keep queueing, and a
	// popup that managed to present before the hold registered is drained.
	// Without this, launch popups (which mount at the root, above the whole
	// Stack) present OVER the onboarding storybook — on top of being bad UX,
	// a reinstall (AsyncStorage wipe re-arms onboarding while a seasoned
	// account's schism/finale/achievements all want at once) put a modal
	// fight on top of a gate screen the player can't leave.
	const holdsRef = useRef(0);

	// The single writer: every machine transition goes through here so the
	// ref mirror (read by callbacks/timers) can never lag the render state.
	const write = useCallback((next: Machine) => {
		// Session-level "a popup presented this login" signal for the quiet-login
		// Sounder nudge. Fire on the EDGE into presenting a given id (idle→present
		// or draining→present), never on re-renders that keep the same presentedId.
		// markPopupPresented() itself excludes the sounderLaunch slot, so the
		// nudge's own presentation never suppresses it.
		const prev = machineRef.current;
		if (
			next.phase === "presenting" &&
			next.presentedId &&
			!(prev.phase === "presenting" && prev.presentedId === next.presentedId)
		) {
			markPopupPresented(next.presentedId);
		}
		machineRef.current = next;
		setMachine(next);
	}, []);

	// Enter 'draining': hide whatever is presented and hold the quiet window.
	// ONE timer per drain, never restarted by later events — one drain yields
	// exactly one admission decision at gap end.
	const beginDrain = useCallback(() => {
		write({ phase: "draining", presentedId: null });
		if (drainTimer.current) clearTimeout(drainTimer.current);
		drainTimer.current = setTimeout(() => {
			drainTimer.current = null;
			// Admission: re-pick from whatever still wants. A winner whose
			// want died mid-drain just isn't here anymore — no deadlock.
			// Holds win over everything: go idle and let the hold's release
			// (a version bump) re-run settle, which presents the queued winner.
			const winner = holdsRef.current > 0 ? null : pickWinner(reqsRef.current);
			write(
				winner
					? { phase: "presenting", presentedId: winner.id }
					: { phase: "idle", presentedId: null }
			);
		}, POPUP_HANDOFF_GAP_MS);
	}, [write]);

	const request = useCallback((id: string, priority: number) => {
		if (reqsRef.current.some((r) => r.id === id)) return;
		reqsRef.current = [...reqsRef.current, { id, priority }];
		setVersion((v) => v + 1);
	}, []);

	const drop = useCallback((id: string) => {
		if (!reqsRef.current.some((r) => r.id === id)) return;
		reqsRef.current = reqsRef.current.filter((r) => r.id !== id);
		setVersion((v) => v + 1);
	}, []);

	const hold = useCallback(() => {
		holdsRef.current += 1;
		setVersion((v) => v + 1);
	}, []);

	const unhold = useCallback(() => {
		holdsRef.current = Math.max(0, holdsRef.current - 1);
		setVersion((v) => v + 1);
	}, []);

	// Dismiss-handler path. Hides the presented modal NOW; the slot stays in
	// the wanting set until its two-phase state clear flips `want` false (the
	// POPUP_TEARDOWN_MS beat — before the gap re-admits). A release from a
	// slot that isn't presented is a no-op: `want` is the sole membership
	// driver, so there's nothing to hide and nothing to remove.
	const release = useCallback(
		(id: string) => {
			const m = machineRef.current;
			if (m.phase === "presenting" && m.presentedId === id) beginDrain();
		},
		[beginDrain]
	);

	// Settle: the single arbitration point, run once per commit after every
	// slot effect in that commit has updated the wanting set.
	useEffect(() => {
		const m = machineRef.current;
		// A drain in progress owns the next transition (its timer admits).
		if (m.phase === "draining") return;
		// A hold drains anything presented and blocks idle admission. Wants
		// keep accumulating; the hold's release bumps version → this effect
		// re-runs → the queued winner presents.
		if (holdsRef.current > 0) {
			if (m.phase === "presenting") beginDrain();
			return;
		}
		const winner = pickWinner(reqsRef.current);
		if (m.phase === "idle") {
			// Nothing presented and nothing tearing down — present directly.
			if (winner) write({ phase: "presenting", presentedId: winner.id });
			return;
		}
		// presenting:
		const presentedStillWants = reqsRef.current.some(
			(r) => r.id === m.presentedId
		);
		if (!presentedStillWants) {
			// The presented slot's want died without a release() (unmount,
			// background state clear). The native modal may already be tearing
			// down detached — drain anyway so nothing presents into it.
			beginDrain();
		} else if (winner && winner.id !== m.presentedId) {
			// Preemption: a higher-priority want arrived. Hide first, admit
			// the winner only after the gap — never swap in the same commit.
			beginDrain();
		}
	});

	useEffect(
		() => () => {
			if (drainTimer.current) clearTimeout(drainTimer.current);
		},
		[]
	);

	const activeId = machine.phase === "presenting" ? machine.presentedId : null;
	const value = useMemo<QueueApi>(
		() => ({ request, drop, release, hold, unhold, activeId }),
		[request, drop, release, hold, unhold, activeId]
	);

	return <PopupCtx.Provider value={value}>{children}</PopupCtx.Provider>;
}

// Declare a popup. `want` = its own trigger condition (state). Returns whether
// it's allowed to be on screen right now (`visible`) and `release()` to call on
// dismiss. Lower `priority` shows first when several want to show at once.
// Block ALL popups while `active` (a pre-shell gate screen is up: auth,
// username setup, onboarding). Reference-counted, so multiple gates compose.
// Wants queue up behind the hold and present, serialized, once it lifts.
export function usePopupHold(active: boolean) {
	const ctx = useContext(PopupCtx);
	useEffect(() => {
		if (!ctx || !active) return;
		ctx.hold();
		return () => ctx.unhold();
	}, [ctx, active]);
}

// One-liner for an UNMANAGED native Modal — a sheet rendered outside the queue
// (UserSheet, HoofprintsSheet, and the other ~10 tab sheets) that still can't
// coexist with a queued popup on iOS (the #50152 invisible-modal wedge). While
// `open`, the queue admits nothing and drains anything presented — exactly the
// mutual exclusion we want — and on close the hold lifts so queued popups
// re-admit after the handoff gap. Mechanically a usePopupHold; named for intent
// so future unmanaged sheets adopt the latch in one line instead of being
// converted to slots.
export function useUnmanagedModalHold(open: boolean) {
	usePopupHold(open);
}

// True while any popup is currently PRESENTED. Lets a caller OUTSIDE the queue
// (the push-tap handler in app/_layout) tell whether it would be navigating the
// Stack UNDER a live native Modal (the iOS #50152 wedge) — so it can hold/drain
// first and only pay the handoff-gap latency when something is actually up.
export function usePopupActive(): boolean {
	const ctx = useContext(PopupCtx);
	return !!ctx?.activeId;
}

export function usePopupSlot(id: string, want: boolean, priority = 100) {
	const ctx = useContext(PopupCtx);

	useEffect(() => {
		if (!ctx) return;
		if (want) ctx.request(id, priority);
		else ctx.drop(id);
		return () => ctx.drop(id);
	}, [ctx, id, want, priority]);

	const visible = !!ctx && want && ctx.activeId === id;
	const release = useCallback(() => ctx?.release(id), [ctx, id]);
	return { visible, release };
}
