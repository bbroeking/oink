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
};

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
	const lastTriggerNonce = useRef(triggerNonce);
	const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
		if (!rive) return;
		if (reduceMotion) rive.pause();
	}, [reduceMotion, rive]);

	useEffect(() => () => {
		if (settleTimer.current) clearTimeout(settleTimer.current);
	}, []);

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
		if (lastTriggerNonce.current === triggerNonce) return;
		lastTriggerNonce.current = triggerNonce;
		if (!trigger) return;
		const property = rive.viewModelInstance?.trigger(trigger);
		if (!property) setStatus("error");
		else property.trigger();

		const animation = AUTHORED_TRIGGER_ANIMATIONS[trigger];
		if (!reduceMotion && animation) {
			// Restarting makes rapid tickles deterministic instead of queueing them.
			if (settleTimer.current) clearTimeout(settleTimer.current);
			rive.stop(animation);
			rive.play(animation);
			settleTimer.current = setTimeout(() => {
				rive.stop(animation);
			}, animation === "Rosie Tickle" ? 700 : 900);
		}
	}, [reduceMotion, rive, trigger, triggerNonce]);

	return (
		<div
			className={`homegrown-rive-scene ${HOMEGROWN_RIVE_ASSET_AUTHORED ? "authored" : "probe"}`}
			data-rive-status={status}
			data-rive-asset={HOMEGROWN_RIVE_ASSET_AUTHORED ? "authored" : "official-probe"}
			aria-hidden="true"
		>
			<RiveComponent aria-label="" />
		</div>
	);
}

export const HomegrownRiveScene = memo(HomegrownRiveSceneImpl);
