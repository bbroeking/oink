// The visit's bag — a strip of the finds you carried here, above the action
// bar. The one that matches the host pig's wish is LIFTED (sun fill, heavy
// border) and is the only find that does anything on a tap: it opens the
// OFFER TRAY, where you choose what to take back or just give it. Every other
// find bounces — the pig sniffs it and it stays in the bag, no server call,
// free to try (docs/satchel-spec.md §5, "wrong item").
//
// Tap, not drag: the visit's controls float over a `box-none` stage on the
// new architecture, and a pan across that layer would have to fight the pigs'
// own presses. A lifted find that reads "swap this" is the same decision with
// one motion fewer.
//
// States:
//   loading        → nothing (the strip never flashes an empty bag)
//   unavailable    → nothing (server without the Satchel — un-pushed)
//   empty bag      → the bag glyph, "dig to fill it", and the wish still shows
//                    over the pig so the player knows what to bring back
//   swapped        → the strip goes quiet: one line saying what moved which
//                    way, and the remaining finds at rest
//   swapped today  → the pair's one swap a day is spent: nothing lifts, and
//                    the line says so rather than inviting a bounce
import { StyleSheet, View } from "react-native";
import { satchelFind, type SatchelFindId } from "@/constants/satchel";
import { ART_SIZE, BORDER, OPACITY, PAGE_PAD, RADII, SPACE, TAP_MIN } from "@/constants/theme";
import { matchingItems, satchelStanding, wishOpenForMe, type FriendWish, type SatchelItem } from "@/utils/satchel";
import { Glyph, Sticker, T } from "../ui";
import { FindArt } from "../satchel/FindArt";
import { VISIT_TYPE_CAP } from "./chrome";

// A find's tile: a tap-minimum square, so six fit a phone with the gaps.
const TILE = TAP_MIN;

export function SatchelStrip({
	items,
	cap,
	wish,
	swapped,
	busy,
	onOpenTray,
	onBounce,
}: {
	items: SatchelItem[];
	cap: number;
	wish: FriendWish | null;
	/** What moved this visit, once the server said yes. `took` null = a gift. */
	swapped: { gave: SatchelFindId; took: SatchelFindId | null } | null;
	busy: boolean;
	/** The lifted tap: the tray rises and owns the decision. */
	onOpenTray: (item: SatchelItem) => void;
	onBounce: (item: SatchelItem) => void;
}) {
	const open = !!wish && wishOpenForMe(wish) && !swapped;
	const matches = open ? new Set(matchingItems(items, wish).map((it) => it.id)) : new Set<number>();
	const wishName = wish ? satchelFind(wish.find_id)?.withArticle : null;
	const name = (id: SatchelFindId) => satchelFind(id)?.name ?? "find";

	let line: string;
	if (swapped) {
		line = swapped.took
			? `you swapped the ${name(swapped.gave)} for the ${name(swapped.took)}`
			: `you gave the ${name(swapped.gave)}`;
	} else if (wish?.swapped_today) {
		line = "you two swapped today";
	} else if (items.length === 0) {
		line = "your Satchel is empty — dig to fill it";
	} else if (matches.size > 0) {
		line = `you have ${wishName} — tap it to swap`;
	} else if (wish && wish.fulfilled_by_me) {
		line = "you already brought this one";
	} else if (wishName) {
		line = `nothing here is ${wishName}`;
	} else {
		line = `${satchelStanding(items.length, cap) ?? `${items.length} finds`} in your Satchel`;
	}

	return (
		<View style={styles.wrap} testID="visit-satchel-strip">
			<View style={styles.head}>
				<Glyph name="digBag" size={ART_SIZE.mark} />
				<T role="kicker" tone="secondary" numberOfLines={1} maxFontSizeMultiplier={VISIT_TYPE_CAP}>
					{line}
				</T>
			</View>
			{items.length > 0 && (
				<View style={styles.row} accessibilityRole="list">
					{items.map((it) => {
						const lifted = matches.has(it.id);
						const f = satchelFind(it.find_id);
						return (
							<Sticker
								key={it.id}
								color={lifted ? "sun" : "paper"}
								radius={RADII.lg}
								border={lifted ? BORDER.heavy : BORDER.thin}
								shadow={lifted ? "sm" : "none"}
								rotate={0}
								disabled={busy}
								onPress={() => (lifted ? onOpenTray(it) : onBounce(it))}
								accessibilityRole="button"
								accessibilityLabel={
									lifted ? `Swap the ${f?.name ?? "find"}` : `Try the ${f?.name ?? "find"}`
								}
								accessibilityHint={
									lifted
										? "Opens what their pig can spare for it."
										: "Not what their pig is hoping for — it stays in your bag."
								}
								testID={lifted ? "visit-find-lifted" : "visit-find"}
								style={[styles.tile, !lifted && open && styles.tileRest]}
							>
								<FindArt id={it.find_id} size={ART_SIZE.glyphSm} />
							</Sticker>
						);
					})}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { paddingHorizontal: PAGE_PAD, gap: SPACE.xs },
	head: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	row: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
	tile: { width: TILE, height: TILE, alignItems: "center", justifyContent: "center" },
	tileRest: { opacity: OPACITY.muted },
});
