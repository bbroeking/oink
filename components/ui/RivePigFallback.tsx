import React from "react";
import { SpritePig } from "./SpritePig";
import {
	resolvePigAnimation,
	type PigRendererProps,
} from "./pigRendererContract";

export interface RivePigProps extends PigRendererProps {
	source: number;
	skinSource?: number;
	artboardName?: string;
	stateMachineName?: string;
}

/**
 * Web-safe renderer until the authored pig.riv and web runtime adapter exist.
 * It preserves the renderer-neutral contract and displays the raster pig
 * immediately instead of evaluating native Rive code.
 */
export function RivePig({
	animation,
	mood,
	pigId,
	size,
	style,
	onComplete,
	onFrame,
}: RivePigProps) {
	return (
		<SpritePig
			animation={resolvePigAnimation(animation, mood)}
			pigId={pigId}
			size={size}
			style={style}
			onComplete={onComplete}
			onFrame={onFrame}
		/>
	);
}
