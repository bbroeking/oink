import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, type ViewStyle } from "react-native";
import Rive, {
	Alignment,
	Fit,
	type RiveRef,
	type RNRiveError,
} from "rive-react-native";
import { SpritePig } from "./SpritePig";
import {
	RIVE_PIG_ANIMATION_COMMANDS,
	RIVE_PIG_ARTBOARD,
	RIVE_PIG_INPUTS,
	RIVE_PIG_SKIN_ASSET,
	RIVE_PIG_STATE_MACHINE,
	resolveRivePigEquipment,
	rivePigSkinIndex,
	rivePigSkinSource,
} from "./rivePigContract";
import {
	PIG_ANIMATION_SPECS,
	pigAnimationDurationMs,
	resolvePigAnimation,
	type PigRendererProps,
} from "./pigRendererContract";
import { recordRivePigRendererFailure } from "@/utils/rivePigRollout";

export interface RivePigProps extends PigRendererProps {
	source: number;
	skinSource?: number;
	artboardName?: string;
	stateMachineName?: string;
}

/**
 * Renderer-compatible Rive pig. The raster pig is mounted immediately if the
 * native view or authored contract fails, so opting into the spike can never
 * strand the homepage without a character.
 */
export function RivePig({
	source,
	skinSource,
	animation,
	mood,
	pigId = "rosie",
	equipment,
	size = 300,
	style,
	onComplete,
	onFrame,
	artboardName = RIVE_PIG_ARTBOARD,
	stateMachineName = RIVE_PIG_STATE_MACHINE,
	onRendererReady,
	onRendererError,
	reduceMotion = false,
}: RivePigProps) {
	const riveRef = useRef<RiveRef>(null);
	// The native Rive view is keyed by source + pig so changing coat remounts it
	// and replaces the referenced `pig_skin` asset. A boolean ready flag would
	// stay true across that child remount, causing the fresh native instance to
	// miss the current skin/equipment/animation inputs. Increment on every
	// native onPlay so the complete contract is replayed for every instance.
	const [playRevision, setPlayRevision] = useState(0);
	const [failed, setFailed] = useState(false);
	const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const completeRef = useRef(onComplete);
	const frameRef = useRef(onFrame);
	const readyRef = useRef(onRendererReady);
	const errorRef = useRef(onRendererError);
	completeRef.current = onComplete;
	frameRef.current = onFrame;
	readyRef.current = onRendererReady;
	errorRef.current = onRendererError;
	const effectiveAnimation = resolvePigAnimation(animation, mood);
	const resolvedEquipment = useMemo(
		() => resolveRivePigEquipment(equipment ?? {}),
		[equipment],
	);
	const referencedAssets = useMemo(
		() => ({
			[RIVE_PIG_SKIN_ASSET]: {
				source: skinSource ?? rivePigSkinSource(pigId),
			},
		}),
		[pigId, skinSource],
	);

	useEffect(
		() => () => {
			if (completionTimer.current) clearTimeout(completionTimer.current);
		},
		[],
	);

	useEffect(() => {
		if (playRevision === 0 || failed) return;
		riveRef.current?.setInputState(
			stateMachineName,
			RIVE_PIG_INPUTS.skin,
			rivePigSkinIndex(pigId),
		);
	}, [failed, pigId, playRevision, stateMachineName]);

	useEffect(() => {
		if (playRevision === 0 || failed) return;
		riveRef.current?.setInputState(
			stateMachineName,
			RIVE_PIG_INPUTS.hat,
			resolvedEquipment.equipment.hat ?? 0,
		);
		riveRef.current?.setInputState(
			stateMachineName,
			RIVE_PIG_INPUTS.face,
			resolvedEquipment.equipment.face ?? 0,
		);
		riveRef.current?.setInputState(
			stateMachineName,
			RIVE_PIG_INPUTS.held,
			resolvedEquipment.equipment.held ?? 0,
		);
	}, [
		resolvedEquipment.equipment.face,
		resolvedEquipment.equipment.hat,
		resolvedEquipment.equipment.held,
		failed,
		playRevision,
		stateMachineName,
	]);

	useEffect(() => {
		if (playRevision === 0 || failed) return;
		if (completionTimer.current) {
			clearTimeout(completionTimer.current);
			completionTimer.current = null;
		}

		const command = RIVE_PIG_ANIMATION_COMMANDS[effectiveAnimation];
		if (command.kind === "rest") {
			riveRef.current?.setInputState(
				stateMachineName,
				RIVE_PIG_INPUTS.rest,
				command.value,
			);
		} else {
			riveRef.current?.fireState(stateMachineName, command.input);
		}
		frameRef.current?.(0);

		if (!PIG_ANIMATION_SPECS[effectiveAnimation].loop) {
			completionTimer.current = setTimeout(
				() => completeRef.current?.(),
				pigAnimationDurationMs(effectiveAnimation),
			);
		}
	}, [effectiveAnimation, failed, playRevision, stateMachineName]);

	if (failed || reduceMotion || !resolvedEquipment.supported) {
		return (
			<SpritePig
				animation={effectiveAnimation}
				pigId={pigId}
				size={size}
				style={style}
				onComplete={onComplete}
				onFrame={onFrame}
			/>
		);
	}

	return (
		<Rive
			key={`${source}:${pigId}`}
			ref={riveRef}
			source={source}
			referencedAssets={referencedAssets}
			artboardName={artboardName}
			stateMachineName={stateMachineName}
			fit={Fit.Contain}
			alignment={Alignment.Center}
			autoplay
			style={StyleSheet.flatten([
				{ width: size, height: size },
				style,
			]) as ViewStyle}
			onPlay={() => {
				setPlayRevision((revision) => revision + 1);
				readyRef.current?.();
			}}
			onError={(riveError: RNRiveError) => {
				const error = new Error(riveError.message);
				setFailed(true);
				recordRivePigRendererFailure(error, {
					pigId,
					animation: effectiveAnimation,
					platform: Platform.OS,
				});
				errorRef.current?.(error);
			}}
		/>
	);
}
