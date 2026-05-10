// PARKED — this file is kept as a reference scaffold for swapping to a
// Rive-rigged pig once you have a `pig.riv` exported from the Rive
// editor. To activate:
//
//   1. Reinstall the runtime:           pnpm add rive-react-native
//   2. Rebuild the iOS dev client:      npx expo run:ios
//      (the package autolinks at boot — without a rebuild, just having
//       it in node_modules crashes the app with a NativeEventEmitter
//       null-arg error)
//   3. Drop pig.riv into:               assets/rive/pig.riv
//   4. Uncomment the imports + body below
//   5. Replace SpritePig with RivePig in components/SwipeElement.tsx
//
// Why it's commented out: importing rive-react-native at module level
// triggers autolinking and crashes the dev client until step 2 is done.
// Leaving the import live blocks the entire app from booting.
//
// All the integration design (slot inputs, customFrames API, animation→
// trigger map) is preserved in the comment block so you don't have to
// re-derive it.

/*
import React, { useEffect, useImperativeHandle, useRef } from "react";
import { StyleProp, ViewStyle, View, Text, StyleSheet } from "react-native";
import Rive, { Fit, Alignment, RiveRef } from "rive-react-native";

// Drop-in replacement for SpritePig. Same animation keys, same `size` prop.
// Backs onto a Rive state machine called "pig" with the inputs documented
// in docs/rive-pig-rigging.md. The PigAnimation type is reused from
// SpritePig so SwipeElement can pass the same prop to either component
// without a generic constraint or branch on the union.
import type { PigAnimation } from "./SpritePig";
export type { PigAnimation };

interface Props {
	animation: PigAnimation;
	size?: number;
	style?: StyleProp<ViewStyle>;
	onComplete?: () => void;
	onFrame?: (idx: number) => void; // unused with Rive; kept for SpritePig API parity
}

const STATE_MACHINE = "pig";

// SpritePig sprite-keys → state-machine inputs we expect to author in Rive.
// Triggers fire one-shots; "sad" is a boolean so it can hold.
const ANIM_TO_INPUT: Record<PigAnimation, { name: string; kind: "trigger" | "boolean" }> = {
	idle: { name: "idle", kind: "trigger" }, // default rest state — firing returns to it
	walk: { name: "walk", kind: "trigger" },
	jump: { name: "jump", kind: "trigger" },
	bounce: { name: "bounce", kind: "trigger" },
	happy: { name: "happy", kind: "trigger" },
	sad: { name: "sad", kind: "boolean" },
	surprise: { name: "surprise", kind: "trigger" },
	wave: { name: "wave", kind: "trigger" },
	arms_up: { name: "arms_up", kind: "trigger" },
};

// Drives the equipped item via state-machine number inputs. A value of 0
// means "no item in this slot". The numeric id mapping lives alongside
// the Rive file (each cosmetic gets a stable index 1..N).
export interface RivePigEquip {
	hat?: number;
	glasses?: number;
	scarf?: number;
	mask?: number;
	necklace?: number;
	bow?: number;
	cape?: number;
	held?: number;
	aura?: number;
	background?: number;
}

export const SLOT_INPUTS = {
	hat: "equip_hat",
	glasses: "equip_glasses",
	scarf: "equip_scarf",
	mask: "equip_mask",
	necklace: "equip_necklace",
	bow: "equip_bow",
	cape: "equip_cape",
	held: "equip_held",
	aura: "equip_aura",
	background: "equip_background",
} as const;

export interface RivePigHandle {
	fire: (anim: PigAnimation) => void;
	setEquip: (equip: RivePigEquip) => void;
}

export const RivePig = React.forwardRef<RivePigHandle, Props>(function RivePig(
	{ animation, size = 300, style, onComplete },
	ref
) {
	const riveRef = useRef<RiveRef>(null);
	const lastTriggerRef = useRef<PigAnimation>("idle");

	useImperativeHandle(ref, () => ({
		fire: (anim: PigAnimation) => {
			const cfg = ANIM_TO_INPUT[anim];
			if (!cfg) return;
			if (cfg.kind === "trigger") {
				riveRef.current?.fireState(STATE_MACHINE, cfg.name);
			}
		},
		setEquip: (equip: RivePigEquip) => {
			for (const [slot, input] of Object.entries(SLOT_INPUTS)) {
				const id = (equip as Record<string, number | undefined>)[slot] ?? 0;
				riveRef.current?.setInputState(STATE_MACHINE, input, id);
			}
		},
	}));

	// Keep the prop-driven animation in sync. Triggers refire on key change;
	// "sad" toggles on/off as a boolean so the rest state can revert cleanly.
	useEffect(() => {
		const cfg = ANIM_TO_INPUT[animation];
		if (!cfg) return;
		if (cfg.kind === "trigger") {
			if (lastTriggerRef.current !== animation) {
				riveRef.current?.fireState(STATE_MACHINE, cfg.name);
				lastTriggerRef.current = animation;
			}
		} else {
			riveRef.current?.setInputState(STATE_MACHINE, cfg.name, true);
		}
		return () => {
			if (cfg.kind === "boolean") {
				riveRef.current?.setInputState(STATE_MACHINE, cfg.name, false);
			}
		};
	}, [animation]);

	// Until the .riv file is committed, fall back to a labeled placeholder so
	// the screen doesn't crash on `require`. Delete this once assets/rive/pig.riv
	// exists and remove the try/catch wrapper.
	let resourceName: string | null = null;
	try {
		require("../../assets/rive/pig.riv");
		resourceName = "pig";
	} catch {
		resourceName = null;
	}

	if (!resourceName) {
		return (
			<View
				style={[
					{
						width: size,
						height: size,
						alignItems: "center",
						justifyContent: "center",
						borderWidth: 2,
						borderColor: "#E8A7B9",
						borderStyle: "dashed",
						borderRadius: 16,
					},
					style,
				]}
			>
				<Text style={{ textAlign: "center", padding: 16, color: "#666" }}>
					RivePig stub{"\n"}drop assets/rive/pig.riv
				</Text>
			</View>
		);
	}

	return (
		<Rive
			ref={riveRef}
			resourceName={resourceName}
			stateMachineName={STATE_MACHINE}
			fit={Fit.Contain}
			alignment={Alignment.Center}
			autoplay
			style={StyleSheet.flatten([{ width: size, height: size }, style]) as ViewStyle}
			onStop={() => onComplete?.()}
		/>
	);
});
*/
