import { Alignment, Fit, Layout, useRive } from "@rive-app/react-webgl2";
import { memo, useEffect, useRef, useState } from "react";

declare const __LANTERNLEAF_RIVE_ASSET_URL__: string;

const ARTBOARD = "Lanternleaf Reflections";
const REFLECTION_PULSE = "Lanternleaf Reflection Pulse";
const PEAK_SECONDS = 15 / 60;
const RESTING_SECONDS = 32 / 60;
const RISE_MS = 280;
const HOLD_MS = 720;
const FALL_MS = 320;
const REST_MS = 2_350;

type ReflectionMotion =
	| "loading"
	| "waiting"
	| "rising"
	| "glowing"
	| "fading"
	| "resting"
	| "reduced";

interface LanternleafReflectionsRiveProps {
	active: boolean;
	reduceMotion: boolean;
}

/**
 * A dedicated composited Rive layer aligned to the Lanternleaf plate. React
 * decides when this route exists; Rive owns only the quiet reflected-light cue.
 */
function LanternleafReflectionsRiveImpl({
	active,
	reduceMotion,
}: LanternleafReflectionsRiveProps) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [motion, setMotion] = useState<ReflectionMotion>("loading");
	const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const { RiveComponent, rive } = useRive({
		src: __LANTERNLEAF_RIVE_ASSET_URL__,
		artboard: ARTBOARD,
		autoplay: false,
		layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
		onLoad: () => setStatus("ready"),
		onLoadError: () => setStatus("error"),
	}, {
		useDevicePixelRatio: true,
		useOffscreenRenderer: true,
		shouldResizeCanvasToContainer: true,
	});

	useEffect(() => {
		if (!rive) return;

		const clearTimers = () => {
			for (const timer of timers.current) clearTimeout(timer);
			timers.current.clear();
		};
		const schedule = (callback: () => void, delay: number) => {
			const timer = setTimeout(() => {
				timers.current.delete(timer);
				callback();
			}, delay);
			timers.current.add(timer);
		};
		const settle = (nextMotion: ReflectionMotion = "resting") => {
			rive.scrub(REFLECTION_PULSE, RESTING_SECONDS);
			rive.pause(REFLECTION_PULSE);
			setMotion(nextMotion);
		};
		const reflect = () => {
			if (reduceMotion) return;
			rive.stop(REFLECTION_PULSE);
			rive.play(REFLECTION_PULSE);
			rive.scrub(REFLECTION_PULSE, 0);
			setMotion("rising");
			schedule(() => {
				rive.scrub(REFLECTION_PULSE, PEAK_SECONDS);
				rive.pause(REFLECTION_PULSE);
				setMotion("glowing");
				schedule(() => {
					rive.play(REFLECTION_PULSE);
					rive.scrub(REFLECTION_PULSE, PEAK_SECONDS);
					setMotion("fading");
					schedule(() => {
						settle();
						schedule(reflect, REST_MS);
					}, FALL_MS);
				}, HOLD_MS);
			}, RISE_MS);
		};

		clearTimers();
		rive.stop(REFLECTION_PULSE);

		if (!active) {
			rive.play(REFLECTION_PULSE);
			rive.scrub(REFLECTION_PULSE, RESTING_SECONDS);
			schedule(() => rive.pause(REFLECTION_PULSE), 0);
			setMotion("waiting");
			return clearTimers;
		}

		if (reduceMotion) {
			rive.play(REFLECTION_PULSE);
			rive.scrub(REFLECTION_PULSE, RESTING_SECONDS);
			schedule(() => rive.pause(REFLECTION_PULSE), 0);
			setMotion("reduced");
			return clearTimers;
		}

		reflect();
		return () => {
			clearTimers();
			rive.stop(REFLECTION_PULSE);
		};
	}, [active, reduceMotion, rive]);

	return (
		<div
			className="lanternleaf-reflections-rive"
			data-rive-animation-names={rive?.animationNames.join("|") ?? ""}
			data-rive-lanternleaf-motion={motion}
			data-rive-status={status}
			aria-hidden="true"
		>
			<RiveComponent aria-label="" />
		</div>
	);
}

export const LanternleafReflectionsRive = memo(LanternleafReflectionsRiveImpl);
