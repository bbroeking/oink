// Bury-a-truffle action for your OWN barn (barn visiting v3). You pay 20 snouts
// to leave a treat; the first visitor to dig it up wins the snouts. Self-
// contained: checks whether you already have one buried, buries on tap, and
// reflects the state. See docs/barn-visiting-design.md §3b.
import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import { FONTS, WHIMSY } from "@/constants/theme";

const COST = 20;

export function BuryTruffleButton() {
	// undefined = loading, true = already buried, false = none yet
	const [buried, setBuried] = useState<boolean | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	const load = useCallback(async () => {
		const { data: ures } = await supabase.auth.getUser();
		if (!ures.user) return;
		const { data } = await supabase
			.from("truffles")
			.select("id")
			.eq("host_id", ures.user.id)
			.is("dug_at", null)
			.maybeSingle();
		setBuried(!!data);
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	const bury = async () => {
		if (busy || buried) return;
		setBusy(true);
		setNote(null);
		const r = await rpc<{ ok?: boolean; error?: string }>("bury_truffle");
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success
			).catch(() => {});
			setBuried(true);
		} else if (r?.error === "too_poor") {
			setNote(`Need ${COST} snouts to bury a truffle.`);
		} else if (r?.error === "already_buried") {
			setBuried(true);
		}
	};

	if (buried === undefined) return null;

	if (buried) {
		return (
			<View style={[styles.btn, styles.buried]}>
				<Text style={styles.text}>🐽 Truffle buried — waiting for a visitor</Text>
			</View>
		);
	}

	return (
		<View>
			<Pressable
				onPress={bury}
				disabled={busy}
				style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
			>
				<Text style={styles.text}>
					{busy ? "burying…" : `🐽 Bury a truffle for visitors (${COST} snouts)`}
				</Text>
			</Pressable>
			{note && <Text style={styles.note}>{note}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	btn: {
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingVertical: 10,
		paddingHorizontal: 16,
		alignItems: "center",
		alignSelf: "center",
		marginTop: 10,
	},
	buried: { backgroundColor: WHIMSY.cream2 },
	text: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	note: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 4,
	},
});
