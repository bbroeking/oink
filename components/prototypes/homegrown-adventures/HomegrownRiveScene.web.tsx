import { Alignment, Fit, Layout, useRive } from "@rive-app/react-webgl2";
import { memo, useEffect, useRef, useState } from "react";
import {
	HOMEGROWN_RIVE_NAMES,
	type HomegrownRiveTrigger,
	type HomegrownRiveViewModel,
} from "./homegrownRiveContract";

declare const __HOMEGROWN_RIVE_ASSET_URL__: string;
declare const __HOMEGROWN_RIVE_AUTHORED__: boolean;

export const HOMEGROWN_RIVE_ASSET_AUTHORED = __HOMEGROWN_RIVE_AUTHORED__;

const AUTHORED_TRIGGER_ANIMATIONS: Partial<Record<HomegrownRiveTrigger, string>> = {
	tickle: "Rosie Tickle",
	pack: "Rosie Pack",
	return: "Rosie Return",
};

const BREATHING_ANIMATION = "Rosie Breathing Idle";
const NOTICE_ANIMATION = "Rosie Notice";
const BAG_HIDDEN_ANIMATION = "Rosie Bag Hidden";
const CROP_STATE_ANIMATIONS = {
	empty: "Clover Bed Empty",
	sprout: "Clover Bed Growing",
	growing: "Clover Bed Growing",
	ready: "Clover Bed Ready",
} as const;
const CROP_ACTION_ANIMATIONS = {
	plant: "Clover Plant",
	flourish: "Clover Ready Flourish",
	harvest: "Clover Harvest",
} as const;
const CROP_ANIMATIONS = [
	...new Set([...Object.values(CROP_STATE_ANIMATIONS), ...Object.values(CROP_ACTION_ANIMATIONS)]),
];
const HOME_STATE_ANIMATIONS = {
	hidden: "Home Consequence Hidden",
	developed: "Home Consequence Developed",
} as const;
const HOME_FLOURISH_ANIMATION = "Glowroot Home Flourish";
const HOME_ANIMATIONS = [...Object.values(HOME_STATE_ANIMATIONS), HOME_FLOURISH_ANIMATION];
const MOONBERRY_STATE_ANIMATIONS = {
	empty: "Moonberry Bed Empty",
	sprout: "Moonberry Bed Growing",
	growing: "Moonberry Bed Growing",
	ready: "Moonberry Bed Growing",
} as const;
const MOONBERRY_PLANT_ANIMATION = "Moonberry Plant";
const MOONBERRY_ANIMATIONS = [
	...new Set([...Object.values(MOONBERRY_STATE_ANIMATIONS), MOONBERRY_PLANT_ANIMATION]),
];
const MOTH_STATE_ANIMATIONS = {
	hidden: "Dusk Moths Hidden",
	present: "Dusk Moths Present",
} as const;
const MOTH_ARRIVE_ANIMATION = "Dusk Moths Arrive";
const MOTH_REST_ANIMATION = "Dusk Moths Resting";
const MOTH_LAUGH_ANIMATION = "Dusk Moths Laugh";
const MOTH_ANIMATIONS = [
	...Object.values(MOTH_STATE_ANIMATIONS),
	MOTH_ARRIVE_ANIMATION,
	MOTH_REST_ANIMATION,
	MOTH_LAUGH_ANIMATION,
];
const CHARACTER_ANIMATIONS = [
	BREATHING_ANIMATION,
	AUTHORED_TRIGGER_ANIMATIONS.tickle,
	AUTHORED_TRIGGER_ANIMATIONS.pack,
	AUTHORED_TRIGGER_ANIMATIONS.return,
	NOTICE_ANIMATION,
].filter((name): name is string => Boolean(name));

type RosieMotion =
	| "loading"
	| "idle"
	| "breathing"
	| "tickle"
	| "notice"
	| "pack"
	| "return"
	| "reduced";

