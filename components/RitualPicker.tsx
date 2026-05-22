// The daily ritual picker. One component, two modes:
//   mode="bless" → casts today's blessing via send_blessing
//   mode="curse" → casts today's curse via send_curse
//
// The kind is NOT chosen by the user — it's whatever today's rotation
// surfaces. Mounted from UserSheet as a small inline panel.
//
// It renders one of five phases so every outcome is a clear state,
// not a one-line error:
//   ready  — today's ritual + a Cast button
//   sent   — "✦ sent ✦" confirmation
//   done   — you already cast this ritual on this friend today
//   capped — you've used all today's blessings & curses
//   error  — an unexpected failure; the Cast button stays for a retry
import React, { useState } from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
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

type Phase = "ready" | "sent" | "done" | "capped" | "error";

export function RitualPicker({ mode, targetUserId, targetName, onCast }: Props) {
	const [busy, setBusy] = useState(false);
	const [phase, setPhase] = useState<Phase>("ready");
	const [result, setResult] = useState<string | null>(null);

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
			setResult(
				isBless
					? `${ritual.name} sent to ${targetName}`
					: `${targetName} has been cursed`
			);
			setPhase("sent");
			onCast?.();
			return;
		}

		const reason = r?.reason;
		if (reason === "already_blessed_today" || reason === "already_cursed_today") {
			setPhase("done");
		} else if (reason === "daily_cap") {
			setPhase("capped");
		} else {
			setResult(reasonText(reason, isBless));
			setPhase("error");
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

			{/* sent — the cast landed */}
			{phase === "sent" && (
				<View style={styles.beat}>
					<Image source={ritual.icon} style={styles.beatImg} />
					<Text style={styles.beatTitle}>
						{isBless ? "✦ blessing sent ✦" : "✦ curse cast ✦"}
					</Text>
					<Text style={styles.beatSub}>{result}</Text>
				</View>
			)}

			{/* done — already cast this ritual on this friend today */}
			{phase === "done" && (
				<View style={styles.beat}>
					<Image
						source={ritual.icon}
						style={[styles.beatImg, { opacity: 0.45 }]}
					/>
					<Text style={styles.beatTitle}>
						{isBless ? "already blessed today" : "already cursed today"}
					</Text>
					<Text style={styles.beatSub}>
						You can {isBless ? "bless" : "curse"} {targetName} again
						tomorrow — one per friend a day.
					</Text>
				</View>
			)}

			{/* capped — today's blessing (or curse) is already spent */}
			{phase === "capped" && (
				<View style={styles.beat}>
					<Text style={styles.beatTitle}>
						{isBless ? "blessing spent" : "curse spent"}
					</Text>
					<Text style={styles.beatSub}>
						One {isBless ? "blessing" : "curse"} a day — your next
						is tomorrow.
					</Text>
				</View>
			)}

			{/* ready / error — the picker + Cast button */}
			{(phase === "ready" || phase === "error") && (
				<>
					<View style={styles.ritualRow}>
						<Image source={ritual.icon} style={styles.emojiImg} />
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
					{phase === "error" && !!result && (
						<Text style={styles.result}>{result}</Text>
					)}
				</>
			)}
		</View>
	);
}

// Only the unexpected cases reach here now — daily_cap and the
// already-cast-today reasons are their own phases above.
function reasonText(reason: string | undefined, isBless: boolean): string {
	switch (reason) {
		case "not_friends":
			return "Only friends can be reached.";
		case "self":
			return "That's you.";
		default:
			return isBless
				? "Couldn't bless. Try again."
				: "Couldn't curse. Try again.";
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
	ritualRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		marginBottom: 10,
	},
	emojiImg: { width: 38, height: 38, resizeMode: "contain" },
	name: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	blurb: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		marginTop: 1,
	},
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
	// Shared terminal-state layout (sent / done / capped).
	beat: { alignItems: "center", paddingVertical: 6 },
	beatImg: {
		width: 56,
		height: 56,
		resizeMode: "contain",
		marginBottom: 4,
	},
	beatTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
		textAlign: "center",
	},
	beatSub: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		marginTop: 2,
		textAlign: "center",
	},
});
