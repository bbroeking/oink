import React, { useEffect, useRef, useState } from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

const FRAMES: Record<string, number> = {
	idle_1: require("../../assets/images/sprites/rosie/idle_1.png"),
	idle_2: require("../../assets/images/sprites/rosie/idle_2.png"),
	idle_3: require("../../assets/images/sprites/rosie/idle_3.png"),
	idle_4: require("../../assets/images/sprites/rosie/idle_4.png"),
	walk_1: require("../../assets/images/sprites/rosie/walk_1.png"),
	walk_2: require("../../assets/images/sprites/rosie/walk_2.png"),
	walk_3: require("../../assets/images/sprites/rosie/walk_3.png"),
	walk_4: require("../../assets/images/sprites/rosie/walk_4.png"),
	jump_1: require("../../assets/images/sprites/rosie/jump_1.png"),
	jump_2: require("../../assets/images/sprites/rosie/jump_2.png"),
	jump_3: require("../../assets/images/sprites/rosie/jump_3.png"),
	jump_4: require("../../assets/images/sprites/rosie/jump_4.png"),
	happy: require("../../assets/images/sprites/rosie/happy.png"),
	sad: require("../../assets/images/sprites/rosie/sad.png"),
	surprise: require("../../assets/images/sprites/rosie/surprise.png"),
	wave: require("../../assets/images/sprites/rosie/wave.png"),
	arms_up_happy: require("../../assets/images/sprites/rosie/arms_up_happy.png"),
	arms_up_cheer: require("../../assets/images/sprites/rosie/arms_up_cheer.png"),
	arms_up_surprise: require("../../assets/images/sprites/rosie/arms_up_surprise.png"),
	arms_up_excited: require("../../assets/images/sprites/rosie/arms_up_excited.png"),
};

export type PigAnimation =
	| "idle"
	| "walk"
	| "jump"
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
	idle: { frames: ["idle_1", "idle_2", "idle_3", "idle_4"], fps: 5, loop: true },
	walk: { frames: ["walk_1", "walk_2", "walk_3", "walk_4"], fps: 9, loop: true },
	jump: { frames: ["jump_1", "jump_2", "jump_3", "jump_4"], fps: 12, loop: false },
	happy: { frames: ["happy"], fps: 1, loop: true },
	sad: { frames: ["sad"], fps: 1, loop: true },
	surprise: { frames: ["surprise"], fps: 1, loop: true },
	wave: { frames: ["wave"], fps: 1, loop: true },
	arms_up: {
		frames: [
			"arms_up_happy",
			"arms_up_cheer",
			"arms_up_surprise",
			"arms_up_excited",
		],
		fps: 7,
		loop: true,
	},
};

interface Props {
	animation: PigAnimation;
	size?: number;
	style?: StyleProp<ImageStyle>;
	onComplete?: () => void;
	onFrame?: (idx: number) => void;
}

export function SpritePig({
	animation,
	size = 300,
	style,
	onComplete,
	onFrame,
}: Props) {
	const [idx, setIdx] = useState(0);
	const completeRef = useRef(onComplete);
	completeRef.current = onComplete;
	const frameRef = useRef(onFrame);
	frameRef.current = onFrame;

	useEffect(() => {
		setIdx(0);
		frameRef.current?.(0);
		const cfg = ANIMATIONS[animation];
		if (cfg.frames.length <= 1) return;
		const period = 1000 / cfg.fps;
		const handle = setInterval(() => {
			setIdx((prev) => {
				const next = prev + 1;
				if (next >= cfg.frames.length) {
					if (cfg.loop) {
						frameRef.current?.(0);
						return 0;
					}
					clearInterval(handle);
					setTimeout(() => completeRef.current?.(), 0);
					return prev;
				}
				frameRef.current?.(next);
				return next;
			});
		}, period);
		return () => clearInterval(handle);
	}, [animation]);

	const cfg = ANIMATIONS[animation];
	const key = cfg.frames[Math.min(idx, cfg.frames.length - 1)];
	return (
		<Image
			source={FRAMES[key]}
			style={[{ width: size, height: size }, style]}
			resizeMode="contain"
		/>
	);
}
