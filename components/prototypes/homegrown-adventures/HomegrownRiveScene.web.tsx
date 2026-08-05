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
	const { RiveComponent, rive } = useRive({
		src: __HOMEGROWN_RIVE_ASSET_URL__,
		...(HOMEGROWN_RIVE_ASSET_AUTHORED
			? {
				artboard: HOMEGROWN_RIVE_NAMES.artboard,
				stateMachines: HOMEGROWN_RIVE_NAMES.stateMachine,
				autoBind: true,
			}
			: {}),
		autoplay: !reduceMotion,
		layout: new Layout({
			fit: HOMEGROWN_RIVE_ASSET_AUTHORED ? Fit.Cover : Fit.Contain,
			alignment: Alignment.Center,
		}),
		onLoad: () => setStatus("ready"),
		onLoadError: () => setStatus("error"),
	}, {
		useDevicePixelRatio: true,
		shouldResizeCanvasToContainer: true,
	});

	useEffect(() => {
		if (!rive) return;
		if (reduceMotion) rive.pause();
		else rive.play();
	}, [reduceMotion, rive]);

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
	}, [rive, trigger, triggerNonce]);

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
