// ActiveEffects — the receiver-side bless/curse status panel.
//
// Shows every blessing / curse currently ON the player
// (my_active_effects): its icon, what it does, and how long is left.
// The "consequential" half of the ritual loop, made legible — before
// this it only showed as a vague glow / miasma on the Barn.
//
// States it renders:
//   • blessed        — gold rows, each counting down
//   • cursed         — green rows + a Cleanse action
//   • both           — both, blessings first
//   • nothing active — renders null (no clutter)
//
// Lives at the top of the Inbox segment in the Friends hub.
import React, { useCallback, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import { CleanseModal, type ActiveCurse } from "./CleanseModal";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
} from "../utils/rituals";
import { FONTS, KICKER_TEXT, WHIMSY, ROW_TILTS } from "@/constants/theme";
import { SectionHeader } from "./ui/SectionHeader";

interface Effect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
	sender_id: string | null;
	sender_username: string | null;
}

// Static "time left" — recomputed on every focus (no per-second timer).
function countdown(iso: string): string {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "expiring";
	const mins = Math.round(ms / 60000);
	if (mins < 60) return `${mins}m left`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h}h ${m}m left` : `${h}h left`;
}

export function ActiveEffects() {
	const [effects, setEffects] = useState<Effect[] | null>(null);
	// Inline Cleanse pill no longer fires the RPC directly — opens
	// the shared CleanseModal so a stray tap doesn't instantly burn
	// 5 snouts. The modal owns the RPC + haptics; we refresh on close.
	const [cleanseOpen, setCleanseOpen] = useState(false);

	const load = useCallback(() => {
		supabase.rpc("my_active_effects").then(({ data }) => {
			const rows = (data as Effect[] | null) ?? [];
			// blessings first, then curses
			rows.sort((a, b) => (a.source < b.source ? -1 : 1));
			setEffects(rows);
		});
	}, []);
	useFocusEffect(useCallback(() => load(), [load]));

	// Nothing active → render nothing (the empty state is just absence).
	if (!effects || effects.length === 0) return null;

	const curses: ActiveCurse[] = effects
		.filter((e) => e.source === "curse")
		.map((e) => ({ kind: e.kind as CurseKind, expires_at: e.expires_at }));

	return (
		<View>
			<SectionHeader
				kicker="left by the sounder"
				title="Hoofprints on you"
				ruleWidth={132}
			/>
			{effects.map((e, i) => {
				const blessed = e.source === "blessing";
				const meta = blessed
					? BLESSING_META[e.kind as BlessingKind]
					: CURSE_META[e.kind as CurseKind];
				const senderName =
					e.sender_username ?? (blessed ? "a friend" : "someone");
				const initial = (e.sender_username ?? "?").slice(0, 1).toUpperCase();
				return (
					<Sticker
						key={`${e.source}-${e.kind}-${i}`}
						color="paper"
						rotate={ROW_TILTS[i % ROW_TILTS.length]}
						radius={10}
						style={[
							styles.row,
							blessed ? styles.rowBless : styles.rowCurse,
						]}
					>
						{/* Corner pill — Blessing (lilac-deep) / Curse (ink).
						    Anchored top-left so the card's nature reads
						    instantly even before you parse the icon. */}
						<View
							style={[
								styles.cornerPill,
								blessed ? styles.cornerPillBless : styles.cornerPillCurse,
							]}
						>
							<Text style={styles.cornerPillText}>
								{blessed ? "Blessing" : "Curse"}
							</Text>
						</View>
						{meta && (
							<Image source={meta.icon} style={styles.icon} />
						)}
						<View style={{ flex: 1, minWidth: 0 }}>
							<Text style={styles.name} numberOfLines={1}>
								{meta?.name ?? e.kind}
							</Text>
							<Text style={styles.blurb} numberOfLines={2}>
								{meta?.blurb ?? ""}
							</Text>
							{/* Sender attribution — small avatar initial + name */}
							<View style={styles.senderRow}>
								<View
									style={[
										styles.senderAvatar,
										blessed
											? styles.senderAvatarBless
											: styles.senderAvatarCurse,
									]}
								>
									<Text style={styles.senderInitial}>{initial}</Text>
								</View>
								<Text style={styles.senderName} numberOfLines={1}>
									<Text style={styles.senderNameBold}>{senderName}</Text>
									{blessed ? " blessed you" : " cursed you"}
								</Text>
							</View>
						</View>
						<View style={styles.rowRight}>
							<Text
								style={[
									styles.countdown,
									blessed ? styles.cdBless : styles.cdCurse,
								]}
							>
								{countdown(e.expires_at)}
							</Text>
							{/* Per-curse Cleanse pill. Opens the shared
							    CleanseModal as a confirm step — cleanse_curses
							    is one-shot (wipes every active curse in a
							    single 5-snout charge), so any per-curse tap
							    routes to the same modal. */}
							{!blessed && (
								<Pressable
									onPress={() => setCleanseOpen(true)}
									style={({ pressed }) => [
										styles.inlineCleanseBtn,
										pressed && { opacity: 0.7 },
									]}
								>
									<SnoutCoin size={12} />
									<Text style={styles.inlineCleanseBtnText}>
										Cleanse · 5
									</Text>
								</Pressable>
							)}
						</View>
					</Sticker>
				);
			})}
			{cleanseOpen && curses.length > 0 && (
				<CleanseModal
					curses={curses}
					onDismiss={() => setCleanseOpen(false)}
					onCleansed={load}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	band: {
		...KICKER_TEXT,
		fontSize: 11,
		marginTop: 4,
		marginBottom: 8,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 12,
		paddingTop: 16,
		paddingBottom: 12,
		marginBottom: 10,
		// Slight overflow allowance for the corner pill so it can hang
		// above the top border without being clipped.
		overflow: "visible",
	},
	rowBless: { borderColor: WHIMSY.sun, borderWidth: 2, backgroundColor: WHIMSY.lilac },
	rowCurse: { borderColor: "#7BA266", borderWidth: 2, backgroundColor: WHIMSY.cream },
	// Floating tag — hangs off the top-left of each effect card so the
	// card's nature (Blessing / Curse) reads before any other parsing.
	cornerPill: {
		position: "absolute",
		top: -10,
		left: 14,
		paddingHorizontal: 10,
		paddingVertical: 2,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 1.5, height: 1.5 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
		zIndex: 2,
	},
	cornerPillBless: { backgroundColor: WHIMSY.lilacDeep },
	cornerPillCurse: { backgroundColor: WHIMSY.ink },
	cornerPillText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.paper,
	},
	icon: { width: 34, height: 34, resizeMode: "contain" },
	name: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	blurb: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	countdown: { fontFamily: FONTS.whimsy, fontSize: 12 },
	cdBless: { color: "#C99B23" },
	cdCurse: { color: "#5E7E49" },
	// Right column for each effect card — stacks the countdown above
	// the (curse-only) inline Cleanse pill.
	rowRight: {
		alignItems: "flex-end",
		gap: 6,
	},
	// Per-curse inline Cleanse pill — gold sun pill with the snout
	// coin + label. Calls cleanse_curses which wipes every active
	// curse in a single 5-snout charge.
	inlineCleanseBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingVertical: 4,
		paddingHorizontal: 10,
	},
	inlineCleanseBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.ink,
	},
	sub: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: -4,
		marginBottom: 8,
	},
	senderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 6,
	},
	senderAvatar: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	senderAvatarBless: { backgroundColor: WHIMSY.sun },
	senderAvatarCurse: { backgroundColor: WHIMSY.sage },
	senderInitial: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.ink,
	},
	senderName: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		opacity: 0.85,
		flex: 1,
		minWidth: 0,
	},
	senderNameBold: { fontFamily: FONTS.bodyExtra, opacity: 1 },
});
