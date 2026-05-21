// "What's new" modal. Auto-fired on Barn mount when the latest release
// in constants/release_notes is newer than the user's last_seen value.
// Also openable manually via the Account "What's new" link.
import React from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Pressable,
	ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sticker } from "./ui/Sticker";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";
import {
	currentRelease,
	RELEASE_SEEN_KEY,
	type ReleaseNote,
} from "@/constants/release_notes";

interface Props {
	visible: boolean;
	release?: ReleaseNote;
	onClose: () => void;
}

export function ReleaseNotesModal({
	visible,
	release = currentRelease(),
	onClose,
}: Props) {
	const handleClose = async () => {
		try {
			await AsyncStorage.setItem(RELEASE_SEEN_KEY, release.version);
		} catch {}
		onClose();
	};
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
			<View style={styles.backdrop}>
				<View style={styles.card}>
					<Sticker color="paper" rotate={-1} radius={18} style={styles.sticker}>
						<Text style={styles.kicker}>★ what's new</Text>
						<Text style={styles.headline}>{release.headline}</Text>
						<Text style={styles.dateText}>v{release.version} · {release.date}</Text>
						<ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
							{release.items.map((it, i) => (
								<View key={i} style={styles.item}>
									<View style={styles.emojiWrap}>
										<Text style={styles.emoji}>{it.emoji ?? "★"}</Text>
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text style={styles.itemTitle}>{it.title}</Text>
										<Text style={styles.itemBody}>{it.body}</Text>
									</View>
								</View>
							))}
						</ScrollView>
						<Pressable
							onPress={handleClose}
							style={({ pressed }) => [
								styles.gotItBtn,
								pressed && { opacity: 0.85 },
							]}
						>
							<Text style={styles.gotItText}>Got it</Text>
						</Pressable>
					</Sticker>
				</View>
			</View>
		</Modal>
	);
}

// Helper: true if the user hasn't seen the current (latest *available*)
// release. Future season entries are invisible until their date, so a
// player isn't shown a "what's new" for something not yet rolled out.
export async function shouldShowReleaseNotes(): Promise<boolean> {
	try {
		const seen = await AsyncStorage.getItem(RELEASE_SEEN_KEY);
		return seen !== currentRelease().version;
	} catch {
		return false;
	}
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 18,
		backgroundColor: MODAL_BACKDROP_BG,
	},
	card: { width: "100%", maxWidth: 420 },
	sticker: { paddingHorizontal: 18, paddingVertical: 18, ...STICKER_SHADOW },
	kicker: { ...KICKER_TEXT, marginBottom: 4 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		marginBottom: 2,
	},
	dateText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginBottom: 12,
	},
	item: {
		flexDirection: "row",
		gap: 10,
		paddingVertical: 8,
	},
	emojiWrap: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	emoji: { fontSize: 18 },
	itemTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	itemBody: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.ink,
		lineHeight: 18,
		marginTop: 2,
	},
	gotItBtn: {
		marginTop: 14,
		paddingHorizontal: 22,
		paddingVertical: 11,
		borderRadius: 12,
		backgroundColor: WHIMSY.lilac,
		alignSelf: "center",
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	gotItText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
});
