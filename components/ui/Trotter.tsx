import Svg, { Path } from "react-native-svg";
import { WHIMSY } from "@/constants/theme";

// A pig's trotter, rubbing the mud away — the Rub verb's face in the Snout
// Deep dig. Ink-outline sticker art like `Shovel` and `BarnDoor`: the leg
// comes down from the top, the cloven hoof splits at the bottom, and two
// small arcs to its right are the rub. (2026-09-13)
export function Trotter({ size = 40 }: { size?: number }) {
	const ink = WHIMSY.ink;
	return (
		<Svg width={size} height={size} viewBox="0 0 64 64">
			{/* the leg */}
			<Path
				d="M22 6 H40 V34 Q40 40 36 44 L36 54 Q36 58 32 58 Q28 58 28 54 L28 44 Q22 40 22 34 Z"
				fill={SKIN}
				stroke={ink}
				strokeWidth={3}
				strokeLinejoin="round"
			/>
			{/* the cloven hoof */}
			<Path
				d="M24 44 H40 L42 56 Q42 60 38 60 H26 Q22 60 22 56 Z M32 46 V60"
				fill={HOOF}
				stroke={ink}
				strokeWidth={3}
				strokeLinejoin="round"
			/>
			{/* the rub */}
			<Path
				d="M48 30 Q54 36 48 42 M54 26 Q62 36 54 46"
				fill="none"
				stroke={ink}
				strokeWidth={2.4}
				strokeLinecap="round"
				opacity={0.55}
			/>
		</Svg>
	);
}

// Art fills, not UI tokens: Rosie's skin and the dark hoof she stands on.
const SKIN = "#f8c9d2";
const HOOF = "#6b4a4a";
