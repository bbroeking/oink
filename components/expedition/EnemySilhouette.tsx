import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Circle, Ellipse, G } from "react-native-svg";
import { WHIMSY } from "@/constants/theme";

// Hand-authored ink silhouettes for the four bestiary enemies. Canonically
// correct for the Bestiary (silhouette until met) AND the fight view — the real
// art lands later via ImageGen. Drawn in ink `WHIMSY.ink` (never a raw hex),
// viewBox 0 0 100 100. `defeated` just softens + tips the shape (nothing
// fancier, per the spec).
export type SilhouetteId =
	| "gate_snail"
	| "puddle_toad"
	| "the_bramble"
	| "tollbooth_goose";

function Shape({ id, ink }: { id: SilhouetteId; ink: string }) {
	switch (id) {
		case "gate_snail":
			return (
				<G>
					{/* foot / body */}
					<Path
						d="M6 76 Q6 64 22 63 L58 63 Q70 63 70 72 Q70 80 58 80 L14 80 Q6 80 6 76 Z"
						fill={ink}
					/>
					{/* shell */}
					<Circle cx="52" cy="50" r="24" fill={ink} />
					<Circle cx="52" cy="50" r="13" fill={WHIMSY.paper} />
					<Circle cx="52" cy="50" r="5" fill={ink} />
					{/* eye stalks */}
					<Path d="M14 64 L9 40" stroke={ink} strokeWidth={4} strokeLinecap="round" />
					<Path d="M22 64 L20 42" stroke={ink} strokeWidth={4} strokeLinecap="round" />
					<Circle cx="9" cy="38" r="4" fill={ink} />
					<Circle cx="20" cy="40" r="4" fill={ink} />
				</G>
			);
		case "puddle_toad":
			return (
				<G>
					{/* squat body */}
					<Ellipse cx="50" cy="64" rx="38" ry="24" fill={ink} />
					{/* haunches */}
					<Ellipse cx="16" cy="78" rx="12" ry="9" fill={ink} />
					<Ellipse cx="84" cy="78" rx="12" ry="9" fill={ink} />
					{/* eye bumps */}
					<Circle cx="34" cy="40" r="12" fill={ink} />
					<Circle cx="66" cy="40" r="12" fill={ink} />
					<Circle cx="34" cy="39" r="4.5" fill={WHIMSY.paper} />
					<Circle cx="66" cy="39" r="4.5" fill={WHIMSY.paper} />
					{/* wide mouth */}
					<Path
						d="M28 66 Q50 78 72 66"
						stroke={WHIMSY.paper}
						strokeWidth={3}
						fill="none"
						strokeLinecap="round"
					/>
				</G>
			);
		case "the_bramble":
			return (
				<G stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round">
					{/* a tangle of crossing canes */}
					<Path d="M8 84 Q28 40 20 12" />
					<Path d="M92 84 Q70 44 82 14" />
					<Path d="M14 70 Q52 52 88 66" />
					<Path d="M18 40 Q54 70 86 38" />
					<Path d="M40 88 Q50 50 62 88" />
					{/* thorns */}
					<Path d="M24 46 L18 40 M24 46 L30 42" />
					<Path d="M52 58 L48 50 M52 58 L58 52" />
					<Path d="M74 52 L80 46 M74 52 L70 44" />
					<Path d="M46 74 L42 66 M56 72 L60 64" />
				</G>
			);
		case "tollbooth_goose":
			return (
				<G>
					{/* body */}
					<Ellipse cx="42" cy="66" rx="30" ry="20" fill={ink} />
					{/* tail */}
					<Path d="M12 60 L2 52 L14 58 Z" fill={ink} />
					{/* long S-neck */}
					<Path
						d="M60 62 Q76 58 72 36 Q68 18 78 14"
						stroke={ink}
						strokeWidth={11}
						fill="none"
						strokeLinecap="round"
					/>
					{/* head */}
					<Circle cx="80" cy="14" r="9" fill={ink} />
					<Circle cx="82" cy="12" r="2.4" fill={WHIMSY.paper} />
					{/* beak */}
					<Path d="M88 13 L98 16 L88 19 Z" fill={ink} />
				</G>
			);
	}
}

export function EnemySilhouette({
	id,
	size = 120,
	defeated = false,
	style,
}: {
	id: SilhouetteId;
	size?: number;
	defeated?: boolean;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View
			style={[
				{
					width: size,
					height: size,
					opacity: defeated ? 0.35 : 1,
					transform: defeated ? [{ rotate: "8deg" }] : undefined,
				},
				style,
			]}
		>
			<Svg width={size} height={size} viewBox="0 0 100 100">
				<Shape id={id} ink={WHIMSY.ink} />
			</Svg>
		</View>
	);
}
