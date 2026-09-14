// The resting pose a surface asks of every pig inside it. A room
// (HabitatScene) provides "sit"; everywhere else pigs stand, so the Exterior's
// tickle idle is untouched. PigStage reads it through
// `resolveRestingAnimation` — the pose only replaces a standing idle, never a
// mood or a reaction. Context rather than a prop because the Barn builds the
// pig presentation once and the Habitat bridge carries that same element into
// the room: the room, not the builder, knows the pig should sit.
import React, { createContext, useContext, type ReactNode } from "react";
import type { PigRestingPose } from "./pigRendererContract";

const PigRestingPoseContext = createContext<PigRestingPose>("stand");

export function PigRestingPoseProvider({
	pose,
	children,
}: {
	pose: PigRestingPose;
	children: ReactNode;
}) {
	return (
		<PigRestingPoseContext.Provider value={pose}>
			{children}
		</PigRestingPoseContext.Provider>
	);
}

export function usePigRestingPose(): PigRestingPose {
	return useContext(PigRestingPoseContext);
}

// How fast a pig rests here, as a multiplier on the rest loops' fps and the
// breath (1 = the Exterior's tempo). A surface declares it once at its root —
// the Barn declares PIG_BARN_REST_TEMPO — and every pig staged inside, host or
// visitor, sitting or standing, rests at that pace. Reactions are not scaled.
const PigRestTempoContext = createContext<number>(1);

export function PigRestTempoProvider({
	tempo,
	children,
}: {
	tempo: number;
	children: ReactNode;
}) {
	return (
		<PigRestTempoContext.Provider value={tempo}>
			{children}
		</PigRestTempoContext.Provider>
	);
}

export function usePigRestTempo(): number {
	return useContext(PigRestTempoContext);
}
