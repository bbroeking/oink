// Drives a reward return (utils/rewardReturn.ts) through Animated values: the
// walk-in, the celebration beat, the card's pop, the items' flight, the
// granted hold. Owns the timers and the grant call; the component only draws.
//
// Contract: the host renders <RewardReturn open …/> and passes `onGrant` (the
// server call — claim_errand, or whatever grants the thing) and `onDone`.
// The hook resolves `open` → arrive → reveal on its own clock, waits for the
// player at reveal, runs the flight and the grant together on `grant()`, and
// calls `onDone` after the granted beat or a skip/dismiss. Reduce Motion cuts
// the walk and the flight (the script says so); the beats that are pauses
// stay. (2026-09-18)

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { Animated } from "react-native";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn } from "@/utils/motionRecipes";
import {
	INITIAL_RETURN,
	advanceReturn,
	canGrant,
	returnScript,
	type GrantResult,
	type ReturnState,
	type RewardItem,
} from "@/utils/rewardReturn";

export interface UseRewardReturnArgs {
	open: boolean;
	items: readonly RewardItem[];
	/** The grant. Resolves the server's answer; rejections are treated as a
	 *  retryable network failure. Never called twice while one is in flight. */
	onGrant: () => Promise<GrantResult>;
	/** After the granted beat, or after a skip / dismiss. */
	onDone: (outcome: "granted" | "skipped") => void;
}

export interface RewardReturnDrive {
	state: ReturnState;
	/** 0 → 1 across the walk-in. Interpolate for translateX. */
	walk: Animated.Value;
	/** The pig's celebration is a PigStage reaction; this flags when to play it. */
	celebrating: boolean;
	/** The card's entrance (popIn). */
	cardScale: Animated.Value;
	cardOpacity: Animated.Value;
	/** One 0 → 1 per item across its flight to the target. */
	flights: Animated.Value[];
	grant: () => void;
	skip: () => void;
	dismiss: () => void;
	canGrant: boolean;
	cuts: boolean;
}

export function useRewardReturn({ open, items, onGrant, onDone }: UseRewardReturnArgs): RewardReturnDrive {
	const policy = useMotionPolicy();
	const script = useMemo(() => returnScript(policy), [policy]);
	const [state, dispatch] = useReducer(advanceReturn, INITIAL_RETURN);

	const walk = useRef(new Animated.Value(0)).current;
	const cardScale = useRef(new Animated.Value(0)).current;
	const cardOpacity = useRef(new Animated.Value(0)).current;
	// One flight value per item; rebuilt only when the item count changes so a
	// re-render mid-flight never resets a coin to the card.
	const flights = useMemo(() => items.map(() => new Animated.Value(0)), [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const later = useCallback((fn: () => void, ms: number) => {
		const t = setTimeout(fn, ms);
		timers.current.push(t);
		return t;
	}, []);
	useEffect(() => () => timers.current.forEach(clearTimeout), []);

	// Keep the latest callbacks without re-arming effects on every render.
	const grantRef = useRef(onGrant);
	grantRef.current = onGrant;
	const doneRef = useRef(onDone);
	doneRef.current = onDone;

	// open → arrive
	useEffect(() => {
		if (open && state.phase === "closed") {
			walk.setValue(0);
			cardScale.setValue(0);
			cardOpacity.setValue(0);
			flights.forEach((f) => f.setValue(0));
			dispatch({ type: "open" });
		}
	}, [open, state.phase, walk, cardScale, cardOpacity, flights]);

	// arrive: the walk, then the celebration beat, then reveal
	useEffect(() => {
		if (state.phase !== "arrive") return;
		let cancelled = false;
		const afterWalk = () => {
			if (cancelled) return;
			later(() => dispatch({ type: "arrived" }), script.celebrateMs);
		};
		if (script.cuts) {
			walk.setValue(1);
			afterWalk();
			return;
		}
		const anim = Animated.timing(walk, { toValue: 1, duration: script.walkMs, useNativeDriver: true });
		anim.start(({ finished }) => finished && afterWalk());
		return () => {
			cancelled = true;
			anim.stop();
		};
	}, [state.phase, script, walk, later]);

	// reveal: the card pops
	useEffect(() => {
		if (state.phase !== "reveal") return;
		const anim = popIn(cardScale, cardOpacity, policy);
		anim.start();
		return () => anim.stop();
	}, [state.phase, cardScale, cardOpacity, policy]);

	// granting: the flight and the grant run together; the phase resolves on
	// the slower of the two so a fast server never lands a coin mid-air.
	useEffect(() => {
		if (state.phase !== "granting") return;
		let cancelled = false;
		const flight = new Promise<void>((resolve) => {
			if (script.cuts || flights.length === 0) {
				flights.forEach((f) => f.setValue(1));
				resolve();
				return;
			}
			Animated.stagger(
				script.flyStaggerMs,
				flights.map((f) => Animated.timing(f, { toValue: 1, duration: script.flyMs, useNativeDriver: true }))
			).start(() => resolve());
		});
		const grant = grantRef
			.current()
			.catch((): GrantResult => ({ ok: false, reason: "network", retryable: true }));
		Promise.all([flight, grant]).then(([, result]) => {
			if (cancelled) return;
			if (result.ok) dispatch({ type: "grantOk" });
			else {
				// The coins come back to the card before the refusal shows.
				flights.forEach((f) => f.setValue(0));
				dispatch({ type: "grantFail", reason: result.reason, retryable: result.retryable });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [state.phase, script, flights]);

	// granted: hold the beat, then hand back
	useEffect(() => {
		if (state.phase !== "granted") return;
		later(() => dispatch({ type: "dismiss" }), script.grantedHoldMs);
	}, [state.phase, script, later]);

	// done → tell the host once
	const outcomeRef = useRef<"granted" | "skipped">("skipped");
	useEffect(() => {
		if (state.phase === "granted") outcomeRef.current = "granted";
		if (state.phase === "done") doneRef.current(outcomeRef.current);
	}, [state.phase]);

	const grant = useCallback(() => dispatch({ type: "grant" }), []);
	const skip = useCallback(() => dispatch({ type: "skip" }), []);
	const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);

	return {
		state,
		walk,
		celebrating: state.phase !== "arrive" && state.phase !== "closed" && state.phase !== "done",
		cardScale,
		cardOpacity,
		flights,
		grant,
		skip,
		dismiss,
		canGrant: canGrant(state),
		cuts: script.cuts,
	};
}
