// The Pop-up Stall's page body (canvas boards B2 / B6, 2026-10-29): a small
// store of its own. Open, it is the set's backdrop with Rosie in one of its
// pieces, a New · Back · Yours segment, and the shop's own 2-col card grid
// (one card grammar, utils/shopShelves). A tap opens the try-on sheet the
// whole store uses; an owned card dresses her in one tap (the 2026-09-17 rule).
// Boarded, it is the packed-up EmptyState and "Your haul" under it.
//
// Today's cut (SKILL.md 2026-10-29): no in-place try-on on the stage and no
// haul meter; the stage is a painted scene and the sheet does the trying on.
//
// Presentational: the route (app/stall/[key].tsx) and the dev preview
// (components/dev/screens/stall-preview.tsx) both feed it.
import { useState } from "react";
import { Image, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { EmptyState, Hand, SectionHeader, SegmentedControl, Tag } from "@/components/ui";
import { isCostumeCategory } from "@/utils/costumeFit";
import { ShopCard, shopCardStyles } from "@/components/shop/ShopCard";
import { HAT_IMAGES } from "@/constants/hats";
import { BORDER, PAGE_PAD, SPACE, TAB_SAFE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { countWord } from "@/utils/shopShelves";
import {
	heroItem,
	stallLanes,
	type SeasonalShelf,
	type ShelfItem,
	type StallLane,
} from "@/utils/seasonalShelf";
import { StallPig } from "./StallPig";

// ── Drawing constants ───────────────────────────────────────────────────────
/** The open stall's stage (B2) and the packed-up one (B6). */
const STAGE_H = 236;
const STAGE_H_BOARDED = 200;
/** Rosie on the open stage, and on the packed-up one. */
const STAGE_PIG = 184;
const STAGE_PIG_BOARDED = 160;

export interface StallPageProps {
	shelf: SeasonalShelf;
	/** The pieces this binary can draw. */
	items: readonly ShelfItem[];
	phase: "open" | "boarded";
	owned: ReadonlySet<string>;
	isEquipped: (id: string, category: string | null | undefined) => boolean;
	counter: number;
	isVip: boolean;
	/** The 2-col grid's numeric tile width (gridTileWidth). */
	tileWidth: number;
	onPressItem: (item: ShelfItem) => void;
	onLongPressItem: (item: ShelfItem) => void;
	onCenter?: (id: string, x: number, y: number) => void;
	onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
	/** Which segment opens first (the dev preview pins one). */
	initialLane?: StallLane;
}

export function StallPage({
	shelf,
	items,
	phase,
	owned,
	isEquipped,
	counter,
	isVip,
	tileWidth,
	onPressItem,
	onLongPressItem,
	onCenter,
	onScroll,
	initialLane = "new",
}: StallPageProps) {
	const [lane, setLane] = useState<StallLane>(initialLane);
	const lanes = stallLanes(items, owned);
	const isOwned = (i: ShelfItem) => i.owned || owned.has(i.id);
	const backdrop = shelf.backdropHatId ? HAT_IMAGES[shelf.backdropHatId] : undefined;
	const boarded = phase === "boarded";

	const card = (item: ShelfItem, i: number) => {
		const mine = isOwned(item);
		const locked = !!item.members_only && !isVip;
		return (
			<View key={item.id} style={{ width: tileWidth }}>
				<ShopCard
					item={item}
					index={i}
					owned={mine}
					active={mine && isEquipped(item.id, item.category)}
					canAfford={counter >= item.cost}
					// Every piece on an open stall is on sale today.
					inDrop={!boarded}
					membersOnly={!!item.members_only}
					locked={locked}
					onPress={() => onPressItem(item)}
					onLongPress={() => onLongPressItem(item)}
					onCenter={(x, y) => onCenter?.(item.id, x, y)}
				/>
				{/* A full costume is the whole outfit, not one more piece: its
				    tile says so in the corner (canvas direction A, 2026-10-29). */}
				{isCostumeCategory(item.category) ? (
					<View pointerEvents="none" style={styles.costumeCorner}>
						<Tag label="full costume" tone="lilac" flat />
					</View>
				) : null}
			</View>
		);
	};

	if (boarded) {
		const haul = lanes.yours;
		const wearing = haul.find((i) => i.category !== "background") ?? null;
		const came = haul.length === 1 ? "piece came" : "pieces came";
		// "back next October" on the sign; "till next October" in the line (B6).
		const till = (shelf.theme.back_line?.trim() || "back next year").replace(/^back /, "till ");
		return (
			<ScrollView
				contentContainerStyle={styles.scroll}
				onScroll={onScroll}
				scrollEventThrottle={16}
				testID="stall-page-boarded"
			>
				<View style={[styles.stage, styles.stageBoarded]}>
					<StallPig item={wearing} size={STAGE_PIG_BOARDED} />
				</View>
				<EmptyState
					glyph="signStore"
					title="The stall has packed up"
					sub={
						haul.length > 0
							? `${capitalize(countWord(haul.length))} ${came} home with you. The rest ride the cart ${till}.`
							: `Nothing came home this time. The pieces ride the cart ${till}.`
					}
					flush
				/>
				{haul.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader
							kicker="what you took home"
							title="Your haul"
							right={`${haul.length} of ${items.length}`}
						/>
						<View style={shopCardStyles.grid}>{haul.map(card)}</View>
					</View>
				) : null}
			</ScrollView>
		);
	}

	const shown = lanes[lane];
	const hero = heroItem(shelf, items);
	return (
		<ScrollView
			contentContainerStyle={styles.scroll}
			onScroll={onScroll}
			scrollEventThrottle={16}
			testID="stall-page-open"
		>
			<View style={[styles.stage, !backdrop && styles.stageBare]}>
				{backdrop ? (
					<Image source={backdrop} style={styles.backdrop} resizeMode="cover" accessible={false} />
				) : null}
				<StallPig item={hero} size={STAGE_PIG} />
				<View style={styles.hint} pointerEvents="none">
					<Hand tone="onDark">tap a piece to see it on her</Hand>
				</View>
			</View>
			<View style={styles.section}>
				<SegmentedControl
					label="Stall pieces"
					value={lane}
					onChange={setLane}
					options={[
						{ value: "new", label: `New · ${lanes.new.length}` },
						{ value: "back", label: `Back · ${lanes.back.length}` },
						{ value: "yours", label: `Yours · ${lanes.yours.length}` },
					]}
				/>
				{shown.length > 0 ? (
					<View style={shopCardStyles.grid}>{shown.map(card)}</View>
				) : lane === "yours" ? (
					<EmptyState
						glyph="gift"
						title="Nothing from the stall yet"
						sub="What you buy here stays yours after it packs up."
						flush
					/>
				) : (
					<EmptyState
						glyph="signStore"
						title="Still unpacking"
						sub="These pieces arrive with the next update."
						flush
					/>
				)}
			</View>
		</ScrollView>
	);
}

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

const styles = StyleSheet.create({
	scroll: { gap: SPACE.md, paddingBottom: TAB_SAFE },
	// Full bleed: the stage runs edge to edge, ruled top and bottom only.
	stage: {
		height: STAGE_H,
		alignItems: "center",
		justifyContent: "flex-end",
		overflow: "hidden",
		borderTopWidth: BORDER.ink,
		borderBottomWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.lilac,
	},
	stageBare: { backgroundColor: WHIMSY.cream2 },
	stageBoarded: { height: STAGE_H_BOARDED, backgroundColor: WHIMSY.cream2 },
	backdrop: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
	hint: { position: "absolute", left: SPACE.md, top: SPACE.sm },
	section: { paddingHorizontal: PAGE_PAD, gap: SPACE.md },
	// Right of the card's rarity dot, clear of its owned badge.
	costumeCorner: {
		position: "absolute",
		top: SPACE.sm,
		left: SPACE.xl,
		zIndex: 2,
	},
});
