// The lobby (phase "lobby"): an invite table filling up. The seated pigs
// stand in a row with dashed "an open seat" spots for the chairs still
// empty. The host holds the invite: its link to copy or share, Start now
// once the game's minimum is seated (the table also starts by itself the
// moment every seat is taken), and Call it off. A guest sees whose table it
// is and waits; nothing a guest can tap here costs anyone anything.
//
// A link or Sounder invite also shows its code, large and in two groups of
// four ("MQSW N29C") so a host can read it out across a room or a call, with
// Copy link and Share right under it. A direct invite has no code to read:
// only the friends it names may sit, and they have a ping.

import { useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Button, CardTitle, Glyph, Hand, Kicker, Sticker, T, Tag } from "@/components/ui";
import { ART_SIZE, CHROME_TYPE_CAP, OPACITY, RADII, SPACE, TYPE } from "@/constants/theme";
import { useServerClock, type RoomSource } from "@/hooks/useMultiplayer";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import { TablePig } from "./TablePig";
import { COPIED_BEAT_MS, LOBBY_PIG } from "./layout";
import { LOBBY_COPY, MATCH_COPY, fill, leftWords, seatName } from "./playCopy";

// The invite's time left only needs to move by the minute.
const LOBBY_TICK_MS = 15_000;
// The code reads aloud in groups this long, like a phone number.
const CODE_GROUP = 4;

/** "MQSWN29C" as it is drawn ("MQSW N29C") and as it is spoken
 *  ("M Q S W, N 2 9 C": a screen reader spells it, with a breath between
 *  the groups). */
export function codeWords(code: string): { drawn: string; spoken: string } {
	const groups: string[] = [];
	for (let i = 0; i < code.length; i += CODE_GROUP) groups.push(code.slice(i, i + CODE_GROUP));
	return { drawn: groups.join(" "), spoken: groups.map((g) => g.split("").join(" ")).join(", ") };
}

export interface LobbyCardProps {
	room: RoomSnapshot;
	source: RoomSource;
	gameTitle: string;
	/** The game's fewest seats a table may start with. */
	minSeats: number;
	starting: boolean;
	onStart: () => void;
	onCancel: () => void;
}

