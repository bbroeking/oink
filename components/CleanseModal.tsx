// Cleanse. Shows the caller's active curses and lets them spend 5
// snouts to wipe all of them. Surfaced from Barn when
// my_active_effects returns any curse rows.
import React, { useState } from "react";
import {
	Modal,
	View,
	Text,
	Image,
	StyleSheet,
	Pressable,
} from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "../utils/supabase";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import { CURSE_META, type CurseKind } from "../utils/rituals";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

export interface ActiveCurse {
	kind: CurseKind;
	expires_at: string | null;
}

interface Props {
	curses: ActiveCurse[];
	onDismiss: () => void;
	// Fired after a successful cleanse so the parent can refresh effects.
	onCleansed?: () => void;
}

export function CleanseModal({ curses, onDismiss, onCleansed }: Props) {
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	const cleanse = async () => {
		if (busy) return;
		setBusy(true);
		const { data } = await supabase.rpc("cleanse_curses");
		const r = data as { ok?: boolean; reason?: string; cleared?: number } | null;
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			onCleansed?.();
			onDismiss();
		} else if (r?.reason === "insufficient_snouts") {
			setFeedback("Not enough snouts — you need 5.");
		} else {
			setFeedback("Couldn't cleanse. Try again.");
		}
	};

	return (
		<Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
			<Pressable style={styles.backdrop} onPress={onDismiss}>
				<Pressable style={styles.cardWrap} onPress={() => {}}>
					<Sticker color="paper" rotate={-1} radius={18} style={[styles.card, STICKER_SHADOW]}>
						<Text style={styles.kicker}>★ you've been cursed ★</Text>
						<Text style={styles.headline}>
							{curses.length === 1
								? "A curse clings to you"
								: `${curses.length} curses cling to you`}
						</Text>

						<View style={styles.list}>
							{curses.map((c, i) => {
								const meta = CURSE_META[c.kind];
								return (
									<View key={i} style={styles.curseRow}>
										<Image source={meta?.icon} style={styles.curseIcon} />
										<View style={{ flex: 1, minWidth: 0 }}>
											<Text style={styles.curseName}>{meta?.name ?? c.kind}</Text>
											<Text style={styles.curseBlurb}>{meta?.blurb ?? ""}</Text>
										</View>
									</View>
								);
							})}
						</View>

						<Pressable
							testID="cleanse-confirm"
							onPress={cleanse}
							disabled={busy}
							style={({ pressed }) => [
								styles.cleanseBtn,
								(pressed || busy) && { opacity: 0.7 },
							]}
						>
							<View style={styles.cleanseBtnInner}>
								<Text style={styles.cleanseBtnText}>
									{busy ? "Cleansing…" : "Cleanse for 5"}
								</Text>
								{!busy && <SnoutCoin size={14} />}
							</View>
						</Pressable>
						<Pressable onPress={onDismiss} hitSlop={10}>
							<Text style={styles.waitText}>or wait it out</Text>
						</Pressable>
						{!!feedback && <Text style={styles.feedback}>{feedback}</Text>}
					</Sticker>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 28,
	},
	cardWrap: { width: "100%", maxWidth: 360 },
	card: { paddingHorizontal: 22, paddingVertical: 22, alignItems: "center" },
	kicker: { ...KICKER_TEXT, marginBottom: 8 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 14,
	},
	list: { width: "100%", gap: 8, marginBottom: 16 },
	curseRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: "#D5E4C9",
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		padding: 8,
	},
	curseIcon: { width: 32, height: 32, resizeMode: "contain" },
	curseName: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	curseBlurb: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.ink, marginTop: 1 },
	cleanseBtn: {
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 26,
		paddingVertical: 11,
		marginBottom: 8,
	},
	cleanseBtnInner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	cleanseBtnText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	waitText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	feedback: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
		marginTop: 8,
		textAlign: "center",
	},
});
