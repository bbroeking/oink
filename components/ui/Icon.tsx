import React from "react";
import { StyleProp, ViewStyle, View } from "react-native";
import Svg, {
	G,
	Path,
	Rect,
	Circle,
	Ellipse,
	Defs,
	LinearGradient,
	Stop,
} from "react-native-svg";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

export type IconName =
	| "home"
	| "ranks"
	| "season"
	| "shop"
	| "user"
	// Bottom-tab icons from the redesign — ink-outline storybook style,
	// distinct from the generic icons above so other surfaces are free
	// to keep using their own shapes.
	| "tabBarn"
	| "tabFriends"
	| "tabSeason"
	| "tabShop"
	| "tabMe"
	| "tickle"
	| "flame"
	| "star"
	| "premium"
	| "lock"
	| "share"
	| "search"
	| "check"
	| "x"
	| "plus"
	| "arrowRight"
	| "globe"
	| "friends"
	| "bell"
	| "speaker"
	| "signOut"
	| "hat"
	| "trending"
	| "clock"
	| "edit"
	| "copy"
	// ── Vector-icons-backed entries (delegated to MCI / Feather). ──
	// Added during the no-emoji sweep so call sites stay
	// <Icon name="crown" /> and we keep one consumer surface.
	| "crown"
	| "gift"
	| "scales"
	| "trophy"
	| "ghost"
	| "gear"
	| "refresh"
	| "exit"
	| "handshake"
	| "pig"
	| "target"
	| "scroll";

// MCI / Feather names per delegated IconName. Filled-by-default
// variants chosen to read against the ink-outline storybook DNA;
// the *-outline variants exist if we want to swap later.
const VECTOR_ICON_MAP: Partial<Record<IconName, {
	family: "mci" | "feather";
	name: string;
}>> = {
	crown:     { family: "mci",     name: "crown" },
	gift:      { family: "mci",     name: "gift" },
	scales:    { family: "mci",     name: "scale-balance" },
	trophy:    { family: "mci",     name: "trophy" },
	ghost:     { family: "mci",     name: "ghost" },
	gear:      { family: "feather", name: "settings" },
	refresh:   { family: "feather", name: "refresh-ccw" },
	exit:      { family: "feather", name: "log-out" },
	handshake: { family: "mci",     name: "handshake" },
	pig:       { family: "mci",     name: "pig" },
	target:    { family: "feather", name: "target" },
	scroll:    { family: "mci",     name: "script-text-outline" },
};

interface Props {
	name: IconName;
	size?: number;
	color?: string;
	filled?: boolean;
	strokeWidth?: number;
	style?: StyleProp<ViewStyle>;
}

