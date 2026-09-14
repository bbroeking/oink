import React from "react";
import {
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import {
	BORDER,
	PRESSED_FLAT,
	RADII,
	ROW_TILTS,
	SPACE,
	TAP_MIN,
	UI_COLORS,
} from "@/constants/theme";
import { Sticker } from "./Sticker";
import { ListRowSkeleton } from "./Skeleton";
import { Icon, type IconName } from "./Icon";
import { Glyph, type GlyphName } from "./Glyph";
import { T } from "./Text";

export interface ListRowProps {
	leading?: React.ReactNode;
	title: React.ReactNode | string;
	sub?: React.ReactNode | string;
	trailing?: React.ReactNode;
	/**
	 * An absolutely-positioned layer inside the row's content box, drawn AFTER
	 * the text column and BEFORE the trailing rail — so it covers the name and
	 * the rail still covers it. The caller owns its insets; the row only turns
	 * on the clip so a sliding overlay is cut at the card edge. (2026-09-12)
	 */
	overlay?: React.ReactNode;
	/**
	 * An absolutely positioned layer drawn AFTER the rail, for a panel that must
	 * follow the rail in accessibility order. Focus order is tree order, so a
	 * row whose trigger opens a panel of actions puts the trigger in `trailing`
	 * and the panel here: identity → trigger → cells. Same clip as `overlay`
	 * (the slide is cut at the card edge); the caller owns its insets and must
	 * leave the rail's own controls uncovered. (2026-09-14)
	 */
	after?: React.ReactNode;
	/** In-flow details below the identity; action controls remain separate accessibility targets. */
	footer?: React.ReactNode;
	onPress?: () => void;
	// Pinned / current row. `BORDER.heavy` and a straightened tilt — selection is
	// never a color change alone (spec §3.3).
	selected?: boolean;
	// The "trotted on" row: already-spent, already-visited, already-done. Muted
	// fill + secondary ink, never an opacity crush.
	muted?: boolean;
	loading?: boolean;
	// Position in the list, so each row takes its own turn from `ROW_TILTS` and
	// the stack reads as scrapbook rather than spreadsheet.
	index?: number;
	tilt?: boolean;
	// Sticker fill for rows that carry a kind (a curse row on curseSurface, a
	// members row on slopBand). Default paper; `muted` still wins. (2026-09-11)
	fill?: React.ComponentProps<typeof Sticker>["color"];
	// A row that cannot be chosen right now keeps its shape (DISABLED chrome via
	// Sticker) and announces it. (2026-09-11)
	disabled?: boolean;
	// A row that opens something in place announces the state it is in, so a
	// screen reader hears "expanded" rather than discovering new buttons.
	expanded?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}

/**
 * The one row drawing. Replaces the row hand-rolled in Leaderboard, Friends,
 * Inbox, CrewRow and race-standings. [D-13, E18] (2026-09-11)
 */
export function ListRow({
	leading,
	title,
	sub,
	trailing,
	overlay,
	after,
	footer,
	onPress,
	selected,
	muted,
	loading,
	index = 0,
	tilt = true,
	fill,
	disabled,
	expanded,
	accessibilityLabel,
	accessibilityHint,
	testID,
	style,
}: ListRowProps) {
	if (loading) return <ListRowSkeleton />;

	// A selected row sits straight — the pin reads as deliberate, not as one
	// more sticker in the pile.
	const rotate =
		selected || !tilt ? 0 : ROW_TILTS[index % ROW_TILTS.length];
	const tone = muted ? "secondary" : "primary";
	const identity = (
		<>
			{leading !== undefined ? <View>{leading}</View> : null}
			<View style={styles.text}>
				{typeof title === "string" ? <T role="body" tone={tone}>{title}</T> : title}
				{typeof sub === "string" ? <T role="hand" tone="secondary">{sub}</T> : sub}
			</View>
		</>
	);

	if (footer !== undefined) {
		return (
			<Sticker
				color={muted ? UI_COLORS.surfaceStrong : (fill ?? "paper")}
				shadow="sm"
				radius={RADII.md}
				border={selected ? BORDER.heavy : BORDER.ink}
				rotate={rotate}
				disabled={disabled}
				style={[styles.row, styles.withFooter, style]}
			>
				<View style={styles.header}>
					<Pressable
						onPress={onPress}
						disabled={disabled}
						accessibilityRole="button"
						accessibilityLabel={accessibilityLabel ?? (typeof title === "string" ? title : undefined)}
						accessibilityHint={accessibilityHint}
						accessibilityState={{ selected: !!selected, disabled: !!disabled, expanded }}
						testID={testID}
						style={({ pressed }) => [styles.identity, pressed && !disabled && PRESSED_FLAT]}
					>
						{identity}
					</Pressable>
					{trailing !== undefined ? <View>{trailing}</View> : null}
				</View>
				{footer}
			</Sticker>
		);
	}

	return (
		<Sticker
			color={muted ? UI_COLORS.surfaceStrong : (fill ?? "paper")}
			shadow="sm"
			radius={RADII.md}
			border={selected ? BORDER.heavy : BORDER.ink}
			rotate={rotate}
			pad
			onPress={onPress}
			disabled={disabled}
			accessibilityState={{
				selected: !!selected,
				...(expanded === undefined ? null : { expanded }),
			}}
			accessibilityLabel={
				accessibilityLabel ??
				(typeof title === "string" ? title : undefined)
			}
			accessibilityHint={accessibilityHint}
			testID={testID}
			style={[
				styles.row,
				(overlay !== undefined || after !== undefined) && styles.clipped,
				style,
			]}
		>
			{identity}
			{/* Paint order IS the design: after the text (so it covers the name),
			    before the trailing rail (so the rail stays on top of it and keeps
			    its taps). */}
			{overlay}
			{trailing !== undefined ? <View>{trailing}</View> : null}
			{/* …and `after` is the other choice: a layer that FOLLOWS the rail, so
			    a screen reader reaches the trigger before what it opened. */}
			{after}
		</Sticker>
	);
}

export interface NavRowProps {
	// An interface affordance (`Icon`) or a piece of subject matter (`Glyph`),
	// either one riding an ink-bordered bubble. Glyph = subject, Icon = UI.
	icon?: IconName;
	glyph?: GlyphName;
	label: string;
	sub?: string;
	badge?: React.ReactNode;
	onPress: () => void;
	// "danger" tints the row on dangerSurface with dangerText — the delete-
	// account door. Never opacity, never a lone color change: the row keeps
	// its ink outline and its chevron. (2026-09-11)
	tone?: "default" | "danger";
	accessibilityHint?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}

/**
 * The `ListRow` preset for "go somewhere": bubble, label, chevron. Account.tsx
 * draws this row in three different geometries today. [E18, E25] (2026-09-11)
 */
export function NavRow({
	icon,
	glyph,
	label,
	sub,
	badge,
	onPress,
	tone = "default",
	accessibilityHint,
	testID,
	style,
}: NavRowProps) {
	const danger = tone === "danger";
	const ink = danger ? UI_COLORS.dangerText : UI_COLORS.textPrimary;
	return (
		<ListRow
			fill={danger ? UI_COLORS.dangerSurface : undefined}
			leading={
				<View style={styles.bubble}>
					{icon ? (
						<Icon name={icon} size={BUBBLE_ICON} color={ink} />
					) : glyph ? (
						<Glyph name={glyph} size={BUBBLE_ICON} />
					) : null}
				</View>
			}
			title={danger ? <T role="body" tone="danger">{label}</T> : label}
			sub={sub}
			trailing={
				<View style={styles.trailing}>
					{badge}
					<Icon
						name="chevronRight"
						size={BUBBLE_ICON}
						color={danger ? UI_COLORS.dangerText : UI_COLORS.textSecondary}
					/>
				</View>
			}
			onPress={onPress}
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			testID={testID}
			style={style}
		/>
	);
}

// The bubble's contents. 18pt reads at the same weight as a row's `body` title
// without crowding the 44pt frame the row already clears.
const BUBBLE_ICON = 18;
// The bubble itself — a squat pill, sized from the scale so it stays in step
// with the row's own padding rather than floating free at "40".
const BUBBLE_SIZE = SPACE.xl + SPACE.md;

const styles = StyleSheet.create({
	withFooter: { flexDirection: "column", alignItems: "stretch" },
	header: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	identity: {
		flex: 1,
		minWidth: 0,
		minHeight: TAP_MIN,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		// `pad` lays down the sanctioned card inset; a row is tighter top-to-bottom
		// and wider side-to-side than a card, so it restates both axes.
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
	},
	// Only rows carrying an `overlay` or an `after` layer clip: a sliding layer
	// has to be cut at the card edge, and every other row keeps the (unclipped)
	// default. The rail's own controls sit inside this box — the 2026-09-12
	// cut-off doors were the text column pushing them OUT of it, which
	// `text.minWidth: 0` below is what fixed.
	clipped: {
		overflow: "hidden",
	},
	text: {
		flex: 1,
		// Yoga's automatic minimum size is CONTENT size, so without this the text
		// column cannot shrink below its widest non-text child and pushes the
		// trailing rail off the card on a narrow phone (or at large Dynamic
		// Type). The rail's controls were being clipped for exactly this reason.
		// [friends-row cut-off doors, 2026-09-12]
		minWidth: 0,
		gap: SPACE.xxs,
	},
	bubble: {
		width: BUBBLE_SIZE,
		height: BUBBLE_SIZE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
	},
	trailing: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
});
