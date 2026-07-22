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
import React, { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import { RitualIconWell } from "./ui/RitualIconWell";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { dailyRitual, type RitualMode } from "../utils/rituals";
import { formatHM } from "../utils/duration";
import { FONTS, KICKER_TEXT, WHIMSY } from "@/constants/theme";

// Rituals reset at UTC midnight (the daily cap keys on the UTC date). "7h 23m"
// until you can bless/curse again — a snapshot taken when the panel renders.
function untilDailyReset(): string {
	const now = new Date();
	const next = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + 1
	);
	const ms = next - now.getTime();
	return formatHM(ms);
}

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
	// How many of today's rituals are left (used / cap), for the visible counter.
	const [usage, setUsage] = useState<{ used: number; cap: number } | null>(null);

	// Season-1 blessing set once world_boss is on — mirrors the server's
	// daily_blessing_kind so the previewed kind matches the cast.
	const s1 = useFeatureFlag("world_boss");
	const ritual = dailyRitual(mode, new Date(), s1);
	const isBless = mode === "bless";

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const r = await rpcAction<{
				bless_used?: number;
				bless_cap?: number;
				curse_used?: number;
				curse_cap?: number;
			}>("ritual_status");
			if (cancelled || !r.ok) return;
			setUsage(
				isBless
					? { used: r.bless_used ?? 0, cap: r.bless_cap ?? 1 }
					: { used: r.curse_used ?? 0, cap: r.curse_cap ?? 1 }
			);
		})();
		return () => {
			cancelled = true;
		};
	}, [isBless]);

	const remaining = usage ? Math.max(0, usage.cap - usage.used) : null;

	const cast = async () => {
		if (busy) return;
		setBusy(true);
		setResult(null);
		const rpcName = isBless ? "send_blessing" : "send_curse";
		const r = await rpcAction(rpcName, { target_user_id: targetUserId });
		setBusy(false);

		if (r.ok) {
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
			setUsage((u) => (u ? { ...u, used: u.used + 1 } : u));
			onCast?.();
			return;
		}

		if (r.reason === "already_blessed_today" || r.reason === "already_cursed_today") {
			setPhase("done");
		} else if (r.reason === "daily_cap") {
			setPhase("capped");
		} else {
			setResult(reasonText(r.reason, isBless));
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
				{isBless ? "✦ today's blessing" : "☁ today's curse"}
			</Text>

			{/* sent — the cast landed */}
			{phase === "sent" && (
				<View style={styles.beat}>
					<Image source={ritual.icon} style={styles.beatImg} />
					<Text style={styles.beatTitle}>
						{isBless ? "✦ blessing sent ✦" : "✦ curse cast ✦"}
					</Text>
					<Text style={styles.beatSub}>{result}</Text>
					<Text style={styles.beatEffect}>{ritual.blurb}</Text>
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
						Next {isBless ? "blessing" : "curse"} in {untilDailyReset()} —
						one per friend a day.
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
						{usage
							? `All ${usage.cap} ${isBless ? "blessings" : "curses"} used today`
							: `${isBless ? "Blessings" : "Curses"} spent`}{" "}
						— your next is in {untilDailyReset()}.
					</Text>
				</View>
			)}

			{/* ready / error — the picker + Cast button */}
			{(phase === "ready" || phase === "error") && (
				<>
					<View style={styles.ritualRow}>
						{/* No corner badge — the kicker above already names
						    the mode (today's blessing / today's curse). */}
						<RitualIconWell
							icon={ritual.icon}
							blessed={isBless}
							size={60}
							fillRatio={0.84}
							badge={false}
						/>
						<View style={{ flex: 1, minWidth: 0 }}>
							<Text style={styles.name}>{ritual.name}</Text>
							<Text style={styles.blurb}>{ritual.blurb}</Text>
						</View>
					</View>
					<Pressable
						testID="ritual-cast"
						onPress={cast}
						disabled={busy || remaining === 0}
						style={({ pressed }) => [
							styles.btn,
							(pressed || busy || remaining === 0) && { opacity: 0.7 },
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
					{remaining !== null && usage && (
						<Text style={styles.left}>
							{remaining} of {usage.cap} {isBless ? "blessings" : "curses"} left
							today · resets in {untilDailyReset()}
						</Text>
					)}
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
	name: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	blurb: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		marginTop: 1,
	},
	// paddingVertical 12 puts the Cast button at ~44pt tall — the
	// minimum comfortable tap target.
	btn: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 12,
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
	left: {
		fontFamily: FONTS.hand,
		fontSize: 11.5,
		color: WHIMSY.ink,
		opacity: 0.7,
		textAlign: "center",
		marginTop: 7,
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
	// The effect itself ("2× tickle regen for an hour") so the caster sees what
	// the ritual actually does, not just that it sent.
	beatEffect: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.ink,
		marginTop: 4,
		textAlign: "center",
	},
});
