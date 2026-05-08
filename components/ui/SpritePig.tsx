import React, { useEffect, useRef, useState } from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

const FRAMES: Record<string, number> = {
	idle_1: require("../../assets/images/sprites/rosie/idle_1.png"),
	idle_2: require("../../assets/images/sprites/rosie/idle_2.png"),
	idle_3: require("../../assets/images/sprites/rosie/idle_3.png"),
	idle_4: require("../../assets/images/sprites/rosie/idle_4.png"),
	sad_1: require("../../assets/images/sprites/rosie/sad_1.png"),
	sad_2: require("../../assets/images/sprites/rosie/sad_2.png"),
	sad_3: require("../../assets/images/sprites/rosie/sad_3.png"),
	sad_4: require("../../assets/images/sprites/rosie/sad_4.png"),
	walk_1: require("../../assets/images/sprites/rosie/walk_1.png"),
	walk_2: require("../../assets/images/sprites/rosie/walk_2.png"),
	walk_3: require("../../assets/images/sprites/rosie/walk_3.png"),
	walk_4: require("../../assets/images/sprites/rosie/walk_4.png"),
	jump_1: require("../../assets/images/sprites/rosie/jump_1.png"),
	jump_2: require("../../assets/images/sprites/rosie/jump_2.png"),
	jump_3: require("../../assets/images/sprites/rosie/jump_3.png"),
	jump_4: require("../../assets/images/sprites/rosie/jump_4.png"),
	surprise_1: require("../../assets/images/sprites/rosie/surprise_1.png"),
	surprise_2: require("../../assets/images/sprites/rosie/surprise_2.png"),
	surprise_3: require("../../assets/images/sprites/rosie/surprise_3.png"),
	surprise_4: require("../../assets/images/sprites/rosie/surprise_4.png"),
	arms_up_1: require("../../assets/images/sprites/rosie/arms_up_1.png"),
	arms_up_2: require("../../assets/images/sprites/rosie/arms_up_2.png"),
	arms_up_3: require("../../assets/images/sprites/rosie/arms_up_3.png"),
	arms_up_4: require("../../assets/images/sprites/rosie/arms_up_4.png"),
	happy_1: require("../../assets/images/sprites/rosie/happy_1.png"),
	happy_2: require("../../assets/images/sprites/rosie/happy_2.png"),
	happy_3: require("../../assets/images/sprites/rosie/happy_3.png"),
	happy_4: require("../../assets/images/sprites/rosie/happy_4.png"),
	wave: require("../../assets/images/sprites/rosie/wave.png"),
};

export type PigAnimation =
	| "idle"
	| "walk"
	| "jump"
	| "bounce"
	| "happy"
	| "sad"
	| "surprise"
	| "wave"
	| "arms_up";

interface AnimationConfig {
	frames: string[];
	fps: number;
	loop: boolean;
}

const ANIMATIONS: Record<PigAnimation, AnimationConfig> = {
	idle: { frames: ["idle_1", "idle_2", "idle_3", "idle_4"], fps: 2.5, loop: true },
	walk: { frames: ["walk_1", "walk_2", "walk_3", "walk_4"], fps: 4, loop: true },
	jump: { frames: ["jump_1", "jump_2", "jump_3", "jump_4"], fps: 6, loop: false },
	// Looping version of the jump frames, slower — for ambient bouncy idle.
	bounce: { frames: ["jump_1", "jump_2", "jump_3", "jump_4"], fps: 3, loop: true },
	happy: { frames: ["happy_1", "happy_2", "happy_3", "happy_4"], fps: 4, loop: true },
	sad: { frames: ["sad_1", "sad_2", "sad_3", "sad_4"], fps: 3, loop: true },
	surprise: {
		frames: ["surprise_1", "surprise_2", "surprise_3", "surprise_4"],
		fps: 6,
		loop: false,
	},
	wave: { frames: ["wave"], fps: 1, loop: true },
	arms_up: {
		frames: ["arms_up_1", "arms_up_2", "arms_up_3", "arms_up_4"],
		fps: 4,
		loop: true,
	},
};

interface Props {
	animation: PigAnimation;
	size?: number;
	style?: StyleProp<ImageStyle>;
	onComplete?: () => void;
	onFrame?: (idx: number) => void;
	// Optional per-animation override that swaps in a different frame set.
	// Used by the pre-baked accessory path so equipping a legendary item
	// can replace the default pig frames with bespoke "pig wearing X" art.
	customFrames?: Partial<Record<PigAnimation, string[]>>;
}

export function SpritePig({
	animation,
	size = 300,
	style,
	onComplete,
	onFrame,
	customFrames,
}: Props) {
	const [idx, setIdx] = useState(0);
	const completeRef = useRef(onComplete);
	completeRef.current = onComplete;
	const frameRef = useRef(onFrame);
	frameRef.current = onFrame;

	// Resolve which frame set + fps to use. customFrames (from prebaked
	// items) overrides the default ANIMATIONS entry per animation key.
	const baseCfg = ANIMATIONS[animation];
	const overrideFrames = customFrames?.[animation];
	const activeFrames = overrideFrames ?? baseCfg.frames;
	const activeCfg = {
		...baseCfg,
		frames: activeFrames,
	};

	useEffect(() => {
		setIdx(0);
		const cfg = activeCfg;
		if (cfg.frames.length <= 1) return;
		const period = 1000 / cfg.fps;
		const handle = setInterval(() => {
			setIdx((prev) => {
				const next = prev + 1;
				if (next >= cfg.frames.length) {
					if (cfg.loop) return 0;
					clearInterval(handle);
					setTimeout(() => completeRef.current?.(), 0);
					return prev;
				}
				return next;
			});
		}, period);
		return () => clearInterval(handle);
	}, [animation]);

	// Fire onFrame after commit — never inside the setIdx updater (React forbids
	// side effects in state updaters as of React 18).
	useEffect(() => {
		frameRef.current?.(idx);
	}, [idx]);

	const key = activeFrames[Math.min(idx, activeFrames.length - 1)];
	return (
		<Image
			source={FRAMES[key]}
			style={[{ width: size, height: size }, style]}
			resizeMode="contain"
		/>
	);
}
