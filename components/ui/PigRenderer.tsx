import React from "react";
import { RasterPig } from "./RasterPig";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { usePigActive } from "@/hooks/usePigActive";
import {
	resolvePigAnimation,
	type PigAnimation,
	type PigRendererProps,
} from "./pigRendererContract";
import { resolveRivePigEquipment } from "./rivePigContract";
import { useRivePigRolloutEnabled } from "@/utils/rivePigRollout";

export type PigRendererKind = "raster" | "rive";

export interface PigRendererComponentProps extends PigRendererProps {
	renderer?: PigRendererKind;
	riveSource?: number;
	customFrames?: Partial<Record<PigAnimation, string[]>>;
	skinTintOverride?: string | null;
	rolloutEnabled?: boolean;
	/** A worn full costume's skin (utils/costumeFit.ts): its frames replace the
	 *  pig's own, pose for pose. Raster only; the Rive rig has no skins. */
	costumeSkin?: Readonly<Record<string, number>> | null;
}

export interface PigRendererDecision {
	renderer?: PigRendererKind;
	riveSource?: number;
	hasCustomFrames?: boolean;
	frameIdx?: number;
	skinTintOverride?: string | null;
	rolloutEnabled?: boolean;
	reduceMotion?: boolean;
	equipmentSupported?: boolean;
}

export function shouldUseRiveRenderer({
	renderer = "raster",
	riveSource,
	hasCustomFrames = false,
	frameIdx,
	skinTintOverride,
	rolloutEnabled = false,
	reduceMotion = false,
	equipmentSupported = true,
}: PigRendererDecision): boolean {
	return (
		renderer === "rive" &&
		riveSource !== undefined &&
		rolloutEnabled &&
		!reduceMotion &&
		equipmentSupported &&
		!hasCustomFrames &&
		frameIdx === undefined &&
		skinTintOverride == null
	);
}

/**
 * Single renderer seam for homepage and preview surfaces. Raster is the
 * default, and any unsupported raster-only feature keeps the call on raster.
 */
export function PigRenderer({
	renderer = "raster",
	riveSource,
	customFrames,
	frameIdx,
	skinTintOverride,
	rolloutEnabled,
	costumeSkin,
	...props
}: PigRendererComponentProps) {
	const persistedRolloutEnabled = useRivePigRolloutEnabled();
	const motion = useMotionPolicy();
	const reduceMotion = props.reduceMotion ?? motion.reduceMotion;
	const active = usePigActive(props.active);
	const resolvedEquipment = resolveRivePigEquipment(props.equipment ?? {});
	const effectiveAnimation = resolvePigAnimation(props.animation, props.mood);
	const useRive = !costumeSkin && shouldUseRiveRenderer({
		renderer,
		riveSource,
		hasCustomFrames: customFrames !== undefined,
		frameIdx,
		skinTintOverride,
		rolloutEnabled: rolloutEnabled ?? persistedRolloutEnabled,
		reduceMotion,
		equipmentSupported: resolvedEquipment.supported,
	});

	if (!useRive) {
		return (
			<RasterPig
				{...props}
				reduceMotion={reduceMotion}
				active={active}
				animation={effectiveAnimation}
				customFrames={customFrames}
				frameIdx={frameIdx}
				skinTintOverride={skinTintOverride}
				costumeSkin={costumeSkin}
			/>
		);
	}

	// Keep the native Rive module out of the default raster module path. This is
	// also important for renderer-only Jest tests and older development clients.
	const { RivePig } = require("./RivePig") as typeof import("./RivePig");
	return (
		<RivePig
			{...props}
			reduceMotion={reduceMotion}
			active={active}
			animation={effectiveAnimation}
			source={riveSource!}
		/>
	);
}
