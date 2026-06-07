// World Cup allegiance pick — a one-time, skippable modal that invites the
// player to back one of the 47 qualified countries for the tournament. Picking
// is LOCKED (server-enforced): first choice wins. On confirm the player gets
// the country's flag (auto-equipped) + the Sunny Pitch soccer background.
// "Choose the right one" teases an end-of-tournament reward; we just store the
// pick here and grade it against the champion later.
import { useState } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	Image,
	FlatList,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Sticker } from "./ui/Sticker";
import { Button } from "./ui";
import { rpcAction } from "@/utils/rpc";
import { HAT_IMAGES } from "@/constants/hats";
import { WORLD_CUP_TEAMS } from "@/constants/worldCupFlags";
import { FONTS, MODAL_BACKDROP_BG, WHIMSY } from "@/constants/theme";

interface Props {
	visible: boolean;
	// Dismiss without choosing ("Maybe later").
	onSkip: () => void;
	// Successful pick — parent refreshes profile / closes. Receives the flag id.
	onChosen: (flagId: string) => void;
}

export function AllegianceModal({ visible, onSkip, onChosen }: Props) {
	const [selected, setSelected] = useState<string | null>(null); // slug
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState<{ name: string } | null>(null);

	const selectedTeam = WORLD_CUP_TEAMS.find((t) => t.slug === selected) ?? null;

	const confirm = async () => {
		if (!selectedTeam || busy) return;
		setBusy(true);
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		const flagId = `flag_${selectedTeam.slug}`;
		const r = await rpcAction("choose_allegiance", {
			p_flag_id: flagId,
		});
		setBusy(false);
		if (r.ok) {
			setDone({ name: selectedTeam.name });
		} else if (r.reason === "already_chosen") {
			// Someone double-tapped or already picked on another device — just
			// close out gracefully.
			onChosen(flagId);
		}
		// Any other error: leave the sheet open so they can retry.
	};

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={onSkip}>
			<View style={styles.backdrop}>
				<Sticker color="paper" rotate={-0.4} radius={22} style={styles.sheet}>
					{done ? (
						// ── Celebratory confirmation ──────────────────────
						<View style={styles.doneWrap}>
							<Text style={styles.doneEmoji}>🎉</Text>
							<Text style={styles.title}>You're backing {done.name}!</Text>
							<Text style={styles.hint}>
								You earned the {done.name} flag (now flying on your pig)
								and the Sunny Pitch background. Cheer them all the way to
								the final!
							</Text>
							<Button
								size="md"
								variant="primary"
								full
								onPress={() => onChosen(`flag_${selected}`)}
							>
								Let's go ⚽
							</Button>
						</View>
					) : (
						<>
							<Pressable onPress={onSkip} style={styles.closeBtn} hitSlop={12}>
								<Text style={styles.closeText}>✕</Text>
							</Pressable>

							<Text style={styles.kicker}>the hog cup</Text>
							<Text style={styles.title}>Pick your country</Text>
							<Text style={styles.hint}>
								Back one team for the whole tournament. Choose wisely — if
								your country lifts the trophy, there may be a reward waiting
								at the final whistle. 🏆
							</Text>

							<FlatList
								data={WORLD_CUP_TEAMS}
								keyExtractor={(t) => t.slug}
								numColumns={3}
								style={styles.grid}
								columnWrapperStyle={styles.gridRow}
								showsVerticalScrollIndicator={false}
								renderItem={({ item }) => {
									const active = selected === item.slug;
									const src = HAT_IMAGES[`flag_${item.slug}`];
									return (
										<Pressable
											onPress={() => {
												Haptics.selectionAsync().catch(() => {});
												setSelected(item.slug);
											}}
											style={[styles.flagCell, active && styles.flagCellActive]}
										>
											{src ? (
												<Image
													source={src}
													style={styles.flagImg}
													resizeMode="contain"
												/>
											) : (
												<View style={styles.flagImg} />
											)}
											<Text
												style={[styles.flagName, active && styles.flagNameActive]}
												numberOfLines={1}
											>
												{item.name}
											</Text>
										</Pressable>
									);
								}}
							/>

							<View style={styles.footer}>
								<Text style={styles.lockNote}>
									You can't change this later.
								</Text>
								<Button
									size="md"
									variant={selectedTeam ? "primary" : "locked"}
									full
									disabled={!selectedTeam || busy}
									onPress={confirm}
								>
									{busy
										? "…"
										: selectedTeam
											? `Support ${selectedTeam.name}`
											: "Tap a flag to choose"}
								</Button>
								<Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={8}>
									<Text style={styles.skipText}>Maybe later</Text>
								</Pressable>
							</View>
						</>
					)}
				</Sticker>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		justifyContent: "center",
		paddingHorizontal: 16,
	},
	sheet: {
		paddingHorizontal: 20,
		paddingTop: 22,
		paddingBottom: 20,
		maxHeight: "86%",
	},
	closeBtn: {
		position: "absolute",
		top: 12,
		right: 14,
		width: 36,
		height: 36,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 30,
	},
	closeText: { fontSize: 22, color: WHIMSY.ink },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		color: WHIMSY.accent,
		textTransform: "uppercase",
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		marginTop: 2,
		marginBottom: 6,
		textAlign: "center",
	},
	hint: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		lineHeight: 19,
		marginBottom: 12,
		textAlign: "center",
	},
	grid: { flexGrow: 0 },
	gridRow: { gap: 8, marginBottom: 8 },
	flagCell: {
		flex: 1,
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 4,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: "transparent",
		backgroundColor: WHIMSY.cream,
	},
	flagCellActive: {
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	flagImg: { width: 48, height: 48, marginBottom: 4 },
	flagName: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		textAlign: "center",
	},
	flagNameActive: { color: WHIMSY.ink },
	footer: { marginTop: 8, gap: 8 },
	lockNote: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.muteSoft,
		textAlign: "center",
	},
	skipBtn: { alignSelf: "center", paddingVertical: 4 },
	skipText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	doneWrap: { alignItems: "center", gap: 10, paddingVertical: 8 },
	doneEmoji: { fontSize: 52 },
});
