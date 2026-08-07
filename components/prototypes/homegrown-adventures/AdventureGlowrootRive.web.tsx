import { Alignment, Fit, Layout, useRive } from "@rive-app/react-webgl2";
import { memo, useEffect, useRef, useState } from "react";
import {
	HOMEGROWN_RIVE_ASSET_AUTHORED,
} from "./HomegrownRiveScene.web";
import { HOMEGROWN_RIVE_NAMES } from "./homegrownRiveContract";

declare const __HOMEGROWN_RIVE_ASSET_URL__: string;

const GLOWROOT_FLOURISH = "Glowroot Home Flourish";
const FLOURISH_SETTLE_SECONDS = 47 / 60;
const GLOW_BREATH_START_SECONDS = 31 / 60;
const REVEAL_MS = 780;
const GLOW_BREATH_MS = 260;
const GLOW_REST_MS = 2_350;

type GlowrootMotion = "loading" | "reveal" | "resting" | "glow" | "reduced";

interface AdventureGlowrootRiveProps {
	reduceMotion: boolean;
}

/**
 * A clipped second view of the existing native Glowroot rig. React decides
 * whether this component exists; Rive owns only its reveal and quiet glow.
 */
function AdventureGlowrootRiveImpl({ reduceMotion }: AdventureGlowrootRiveProps) {
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [motion, setMotion] = useState<GlowrootMotion>("loading");
	const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
	const { RiveComponent, rive } = useRive({
		src: __HOMEGROWN_RIVE_ASSET_URL__,
		...(HOMEGROWN_RIVE_ASSET_AUTHORED
			? { artboard: HOMEGROWN_RIVE_NAMES.artboard }
			: {}),
		autoplay: false,
		layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
		onLoad: () => setStatus("ready"),
		onLoadError: () => setStatus("error"),
	}, {
		useDevicePixelRatio: true,
		// Share the renderer with the persistent Farm canvas. Unmounting this
		// temporary view must not tear down a context still used by the main scene.
		useOffscreenRenderer: true,
		shouldResizeCanvasToContainer: true,
	});

	useEffect(() => {
		if (!rive || !HOMEGROWN_RIVE_ASSET_AUTHORED) return;

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
		const settle = (nextMotion: GlowrootMotion = "resting") => {
			rive.scrub(GLOWROOT_FLOURISH, FLOURISH_SETTLE_SECONDS);
			rive.pause(GLOWROOT_FLOURISH);
			setMotion(nextMotion);
		};
		const breathe = () => {
			if (reduceMotion) return;
			rive.scrub(GLOWROOT_FLOURISH, GLOW_BREATH_START_SECONDS);
			rive.play(GLOWROOT_FLOURISH);
			setMotion("glow");
			schedule(() => {
				settle();
				schedule(breathe, GLOW_REST_MS);
			}, GLOW_BREATH_MS);
		};

		clearTimers();
		rive.stop(GLOWROOT_FLOURISH);

		if (reduceMotion) {
			// Starting the nested vector timeline before scrubbing makes the final
			// silhouette paint atomically in WebGL2 without exposing motion.
			rive.play(GLOWROOT_FLOURISH);
			rive.scrub(GLOWROOT_FLOURISH, FLOURISH_SETTLE_SECONDS);
			schedule(() => rive.pause(GLOWROOT_FLOURISH), 0);
			setMotion("reduced");
			return clearTimers;
		}

		rive.play(GLOWROOT_FLOURISH);
		setMotion("reveal");
		schedule(() => {
			settle();
			schedule(breathe, GLOW_REST_MS);
		}, REVEAL_MS);

		return () => {
			clearTimers();
			rive.stop(GLOWROOT_FLOURISH);
		};
	}, [reduceMotion, rive]);

	return (
		<div
			className="adventure-glowroot-rive"
			data-rive-glowroot-motion={motion}
			data-rive-status={status}
			aria-hidden="true"
		>
			<div className="adventure-glowroot-rive-stage">
				<RiveComponent aria-label="" />
			</div>
		</div>
	);
}

export const AdventureGlowrootRive = memo(AdventureGlowrootRiveImpl);
