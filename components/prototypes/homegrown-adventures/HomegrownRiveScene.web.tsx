import { Alignment, Fit, Layout, useRive } from "@rive-app/react-webgl2";
import { memo, useEffect } from "react";

export interface HomegrownRiveSceneProps {
	reduceMotion: boolean;
}

/**
 * Stable web-only runtime boundary. The checked-in file is an official runtime
 * probe, not the missing Rosie scene; the UI labels it honestly. Replacing the
 * src with homegrown-adventures.riv is the only asset handoff this wrapper needs.
 */
function HomegrownRiveSceneImpl({ reduceMotion }: HomegrownRiveSceneProps) {
	const { RiveComponent, rive } = useRive({
		src: "./assets/rive/runtime-sample.riv",
		autoplay: !reduceMotion,
		layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
	});

	useEffect(() => {
		if (!rive) return;
		if (reduceMotion) rive.pause();
		else rive.play();
	}, [reduceMotion, rive]);

	return (
		<div className="rive-runtime-probe" aria-label="Rive WebGL2 runtime test">
			<RiveComponent />
		</div>
	);
}

export const HomegrownRiveScene = memo(HomegrownRiveSceneImpl);
