// The yard: the places around it with their heaps and weights, the pigs, and
// the reveal's moving parts. Every position comes from the pure model
// (./model.ts); this file only draws.

import { Image, StyleSheet, View } from "react-native";
import { Glyph, Sticker, T } from "@/components/ui";
import { findArtGlyph } from "@/components/satchel/FindArt";
import { BORDER, RADII, ROW_TILTS, SHADOW_SM, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import type { DayRecord, OlView } from "@/multiplayer/games/out_looking/rules";
import type { PigStageLookProps } from "@/utils/multiplayer/looks";
import { OUT_LOOKING_ART } from "../../playArt";
import {
	CARD_GAP,
	CARD_PAD_TOP,
	CARD_PAD_X,
	FIELD_PAD,
	PLACE_NAME,
	heapCentre,
	listFinds,
	type Beat,
	type Flight,
	type Geometry,
	type Heap,
	type PigSpot,
	type Point,
	type Rect,
	type SceneSizes,
} from "./model";
import { DropIn, FloatHeart, FlyingFind, MuddySticker, SeatPig } from "./motion";
/** The weight tag pinned to each place's inner top corner. */
const WEIGHT_TAG = 26;
/** The weight tag rides a little below the card's top edge; the yard sits a
 *  little inside the cards on either side of it. */
const WEIGHT_DROP = SPACE.xs;
const YARD_INSET = SPACE.xs;
/** "+N" after the fifth tile, and the "bare today" note where a heap would be. */
const MORE_W = 26;
const BARE_W = 96;
/** A heap leans every which way, like a pile. */
const HEAP_TILT_DEG = [-8, 6, -4, 9, -6];
const TYPE_CAP = 1.3;

export interface SceneProps {
	geo: Geometry;
	view: OlView;
	heaps: Heap[];
	spots: Record<number, PigSpot>;
	looks: Record<number, PigStageLookProps>;
	/** The place I have chosen, or where my pig is looking. */
	highlighted: number | null;
	canPick: boolean;
	onPick: (place: number) => void;
	reveal: { day: DayRecord; beat: Beat } | null;
	flights: Flight[];
	hearts: Point[];
	muddy: number[];
	reduce: boolean;
}

export function Scene({ geo, view, heaps, spots, looks, highlighted, canPick, onPick, reveal, flights, hearts, muddy, reduce }: SceneProps) {
	// Nearer the bottom is nearer the camera: draw those pigs last.
	const pigs = Object.entries(spots)
		.map(([seat, spot]) => ({ seat: Number(seat), spot }))
		.sort((a, b) => a.spot.y - b.spot.y || a.seat - b.seat);
	const played = reveal !== null && reveal.beat !== "out" ? reveal : null;
	const fieldH = geo.height + 2 * FIELD_PAD + 2 * BORDER.ink;
	// A new yard size (the board's height arrived, the text size changed)
	// moves every spot at once: the pigs are put there, not walked there.
	const geoKey = `${geo.width}x${geo.height}`;
	const { sizes } = geo;

	return (
		<Sticker color="sage" rotate={0} radius={RADII.xl} shadow="none" style={[styles.field, { height: fieldH }]} testID="ol-scene">
			<View style={[styles.stage, { width: geo.width, height: geo.height }]}>
				<View
					pointerEvents="none"
					style={[styles.yard, { left: geo.yard.x + YARD_INSET, top: geo.yard.y, width: geo.yard.w - 2 * YARD_INSET, height: geo.yard.h }]}
				/>
				{geo.cards.map((rect, j) => (
					<PlaceCard
						key={view.places[j].id}
						rect={rect}
						sizes={sizes}
						index={j}
						view={view}
						heap={heaps[j]}
						highlighted={highlighted === j}
						canPick={canPick}
						onPick={onPick}
					/>
				))}
				{heaps.map((heap, j) => (
					<HeapLayer key={`heap-${j}`} heap={heap} glyph={sizes.heap} reduce={reduce} testID={`ol-bare-${view.places[j].id}`} />
				))}
				{geo.cards.map((rect, j) => (
					<WeightTag key={`w-${j}`} rect={rect} geo={geo} weight={heaps[j].weight} />
				))}
				{played
					? muddy.map((j) => (
							<MuddySticker key={`m-${played.day.round}-${j}`} at={heapCentre(geo.cards[j], sizes)} size={sizes.muddy} reduce={reduce}>
								<Image source={OUT_LOOKING_ART.muddyTrotters} style={styles.muddyArt} resizeMode="contain" accessible={false} />
							</MuddySticker>
						))
					: null}
				{pigs.map(({ seat, spot }) => (
					<SeatPig key={seat} spot={spot} look={looks[seat]} geoKey={geoKey} reduce={reduce} testID={`ol-pig-${seat}`} />
				))}
				{played ? hearts.map((at, i) => <FloatHeart key={`h-${played.day.round}-${i}`} at={at} reduce={reduce} />) : null}
				{played ? flights.map((f) => <FlyingFind key={`f-${played.day.round}-${f.key}`} flight={f} reduce={reduce} />) : null}
			</View>
		</Sticker>
	);
}

function PlaceCard({
	rect,
	sizes,
	index,
	view,
	heap,
	highlighted,
	canPick,
	onPick,
}: {
	rect: Rect;
	sizes: SceneSizes;
	index: number;
	view: OlView;
	heap: Heap;
	highlighted: boolean;
	canPick: boolean;
	onPick: (place: number) => void;
}) {
	const id = view.places[index].id;
	const name = PLACE_NAME[id];
	const pile = heap.bare ? "bare today" : heap.finds.length === 0 ? "nothing there" : `${listFinds(heap.finds)}, weight ${heap.weight}`;
	return (
		<Sticker
			color={highlighted ? "sun" : "paper"}
			rotate={ROW_TILTS[index % ROW_TILTS.length]}
			radius={RADII.lg}
			border={highlighted ? BORDER.heavy : BORDER.ink}
			shadow={highlighted ? "sticker" : "sm"}
			onPress={canPick ? () => onPick(index) : undefined}
			accessibilityRole={canPick ? "button" : "image"}
			accessibilityLabel={`The ${name}: ${pile}`}
			accessibilityHint={canPick ? `Picks the ${name} for today` : undefined}
			accessibilityState={{ selected: highlighted }}
			testID={`ol-place-${id}`}
			style={[styles.card, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
		>
			<View style={[styles.cardName, { height: sizes.nameH }]}>
				<T role="hand" align="center" numberOfLines={1} maxFontSizeMultiplier={TYPE_CAP}>
					{name}
				</T>
			</View>
			<View style={{ height: sizes.heap }} />
			{sizes.art > 0 ? (
				<Image
					source={OUT_LOOKING_ART[id]}
					style={{ width: sizes.art, height: sizes.art }}
					resizeMode="contain"
					accessible={false}
					testID={`ol-art-${id}`}
				/>
			) : null}
		</Sticker>
	);
}

function HeapLayer({ heap, glyph: size, reduce, testID }: { heap: Heap; glyph: number; reduce: boolean; testID: string }) {
	return (
		<>
			{heap.bare ? (
				<View
					pointerEvents="none"
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					style={[styles.bare, { left: heap.centre.x - BARE_W / 2, top: heap.centre.y - size / 2, height: size }]}
					testID={testID}
				>
					<T role="hand" tone="secondary" align="center" numberOfLines={1} maxFontSizeMultiplier={TYPE_CAP}>
						bare today
					</T>
				</View>
			) : null}
			{heap.tiles.map((tile, i) => {
				const glyph = <Glyph name={findArtGlyph(tile.find)} size={size} />;
				return (
					<View
						key={tile.key}
						pointerEvents="none"
						accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
						style={[
							styles.tile,
							{ left: tile.at.x - size / 2, top: tile.at.y - size / 2, transform: [{ rotate: `${HEAP_TILT_DEG[i % HEAP_TILT_DEG.length]}deg` }] },
						]}
					>
						{tile.fresh ? <DropIn reduce={reduce}>{glyph}</DropIn> : glyph}
					</View>
				);
			})}
			{heap.more ? (
				<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.more, { left: heap.more.at.x - MORE_W / 2, top: heap.more.at.y - size / 2, height: size }]}>
					<T role="label" tone="secondary" align="center" maxFontSizeMultiplier={TYPE_CAP}>{`+${heap.more.count}`}</T>
				</View>
			) : null}
		</>
	);
}

/** Pinned to the card's corner nearest the yard, half on the card. An empty
 *  pile wears no tag: there is nothing to weigh. */
function WeightTag({ rect, geo, weight }: { rect: Rect; geo: Geometry; weight: number }) {
	if (weight <= 0) return null;
	// Left-hand and centred cards pin it on their right corner, right-hand cards on their left.
	const cornerX = rect.x + rect.w / 2 <= geo.width / 2 + 1 ? rect.x + rect.w : rect.x;
	return (
		<View
			pointerEvents="none"
			accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
			style={[styles.weight, { left: cornerX - WEIGHT_TAG / 2, top: rect.y + WEIGHT_DROP - WEIGHT_TAG / 2 }]}
		>
			<T role="numeral" align="center" maxFontSizeMultiplier={TYPE_CAP}>
				{weight}
			</T>
		</View>
	);
}

const styles = StyleSheet.create({
	field: { alignSelf: "stretch" },
	stage: { position: "absolute", left: FIELD_PAD, top: FIELD_PAD },
	yard: {
		position: "absolute",
		backgroundColor: WHIMSY.cream,
		borderRadius: RADII.xl,
		borderWidth: BORDER.thin,
		borderStyle: "dashed",
		borderColor: UI_COLORS.border,
	},
	card: {
		position: "absolute",
		alignItems: "center",
		paddingTop: CARD_PAD_TOP,
		paddingHorizontal: CARD_PAD_X,
		gap: CARD_GAP,
	},
	cardName: { alignSelf: "stretch", justifyContent: "center" },
	tile: { position: "absolute" },
	more: { position: "absolute", width: MORE_W, justifyContent: "center" },
	bare: { position: "absolute", width: BARE_W, justifyContent: "center" },
	weight: {
		position: "absolute",
		minWidth: WEIGHT_TAG,
		minHeight: WEIGHT_TAG,
		paddingHorizontal: SPACE.xs,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	muddyArt: { width: "100%", height: "100%" },
});
