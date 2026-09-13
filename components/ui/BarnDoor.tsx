import Svg, { Path, Rect } from "react-native-svg";
import { WHIMSY } from "@/constants/theme";

// The barn door, as the face of the Barn button: two leaves with the X brace,
// the right leaf swung open onto a dark doorway, and a little arrow going in.
// Ink-outline sticker art like `Shovel` — the two are the button's two faces
// (door when the patch is shut, shovel while it is open), so they share a
// stroke weight and a viewBox. From `docs/design/claude-design/barn/
// action-button.html`, verbatim. (2026-09-13)
export function BarnDoor({ size = 40 }: { size?: number }) {
	const ink = WHIMSY.ink;
	return (
		<Svg width={size} height={size} viewBox="0 0 64 64">
			{/* the gable wall */}
			<Path
				d="M8 26 L32 8 L56 26 V58 H8 Z"
				fill={WALL}
				stroke={ink}
				strokeWidth={3}
				strokeLinejoin="round"
			/>
			{/* the closed left leaf, with its brace */}
			<Rect x={16} y={30} width={16} height={28} fill={LEAF} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
			<Path d="M16 30 L32 58 M32 30 L16 58" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
			{/* the open right leaf: the doorway, dark */}
			<Rect x={32} y={30} width={16} height={28} fill={WHIMSY.bark} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
			{/* the arrow going in */}
			<Path
				d="M36 44 H48 M44 39 L49 44 L44 49"
				fill="none"
				stroke={WHIMSY.cream}
				strokeWidth={3}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Svg>
	);
}

// Art fills, not UI tokens: the sun-bleached wall and the red leaf are the same
// two paints the exterior barn sprite wears.
const WALL = "#e8b4a0";
const LEAF = "#c25a3f";