type CropMotion =
	| "loading"
	| "empty"
	| "growing"
	| "ready"
	| "plant"
	| "flourish"
	| "harvest"
	| "reduced";

type HomeMotion = "loading" | "hidden" | "flourish" | "developed" | "reduced";
type MoonberryMotion = "loading" | "empty" | "plant" | "growing" | "reduced";
type MothMotion =
	| "loading"
	| "hidden"
	| "arrive"
	| "present"
	| "resting"
	| "laugh"
	| "reduced";

export interface HomegrownRiveSceneProps {
	reduceMotion: boolean;
	model: HomegrownRiveViewModel;
	trigger: HomegrownRiveTrigger | null;
	triggerNonce: string;
}

/**
 * Stable web-only runtime boundary. The build selects the authored scene when
 * present and otherwise keeps an honest, invisible official runtime probe.
 */
function HomegrownRiveSceneImpl({
	reduceMotion,
	model,
	trigger,
	triggerNonce,
}: HomegrownRiveSceneProps) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [motion, setMotion] = useState<RosieMotion>("loading");
	const [cropMotion, setCropMotion] = useState<CropMotion>("loading");
	const [homeMotion, setHomeMotion] = useState<HomeMotion>("loading");
	const [moonberryMotion, setMoonberryMotion] = useState<MoonberryMotion>("loading");
	const [mothMotion, setMothMotion] = useState<MothMotion>("loading");
	const lastTriggerNonce = useRef(triggerNonce);
	const lastCropTriggerNonce = useRef(triggerNonce);
	const previousBedOneState = useRef(model.bedOneState);
	const previousHomeDeveloped = useRef(model.hedgeCrossingOpen);
	const previousBedTwoState = useRef(model.bedTwoState);
	const previousMothsVisible = useRef(model.mothsVisible);
	const lastMothTriggerNonce = useRef(triggerNonce);
	const latestMothTrigger = useRef(trigger);
	latestMothTrigger.current = trigger;
	const motionTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const cropTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const homeTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const moonberryTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const mothTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const { RiveComponent, rive } = useRive({
		src: __HOMEGROWN_RIVE_ASSET_URL__,
		...(HOMEGROWN_RIVE_ASSET_AUTHORED
			? {
				artboard: HOMEGROWN_RIVE_NAMES.artboard,
				autoBind: true,
			}
			: {}),
		autoplay: false,
		layout: new Layout({
			fit: HOMEGROWN_RIVE_ASSET_AUTHORED ? Fit.Cover : Fit.Contain,
			alignment: Alignment.Center,
		}),
		onLoad: () => setStatus("ready"),
		onLoadError: () => setStatus("error"),
	}, {
		useDevicePixelRatio: true,
		// This scene is the only Rive instance on the page. A dedicated context
		// preserves canvas alpha so the approved farm concept remains visible.
		useOffscreenRenderer: false,
		shouldResizeCanvasToContainer: true,
	});

	useEffect(() => {
		if (!rive || !HOMEGROWN_RIVE_ASSET_AUTHORED) return;
		const instance = rive.viewModelInstance;
		if (!instance) {
			setStatus("error");
			return;
		}

		for (const [name, value] of Object.entries(model)) {
			if (typeof value === "boolean") {
				const property = instance.boolean(name);
				if (!property) setStatus("error");
				else property.value = value;
			} else {
				const property = instance.enum(name);
				if (!property) setStatus("error");
				else property.value = value;
			}
		}
	}, [model, rive]);

	useEffect(() => {
		if (!rive || !HOMEGROWN_RIVE_ASSET_AUTHORED) return;

		const clearTimers = () => {
			for (const timer of motionTimers.current) clearTimeout(timer);
			motionTimers.current.clear();
		};
		const schedule = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => {
				motionTimers.current.delete(timer);
				callback();
			}, delay);
			motionTimers.current.add(timer);
		};
		const stopCharacterMotion = () => {
			for (const animation of CHARACTER_ANIMATIONS) rive.stop(animation);
		};
		const syncSatchelVisibility = () => {
			rive.stop(BAG_HIDDEN_ANIMATION);
			if (model.satchelEquipped) return;

			// The reducer owns equipped state. Scrubbing the authored static clip
			// keeps an unpacked Rosie bag-free without introducing parallel DOM art.
			rive.scrub(BAG_HIDDEN_ANIMATION, 0);
			rive.pause(BAG_HIDDEN_ANIMATION);
		};
		const startBreathing = () => {
			if (reduceMotion) return;
			rive.stop(BREATHING_ANIMATION);
			rive.play(BREATHING_ANIMATION);
			setMotion("breathing");
			// A restrained authored breath followed by a restful hold keeps the
			// full cadence calm without changing Rive playback speed globally.
			schedule(() => {
				rive.stop(BREATHING_ANIMATION);
				setMotion("idle");
				schedule(startBreathing, 2_250);
			}, 1_000);
		};

		clearTimers();
		stopCharacterMotion();
		syncSatchelVisibility();

		const isNewTrigger = lastTriggerNonce.current !== triggerNonce;
		lastTriggerNonce.current = triggerNonce;

		if (reduceMotion) {
			rive.pause(CHARACTER_ANIMATIONS);
			setMotion("reduced");
			return clearTimers;
		}

		if (!isNewTrigger || !trigger) {
			startBreathing();
			return () => {
				clearTimers();
				stopCharacterMotion();
			};
		}

		const property = rive.viewModelInstance?.trigger(trigger);
		if (!property) setStatus("error");
		else property.trigger();

		const animation = AUTHORED_TRIGGER_ANIMATIONS[trigger];
		if (!animation) {
			startBreathing();
			return clearTimers;
		}

		// Restarting makes rapid tickles deterministic instead of queueing them.
		rive.play(animation);
		setMotion(trigger === "pack" ? "pack" : trigger === "return" ? "return" : "tickle");

		if (model.rosieAction === "notice") {
			schedule(() => {
				rive.stop(animation);
				// Layer the authored body-and-leg Notice pose over a clean breathing
				// base instead of letting it inherit the tickle jump apex.
				rive.stop(BREATHING_ANIMATION);
				rive.play(BREATHING_ANIMATION);
				rive.play(NOTICE_ANIMATION);
				setMotion("notice");
			}, 620);
			schedule(() => {
				rive.stop(NOTICE_ANIMATION);
				rive.stop(BREATHING_ANIMATION);
				startBreathing();
			}, 1_520);
		} else {
			const settleDelay = trigger === "return" ? 900 : trigger === "pack" ? 600 : 700;
			schedule(() => {
				rive.stop(animation);
				syncSatchelVisibility();
				startBreathing();
			}, settleDelay);
		}

		return () => {
			clearTimers();
			stopCharacterMotion();
		};
	}, [model.rosieAction, model.satchelEquipped, reduceMotion, rive, trigger, triggerNonce]);

	useEffect(() => {
		if (!rive || !HOMEGROWN_RIVE_ASSET_AUTHORED) return;

		const clearTimers = () => {
			for (const timer of cropTimers.current) clearTimeout(timer);
			cropTimers.current.clear();
		};
		const schedule = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => {
				cropTimers.current.delete(timer);
				callback();
			}, delay);
			cropTimers.current.add(timer);
		};
		const stopCropMotion = () => {
			for (const animation of CROP_ANIMATIONS) rive.stop(animation);
		};
		const syncCropState = () => {
			stopCropMotion();
			const animation = CROP_STATE_ANIMATIONS[model.bedOneState];
			rive.scrub(animation, 0);
			rive.pause(animation);
			setCropMotion(
				reduceMotion
					? "reduced"
					: model.bedOneState === "ready"
						? "ready"
						: model.bedOneState === "empty"
							? "empty"
							: "growing",
			);
		};

		clearTimers();
		stopCropMotion();

		const isNewTrigger = lastCropTriggerNonce.current !== triggerNonce;
		const previousState = previousBedOneState.current;
		lastCropTriggerNonce.current = triggerNonce;
		previousBedOneState.current = model.bedOneState;

		if (reduceMotion) {
			syncCropState();
			return clearTimers;
		}

		if (isNewTrigger && trigger === "plant") {
			rive.play(CROP_ACTION_ANIMATIONS.plant);
			setCropMotion("plant");
			schedule(syncCropState, 560);
		} else if (isNewTrigger && trigger === "harvest") {
			rive.play(CROP_ACTION_ANIMATIONS.harvest);
			setCropMotion("harvest");
			schedule(syncCropState, 560);
		} else if (previousState !== "ready" && model.bedOneState === "ready") {
			rive.play(CROP_ACTION_ANIMATIONS.flourish);
			setCropMotion("flourish");
			schedule(syncCropState, 720);
		} else {
			syncCropState();
		}

		return () => {
			clearTimers();
			stopCropMotion();
		};
	}, [model.bedOneState, reduceMotion, rive, trigger, triggerNonce]);

	useEffect(() => {
		if (!rive || !HOMEGROWN_RIVE_ASSET_AUTHORED) return;

		const clearTimers = () => {
			for (const timer of homeTimers.current) clearTimeout(timer);
			homeTimers.current.clear();
		};
		const schedule = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => {
				homeTimers.current.delete(timer);
				callback();
			}, delay);
			homeTimers.current.add(timer);
		};
		const stopHomeMotion = () => {
			for (const animation of HOME_ANIMATIONS) rive.stop(animation);
		};
		const syncHomeState = () => {
			stopHomeMotion();
			const animation = model.hedgeCrossingOpen
				? HOME_STATE_ANIMATIONS.developed
				: HOME_STATE_ANIMATIONS.hidden;
			rive.scrub(animation, 0);
			rive.pause(animation);
			setHomeMotion(
				reduceMotion ? "reduced" : model.hedgeCrossingOpen ? "developed" : "hidden",
			);
		};

		clearTimers();
		stopHomeMotion();

		const wasDeveloped = previousHomeDeveloped.current;
		previousHomeDeveloped.current = model.hedgeCrossingOpen;

		if (reduceMotion) {
			syncHomeState();
			return clearTimers;
		}

		if (!wasDeveloped && model.hedgeCrossingOpen) {
			rive.play(HOME_FLOURISH_ANIMATION);
			setHomeMotion("flourish");
			schedule(syncHomeState, 780);
		} else {
			syncHomeState();
		}

		return () => {
			clearTimers();
			stopHomeMotion();
		};
	}, [model.hedgeCrossingOpen, reduceMotion, rive]);

	useEffect(() => {
		if (!rive || !HOMEGROWN_RIVE_ASSET_AUTHORED) return;

		const clearTimers = () => {
			for (const timer of moonberryTimers.current) clearTimeout(timer);
			moonberryTimers.current.clear();
		};
		const schedule = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => {
				moonberryTimers.current.delete(timer);
				callback();
			}, delay);
			moonberryTimers.current.add(timer);
		};
		const stopMoonberryMotion = () => {
			for (const animation of MOONBERRY_ANIMATIONS) rive.stop(animation);
		};
		const syncMoonberryState = () => {
			stopMoonberryMotion();
			const animation = MOONBERRY_STATE_ANIMATIONS[model.bedTwoState];
			rive.scrub(animation, 0);
			rive.pause(animation);
			setMoonberryMotion(
				reduceMotion
					? "reduced"
					: model.bedTwoState === "empty"
						? "empty"
						: "growing",
			);
		};

		clearTimers();
		stopMoonberryMotion();

		const previousState = previousBedTwoState.current;
		previousBedTwoState.current = model.bedTwoState;

		if (reduceMotion) {
			syncMoonberryState();
			return clearTimers;
		}

		if (previousState === "empty" && model.bedTwoState === "growing") {
			rive.play(MOONBERRY_PLANT_ANIMATION);
			setMoonberryMotion("plant");
			schedule(syncMoonberryState, 760);
		} else {
			syncMoonberryState();
		}

		return () => {
			clearTimers();
			stopMoonberryMotion();
		};
	}, [model.bedTwoState, reduceMotion, rive]);

	useEffect(() => {
		if (!rive || !HOMEGROWN_RIVE_ASSET_AUTHORED) return;

		const clearTimers = () => {
			for (const timer of mothTimers.current) clearTimeout(timer);
			mothTimers.current.clear();
		};
		const schedule = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => {
				mothTimers.current.delete(timer);
				callback();
			}, delay);
			mothTimers.current.add(timer);
		};
		const stopMothMotion = () => {
			for (const animation of MOTH_ANIMATIONS) rive.stop(animation);
		};
		const syncMothState = () => {
			stopMothMotion();
			const animation = model.mothsVisible
				? MOTH_STATE_ANIMATIONS.present
				: MOTH_STATE_ANIMATIONS.hidden;
			rive.scrub(animation, 0);
			rive.pause(animation);
			setMothMotion(
				reduceMotion ? "reduced" : model.mothsVisible ? "present" : "hidden",
			);
		};
		const startMothRest = () => {
			if (reduceMotion || !model.mothsVisible) return;
			rive.stop(MOTH_REST_ANIMATION);
			rive.play(MOTH_REST_ANIMATION);
			setMothMotion("resting");
			schedule(() => {
				rive.stop(MOTH_REST_ANIMATION);
				rive.scrub(MOTH_STATE_ANIMATIONS.present, 0);
				rive.pause(MOTH_STATE_ANIMATIONS.present);
				setMothMotion("present");
				schedule(startMothRest, 2_250);
			}, 560);
		};
		const settleAndRest = () => {
			syncMothState();
			if (model.mothsVisible) schedule(startMothRest, 650);
		};

		clearTimers();
		stopMothMotion();

		const wasVisible = previousMothsVisible.current;
		previousMothsVisible.current = model.mothsVisible;
		const isNewTrigger = lastMothTriggerNonce.current !== triggerNonce;
		lastMothTriggerNonce.current = triggerNonce;

		if (reduceMotion) {
			syncMothState();
			return clearTimers;
		}

		if (!wasVisible && model.mothsVisible) {
			rive.play(MOTH_ARRIVE_ANIMATION);
			setMothMotion("arrive");
			schedule(settleAndRest, 900);
		} else if (
			isNewTrigger &&
			latestMothTrigger.current === "tickle" &&
			model.mothsVisible
		) {
			// The resident answers Rosie's laugh immediately, then returns to the
			// reducer-owned Present pose before its independent rest cadence resumes.
			rive.play(MOTH_LAUGH_ANIMATION);
			setMothMotion("laugh");
			schedule(settleAndRest, 600);
		} else {
			settleAndRest();
		}

		return () => {
			clearTimers();
			stopMothMotion();
		};
	}, [model.mothsVisible, reduceMotion, rive, triggerNonce]);

	return (
		<div
			className={`homegrown-rive-scene ${HOMEGROWN_RIVE_ASSET_AUTHORED ? "authored" : "probe"}`}
			data-rive-status={status}
			data-rive-motion={motion}
			data-rive-crop-motion={cropMotion}
			data-rive-bed-one={model.bedOneState}
			data-rive-home-motion={homeMotion}
			data-rive-home-developed={model.hedgeCrossingOpen}
			data-rive-bed-two={model.bedTwoState}
			data-rive-moonberry-motion={moonberryMotion}
			data-rive-moths-visible={model.mothsVisible}
			data-rive-moth-motion={mothMotion}
			data-rive-asset={HOMEGROWN_RIVE_ASSET_AUTHORED ? "authored" : "official-probe"}
			aria-hidden="true"
		>
			<RiveComponent aria-label="" />
		</div>
	);
}

export const HomegrownRiveScene = memo(HomegrownRiveSceneImpl);
