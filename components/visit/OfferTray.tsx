// The offer tray — the card that rises from the strip when you tap a lifted
// find. It is the whole swap decision in one shape:
//
//   [red berries]  Maple's pig can spare
//                  one of these for your red berries        (×)
//   [ old key ] [ river pebble ] [ pinecone ]
//              …or just give it
//
// The options are the SERVER's (`_wish_options`, frozen per wish_no) — the
// client renders what `friend_wishes` returned and never recomputes the rule,
// so a host's bag is never on show beyond the three. An empty list is the
// honest "gift only" state, not a failure.
//
// WHERE IT SITS (docs/design/claude-design/swap-2026-09-16, the `tray` board).
// It is NOT a centred dialog: a card in the middle of the phone covers both
// pigs and the wish bubble over the host's head, which are the two things the
// decision is about. The tray is LOW — a paper `Sticker` at `TILT.dialog`
// pinned to the bottom of the visit's content layer, `PAGE_PAD` in from each
// edge, its bottom edge on the same line the action bar floats its pill
// (`insets.bottom + TRAY_FLOAT` — 46pt on a 390x844, the canvas value). It
// draws OVER the strip it came from and under the receipt / nap dialogs.
//
// There is no scrim, for the same reason: the pigs stay visible. The wrapper is
// `box-none` so a tap outside the card still reaches the pigs on the visit's
// `box-none` stage (the Fabric overlay footgun — a full-bleed `auto` layer eats
// every tap); the card itself is a plain `auto` view, so it swallows the taps
// that land on it rather than letting them through to the stage underneath.
// Tapping outside does NOT close the tray — the × does. Nothing about the strip
// changes while the tray is open.
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { satchelFind, type SatchelFindId } from "@/constants/satchel";
import {
	ART_SIZE,
	BORDER,
	PAGE_PAD,
	RADII,
	SPACE,
	TAP_MIN,
	TILT,
} from "@/constants/theme";
import { Button, IconButton, Sticker, T } from "../ui";
import { FindArt } from "../satchel/FindArt";
import { VISIT_TYPE_CAP } from "./chrome";

// How far the card floats above the home indicator — the same float the action
// bar gives its pill, so the two share one bottom line. A drawing offset
// against a device inset, not a step on the spacing scale.
const TRAY_FLOAT = SPACE.md;

// The close ring: the drawn circle inside the 44pt frame `IconButton`
// guarantees. A drawing size, not a spacing step.
const CLOSE_RING = 30;

export function OfferTray({
	hostName,
	give,
	options,
	busy,
	onTake,
	onClose,
}: {
	hostName: string;
	/** The find you are handing over — the wish the host's pig is hoping for. */
	give: SatchelFindId;
	/** Up to three finds the host's bag can spare. Empty = gift only. */
	options: SatchelFindId[];
	busy: boolean;
	/** A find id takes that one back; null is "…or just give it". */
	onTake: (take: SatchelFindId | null) => void;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const giveName = satchelFind(give)?.name ?? "find";
	const canSpare = options.length > 0;
	return (
		<View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + TRAY_FLOAT }]}>
			<Sticker
				color="paper"
				radius={RADII.xl}
				rotate={TILT.dialog}
				shadow="sticker"
				style={styles.card}
				testID="visit-offer-tray"
			>
				{/* The header names the trade in the host's voice, with the find you
				    are giving drawn as the strip's own lifted tile — the same object,
				    carried up into the card. */}
				<View style={styles.head}>
					<View style={styles.gave}>
						<Sticker
							color="sun"
							radius={RADII.lg}
							border={BORDER.heavy}
							shadow="sm"
							rotate={0}
							style={styles.giveTile}
						>
							<FindArt id={give} size={ART_SIZE.glyphSm} />
						</Sticker>
						<View style={styles.headText}>
							<T role="kicker" tone="accent" maxFontSizeMultiplier={VISIT_TYPE_CAP}>
								{canSpare ? `${hostName}'s pig can spare` : `${hostName}'s pig`}
							</T>
							<T role="cardTitle" maxFontSizeMultiplier={VISIT_TYPE_CAP}>
								{canSpare
									? `one of these for your ${giveName}`
									: "has nothing to spare yet"}
							</T>
						</View>
					</View>
					<IconButton
						name="x"
						label="Back to the visit"
						accessibilityHint="Closes what their pig can spare. Nothing is swapped."
						onPress={onClose}
						visualSize={CLOSE_RING}
						iconSize={ART_SIZE.mark}
						style={styles.close}
					/>
				</View>
				{canSpare ? (
					<View style={styles.row} accessibilityRole="list">
						{options.map((id) => {
							const f = satchelFind(id);
							return (
								<Sticker
									key={id}
									color="paper"
									radius={RADII.lg}
									border={BORDER.thin}
									shadow="none"
									rotate={0}
									disabled={busy}
									onPress={() => onTake(id)}
									accessibilityRole="button"
									accessibilityLabel={`Take the ${f?.name ?? "find"}`}
									accessibilityHint={`Gives their pig your ${giveName} and puts the ${f?.name ?? "find"} in your Satchel.`}
									testID="visit-offer-option"
									style={styles.tile}
								>
									<FindArt id={id} size={ART_SIZE.glyph} />
									<T
										role="kicker"
										align="center"
										maxFontSizeMultiplier={VISIT_TYPE_CAP}
									>
										{f?.name ?? "find"}
									</T>
								</Sticker>
							);
						})}
					</View>
				) : (
					<T role="hand" tone="secondary" maxFontSizeMultiplier={VISIT_TYPE_CAP}>
						a gift still tickles you both — and it lands in the bag over there, so
						next time there may be something to spare.
					</T>
				)}
				{/* With options the gift is the quiet way out; with none it IS the
				    decision, so it wears the gold. */}
				<Button
					variant={canSpare ? "link" : "gold"}
					full
					disabled={busy}
					onPress={() => onTake(null)}
					maxFontSizeMultiplier={VISIT_TYPE_CAP}
					accessibilityLabel="Just give it"
					accessibilityHint={`Hands their pig your ${giveName} and takes nothing back.`}
					testID="visit-offer-gift"
				>
					{canSpare ? "…or just give it" : "Just give it"}
				</Button>
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	// The layer: `box-none` so only the card takes touches; `bottom` is the
	// device inset plus the float, supplied at render.
	wrap: { position: "absolute", left: PAGE_PAD, right: PAGE_PAD },
	card: { padding: SPACE.card, gap: SPACE.md },
	head: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
	gave: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	giveTile: {
		width: TAP_MIN,
		height: TAP_MIN,
		alignItems: "center",
		justifyContent: "center",
	},
	headText: { flex: 1, minWidth: 0 },
	// The 44pt frame is pulled into the card's own padding so the ring sits on
	// the card's top-right corner rather than pushing the header down.
	close: { marginTop: -SPACE.sm, marginRight: -SPACE.sm },
	row: { flexDirection: "row", gap: SPACE.sm },
	// Equal columns, never a tile that reads bigger because its name is longer.
	tile: {
		flex: 1,
		minHeight: TAP_MIN,
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
});
