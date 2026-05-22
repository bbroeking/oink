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
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
} from "../utils/rituals";
import { FONTS, KICKER_TEXT, WHIMSY, ROW_TILTS } from "@/constants/theme";

interface Effect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
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
	const [busy, setBusy] = useState(false);

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

	const curseCount = effects.filter((e) => e.source === "curse").length;

	const cleanse = async () => {
		if (busy) return;
		setBusy(true);
		const { data } = await supabase.rpc("cleanse_curses");
		setBusy(false);
		const r = data as { ok?: boolean } | null;
		if (r?.ok) {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success
			).catch(() => {});
			load();
		}
	};

	return (
		<View>
			<Text style={styles.band}>On you now</Text>
			{effects.map((e, i) => {
				const blessed = e.source === "blessing";
				const meta = blessed
					? BLESSING_META[e.kind as BlessingKind]
					: CURSE_META[e.kind as CurseKind];
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
						</View>
						<Text
							style={[
								styles.countdown,
								blessed ? styles.cdBless : styles.cdCurse,
							]}
						>
							{countdown(e.expires_at)}
						</Text>
					</Sticker>
				);
			})}
			{curseCount > 0 && (
				<Pressable
					onPress={cleanse}
					disabled={busy}
					style={({ pressed }) => [
						styles.cleanseBtn,
						(pressed || busy) && { opacity: 0.7 },
					]}
				>
					<Text style={styles.cleanseText}>
						{busy
							? "Cleansing…"
							: `Cleanse ${curseCount > 1 ? "all curses" : "the curse"} · 5`}
					</Text>
					{!busy && <SnoutCoin size={15} />}
				</Pressable>
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
		paddingVertical: 10,
		marginBottom: 8,
	},
	rowBless: { borderColor: WHIMSY.sun, borderWidth: 2 },
	rowCurse: { borderColor: "#7BA266", borderWidth: 2 },
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
	cleanseBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		backgroundColor: "#D5E4C9",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 10,
		marginBottom: 4,
	},
	cleanseText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
});
