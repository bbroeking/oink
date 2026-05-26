// Active-effect chips that sit on the Barn screen, just below the
// stat tickets — gives the player at-a-glance awareness of what
// blessings/curses are currently on them, with sender attribution.
//
// Tapping a chip navigates to the Friends hub (Inbox segment is the
// full panel). Renders nothing when no effects are active so it
// doesn't clutter a clean Barn.
//
// Closes the design's "Active effects on Barn" gap; the full
// `ActiveEffects` panel still lives at the top of Inbox.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { HoofprintsSheet } from "./HoofprintsSheet";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
} from "../utils/rituals";
import { FONTS, WHIMSY } from "@/constants/theme";

interface Effect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
	sender_id: string | null;
	sender_username: string | null;
}

// "5m" / "2h 14m" / "expiring" — compact for the chip.
function shortLeft(iso: string): string {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "expiring";
	const mins = Math.round(ms / 60000);
	if (mins < 60) return `${mins}m`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h}h ${m}m` : `${h}h`;
}

export function BarnActiveEffectsStrip() {
	const [effects, setEffects] = useState<Effect[]>([]);
	// Tap a chip → open the full Hoofprints recap sheet so the
	// player can read the actual effect (e.g. "1-in-3 taps slip")
	// instead of just the kind name. Sheet owns its own fresh
	// fetch of my_active_effects on open.
	const [sheetOpen, setSheetOpen] = useState(false);

	const load = useCallback(() => {
		supabase.rpc("my_active_effects").then(({ data }) => {
			const rows = (data as Effect[] | null) ?? [];
			rows.sort((a, b) => (a.source < b.source ? -1 : 1));
			setEffects(rows);
		});
	}, []);
	useFocusEffect(useCallback(() => load(), [load]));

	// Realtime: subscribe to INSERTs on blessings + curses where
	// the caller is the receiver. On any event, re-run load() so
	// the chip appears within ~a second of being cast, no swipe
	// required. The receiver filter is enforced server-side via
	// the existing RLS SELECT policies that scope rows to the
	// caller's auth.uid().
	useEffect(() => {
		let active = true;
		let channelKey: string | null = null;
		(async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!active || !user) return;
			channelKey = `realtime:effects:${user.id}`;
			const ch = supabase
				.channel(channelKey)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "blessings",
						filter: `receiver_id=eq.${user.id}`,
					},
					() => load()
				)
				.on(
					"postgres_changes",
					{
						event: "INSERT",
						schema: "public",
						table: "curses",
						filter: `receiver_id=eq.${user.id}`,
					},
					() => load()
				)
				// Cleanse fires an UPDATE that sets cleared_at — listen
				// for it so chips disappear live too.
				.on(
					"postgres_changes",
					{
						event: "UPDATE",
						schema: "public",
						table: "curses",
						filter: `receiver_id=eq.${user.id}`,
					},
					() => load()
				)
				.subscribe();
			return () => {
				supabase.removeChannel(ch);
			};
		})();
		return () => {
			active = false;
			if (channelKey) {
				// Best-effort: a channel created in the async branch
				// above is cleaned by its own returned closure, but
				// dropping any channel with this key catches the
				// rare unmount-before-subscribe race.
				supabase.getChannels()
					.filter((c) => c.topic === channelKey)
					.forEach((c) => supabase.removeChannel(c));
			}
		};
	}, [load]);

	if (effects.length === 0) return null;

	return (
		<>
		<View style={styles.strip}>
			{effects.slice(0, 2).map((e, i) => {
				const blessed = e.source === "blessing";
				const meta = blessed
					? BLESSING_META[e.kind as BlessingKind]
					: CURSE_META[e.kind as CurseKind];
				const senderName =
					e.sender_username ?? (blessed ? "a friend" : "someone");
				const initial = (e.sender_username ?? "?").slice(0, 1).toUpperCase();
				return (
					<Pressable
						key={`${e.source}-${e.kind}-${i}`}
						onPress={() => setSheetOpen(true)}
						style={[
							styles.chip,
							blessed ? styles.chipBless : styles.chipCurse,
							{ transform: [{ rotate: i % 2 === 0 ? "-0.8deg" : "0.8deg" }] },
						]}
					>
						<View
							style={[
								styles.iconWell,
								blessed ? styles.iconWellBless : styles.iconWellCurse,
							]}
						>
							{meta && (
								<Image
									source={meta.icon}
									style={styles.icon}
									resizeMode="contain"
								/>
							)}
						</View>
						<View style={{ flex: 1, minWidth: 0 }}>
							<Text style={styles.name} numberOfLines={1}>
								{meta?.name ?? e.kind}
							</Text>
							<View style={styles.metaRow}>
								<View
									style={[
										styles.senderDot,
										blessed
											? styles.senderDotBless
											: styles.senderDotCurse,
									]}
								>
									<Text style={styles.senderInitial}>{initial}</Text>
								</View>
								<Text style={styles.meta} numberOfLines={1}>
									{senderName} · {shortLeft(e.expires_at)}
								</Text>
							</View>
						</View>
					</Pressable>
				);
			})}
		</View>
		<HoofprintsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
		</>
	);
}

const styles = StyleSheet.create({
	strip: {
		flexDirection: "row",
		gap: 10,
		paddingHorizontal: 16,
		marginTop: 14,
	},
	chip: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 8,
		paddingVertical: 6,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	chipBless: { backgroundColor: WHIMSY.lilac },
	chipCurse: { backgroundColor: WHIMSY.cream },
	iconWell: {
		width: 30,
		height: 30,
		borderRadius: 8,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	iconWellBless: { backgroundColor: WHIMSY.paper },
	iconWellCurse: { backgroundColor: WHIMSY.ink },
	icon: { width: 22, height: 22 },
	name: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		lineHeight: 14,
	},
	metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
	senderDot: {
		width: 16,
		height: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	senderDotBless: { backgroundColor: WHIMSY.rose },
	senderDotCurse: { backgroundColor: WHIMSY.sage },
	senderInitial: {
		fontFamily: FONTS.whimsy,
		fontSize: 9,
		color: WHIMSY.ink,
	},
	meta: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.ink,
		flex: 1,
	},
});
