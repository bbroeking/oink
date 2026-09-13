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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Feather from "@expo/vector-icons/Feather";
import { GameIcon } from "./GameIcon";

// The star's hand-cut outline, shared by `star` and `premium` so the two read
// as one family. Generated from a 5-tip star (R 9.9 / r 5.5, −5° lean, tips
// rounded at 78 % of each edge) — regenerate rather than hand-nudge.
const STAR_PATH =
	"M10.53 3.69 Q11.14 2.44 11.95 3.57 L14.83 7.59 L19.87 8.18 Q21.30 8.35 20.43 9.49 L17.36 13.54 L18.25 18.40 Q18.49 19.77 17.17 19.33 L12.48 17.78 L8.07 20.22 Q6.82 20.91 6.85 19.49 L6.94 14.45 L3.48 11.06 Q2.50 10.11 3.80 9.68 L8.39 8.15 Z";
const STAR_GLINT = "M8.9 8.6 Q9.9 7.4 11.1 7.1";

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
	| "speakerOff"
	| "signOut"
	| "hat"
	| "trending"
	| "clock"
	| "edit"
	| "copy"
	| "chevronDown"
	| "chevronLeft"
	| "chevronRight"
	| "more"
	| "undo"
	| "save"
	| "furnishings"
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
	edit:      { family: "feather", name: "edit-2" },
	refresh:   { family: "feather", name: "refresh-ccw" },
	exit:      { family: "feather", name: "log-out" },
	handshake: { family: "mci",     name: "handshake" },
	pig:       { family: "mci",     name: "pig" },
	target:    { family: "feather", name: "target" },
	scroll:    { family: "mci",     name: "script-text-outline" },
	chevronDown: { family: "feather", name: "chevron-down" },
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
		// A hand-cut star, not a stock polygon: fat inner radius, rounded tips,
		// a 5° lean and a hair of asymmetry so it rhymes with the painted
		// `Glyph name="star"`; a cream glint when filled. (2026-09-12)
		case "star":
			return (
				<G>
					<Path
						d={STAR_PATH}
						fill={filled ? "#F5C44A" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					{filled && (
						<Path
							d={STAR_GLINT}
							fill="none"
							stroke="#FFF6D6"
							strokeWidth={1.6}
							strokeLinecap="round"
						/>
					)}
				</G>
			);
		case "premium":
			return (
				<Path
					d={STAR_PATH}
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
		case "clock":
			return (
				<G>
					<Circle cx="12" cy="12" r="8.5" fill="none" stroke={c} strokeWidth={sw} />
					<Path
						d="M12 7.5 V12 L15 14"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</G>
			);
		case "hat":
			// A top hat: brim + crown, the closet's own sign.
			return (
				<G>
					<Path
						d="M4 17.5 H20"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<Path
						d="M7 17.5 V8.5 a5 3 0 0 1 10 0 V17.5"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path d="M7 13 H17" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
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

		case "chevronRight":
			return (
				<Path
					d="M9 5 L16 12 L9 19"
					fill="none"
					stroke={c}
					strokeWidth={sw}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			);
		case "chevronLeft":
			return (
				<Path
					d="M15 5 L8 12 L15 19"
					fill="none"
					stroke={c}
					strokeWidth={sw}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			);
		case "more":
			return (
				<G>
					<Circle cx="5" cy="12" r="1.7" fill={c} />
					<Circle cx="12" cy="12" r="1.7" fill={c} />
					<Circle cx="19" cy="12" r="1.7" fill={c} />
				</G>
			);
		case "undo":
			return (
				<G
					fill="none"
					stroke={c}
					strokeWidth={sw}
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<Path d="M8.5 6.5 L4 11 L8.5 15.5" />
					<Path d="M4 11 H14 a5 5 0 0 1 0 10 H9.5" />
				</G>
			);
		case "save":
			return (
				<G>
					<Path
						d="M4.5 5.5 a1 1 0 0 1 1 -1 H15.5 L19.5 8.5 V18.5 a1 1 0 0 1 -1 1 H5.5 a1 1 0 0 1 -1 -1 Z"
						fill={filled ? "#EFEAE3" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M8.5 4.5 V9 H14.5 V4.5"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M7.5 19.5 V14 H16.5 V19.5"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
				</G>
			);
		case "furnishings":
			// Briefcase — the furnishing collection case.
			return (
				<G>
					<Path
						d="M9 7 V5.5 a1.5 1.5 0 0 1 1.5 -1.5 H13.5 a1.5 1.5 0 0 1 1.5 1.5 V7"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<Rect
						x="3"
						y="7"
						width="18"
						height="12.5"
						rx="2"
						fill={filled ? "#EFEAE3" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path d="M3 12.5 H21" stroke={c} strokeWidth={sw} />
					<Rect
						x="10.4"
						y="11"
						width="3.2"
						height="3"
						rx="0.8"
						fill={filled ? "#fff" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
				</G>
			);

		// ── Bottom-tab icons (paper-storybook redesign) ────────────────
		// All filled with sun-yellow when active to read as the "tape" on
		// a sticker. SVG paths transcribed from tab-icons.jsx in the
		// design bundle.
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

		case "speaker":
			return (
				<G>
					<Path
						d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z"
						fill={filled ? "#F5C44A" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M16 9.5 a4 4 0 0 1 0 5"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<Path
						d="M18.5 7.5 a7 7 0 0 1 0 9"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
				</G>
			);
		case "speakerOff":
			return (
				<G>
					<Path
						d="M4 9.5 H8 L13 5 V19 L8 14.5 H4 Z"
						fill={filled ? "#F5C44A" : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M16 9.5 L21 14.5 M21 9.5 L16 14.5"
						fill="none"
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
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
	if (name === "tabBarn") {
		return <GameIcon name="visit" size={size} style={style} />;
	}
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
