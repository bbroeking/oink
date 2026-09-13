import React from "react";
import { RasterPig } from "./RasterPig";
// The props shape is shared with the native renderer — one declaration lives on
// the Rive contract so the platform split can't drift.
import type { RivePigProps } from "./rivePigContract";

export type { RivePigProps };

/**
 * Web-safe renderer until the authored pig.riv and web runtime adapter exist.
 * It preserves the renderer-neutral contract and displays the raster pig
 * immediately instead of evaluating native Rive code.
 */
export function RivePig(props: RivePigProps) {
	return <RasterPig {...props} />;
}