export function LobbyCard({ room, source, gameTitle, minSeats, starting, onStart, onCancel }: LobbyCardProps) {
	const now = useServerClock(LOBBY_TICK_MS, source);
	const host = room.host !== null && room.host === room.you;
	const invite = room.invite;
	const seated = room.seats.filter((s) => !s.gone);
	const open = Math.max(0, room.seatCount - seated.length);
	const short = Math.max(0, minSeats - seated.length);
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_BEAT_MS);
		return () => clearTimeout(timer);
	}, [copied]);

	const hostLine = invite?.kind === "direct" ? LOBBY_COPY.directLine : invite?.kind === "crew" ? LOBBY_COPY.crewLine : LOBBY_COPY.hostLine;
	// A code only a link or a Sounder invite can be taken with.
	const showsCode = host && !!invite && invite.kind !== "direct";
	const code = invite ? codeWords(invite.code) : null;
	const hostName = room.host !== null ? seatName(room, room.host) : null;
	// A table the queue is gathering (a party game pulling in a few more pigs
	// for a moment) has no host and starts by itself.
	const gathering = room.source === "queue";
	const guestLine = gathering ? LOBBY_COPY.gathering : hostName ? fill(LOBBY_COPY.waitingHost, { name: hostName }) : LOBBY_COPY.startsWhenFull;

	const copy = async () => {
		if (!invite?.url) return;
		try {
			await Clipboard.setStringAsync(invite.url);
			setCopied(true);
		} catch {
			// The clipboard said no: the Share button still works.
		}
	};
	const share = async () => {
		if (!invite?.url) return;
		try {
			await Share.share({ message: `${fill(LOBBY_COPY.shareMessage, { game: gameTitle })}\n${invite.url}` });
		} catch {
			// Cancelled, or the sheet could not open: nothing to undo.
		}
	};

	const linkRow = (
		<View style={styles.linkRow}>
			<Button variant="ghost" size="sm" onPress={() => void copy()} accessibilityHint={LOBBY_COPY.copyHint} style={styles.half} testID="lobby-copy">
				{copied ? LOBBY_COPY.copied : LOBBY_COPY.copy}
			</Button>
			<Button variant="lilac" size="sm" onPress={() => void share()} accessibilityHint={LOBBY_COPY.shareHint} style={styles.half} testID="lobby-share">
				{LOBBY_COPY.share}
			</Button>
		</View>
	);

	return (
		<View style={styles.wrap} testID="lobby-card">
			<Sticker color="paper" pad style={styles.card}>
				<Kicker>{host ? LOBBY_COPY.kickerHost : LOBBY_COPY.kickerGuest}</Kicker>
				<CardTitle>{gameTitle}</CardTitle>
				<Hand tone="secondary">{host ? hostLine : guestLine}</Hand>

				<View style={styles.seats} accessibilityRole="list">
					{seated.map((s) => (
						<View key={s.seat} style={styles.seat} accessible accessibilityLabel={s.seat === room.you ? MATCH_COPY.you : s.name} testID={`lobby-seat-${s.seat}`}>
							<TablePig look={s.look} size={LOBBY_PIG} />
							<Tag flat label={s.seat === room.you ? MATCH_COPY.you : s.name} tone={s.seat === room.host ? "sun" : "paper"} style={styles.seatTag} />
						</View>
					))}
					{Array.from({ length: open }, (_, i) => (
						<View key={`open-${i}`} style={styles.seat} accessible accessibilityLabel={LOBBY_COPY.openSeat} testID="lobby-open-seat">
							<View style={styles.openSpot}>
								<Sticker color="cream" radius={RADII.pill} borderStyle="dashed" shadow="none" rotate={0} style={styles.openDisc}>
									<Glyph name="pigface" size={ART_SIZE.glyphSm} style={styles.ghost} />
								</Sticker>
							</View>
							<Tag flat label={LOBBY_COPY.openSeatTag} tone="muted" style={styles.seatTag} />
						</View>
					))}
				</View>

				{showsCode && code ? (
					// Printed, not pressed: a flat inset, the code, and its two doors.
					<Sticker color="cream" radius={RADII.md} shadow="none" rotate={0} pad style={styles.codeBlock} testID="lobby-code-block">
						<Kicker align="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
							{LOBBY_COPY.codeKicker}
						</Kicker>
						<T
							role="display"
							align="center"
							maxFontSizeMultiplier={CHROME_TYPE_CAP}
							accessibilityRole="text"
							accessibilityLabel={fill(LOBBY_COPY.codeLabel, { code: code.spoken })}
							style={styles.code}
							testID="lobby-code"
						>
							{code.drawn}
						</T>
						{invite?.url ? linkRow : null}
					</Sticker>
				) : host && invite?.url ? (
					linkRow
				) : null}

				{host ? (
					short > 0 ? (
						<Hand tone="secondary" align="center" testID="lobby-need-more">
							{room.seatCount <= minSeats
								? LOBBY_COPY.startsWhenFull
								: fill(short === 1 ? LOBBY_COPY.needMore : LOBBY_COPY.needMorePlural, { n: String(short) })}
						</Hand>
					) : open > 0 ? (
						<Button variant="primary" size="lg" full loading={starting} loadingLabel="starting" onPress={onStart} accessibilityHint={LOBBY_COPY.startHint} testID="lobby-start">
							{LOBBY_COPY.start}
						</Button>
					) : null
				) : guestLine !== LOBBY_COPY.startsWhenFull && !gathering ? (
					<Hand tone="secondary" align="center">
						{LOBBY_COPY.startsWhenFull}
					</Hand>
				) : null}

				{invite && invite.status === "open" ? (
					<Hand tone="secondary" align="center" style={styles.expiry} testID="lobby-expiry">
						{fill(LOBBY_COPY.expires, { left: leftWords(invite.expiresAt - now) })}
					</Hand>
				) : null}
			</Sticker>

			{host ? (
				<Button variant="handLink" size="sm" onPress={onCancel} accessibilityHint={LOBBY_COPY.cancelHint} testID="lobby-cancel">
					{LOBBY_COPY.cancel}
				</Button>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.sm, alignItems: "center" },
	card: { alignSelf: "stretch", gap: SPACE.sm },
	seats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACE.md, marginVertical: SPACE.sm },
	seat: { alignItems: "center", gap: SPACE.xs },
	seatTag: { maxWidth: LOBBY_PIG },
	openSpot: { width: LOBBY_PIG, height: LOBBY_PIG, alignItems: "center", justifyContent: "center" },
	openDisc: { width: ART_SIZE.badge, height: ART_SIZE.badge, alignItems: "center", justifyContent: "center" },
	ghost: { opacity: OPACITY.ghost },
	codeBlock: { gap: SPACE.sm },
	// Tracked like the pill kickers: each character stands apart when read out.
	code: { letterSpacing: TYPE.kickerPill.letterSpacing },
	linkRow: { flexDirection: "row", gap: SPACE.sm },
	half: { flex: 1 },
	expiry: { marginTop: SPACE.xxs },
});
