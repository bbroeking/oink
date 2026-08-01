// "What's new" modal. Opened manually from Me → Settings so release notes
// remain available without interrupting a login.
import React from "react";
import {
	Modal,
	View,
	Text,
	Image,
	StyleSheet,
	Pressable,
	ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sticker } from "./ui/Sticker";
import { Icon, type IconName } from "./ui/Icon";
import { releaseIcon, releaseIconName } from "../constants/emojiArt";
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
							{release.items.map((it, i) => {
								// Resolve the leading glyph WITHOUT ever rendering a
								// raw emoji: art PNG first, then a fitting vector Icon,
								// then a print glyph (keep the design glyphs the note
								// already carries — ✦ ★ etc. — and ★-fallback the rest).
								const art = releaseIcon(it.emoji);
								const iconName = releaseIconName(it.emoji);
								const PRINT_GLYPHS = ["★", "✦", "♥", "✓", "✕", "•", "→"];
								const printGlyph =
									it.emoji && PRINT_GLYPHS.includes(it.emoji)
										? it.emoji
										: "✦";
								return (
								<View key={i} style={styles.item}>
									<View style={styles.emojiWrap}>
										{art ? (
											<Image source={art} style={styles.emojiImg} />
										) : iconName ? (
											<Icon
												name={iconName as IconName}
												size={20}
												color={WHIMSY.ink}
											/>
										) : (
											<Text style={styles.emoji}>{printGlyph}</Text>
										)}
									</View>
									<View style={{ flex: 1, minWidth: 0 }}>
										<Text style={styles.itemTitle}>{it.title}</Text>
										<Text style={styles.itemBody}>{it.body}</Text>
									</View>
								</View>
								);
							})}
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
	emojiImg: { width: 26, height: 26, resizeMode: "contain" },
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
