// The Titles picker (the shop-IA pass, 2026-09-17).
//
// The pig's nameplate used to `scrollToEnd` past ~127 catalog tiles to reach a
// Titles footer at the bottom of the world (defect 8). It opens this instead:
// one searchable list over the page, worn first, with the titles you have not
// earned yet behind a second segment — silhouettes with the line that says how
// they are come by. Titles are earned, never sold (20260677), so nothing here
// ever carries a price.
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { rpc } from "@/utils/rpc";
import type { TitleRow } from "@/constants/title_types";
import {
	filterTitles,
	sortTitles,
	unearnedTitles,
	type UseTitles,
} from "@/hooks/useTitles";
import {
	ART_SIZE,
	BORDER,
	OPACITY,
	RADII,
	SPACE,
	TAP_MIN,
	UI_COLORS,
} from "@/constants/theme";
import { showAppToast } from "./PurchaseToast";
import {
	EmptyState,
	Glyph,
	LoadingBeat,
	SegmentedControl,
	Sheet,
	Sticker,
	T,
	Tag,
	TextField,
} from "./ui";

// ── Drawing constants ───────────────────────────────────────────────────────
/** The crown standing in for a title's face, in its own round window. */
const AVATAR = 40;
const AVATAR_MARK = ART_SIZE.glyphSm;

type TitlesTab = "earned" | "unearned";

/** Where the title sits against the name — the row's own quiet qualifier. */
const placementLine = (placement: TitleRow["placement"]) =>
	placement === "pre" ? "before her name" : "after her name";

function TitleAvatar({ ghost }: { ghost?: boolean }) {
	return (
		<View style={[styles.avatar, ghost && styles.avatarGhost]}>
			<Glyph name="crown" size={AVATAR_MARK} />
		</View>
	);
}

/** One earned title: tap it and she wears it. */
function TitleRowCard({
	title,
	worn,
	onPress,
}: {
	title: TitleRow;
	worn: boolean;
	onPress: () => void;
}) {
	return (
		<Sticker
			color="paper"
			rotate={0}
			radius={RADII.lg}
			shadow="sm"
			onPress={onPress}
			accessibilityRole="radio"
			accessibilityState={{ selected: worn }}
			accessibilityLabel={`${title.name}, ${placementLine(title.placement)}`}
			accessibilityHint={
				worn ? "Takes this title off her name" : "Wears this title"
			}
			style={styles.row}
		>
			<TitleAvatar />
			<View style={styles.rowCopy}>
				<T role="cardTitleSm" numberOfLines={1}>
					{title.name}
				</T>
				<T role="hand" tone="secondary" numberOfLines={2}>
					{placementLine(title.placement)}
					{title.description ? ` · ${title.description}` : ""}
				</T>
			</View>
			{worn ? <Tag tone="sage" icon="check" label="Wearing" /> : null}
		</Sticker>
	);
}

/** One title still out there: the how-line, and nothing to press. */
function UnearnedRow({ title }: { title: TitleRow }) {
	return (
		<Sticker
			color="cream"
			rotate={0}
			radius={RADII.lg}
			shadow="none"
			style={styles.row}
		>
			<TitleAvatar ghost />
			<View style={styles.rowCopy}>
				<T role="cardTitleSm" tone="secondary" numberOfLines={1}>
					{title.name}
				</T>
				<T role="hand" tone="secondary" numberOfLines={2}>
					{placementLine(title.placement)}
					{title.description ? ` · ${title.description}` : ""}
				</T>
			</View>
		</Sticker>
	);
}

