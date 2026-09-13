// "What's new" modal. Opened manually from Me → Settings so release notes
// remain available without interrupting a login.
//
// Rebuilt on the dialog shell (design-system spec §2 row 05, audit E22): the
// hand-rolled Modal + backdrop + `maxHeight: 380` scroll is now
// `AdaptiveModalScaffold`, which sizes itself from the live window, respects
// the safe areas and always gives dense content a scroll path. The only way out
// used to be a "Got it" button below that scroll — a long release could bury
// its own exit — so the scaffold's `DialogCloseRow` rides above the scroll and
// a backdrop tap dismisses too. Each note is a `ListRow`, so the list reads as
// scrapbook rather than as a bulleted spec.
//
// `visible` / `onClose` are unchanged: Account.tsx drives both.
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	AdaptiveModalScaffold,
	Avatar,
	Button,
	Icon,
	Kicker,
	ListRow,
	SectionTitle,
	T,
	type IconName,
} from "./ui";
import { releaseIcon, releaseIconName } from "../constants/emojiArt";
import {
	ART_SIZE,
	AVATAR_SIZE,
	PAGE_PAD,
	SPACE,
	UI_COLORS,
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

// The print marks a release note may carry as typography. Spec §6: ★ ✦ · are
// typography, ✓ ✕ ♥ are semantic — anything outside this list falls back to ✦
// rather than rendering the authored emoji.
const PRINT_GLYPHS = ["★", "✦", "♥", "✓", "✕", "•", "→"];

// The mark on a note's row: art PNG first, then a fitting vector Icon, then a
// print glyph — never a raw emoji codepoint.
function NoteMark({ emoji, title }: { emoji?: string; title: string }) {
	const art = releaseIcon(emoji);
	const iconName = releaseIconName(emoji) as IconName | null;
	const printGlyph = emoji && PRINT_GLYPHS.includes(emoji) ? emoji : "✦";
	return (
		<Avatar size={AVATAR_SIZE[0]} fill="paper" label={title}>
			{art ? (
				<Image source={art} style={styles.mark} resizeMode="contain" />
			) : iconName ? (
				<Icon
					name={iconName}
					size={ART_SIZE.glyphSm}
					color={UI_COLORS.textPrimary}
				/>
			) : (
				<T role="cardTitle">{printGlyph}</T>
			)}
		</Avatar>
	);
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
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={handleClose}
			showCloseButton
			closeLabel="Close what's new"
			dismissOnBackdrop
			testID="release-notes"
			contentContainerStyle={styles.content}
		>
			<Kicker>what's new</Kicker>
			<SectionTitle accessibilityRole="header">{release.headline}</SectionTitle>
			<T role="kicker" tone="secondary" style={styles.dateLine}>
				v{release.version} · {release.date}
			</T>
			<View style={styles.items}>
				{release.items.map((it, i) => (
					<ListRow
						key={i}
						index={i}
						leading={<NoteMark emoji={it.emoji} title={it.title} />}
						title={it.title}
						sub={it.body}
					/>
				))}
			</View>
			<Button
				variant="lilac"
				onPress={handleClose}
				style={styles.gotIt}
				accessibilityHint="Closes what's new and marks this release read."
			>
				Got it
			</Button>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingBottom: PAGE_PAD,
	},
	dateLine: {
		marginBottom: SPACE.md,
	},
	items: {
		gap: SPACE.sm,
	},
	mark: {
		width: ART_SIZE.glyphSm,
		height: ART_SIZE.glyphSm,
	},
	gotIt: {
		marginTop: SPACE.lg,
		alignSelf: "center",
	},
});
