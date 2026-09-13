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
