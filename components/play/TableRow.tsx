// One of "Your tables" on the hub: a play-by-post table or a live one still
// going. The pig you are playing leads the row with the game's icon tucked at
// its corner (or the icon alone while a chair waits for its pig); "Your move"
// wears the sun, and a by-post table you are waiting on says how long the
// other pig has. A tap opens the table.
//
// The status is chrome: it caps at CHROME_TYPE_CAP, and past that size it
// drops under the names instead of riding the row's end, where it squeezed
// the game and the pig out of the row (the 2026-10-04 run, A-11a). The
// game's name wraps to two lines rather than being cut.

import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { ListRow, PigAvatar, T, Tag, Hand } from "@/components/ui";
import { AVATAR_SIZE, CHROME_TYPE_CAP, SPACE } from "@/constants/theme";
import { getGame } from "@/multiplayer/games";
import type { RoomSummary } from "@/multiplayer/protocol";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { GAME_ICONS } from "./playArt";
import { GAME_ICON_ROW } from "./layout";
import { TABLE_COPY, fill, leftWords, withLine } from "./playCopy";

// The game's icon tucked at the corner of the pig: half the avatar.
const CORNER_ICON = AVATAR_SIZE[1] / 2;

export function TableRow({ table, index, now, onPress }: { table: RoomSummary; index: number; now: number; onPress: () => void }) {
	const title = getGame(table.game)?.title ?? table.game;
	const names = table.opponents.map((o) => o.name);
	const first = table.opponents[0] ?? null;
	const status = statusOf(table, now);
	const { fontScale } = useWindowDimensions();
	const stacked = fontScale > CHROME_TYPE_CAP;
	const statusMark = status.tag ? (
		<Tag flat label={status.label} tone={status.tag} maxFontSizeMultiplier={CHROME_TYPE_CAP} style={stacked ? styles.stackedTag : undefined} testID={`table-status-${table.roomId}`} />
	) : (
		<Hand tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP} testID={`table-status-${table.roomId}`}>
			{status.label}
		</Hand>
	);
	return (
		<ListRow
			index={index}
			fill={table.yourTurn ? "cream" : "paper"}
			leading={
				first ? (
					<View>
						<PigAvatar size={AVATAR_SIZE[1]} pigId={pigStagePropsForLook(first.look).pigId} hatId={first.look.hat} bowId={first.look.bow} mode="worn" />
						<Image source={GAME_ICONS[table.game]} resizeMode="contain" style={styles.corner} />
					</View>
				) : (
					<Image source={GAME_ICONS[table.game]} resizeMode="contain" style={styles.icon} />
				)
			}
			title={
				<T role="cardTitleSm" numberOfLines={2}>
					{title}
				</T>
			}
			sub={
				stacked ? (
					<View style={styles.stackedSub}>
						<T role="hand" tone="secondary">
							{withLine(names)}
						</T>
						{statusMark}
					</View>
				) : (
					withLine(names)
				)
			}
			trailing={stacked ? undefined : statusMark}
			onPress={onPress}
			accessibilityLabel={`${title}, ${withLine(names)}, ${status.label}`}
			accessibilityHint={fill(TABLE_COPY.open, { game: title })}
			testID={`table-row-${table.roomId}`}
		/>
	);
}

function statusOf(table: RoomSummary, now: number): { label: string; tag: "sun" | "sky" | null } {
	if (table.yourTurn) {
		// By post, the move comes with how long it waits.
		const left = table.pace === "async" && table.deadline !== null ? ` · ${leftWords(table.deadline - now)}` : "";
		return { label: `${TABLE_COPY.yourMove}${left}`, tag: "sun" };
	}
	if (table.phase === "lobby") return { label: TABLE_COPY.lobby, tag: null };
	if (table.phase === "starting") return { label: TABLE_COPY.starting, tag: "sky" };
	if (table.phase === "ended") return { label: TABLE_COPY.finished, tag: null };
	if (table.pace === "live") return { label: TABLE_COPY.live, tag: "sky" };
	return { label: waitingOn(table), tag: null };
}

function waitingOn(table: RoomSummary): string {
	const first = table.opponents[0];
	return first ? fill(TABLE_COPY.theirMove, { name: first.name }) : TABLE_COPY.waiting;
}

const styles = StyleSheet.create({
	stackedSub: { gap: SPACE.xs },
	stackedTag: { alignSelf: "flex-start" },
	icon: { width: GAME_ICON_ROW, height: GAME_ICON_ROW },
	corner: { position: "absolute", right: -SPACE.xs, bottom: -SPACE.xs, width: CORNER_ICON, height: CORNER_ICON },
});
