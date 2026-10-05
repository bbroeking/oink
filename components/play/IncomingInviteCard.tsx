// An invite waiting for you, on the hub: the inviter's pig, "Clover wants to
// play Rootle", how long the seat is held, and two answers. A card, not a
// row, because it asks something of you; Accept takes the seat, Not now lets
// it go (a direct invite tells the inviter "not this time"; a link or
// Sounder invite simply leaves the list, nobody is told anything).

import { StyleSheet, View } from "react-native";
import { Button, Hand, PigAvatar, Sticker, T } from "@/components/ui";
import { AVATAR_SIZE, SPACE, TILT } from "@/constants/theme";
import { getGame } from "@/multiplayer/games";
import type { InviteSummary } from "@/multiplayer/protocol";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { INCOMING_COPY, fill, leftWords } from "./playCopy";

export interface IncomingInviteCardProps {
	invite: InviteSummary;
	now: number;
	busy: "accept" | "decline" | null;
	onAccept: () => void;
	onNotNow: () => void;
}

export function IncomingInviteCard({ invite, now, busy, onAccept, onNotNow }: IncomingInviteCardProps) {
	const game = getGame(invite.game)?.title ?? invite.game;
	const line = fill(INCOMING_COPY.wants, { name: invite.from.name, game });
	const left = leftWords(invite.expiresAt - now);
	return (
		<Sticker color="rose" rotate={TILT.card} pad style={styles.card} testID={`incoming-${invite.code}`}>
			<View style={styles.row} accessible accessibilityLabel={`${line}, ${left}`}>
				<PigAvatar size={AVATAR_SIZE[2]} pigId={pigStagePropsForLook(invite.from.look).pigId} hatId={invite.from.look.hat} bowId={invite.from.look.bow} mode="worn" />
				<View style={styles.words}>
					<T role="cardTitleSm">{line}</T>
					<Hand tone="secondary">{left}</Hand>
				</View>
			</View>
			<View style={styles.actions}>
				<Button
					variant="primary"
					size="sm"
					loading={busy === "accept"}
					disabled={busy !== null}
					onPress={onAccept}
					accessibilityHint={fill(INCOMING_COPY.acceptHint, { name: invite.from.name })}
					style={styles.half}
					testID={`incoming-accept-${invite.code}`}
				>
					{INCOMING_COPY.accept}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					loading={busy === "decline"}
					disabled={busy !== null}
					onPress={onNotNow}
					accessibilityHint={INCOMING_COPY.notNowHint}
					style={styles.half}
					testID={`incoming-not-now-${invite.code}`}
				>
					{INCOMING_COPY.notNow}
				</Button>
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: { gap: SPACE.sm },
	row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	words: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	actions: { flexDirection: "row", gap: SPACE.sm },
	half: { flex: 1 },
});