function Render({
	name,
	c,
	sw,
	filled,
}: {
	name: IconName;
	c: string;
	sw: number;
	filled: boolean;
}) {
	switch (name) {
		case "home":
			return (
				<G>
					<Path
						d="M3 11 L12 3.5 L21 11 V20 a1.5 1.5 0 0 1 -1.5 1.5 H4.5 A1.5 1.5 0 0 1 3 20 Z"
						fill={filled ? "#FBE6EC" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M9.5 21.5 V14 a1 1 0 0 1 1 -1 h3 a1 1 0 0 1 1 1 V21.5"
						fill={filled ? "#fff" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
				</G>
			);
		case "ranks":
			return (
				<G>
					<Path
						d="M7 4 H17 V9 a5 5 0 0 1 -10 0 Z"
						fill={filled ? "#F5C44A" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M7 6 H4 a1 1 0 0 0 -1 1 V8 a3 3 0 0 0 3 3"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M17 6 H20 a1 1 0 0 1 1 1 V8 a3 3 0 0 1 -3 3"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Rect
						x="9"
						y="14"
						width="6"
						height="2.5"
						fill={filled ? "#F5C44A" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Rect
						x="6.5"
						y="16.5"
						width="11"
						height="3"
						rx="0.5"
						fill={filled ? "#F5C44A" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
				</G>
			);
		case "season":
			return (
				<Path
					d="M12 2.5 L14.5 8.5 L21 9.2 L16 13.5 L17.6 20 L12 16.5 L6.4 20 L8 13.5 L3 9.2 L9.5 8.5 Z"
					fill={filled ? "#7B5FFF" : "none"}
					stroke={c}
					strokeWidth={sw}
					strokeLinejoin="round"
				/>
			);
		case "shop":
			return (
				<G>
					<Path
						d="M5 8 H19 L18 21 a1.5 1.5 0 0 1 -1.5 1.4 H7.5 A1.5 1.5 0 0 1 6 21 Z"
						fill={filled ? "#FBE6EC" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M9 10 V7 a3 3 0 0 1 6 0 V10"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<Circle cx="9.5" cy="13" r="0.9" fill={c} />
					<Circle cx="14.5" cy="13" r="0.9" fill={c} />
				</G>
			);
		case "user":
			return (
				<G>
					<Circle
						cx="12"
						cy="8.5"
						r="4.2"
						fill={filled ? "#FBE6EC" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Path
						d="M3.5 21 a8.5 8.5 0 0 1 17 0"
						fill={filled ? "#FBE6EC" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</G>
			);
		case "tickle":
			return (
				<G>
					<Ellipse
						cx="12"
						cy="13"
						rx="7.5"
						ry="6"
						fill="#E8A7B9"
						stroke="#A05A72"
						strokeWidth={sw}
					/>
					<Ellipse cx="9.5" cy="12.5" rx="1.1" ry="1.5" fill="#1A1A1A" />
					<Ellipse cx="14.5" cy="12.5" rx="1.1" ry="1.5" fill="#1A1A1A" />
				</G>
			);
		case "flame":
			return (
				<G>
					<Path
						d="M12 2.5 C 9 6 7.5 8 8 11 C 8.4 13.5 6 14 6 17 a6 6 0 0 0 12 0 C 18 13.5 16 12.5 15 9.5 C 14 11 13.5 11 13 10 C 12.5 8.5 13 5 12 2.5 Z"
						fill={filled ? "url(#flameG)" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
				</G>
			);
		case "star":
			return (
				<Path
					d="M12 3 L14.4 8.7 L20.5 9.3 L15.9 13.4 L17.4 19.4 L12 16.2 L6.6 19.4 L8.1 13.4 L3.5 9.3 L9.6 8.7 Z"
					fill={filled ? "#F5C44A" : "none"}
					stroke={c}
					strokeWidth={sw}
					strokeLinejoin="round"
				/>
			);
		case "premium":
			return (
				<Path
					d="M12 3 L14.4 8.7 L20.5 9.3 L15.9 13.4 L17.4 19.4 L12 16.2 L6.6 19.4 L8.1 13.4 L3.5 9.3 L9.6 8.7 Z"
					fill={filled ? "#7B5FFF" : "none"}
					stroke={c}
					strokeWidth={sw}
					strokeLinejoin="round"
				/>
			);
		case "lock":
			return (
				<G>
					<Path
						d="M7 11 V8 a5 5 0 0 1 10 0 V11"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<Rect
						x="5"
						y="11"
						width="14"
						height="9.5"
						rx="2"
						fill={filled ? "#EFEAE3" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Circle cx="12" cy="15.2" r="1.3" fill={c} />
					<Rect x="11.4" y="15.5" width="1.2" height="3" rx="0.6" fill={c} />
				</G>
			);
		case "share":
			return (
				<G>
					<Path
						d="M12 3 V15"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<Path
						d="M8 7 L12 3 L16 7"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<Path
						d="M5 12 V19 a1.5 1.5 0 0 0 1.5 1.5 H17.5 A1.5 1.5 0 0 0 19 19 V12"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</G>
			);
		case "search":
			return (
				<G>
					<Circle cx="11" cy="11" r="7" fill="none" stroke={c} strokeWidth={sw} />
					<Path
						d="M16.5 16.5 L21 21"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</G>
			);
		case "check":
			return (
				<G>
					{filled && <Circle cx="12" cy="12" r="10" fill="#5BC97D" />}
					<Path
						d="M6 12.5 L10.5 17 L18.5 8"
						fill="none"
						stroke={filled ? "#fff" : c}
						strokeWidth={sw + 0.4}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</G>
			);
		case "x":
			return (
				<G strokeLinecap="round">
					<Path d="M6 6 L18 18" stroke={c} strokeWidth={sw} />
					<Path d="M18 6 L6 18" stroke={c} strokeWidth={sw} />
				</G>
			);
		case "plus":
			return (
				<G strokeLinecap="round">
					<Path d="M12 5 V19" stroke={c} strokeWidth={sw} />
					<Path d="M5 12 H19" stroke={c} strokeWidth={sw} />
				</G>
			);
		case "arrowRight":
			return (
				<G
					fill="none"
					stroke={c}
					strokeWidth={sw}
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<Path d="M5 12 H19" />
					<Path d="M13 6 L19 12 L13 18" />
				</G>
			);
		case "globe":
			return (
				<G>
					<Circle
						cx="12"
						cy="12"
						r="9"
						fill={filled ? "#BCE0F0" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Ellipse
						cx="12"
						cy="12"
						rx="9"
						ry="3.5"
						fill="none"
						stroke={c}
						strokeWidth={sw * 0.8}
					/>
					<Path
						d="M12 3 C 8 7 8 17 12 21"
						fill="none"
						stroke={c}
						strokeWidth={sw * 0.8}
					/>
					<Path
						d="M12 3 C 16 7 16 17 12 21"
						fill="none"
						stroke={c}
						strokeWidth={sw * 0.8}
					/>
				</G>
			);
		case "friends":
			return (
				<G>
					<Circle
						cx="9"
						cy="9"
						r="3.5"
						fill={filled ? "#FBE6EC" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Circle
						cx="16"
						cy="10.5"
						r="2.8"
						fill={filled ? "#EFE9FF" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Path
						d="M3 20 a6 6 0 0 1 12 0"
						fill={filled ? "#FBE6EC" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<Path
						d="M14 20 a4.5 4.5 0 0 1 7 -3.5"
						fill={filled ? "#EFE9FF" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</G>
			);
		case "bell":
			return (
				<G>
					<Path
						d="M6 17 V11 a6 6 0 0 1 12 0 V17 L19 19 H5 Z"
						fill={filled ? "#F5C44A" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M10 19 a2 2 0 0 0 4 0"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</G>
			);
		case "signOut":
			return (
				<G
					fill="none"
					stroke={c}
					strokeWidth={sw}
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<Path d="M10 4 H5 a1 1 0 0 0 -1 1 V19 a1 1 0 0 0 1 1 H10" />
					<Path d="M14 8 L18 12 L14 16" />
					<Path d="M9 12 H18" />
				</G>
			);
		case "copy":
			return (
				<G>
					<Rect
						x="8.5"
						y="8.5"
						width="11.5"
						height="12.5"
						rx="2.4"
						fill={filled ? "#FBE6EC" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Path
						d="M15.5 8.5 V5.5 A1.5 1.5 0 0 0 14 4 H5.5 A1.5 1.5 0 0 0 4 5.5 V15 A1.5 1.5 0 0 0 5.5 16.5 H8.5"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				</G>
			);

		// ── Bottom-tab icons (paper-storybook redesign) ────────────────
		// All filled with sun-yellow when active to read as the "tape" on
		// a sticker. SVG paths transcribed from tab-icons.jsx in the
		// design bundle.
		case "tabBarn":
			// Pentagon house with a door.
			return (
				<G>
					<Path
						d="M3 12 L12 4 L21 12 L21 20 L3 20 Z"
						fill={filled ? "#ffd87a" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M10 20 V14 H14 V20"
						fill={filled ? c : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M3 12 L6 12 M21 12 L18 12"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</G>
			);
		case "tabFriends":
			// Two friendly snout-circles, interlocking.
			return (
				<G>
					<Circle
						cx="8.5"
						cy="12"
						r="5.5"
						fill={filled ? "#ffd87a" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Circle
						cx="15.5"
						cy="12"
						r="5.5"
						fill={filled ? "#ffd87a" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Circle cx="8.5" cy="12" r="1.4" fill={c} />
					<Circle cx="15.5" cy="12" r="1.4" fill={c} />
				</G>
			);
		case "tabSeason":
			// Scales of judgement — Goblins vs Angels.
			return (
				<G>
					<Path
						d="M12 4 V20 M9 20 H15 M5 8 H19 M12 4 L12 8"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<Path
						d="M2.5 12 Q5 14 7.5 12 L5 8 Z"
						fill={filled ? "#ffd87a" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M16.5 12 Q19 14 21.5 12 L19 8 Z"
						fill={filled ? "#ffd87a" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
				</G>
			);
		case "tabShop":
			// Classic shopping tote.
			return (
				<G>
					<Path
						d="M5 9 L19 9 L17.5 20 L6.5 20 Z"
						fill={filled ? "#ffd87a" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M9 9 V7 A3 3 0 0 1 15 7 V9"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</G>
			);
		case "tabMe":
			// Pig snout — oval with two nostrils.
			return (
				<G>
					<Ellipse
						cx="12"
						cy="12"
						rx="6.5"
						ry="5"
						fill={filled ? "#ffd87a" : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Ellipse cx="9.8" cy="12" rx="1.1" ry="1.5" fill={c} />
					<Ellipse cx="14.2" cy="12" rx="1.1" ry="1.5" fill={c} />
				</G>
			);

		default:
			return null;
	}
}

export function Icon({
	name,
	size = 24,
	color = "#1A1A1A",
	filled = false,
	strokeWidth = 1.8,
	style,
}: Props) {
	// Vector-icons delegates — render via MCI / Feather. The wrapping
	// View carries the style prop so callers can position the icon the
	// same way they do for the hand-rolled Svg path entries.
	const vec = VECTOR_ICON_MAP[name];
	if (vec) {
		return (
			<View style={style}>
				{vec.family === "mci" ? (
					<MaterialCommunityIcons
						name={vec.name as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
						size={size}
						color={color}
					/>
				) : (
					<Feather
						name={vec.name as React.ComponentProps<typeof Feather>["name"]}
						size={size}
						color={color}
					/>
				)}
			</View>
		);
	}
	return (
		<Svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			style={style}
		>
			<Defs>
				<LinearGradient id="flameG" x1="0" y1="0" x2="0" y2="1">
					<Stop offset="0" stopColor="#FFB84A" />
					<Stop offset="0.5" stopColor="#F58F4A" />
					<Stop offset="1" stopColor="#D85858" />
				</LinearGradient>
			</Defs>
			<Render name={name} c={color} sw={strokeWidth} filled={filled} />
		</Svg>
	);
}
