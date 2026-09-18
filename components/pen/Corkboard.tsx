// The corkboard — the pinboard under the fence row where returns wait. One
// paper pin per `back` errand: who it was for, the find (or the dizzy glyph
// for muddy trotters), and a hand line. A tap opens the homecoming for that
// row. Drawn only when something waits; at the cap the pig's card says
// "resting until you look".
import { ScrollView, StyleSheet, View } from "react-native";
import { Glyph, Hand, Sticker, T } from "@/components/ui";
import { FindArt } from "@/components/satchel/FindArt";
import type { ErrandRow } from "@/constants/errands";
import { ART_SIZE, BORDER, RADII, SPACE, TILT, WHIMSY } from "@/constants/theme";
import { pinKicker, type ErrandFriend } from "@/utils/errands";
import { pigDefinition } from "@/utils/pigs";

/** A pin's paper and the red pin-head on it. */
const PIN_W = 92;
const PIN_HEAD = 10;

interface Props {
	board: ErrandRow[];
	cap: number;
	friendFor: (userId: string | null) => ErrandFriend | null;
	onOpen: (row: ErrandRow) => void;
}

export function Corkboard({ board, cap, friendFor, onOpen }: Props) {
	if (board.length === 0) return null;
	const n = board.length;
	return (
		<Sticker color={WHIMSY.cork} rotate={0} radius={RADII.md} shadow="sm" style={styles.board} testID="corkboard">
			<View style={styles.label}>
				<T role="kickerPill" tone="onDark">
					{`the board · ${n} waiting${n >= cap ? " · full" : ""}`}
				</T>
			</View>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pins}>
				{board.map((row, i) => {
					const find = row.result_find_ids[0] ?? null;
					const pig = pigDefinition(row.pig_id);
					const friend = friendFor(row.for_user_id);
					const line = find ? pig.name : "muddy trotters";
					return (
						<Sticker
							key={row.id}
							color="paper"
							rotate={i % 2 === 0 ? TILT.card : -TILT.card}
							radius={RADII.sm}
							shadow="sm"
							onPress={() => onOpen(row)}
							accessibilityLabel={`${pig.name} is back, ${pinKicker(row, friend)}${find ? "" : ", empty-handed"}`}
							accessibilityHint="Opens the homecoming"
							testID={`pin-${row.id}`}
							style={styles.pin}
						>
							<View style={styles.pinHead} />
							<T role="kickerPillSm" tone="secondary" numberOfLines={1}>
								{pinKicker(row, friend)}
							</T>
							<View style={styles.art}>
								{find ? <FindArt id={find} size={ART_SIZE.glyph} /> : <Glyph name="dizzy" size={ART_SIZE.glyph} />}
							</View>
							<Hand tone="secondary" align="center" numberOfLines={1}>
								{line}
							</Hand>
						</Sticker>
					);
				})}
			</ScrollView>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	board: { marginTop: SPACE.sm, padding: SPACE.md, gap: SPACE.sm },
	label: {
		alignSelf: "flex-start",
		backgroundColor: WHIMSY.bark,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xxs,
	},
	pins: { flexDirection: "row", gap: SPACE.md, paddingVertical: SPACE.xs, paddingHorizontal: SPACE.xxs },
	pin: { width: PIN_W, alignItems: "center", padding: SPACE.sm, paddingTop: SPACE.md, gap: SPACE.xxs },
	pinHead: {
		position: "absolute",
		top: -PIN_HEAD / 2,
		alignSelf: "center",
		width: PIN_HEAD,
		height: PIN_HEAD,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.barnRed,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		zIndex: 2,
	},
	art: { paddingVertical: SPACE.xs },
});
