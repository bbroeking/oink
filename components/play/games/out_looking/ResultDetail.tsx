// The result sheet's detail: every pig's pouch, heaviest first, drawn as the
// finds themselves with the weight beside them (and the hearts that break a
// tie). A pouch is a thing you collected, so it is shown, never summed alone.

import { StyleSheet, View } from "react-native";
import { Glyph, Hand, Numeral, PigAvatar, T } from "@/components/ui";
import { findArtGlyph } from "@/components/satchel/FindArt";
import { ART_SIZE, AVATAR_SIZE, SPACE } from "@/constants/theme";
import type { OlView } from "@/multiplayer/games/out_looking/rules";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { heartsLabel, listFinds } from "./model";

const TYPE_CAP = 1.3;

export function OutLookingResult({ view, room, you }: { view: OlView; room: RoomSnapshot<OlView>; you: number }) {
	const order = Array.from({ length: view.seats }, (_, s) => s)
		.filter((s) => room.seats.some((info) => info.seat === s))
		.sort((a, b) => view.weights[b] - view.weights[a] || view.hearts[b] - view.hearts[a] || a - b);
	return (
		<View style={styles.list} testID="ol-result">
			{order.map((seat) => {
				const info = room.seats.find((s) => s.seat === seat);
				const look = pigStagePropsForLook(info?.look);
				const name = seat === you ? `${info?.name ?? "You"} (you)` : (info?.name ?? "A pig");
				const pouch = view.pouches[seat] ?? [];
				const hearts = view.hearts[seat] ?? 0;
				const said = `${name}: ${pouch.length > 0 ? `${listFinds(pouch)}, weight ${view.weights[seat]}` : "came home light"}${hearts > 0 ? `, ${heartsLabel(hearts)}` : ""}`;
				return (
					<View key={seat} style={styles.row} accessible accessibilityLabel={said} testID={`ol-result-${seat}`}>
						<PigAvatar size={AVATAR_SIZE[0]} pigId={look.pigId} hatId={info?.look.hat} bowId={info?.look.bow} mode="worn" />
						<View style={styles.body}>
							<View style={styles.head}>
								<T role="label" numberOfLines={1} maxFontSizeMultiplier={TYPE_CAP} style={styles.name}>
									{name}
								</T>
								{hearts > 0 ? (
									<View style={styles.hearts}>
										<Glyph name="heart" size={ART_SIZE.mark} />
										<T role="label" tone="secondary" maxFontSizeMultiplier={TYPE_CAP}>
											{hearts}
										</T>
									</View>
								) : null}
								<Numeral maxFontSizeMultiplier={TYPE_CAP}>{view.weights[seat]}</Numeral>
							</View>
							{pouch.length > 0 ? (
								<View style={styles.pouch}>
									{pouch.map((find, i) => (
										<Glyph key={`${find}-${i}`} name={findArtGlyph(find)} size={ART_SIZE.glyphSm} />
									))}
								</View>
							) : (
								<Hand tone="secondary" maxFontSizeMultiplier={TYPE_CAP}>
									came home light
								</Hand>
							)}
						</View>
					</View>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	list: { gap: SPACE.md },
	row: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
	body: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	head: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	name: { flex: 1, minWidth: 0 },
	hearts: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs },
	pouch: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xxs },
});
