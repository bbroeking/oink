import React, { useState } from "react";
import { SpritePig } from "./SpritePig";
import { resolvePigAnimation, type PigRendererProps, type PigAnimation } from "./pigRendererContract";

/** Preserves the same mood/reaction semantics when an appearance needs sprites. */
export function RasterPig({ reaction, animation, mood, onComplete, ...props }: PigRendererProps & {
	customFrames?: Partial<Record<PigAnimation, string[]>>;
	skinTintOverride?: string | null;
}) {
	const [finished, setFinished] = useState<number | null>(null);
	const current = reaction && reaction.id !== finished ? reaction : null;
	return <SpritePig
		{...props}
		animation={current?.kind ?? resolvePigAnimation(animation, mood)}
		playbackKey={current?.id}
		playOnce={!!current}
		onComplete={() => {
			if (current) setFinished(current.id);
			onComplete?.();
		}}
	/>;
}
