// Phase 2 — the daily ritual picker. One component, two modes:
//   mode="bless" → casts today's blessing via send_blessing
//   mode="curse" → casts today's curse via send_curse
//
// The kind is NOT chosen by the user — it's whatever today's rotation
// surfaces. The picker just shows what today's ritual is and lets the
// user fire it at the target. Mounted from UserSheet (and later the
// Friends rows) as a small inline panel.
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { dailyRitual, type RitualMode } from "../utils/rituals";
import { FONTS, KICKER_TEXT, WHIMSY } from "@/constants/theme";

interface Props {
	mode: RitualMode;
	targetUserId: string;
	targetName: string;
	// Fired after a successful cast so the parent can refresh.
	onCast?: () => void;
}

export function RitualPicker({ mode, targetUserId, targetName, onCast }: Props) {
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<string | null>(null);
	// null = not cast yet, true = cast landed, false = cast rejected.
	const [castOk, setCastOk] = useState<boolean | null>(null);

	const ritual = dailyRitual(mode);
	const isBless = mode === "bless";

	const cast = async () => {
		if (busy) return;
		setBusy(true);
		setResult(null);
		const rpc = isBless ? "send_blessing" : "send_curse";
		const { data } = await supabase.rpc(rpc, { target_user_id: targetUserId });
		const r = data as { ok?: boolean; reason?: string } | null;
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(
				isBless
					? Haptics.NotificationFeedbackType.Success
					: Haptics.NotificationFeedbackType.Warning
			).catch(() => {});
			setCastOk(true);
			setResult(
				isBless
					? `${ritual.name} sent to ${targetName}`
					: `${targetName} has been cursed`
			);
			onCast?.();
		} else {
			setCastOk(false);
			setResult(reasonText(r?.reason, isBless));
		}
	};

	return (
		<View
			style={[
				styles.wrap,
				{ backgroundColor: isBless ? WHIMSY.sun : "#D5E4C9" },
			]}
		>
			<Text style={styles.kicker}>
				{isBless ? "☀ today's blessing" : "🟢 today's curse"}
			</Text>

			{castOk === true ? (
				// The cast landed — a prominent confirmation beat, not a
				// quiet one-liner. The button is gone; the deed is done.
				<View style={styles.castDone}>
					<Text style={styles.castDoneEmoji}>{ritual.emoji}</Text>
					<Text style={styles.castDoneTitle}>
						{isBless ? "✦ blessing sent ✦" : "✦ curse cast ✦"}
					</Text>
					<Text style={styles.castDoneSub}>{result}</Text>
				</View>
			) : (
				<>
					<View style={styles.ritualRow}>
						<Text style={styles.emoji}>{ritual.emoji}</Text>
						<View style={{ flex: 1, minWidth: 0 }}>
							<Text style={styles.name}>{ritual.name}</Text>
							<Text style={styles.blurb}>{ritual.blurb}</Text>
						</View>
					</View>
					<Pressable
						testID="ritual-cast"
						onPress={cast}
						disabled={busy}
						style={({ pressed }) => [
							styles.btn,
							(pressed || busy) && { opacity: 0.7 },
						]}
					>
						<Text style={styles.btnText}>
							{busy
								? "…"
								: isBless
									? `Bless ${targetName}`
									: `Curse ${targetName}`}
						</Text>
					</Pressable>
					{castOk === false && !!result && (
						<Text style={styles.result}>{result}</Text>
					)}
				</>
			)}
		</View>
	);
}

function reasonText(reason: string | undefined, isBless: boolean): string {
	switch (reason) {
		case "daily_cap":
			return "You've used all your casts for today.";
		case "already_blessed_today":
			return "Already blessed them today.";
		case "already_cursed_today":
			return "Already cursed them today.";
		case "not_friends":
			return "Only friends can be reached.";
		case "self":
			return "That's you.";
		default:
			return isBless ? "Couldn't bless. Try again." : "Couldn't curse. Try again.";
	}
}

const styles = StyleSheet.create({
	wrap: {
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		padding: 12,
		marginTop: 10,
	},
	kicker: { ...KICKER_TEXT, fontSize: 10, marginBottom: 8 },
	ritualRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
	emoji: { fontSize: 30 },
	name: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	blurb: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.ink, marginTop: 1 },
	btn: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 9,
		alignItems: "center",
	},
	btnText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	result: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 8,
	},
	castDone: { alignItems: "center", paddingVertical: 6 },
	castDoneEmoji: { fontSize: 44, marginBottom: 4 },
	castDoneTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	castDoneSub: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		marginTop: 2,
	},
});