export function TitlesPickerSheet({
	open,
	onClose,
	titles,
	activeTitleId,
	onChange,
}: {
	open: boolean;
	onClose: () => void;
	/**
	 * The host's `useTitles` read. The nameplate the picker opens from resolves
	 * its name from the same rows, so both come from one query rather than two.
	 */
	titles: UseTitles;
	activeTitleId: string | null;
	/** Optimistic: the host's nameplate updates before the RPC comes back. */
	onChange: (next: string | null) => void;
}) {
	const { owned, catalog, loading } = titles;
	const [tab, setTab] = useState<TitlesTab>("earned");
	const [query, setQuery] = useState("");
	const [busy, setBusy] = useState(false);

	const unearned = useMemo(
		() => unearnedTitles(catalog, owned),
		[catalog, owned],
	);
	const earnedRows = useMemo(
		() => filterTitles(sortTitles(owned, activeTitleId), query),
		[owned, activeTitleId, query],
	);
	const unearnedRows = useMemo(
		() => filterTitles(sortTitles(unearned, null), query),
		[unearned, query],
	);

	const wear = async (next: string | null) => {
		if (busy) return;
		setBusy(true);
		const previous = activeTitleId;
		onChange(next); // optimistic — the nameplate behind the sheet moves first
		onClose();
		const result = await rpc<{ ok?: boolean; reason?: string }>(
			"equip_title",
			{ target_title_id: next },
		);
		setBusy(false);
		if (result?.ok === true) return;
		onChange(previous);
		showAppToast({
			type: "fail",
			title: "Couldn't equip title",
			text:
				result?.reason === "not_owned"
					? "You don't own that title yet."
					: "Try again in a moment.",
		});
	};

	return (
		<Sheet
			open={open}
			onClose={onClose}
			keyboardAware
			kicker="earned, never sold"
			title="Titles"
			subtitle={`${owned.length} of ${catalog.length || owned.length}`}
			closeLabel="Close titles"
		>
			<View style={styles.controls}>
				<TextField
					label="Search your titles"
					labelHidden
					icon="search"
					value={query}
					onChangeText={setQuery}
					placeholder="Search your titles"
					autoCorrect={false}
				/>
				<SegmentedControl
					options={[
						{
							value: "earned" as TitlesTab,
							label: `Earned · ${owned.length}`,
							accessibilityHint: "Shows the titles you have earned",
						},
						{
							value: "unearned" as TitlesTab,
							label: `Not yet · ${unearned.length}`,
							accessibilityHint: "Shows the titles still out there",
						},
					]}
					value={tab}
					onChange={setTab}
					label="Which titles"
					layout="row"
				/>
			</View>

			{loading ? (
				<LoadingBeat label="reading your titles" />
			) : tab === "earned" ? (
				<View
					style={styles.list}
					accessibilityRole="radiogroup"
					accessibilityLabel="Your titles"
				>
					{/* Her own name, plain — the first row, always. */}
					<Sticker
						color="paper"
						rotate={0}
						radius={RADII.lg}
						shadow="sm"
						onPress={() => void wear(null)}
						accessibilityRole="radio"
						accessibilityState={{ selected: activeTitleId == null }}
						accessibilityLabel="No title"
						accessibilityHint="Shows her name on its own"
						style={styles.row}
					>
						<TitleAvatar ghost />
						<View style={styles.rowCopy}>
							<T role="cardTitleSm" numberOfLines={1}>
								No title
							</T>
							<T role="hand" tone="secondary">
								just Rosie
							</T>
						</View>
						{activeTitleId == null ? (
							<Tag tone="sage" icon="check" label="Wearing" />
						) : null}
					</Sticker>
					{earnedRows.map((title) => (
						<TitleRowCard
							key={title.id}
							title={title}
							worn={title.id === activeTitleId}
							onPress={() =>
								void wear(title.id === activeTitleId ? null : title.id)
							}
						/>
					))}
					{owned.length === 0 ? (
						<EmptyState
							glyph="star"
							title="No titles yet"
							sub="Climb the snout season pass to earn your first."
						/>
					) : null}
				</View>
			) : (
				<View style={styles.list}>
					{unearnedRows.map((title) => (
						<UnearnedRow key={title.id} title={title} />
					))}
					{unearnedRows.length === 0 ? (
						<EmptyState
							glyph="search"
							title="Nothing left out there"
							sub="Every title we know of is already yours."
						/>
					) : null}
				</View>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	controls: { gap: SPACE.sm, marginBottom: SPACE.md },
	list: { gap: SPACE.sm },
	row: {
		minHeight: TAP_MIN,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
	},
	rowCopy: { flex: 1, minWidth: 0 },
	avatar: {
		width: AVATAR,
		height: AVATAR,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surfaceStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	// A title you have not earned is a silhouette of one.
	avatarGhost: { opacity: OPACITY.ghost },
});
