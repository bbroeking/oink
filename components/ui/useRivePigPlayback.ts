import { useEffect, useLayoutEffect, useRef } from "react";
import { pigMoodAnimation, resolvePigAnimation, type PigReactionKind } from "./pigRendererContract";
import {
	RIVE_PIG_ANIMATION_COMMANDS, RIVE_PIG_INPUTS, RIVE_PIG_REACTION_INPUTS,
	resolveRivePigEquipment, rivePigSkinIndex, type RivePigProps,
} from "./rivePigContract";

export interface PigPlaybackPort {
	number: (name: string, value: number) => void;
	fire: (name: string) => void;
	play: () => void | Promise<void>;
	pause: () => void | Promise<void>;
	onComplete: (listener: () => void) => () => void;
}

/** Platform adapters own instances; the rig owns time and return-to-current-mood. */
export function useRivePigPlayback(port: PigPlaybackPort | null, props: RivePigProps, fail: (error: unknown) => void) {
	const latest = useRef(props);
	const failure = useRef(fail);
	useLayoutEffect(() => { latest.current = props; failure.current = fail; });
	const pending = useRef(false);
	const completed = useRef<number | null>(null);
	const { animation, mood, reaction, pigId = "rosie", active = true } = props;
	const reactionId = reaction?.id;
	const reactionKind = reaction?.kind;
	const equipment = resolveRivePigEquipment(props.equipment ?? {}).equipment;
	const effective = resolvePigAnimation(animation, mood);
	const command = RIVE_PIG_ANIMATION_COMMANDS[effective];
	const rest = RIVE_PIG_ANIMATION_COMMANDS[pigMoodAnimation(mood ?? "content")];
	const restValue = command.kind === "rest" ? command.value : rest.kind === "rest" ? rest.value : 0;
	const activity = command.kind === "activity" ? command.value : 0;
	const implicit = command.kind === "trigger" ? effective as PigReactionKind : null;

	useEffect(() => {
		if (!port) return;
		return port.onComplete(() => {
			if (!pending.current) return;
			pending.current = false;
			completed.current = latest.current.reaction?.id ?? null;
			latest.current.onComplete?.();
		});
	}, [port]);

	// Persistent inputs are independent from reaction identity. A mood change
	// mid-jump changes its destination without restarting the jump or readiness.
	useEffect(() => {
		if (!port) return;
		try {
			port.number(RIVE_PIG_INPUTS.skin, rivePigSkinIndex(pigId));
			port.number(RIVE_PIG_INPUTS.rest, restValue);
			port.number(RIVE_PIG_INPUTS.activity, activity);
			port.number(RIVE_PIG_INPUTS.hat, equipment.hat ?? 0);
			port.number(RIVE_PIG_INPUTS.face, equipment.face ?? 0);
			port.number(RIVE_PIG_INPUTS.held, equipment.held ?? 0);
		} catch (error) { failure.current(error); }
	}, [port, pigId, restValue, activity, equipment.hat, equipment.face, equipment.held]);

	useEffect(() => {
		if (!port) return;
		const kind = reactionKind ?? implicit;
		if (!kind || (reactionId !== undefined && reactionId === completed.current)) return;
		try {
			pending.current = true;
			port.fire(RIVE_PIG_REACTION_INPUTS[kind]);
		} catch (error) { failure.current(error); }
	}, [port, reactionId, reactionKind, implicit]);

	useEffect(() => {
		if (!port) return;
		let mounted = true;
		try {
			Promise.resolve(active ? port.play() : port.pause()).catch((error: unknown) => {
				if (mounted) failure.current(error);
			});
		} catch (error) { failure.current(error); }
		return () => { mounted = false; };
	}, [active, port]);
}
