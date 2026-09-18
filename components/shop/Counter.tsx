// The counter (Storefront build 2, 2026-09-16, taste-standard ruling 2: "the
// sounder stands at the counter wearing today's buys, tagged in the hand
// voice, absent when they bought nothing"). A wooden counter across the foot
// of the store; crewmates who bought something today stand along its front
// wearing it, each with a hand tag ("Jen · Top Hat"). A tap opens the same
// preview sheet a shelf item opens — the counter is a second inventory, not
// a second shop. Nobody bought: there is no counter at all (2026-09-17 — the
// furniture used to stay behind; the shopkeep is build 3's art).
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { counterTag, type CounterBuy } from "@/utils/shopCounter";
import {
	AVATAR_SIZE,
	BORDER,
	PRESSED_FLAT,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WOOD,
} from "@/constants/theme";
import { PigAvatar } from "../ui/PigAvatar";
import { Sticker } from "../ui/Sticker";
import { T } from "../ui/Text";
import { HatThumb } from "./HatThumb";
import { Plank } from "./Shelf";

// ── Drawing constants ───────────────────────────────────────────────────────
/** The counter's face, and the scene it stands in (pigs rise above the lip). */
const COUNTER_H = 72;
const SCENE_H = 136;
/** Where the lip sits on the counter's face. */
const LIP_BOTTOM = 60;
/** A crewmate at the counter: the list-row pig, a small held thing, a tag's width. */
const FIGURE_PIG = AVATAR_SIZE[1];
const HELD_ART = 24;
const FIGURE_W = 88;

function CounterFigure({
	buy,
	owned,
	active,
	locked,
	index,
	onPress,
}: {
	buy: CounterBuy;
	owned: boolean;
	active: boolean;
	locked: boolean;
	index: number;
	onPress: () => void;
}) {
	const { item } = buy;
	const tag = counterTag(buy);
	// The pig wears a head piece; anything else (an aura, a background, a held
	// thing) rides at its shoulder as its own small product shot.
	const wornHat = item.category === "hat" ? item.id : null;
	const wornBow = item.category === "bow" ? item.id : null;
	const held = !wornHat && !wornBow;
	const price = item.cost.toLocaleString();
	const state = owned
		? active
			? "you are wearing it"
			: "you own it"
		: locked
			? "Slop Club members only"
			: `${price} snouts`;
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${tag}, ${state}`}
			accessibilityHint="Opens the item preview"
			style={({ pressed }) => [styles.figure, pressed && PRESSED_FLAT]}
		>
			<View style={styles.pig}>
				<PigAvatar
					size={FIGURE_PIG}
					pigId={buy.pigId}
					hatId={wornHat}
					bowId={wornBow}
					mode="worn"
					border={UI_COLORS.border}
				/>
				{held ? (
					<View style={styles.held} pointerEvents="none">
						<HatThumb item={item} size={HELD_ART} />
					</View>
				) : null}
			</View>
			<Sticker
				color="paper"
				radius={RADII.sm}
				shadow="sm"
				rotate={TILT.row[index % TILT.row.length]}
				style={styles.tag}
			>
				<T role="hand" numberOfLines={2} align="center">
					{tag}
				</T>
			</Sticker>
		</Pressable>
	);
}

export function Counter({
	buys,
	owned,
	isEquipped,
	isVip,
	onPreview,
}: {
	buys: readonly CounterBuy[];
	owned: ReadonlySet<string>;
	isEquipped: (id: string, category: string | null | undefined) => boolean;
	isVip: boolean;
	onPreview: (buy: CounterBuy) => void;
}) {
	// Nobody bought anything today: the whole scene is absent, wood and all
	// (taste-standard ruling 2, 09-16 — an empty counter drew ~130pt of blank
	// furniture; the shop-IA pass, 2026-09-17).
	if (buys.length === 0) return null;
	return (
		<View style={styles.scene}>
			<LinearGradient
				colors={[WOOD.top, WOOD.bottom]}
				style={styles.face}
				pointerEvents="none"
			/>
			<Plank style={styles.lip} />
			<T role="kickerPillSm" tone="secondary" style={styles.kicker}>
				at the counter today
			</T>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.rail}
				contentContainerStyle={styles.figures}
				accessibilityLabel="Crewmates who bought something today"
			>
				{buys.map((buy, i) => (
					<CounterFigure
						key={`${buy.userId}:${buy.item.id}`}
						buy={buy}
						index={i}
						owned={owned.has(buy.item.id)}
						active={isEquipped(buy.item.id, buy.item.category)}
						locked={!!buy.item.members_only && !isVip}
						onPress={() => onPreview(buy)}
					/>
				))}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	scene: {
		position: "relative",
		minHeight: SCENE_H,
		justifyContent: "flex-end",
	},
	face: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: COUNTER_H,
		borderTopWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	lip: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: LIP_BOTTOM,
		borderRadius: 0,
	},
	// In the flow above the figures, so a two-line tag can never push a pig's
	// head up through it.
	kicker: {
		marginLeft: SPACE.md,
		marginBottom: SPACE.xs,
	},
	// A ScrollView grows by default; the rail must hug its figures so the
	// kicker sits just above their heads.
	rail: { zIndex: 1, flexGrow: 0 },
	figures: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		paddingBottom: SPACE.xs,
	},
	figure: {
		width: FIGURE_W,
		alignItems: "center",
		gap: SPACE.xxs,
	},
	pig: { position: "relative" },
	held: {
		position: "absolute",
		right: -SPACE.sm,
		bottom: 0,
	},
	tag: {
		paddingHorizontal: SPACE.sm,
		maxWidth: "100%",
	},
});
