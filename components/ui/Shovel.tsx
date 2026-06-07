import Svg, { Path, Rect } from "react-native-svg";
import { WHIMSY } from "@/constants/theme";

// A little cartoony shovel — wooden shaft, T-grip, metal spade. Used for the
// barn-visit truffle dig and the bury-a-truffle animation.
export function Shovel({ size = 56 }: { size?: number }) {
	const ink = WHIMSY.ink;
	return (
		<Svg width={size} height={size} viewBox="0 0 64 64">
			{/* spade blade */}
			<Path
				d="M22 37 H42 V46 Q42 59 32 62 Q22 59 22 46 Z"
				fill="#c3ccd4"
				stroke={ink}
				strokeWidth={2.5}
				strokeLinejoin="round"
			/>
			{/* blade midrib */}
			<Path d="M32 39 V57" stroke={ink} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
			{/* wooden shaft */}
			<Rect x={28.5} y={12} width={7} height={27} rx={3} fill="#c98a5e" stroke={ink} strokeWidth={2.5} />
			{/* T-grip */}
			<Rect x={20} y={5} width={24} height={9} rx={4.5} fill="#e0a36e" stroke={ink} strokeWidth={2.5} />
		</Svg>
	);
}
