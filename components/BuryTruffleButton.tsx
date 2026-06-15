// Bury-a-truffle control for your OWN barn. Choose a stake (10/20/50 snouts) —
// the stake becomes a shared pot that visitors dig shares from. Once buried, it
// becomes a "check on your truffle" pill (the mound by your pig is also tappable).
// Buried state is owned by the parent (useBuriedTruffle); this is the control.
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { rpcAction } from "@/utils/rpc";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Glyph, IconText } from "./ui/Glyph";
import { FONTS, WHIMSY, SHADOW_SM } from "@/constants/theme";

const STAKES = [10, 20, 50];

interface Props {
	buried: boolean;
	onBury: () => void; // fired after a successful bury (parent refreshes + animates)
	onCheck: () => void; // open the "check on your truffle" sheet
}

export function BuryTruffleButton({ buried, onBury, onCheck }: Props) {
	const [stake, setStake] = useState(20);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	const bury = async () => {
		if (busy || buried) return;
		setBusy(true);
		setNote(null);
		const r = await rpcAction("bury_truffle", { p_amount: stake });
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			onBury();
		} else if (r.reason === "too_poor") {
			setNote(`Need ${stake} snouts to bury this truffle.`);
		} else if (r.reason === "already_buried") {
			onBury();
		}
	};

	if (buried) {
		return (
			<Pressable onPress={onCheck} style={({ pressed }) => [styles.checkPill, pressed && { opacity: 0.85 }]}>
				<IconText left={<Glyph name="pigface" size={16} />} gap={6}>
					<Text style={styles.checkText}>Truffle buried — check on it</Text>
				</IconText>
			</Pressable>
		);
	}

	return (
		<View style={styles.wrap}>
			<View style={styles.row}>
				<IconText left={<Glyph name="pigface" size={16} />} gap={5}>
					<Text style={styles.lead}>Bury a truffle</Text>
				</IconText>
				<View style={styles.stakes}>
					{STAKES.map((s) => {
						const on = s === stake;
						return (
							<Pressable
								key={s}
								onPress={() => setStake(s)}
								style={[styles.chip, on && styles.chipOn]}
							>
								<SnoutCoin size={13} />
								<Text style={[styles.chipText, on && styles.chipTextOn]}>{s}</Text>
							</Pressable>
						);
					})}
				</View>
			</View>
			<Pressable
				onPress={bury}
				disabled={busy}
				style={({ pressed }) => [styles.buryBtn, pressed && { opacity: 0.85 }]}
			>
				<Text style={styles.buryText}>{busy ? "burying…" : `Bury for visitors · ${stake} snouts`}</Text>
			</Pressable>
			{note && <Text style={styles.note}>{note}</Text>}
		</View>
	);
}

const INK = WHIMSY.ink;
const sticker = SHADOW_SM;
const styles = StyleSheet.create({
	wrap: { alignSelf: "center", alignItems: "center", marginTop: 10, gap: 7 },
	row: { flexDirection: "row", alignItems: "center", gap: 10 },
	lead: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
	stakes: { flexDirection: "row", gap: 5 },
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 3,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: INK,
		backgroundColor: WHIMSY.cream,
	},
	chipOn: { backgroundColor: WHIMSY.sun },
	chipText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.mute },
	chipTextOn: { color: INK },
	buryBtn: {
		backgroundColor: WHIMSY.peach,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 9,
		paddingHorizontal: 18,
		...sticker,
	},
	buryText: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
	checkPill: {
		alignSelf: "center",
		marginTop: 10,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 2,
		borderColor: INK,
		borderRadius: 14,
		paddingVertical: 9,
		paddingHorizontal: 16,
		...sticker,
	},
	checkText: { fontFamily: FONTS.whimsy, fontSize: 14, color: INK },
	note: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, textAlign: "center" },
});
