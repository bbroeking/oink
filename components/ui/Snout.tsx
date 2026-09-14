import Svg, { Ellipse, Path } from "react-native-svg";
import { WHIMSY } from "@/constants/theme";

// A pig's snout, pressed to the mud and sniffing — the Sniff verb's face in
// the Snout Deep dig. Ink-outline sticker art like `Shovel` and `BarnDoor`:
// one flat fill, two nostrils, three scent lines rising off the top. Same
// stroke weight and viewBox as its two siblings so the verb bar reads as one
// family. (2026-09-13)
export function Snout({ size = 40 }: { size?: number }) {
	const ink = WHIMSY.ink;
	return (
		<Svg width={size} height={size} viewBox="0 0 64 64">
			{/* scent rising */}
			<Path
				d="M20 22 Q16 16 20 10 M32 20 Q28 14 32 8 M44 22 Q40 16 44 10"
				fill="none"
				stroke={ink}
				strokeWidth={2.4}
				strokeLinecap="round"
				opacity={0.55}
			/>
			{/* the snout */}
			<Ellipse cx={32} cy={40} rx={22} ry={15} fill={SNOUT} stroke={ink} strokeWidth={3} />
			<Ellipse cx={23} cy={40} rx={4.5} ry={6} fill={ink} />
			<Ellipse cx={41} cy={40} rx={4.5} ry={6} fill={ink} />
		</Svg>
	);
}

// Art fill, not a UI token: the same pink the pig's own snout wears.
const SNOUT = "#f8a8b3";
