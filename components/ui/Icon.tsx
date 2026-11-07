import React from "react";
import { StyleProp, ViewStyle } from "react-native";
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
import { GameIcon } from "./GameIcon";
import { ART, WHIMSY } from "@/constants/theme";

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
	// The stepper's "one less" (Bullion's Market price, 2026-10-31).
	| "minus"
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
	// ── Hand-cut since 2026-09-22. These fourteen were delegated to
	// MaterialCommunityIcons / Feather (Lucide's parent set) during the
	// no-emoji sweep; a generic icon family beside the storybook outlines was
	// the one place the app still looked like every other app.
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
						fill={filled ? WHIMSY.rose : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M9.5 21.5 V14 a1 1 0 0 1 1 -1 h3 a1 1 0 0 1 1 1 V21.5"
						fill={filled ? WHIMSY.paper : "none"}
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
						fill={filled ? WHIMSY.slopGold : "none"}
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
						fill={filled ? WHIMSY.slopGold : "none"}
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
						fill={filled ? WHIMSY.slopGold : "none"}
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
					fill={filled ? WHIMSY.lilacDeep : "none"}
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
						fill={filled ? WHIMSY.rose : "none"}
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
						fill={filled ? WHIMSY.rose : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Path
						d="M3.5 21 a8.5 8.5 0 0 1 17 0"
						fill={filled ? WHIMSY.rose : "none"}
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
						fill={ART.tickleFace}
						stroke={ART.tickleOutline}
						strokeWidth={sw}
					/>
					<Ellipse cx="9.5" cy="12.5" rx="1.1" ry="1.5" fill={WHIMSY.ink} />
					<Ellipse cx="14.5" cy="12.5" rx="1.1" ry="1.5" fill={WHIMSY.ink} />
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
						fill={filled ? WHIMSY.slopGold : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					{filled && (
						<Path
							d={STAR_GLINT}
							fill="none"
							stroke={WHIMSY.paper}
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
					fill={filled ? WHIMSY.lilacDeep : "none"}
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
						fill={filled ? WHIMSY.cream : "none"}
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
					{filled && <Circle cx="12" cy="12" r="10" fill={WHIMSY.grass} />}
					<Path
						d="M6 12.5 L10.5 17 L18.5 8"
						fill="none"
						stroke={filled ? WHIMSY.paper : c}
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
		case "minus":
			return <Path d="M5 12 H19" stroke={c} strokeWidth={sw} strokeLinecap="round" />;
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
						fill={filled ? WHIMSY.sky : "none"}
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
						fill={filled ? WHIMSY.rose : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Circle
						cx="16"
						cy="10.5"
						r="2.8"
						fill={filled ? WHIMSY.lilac : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Path
						d="M3 20 a6 6 0 0 1 12 0"
						fill={filled ? WHIMSY.rose : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinecap="round"
					/>
					<Path
						d="M14 20 a4.5 4.5 0 0 1 7 -3.5"
						fill={filled ? WHIMSY.lilac : "none"}
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
						fill={filled ? WHIMSY.slopGold : "none"}
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
						fill={filled ? WHIMSY.rose : "none"}
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
						fill={filled ? WHIMSY.cream : "none"}
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
						fill={filled ? WHIMSY.cream : "none"}
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
						fill={filled ? WHIMSY.paper : "none"}
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
						fill={filled ? WHIMSY.sun : "none"}
						stroke={c}
						strokeWidth={sw}
					/>
					<Circle
						cx="15.5"
						cy="12"
						r="5.5"
						fill={filled ? WHIMSY.sun : "none"}
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
						fill={filled ? WHIMSY.sun : "none"}
						stroke={c}
						strokeWidth={sw}
						strokeLinejoin="round"
					/>
					<Path
						d="M16.5 12 Q19 14 21.5 12 L19 8 Z"
						fill={filled ? WHIMSY.sun : "none"}
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
						fill={filled ? WHIMSY.sun : "none"}
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
						fill={filled ? WHIMSY.sun : "none"}
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
						fill={filled ? WHIMSY.slopGold : "none"}
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
						fill={filled ? WHIMSY.slopGold : "none"}
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
		case "gear":
			return (
				<G>
					<Path fill={filled ? WHIMSY.cream : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M19.63 9.96 L22.00 9.98 L22.20 11.89 L19.89 12.41 L18.84 15.95 L20.50 17.64 L19.29 19.14 L17.29 17.87 L14.04 19.63 L14.02 22.00 L12.11 22.20 L11.59 19.89 L8.05 18.84 L6.36 20.50 L4.86 19.29 L6.13 17.29 L4.37 14.04 L2.00 14.02 L1.80 12.11 L4.11 11.59 L5.16 8.05 L3.50 6.36 L4.71 4.86 L6.71 6.13 L9.96 4.37 L9.98 2.00 L11.89 1.80 L12.41 4.11 L15.95 5.16 L17.64 3.50 L19.14 4.71 L17.87 6.71 Z" />
					<Circle fill={filled ? WHIMSY.paper : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="12" cy="12" r="2.7" />
				</G>
			);
		case "edit":
			return (
				<G>
					<Path fill={filled ? WHIMSY.sun : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M4.2 19.8 L5 15.6 L15.6 5 a1.8 1.8 0 0 1 2.6 0 L19.2 6 a1.8 1.8 0 0 1 0 2.6 L8.6 19.2 Z" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M13.8 6.8 L17.4 10.4" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M5 15.6 L8.6 19.2" />
				</G>
			);
		case "refresh":
			return (
				<G>
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M19.4 12.6 a7.4 7.4 0 0 1 -12.9 4.6" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M4.6 11.4 a7.4 7.4 0 0 1 12.9 -4.6" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M17.5 3.2 L17.8 7.4 L13.6 7.2" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M6.5 20.8 L6.2 16.6 L10.4 16.8" />
				</G>
			);
		case "exit":
			return (
				<G>
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M10 4.2 H5.4 a1.2 1.2 0 0 0 -1.2 1.2 V18.6 a1.2 1.2 0 0 0 1.2 1.2 H10" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M14.2 8.2 L18.6 12 L14.2 15.8" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M18.6 12 H8.4" />
				</G>
			);
		case "chevronDown":
			return (
				<G>
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M6 9.4 L12 15.4 L18 9.4" />
				</G>
			);
		case "crown":
			return (
				<G>
					<Path fill={filled ? WHIMSY.slopGold : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M4.4 17.4 L3.4 7.6 L8.2 11.2 L12.2 5.4 L15.9 11.2 L20.7 7.6 L19.7 17.4 Z" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M4.6 20 H19.5" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="12.1" cy="13.6" r="0.9" />
				</G>
			);
		case "gift":
			return (
				<G>
					<Path fill={filled ? WHIMSY.rose : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M4.4 11.4 H19.6 V19.2 a1.2 1.2 0 0 1 -1.2 1.2 H5.6 a1.2 1.2 0 0 1 -1.2 -1.2 Z" />
					<Path fill={filled ? WHIMSY.rose : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M3.4 8 H20.6 V11.4 H3.4 Z" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M12 8 V20.4" />
					<Path fill={filled ? WHIMSY.rose : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M12 8 C9.2 8 7.4 6.2 8.2 4.6 C9.2 3 11.4 5.2 12 8 C12.6 5.2 14.8 3 15.8 4.6 C16.6 6.2 14.8 8 12 8 Z" />
				</G>
			);
		case "scales":
			return (
				<G>
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M12 4.2 V19.6" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M8.2 20 H15.8" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M4.8 8 H19.2" />
					<Circle fill={filled ? WHIMSY.paper : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="12" cy="5.6" r="1.3" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M5.2 8 L2.6 14 M5.2 8 L7.8 14" />
					<Path fill={filled ? WHIMSY.sun : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M2.4 14 a2.8 2.4 0 0 0 5.6 0 Z" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M18.8 8 L16.2 14 M18.8 8 L21.4 14" />
					<Path fill={filled ? WHIMSY.sun : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M16 14 a2.8 2.4 0 0 0 5.6 0 Z" />
				</G>
			);
		case "trophy":
			return (
				<G>
					<Path fill={filled ? WHIMSY.slopGold : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M7 4.4 H17 V10 a5 5 0 0 1 -10 0 Z" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M7 6.2 H4.6 a2.4 2.6 0 0 0 2.6 4.2" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M17 6.2 H19.4 a2.4 2.6 0 0 1 -2.6 4.2" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M12 15.2 V17.8" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M9.2 18 H14.8" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M8.2 20.2 H15.8" />
				</G>
			);
		case "ghost":
			return (
				<G>
					<Path fill={filled ? WHIMSY.cream : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M5.8 20 V11.2 a6.2 6.2 0 0 1 12.4 0 V20 L15.4 18.2 L12 20.2 L8.8 18.2 Z" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="9.6" cy="11.4" r="1.0" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="14.4" cy="11.4" r="1.0" />
				</G>
			);
		case "handshake":
			return (
				<G>
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M2.6 9.4 L6.4 7.2 L10.6 8.6 L14.2 6.8 L17.8 8.2 L21.4 10" />
					<Path fill={filled ? WHIMSY.rose : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M2.6 9.4 L6 15.2 L9 17.6 L11.6 18.2 L14 17 L16.4 15.4 L18.6 13.4 L21.4 10" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M10.6 8.6 L8.4 11 a1.4 1.4 0 0 0 2 2 L12.4 11.2 L14 12.8 M13 14.2 L15 15.8" />
				</G>
			);
		case "pig":
			return (
				<G>
					<Path fill={filled ? WHIMSY.roseDeep : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M12 5.2 C7.2 5.2 4.2 8.4 4.2 12.6 C4.2 16.6 7.4 19.6 12 19.6 C16.6 19.6 19.8 16.6 19.8 12.6 C19.8 8.4 16.8 5.2 12 5.2 Z" />
					<Path fill={filled ? WHIMSY.roseDeep : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M5.6 8.6 L4.4 4.6 L8.4 6.2 M18.4 8.6 L19.6 4.6 L15.6 6.2" />
					<Path fill={filled ? WHIMSY.rose : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M8.6 12.4 H15.4 a1.6 2 0 0 1 0 4 H8.6 a1.6 2 0 0 1 0 -4 Z" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="10.4" cy="14.4" r="0.8" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="13.6" cy="14.4" r="0.8" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="8.6" cy="10.2" r="0.8" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="15.4" cy="10.2" r="0.8" />
				</G>
			);
		case "target":
			return (
				<G>
					<Circle fill={filled ? WHIMSY.paper : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="12" cy="12" r="8.6" />
					<Circle fill={filled ? WHIMSY.rose : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="12" cy="12" r="5.2" />
					<Circle fill={WHIMSY.ink} stroke="none" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" cx="12" cy="12" r="1.8" />
				</G>
			);
		case "scroll":
			return (
				<G>
					<Path fill={filled ? WHIMSY.paper : "none"} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M7 5.4 H18.4 a1.4 1.4 0 0 1 1.4 1.4 V18.6 a1.4 1.4 0 0 1 -1.4 1.4 H6.8 a2.4 2.4 0 0 1 -2.4 -2.4 V8 a2.6 2.6 0 0 1 2.6 -2.6 Z" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M7 5.4 a2.6 2.6 0 0 0 -2.6 2.6 V10 H7" />
					<Path fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" d="M10 10 H16 M10 13.2 H16 M10 16.4 H13.6" />
				</G>
			);
		default:
			return null;
	}
}

export function Icon({
	name,
	size = 24,
	color = WHIMSY.ink,
	filled = false,
	strokeWidth = 1.8,
	style,
}: Props) {
	if (name === "tabBarn") {
		return <GameIcon name="visit" size={size} style={style} />;
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
					<Stop offset="0" stopColor={ART.flameTop} />
					<Stop offset="0.5" stopColor={ART.flame} />
					<Stop offset="1" stopColor={ART.flameDeep} />
				</LinearGradient>
			</Defs>
			<Render name={name} c={color} sw={strokeWidth} filled={filled} />
		</Svg>
	);
}
