import React from "react";
import {
	Pressable,
	StyleSheet,
	View,
	useWindowDimensions,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import {
	BORDER,
	CHROME_TYPE_CAP,
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
import { useIconScale } from "./DynamicTypeText";

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
	/**
	 * A control that must stay its OWN accessibility target — the Share pill on
	 * a navigation row. Inside the row it was part of one grouped button, so
	 * VoiceOver could never reach it. Given, the row splits the way the
	 * `footer` variant does: the identity (leading + text) is the row's button,
	 * `action` sits outside it, and the trailing rail (a chevron) still answers
	 * the row's tap but stays out of the tree, the identity already carrying the
	 * name. (2026-10-04, Me ask M-02)
	 *
	 * The split row carries `overlay` and `after` too, in the same paint and
	 * focus order (identity → overlay → action → rail → after), so a row whose
	 * trigger opens a slide-over panel puts the trigger HERE: in `trailing` it
	 * was inside the row's one button, and VoiceOver could reach neither the
	 * trigger nor the panel (the friend row's "Actions for …"). (2026-10-04)
	 */
	action?: React.ReactNode;
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
	// A row INSIDE a sticker — a roster, a ladder — draws no outline of its own,
	// no lift, and no side inset (the host card already has all three). It keeps
	// the 44pt frame, the press, and the identity/rail grammar. Selection still
	// draws its heavy outline. Added so no caller has to zero the chrome from
	// outside (the 2026-09-12 ruling). (2026-09-16)
	flat?: boolean;
	// A row that opens something in place announces the state it is in, so a
	// screen reader hears "expanded" rather than discovering new buttons.
	expanded?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	/**
	 * VoiceOver custom actions on the row's button: how a small control drawn
	 * INSIDE the identity (the friend row's "send a pig" tag) stays reachable,
	 * since an accessibility element hides everything inside it. (2026-10-04)
	 */
	accessibilityActions?: PressableProps["accessibilityActions"];
	onAccessibilityAction?: PressableProps["onAccessibilityAction"];
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
	action,
	onPress,
	selected,
	muted,
	loading,
	index = 0,
	tilt = true,
	fill,
	disabled,
	flat,
	expanded,
	accessibilityLabel,
	accessibilityHint,
	accessibilityActions,
	onAccessibilityAction,
	testID,
	style,
}: ListRowProps) {
	const { fontScale } = useWindowDimensions();
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

	// The split row: identity button · action · a rail that answers the tap.
	if (action !== undefined && footer === undefined) {
		// Past the chrome ceiling the action moves under the identity, the way a
		// table cell stacks its accessory at the accessibility sizes: a Share
		// pill keeps its width as the type grows, and beside it "Invite new
		// pigs" broke letter by letter on an SE ("In / vi / te", after round
		// 2026-10-04). A row carrying an overlay or an after panel keeps its one
		// line, because the panel is laid against it (the friend row).
		const stacked = fontScale > CHROME_TYPE_CAP && overlay === undefined && after === undefined;
		const identityButton = (
			<Pressable
				onPress={onPress}
				disabled={disabled}
				// The card's own pad still answers the row's tap, as it did when
				// the whole card was the button.
				hitSlop={flat ? IDENTITY_SLOP_FLAT : IDENTITY_SLOP}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? (typeof title === "string" ? title : undefined)}
				accessibilityHint={accessibilityHint}
				accessibilityState={{ selected: !!selected, disabled: !!disabled, expanded }}
				accessibilityActions={accessibilityActions}
				onAccessibilityAction={onAccessibilityAction}
				testID={testID}
				style={({ pressed }) => [
					styles.identity,
					styles.identityFill,
					pressed && !disabled && PRESSED_FLAT,
				]}
			>
				{identity}
			</Pressable>
		);
		const rail =
			trailing !== undefined ? (
				// The chevron is the row's own door, drawn: a tap on it is a tap
				// on the row, and a screen reader already met the row by name.
				<Pressable
					onPress={onPress}
					disabled={disabled}
					accessible={false}
					importantForAccessibility="no-hide-descendants"
					style={styles.rail}
				>
					{trailing}
				</Pressable>
			) : null;
		return (
			<Sticker
				color={muted ? UI_COLORS.surfaceStrong : (fill ?? "paper")}
				shadow={flat ? "none" : "sm"}
				radius={RADII.md}
				border={selected ? BORDER.heavy : flat ? 0 : BORDER.ink}
				rotate={flat ? 0 : rotate}
				pad
				disabled={disabled}
				style={[
					styles.row,
					stacked && styles.rowStacked,
					flat && styles.flat,
					(overlay !== undefined || after !== undefined) && styles.clipped,
					style,
				]}
			>
				{stacked ? (
					// Focus order is unchanged: identity, then the action (the rail
					// stays out of the tree).
					<>
						<View style={styles.stackLine}>
							{identityButton}
							{rail}
						</View>
						<View style={styles.actionStacked}>{action}</View>
					</>
				) : (
					<>
						{identityButton}
						{overlay}
						<View>{action}</View>
						{rail}
						{after}
					</>
				)}
			</Sticker>
		);
	}

	if (footer !== undefined) {
		return (
			<Sticker
				color={muted ? UI_COLORS.surfaceStrong : (fill ?? "paper")}
				shadow={flat ? "none" : "sm"}
				radius={RADII.md}
				border={selected ? BORDER.heavy : flat ? 0 : BORDER.ink}
				rotate={flat ? 0 : rotate}
				disabled={disabled}
				style={[styles.row, styles.withFooter, flat && styles.flat, style]}
			>
				<View style={styles.header}>
					<Pressable
						onPress={onPress}
						disabled={disabled}
						accessibilityRole="button"
						accessibilityLabel={accessibilityLabel ?? (typeof title === "string" ? title : undefined)}
						accessibilityHint={accessibilityHint}
						accessibilityState={{ selected: !!selected, disabled: !!disabled, expanded }}
						accessibilityActions={accessibilityActions}
						onAccessibilityAction={onAccessibilityAction}
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
			shadow={flat ? "none" : "sm"}
			radius={RADII.md}
			border={selected ? BORDER.heavy : flat ? 0 : BORDER.ink}
			rotate={flat ? 0 : rotate}
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
			accessibilityActions={accessibilityActions}
			onAccessibilityAction={onAccessibilityAction}
			testID={testID}
			style={[
				styles.row,
				flat && styles.flat,
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
	/**
	 * What the badge says, when it is art rather than words (a rank disc, a
	 * dot). Omitted, the row reads the badge's own label or text. (2026-10-04)
	 */
	badgeLabel?: string;
	/**
	 * A control that is its own accessibility target, drawn before the chevron
	 * and OUTSIDE the row's button (a Share pill) — see `ListRow.action`.
	 * (2026-10-04, Me ask M-02)
	 */
	action?: React.ReactNode;
	/** Overrides the spoken name. By default: label, sub line, badge. */
	accessibilityLabel?: string;
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
	badgeLabel,
	action,
	accessibilityLabel,
	onPress,
	tone = "default",
	accessibilityHint,
	testID,
	style,
}: NavRowProps) {
	const danger = tone === "danger";
	const ink = danger ? UI_COLORS.dangerText : UI_COLORS.textPrimary;
	// The bubble and its mark grow with the words beside them, up to 2x (the
	// 200% rule), so the row's art never shrinks to a speck next to large
	// text. At the default size nothing moves. (2026-10-04, Me ask M-05)
	const scale = useIconScale();
	const bubbleSize = BUBBLE_SIZE * scale;
	const iconSize = BUBBLE_ICON * scale;
	// The name a screen reader hears is everything the row SAYS: the label, the
	// sub line and the badge (the Me rows' "0 of 6 regalia · next: …" and their
	// rank chip were silent). (2026-10-04, Me ask M-03)
	const spoken =
		accessibilityLabel ??
		[label, sub, badgeLabel ?? spokenText(badge)].filter(Boolean).join(", ");
	return (
		<ListRow
			fill={danger ? UI_COLORS.dangerSurface : undefined}
			leading={
				<View
					style={[
						styles.bubble,
						{ width: bubbleSize, height: bubbleSize },
					]}
				>
					{icon ? (
						<Icon name={icon} size={iconSize} color={ink} />
					) : glyph ? (
						<Glyph name={glyph} size={iconSize} />
					) : null}
				</View>
			}
			title={danger ? <T role="body" tone="danger">{label}</T> : label}
			sub={sub}
			action={action}
			trailing={
				<View style={styles.trailing}>
					{badge}
					<Icon
						name="chevronRight"
						size={iconSize}
						color={danger ? UI_COLORS.dangerText : UI_COLORS.textSecondary}
					/>
				</View>
			}
			onPress={onPress}
			accessibilityLabel={spoken}
			accessibilityHint={accessibilityHint}
			testID={testID}
			style={style}
		/>
	);
}

/**
 * The words a badge node says: a plain string or number, else the element's
 * own `accessibilityLabel`, else its `label` prop (a `Tag`), else its text
 * children. Art with none of those says nothing — pass `badgeLabel`.
 */
function spokenText(node: React.ReactNode): string {
	if (node === null || node === undefined || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(spokenText).filter(Boolean).join(" ");
	if (React.isValidElement(node)) {
		const props = node.props as {
			accessibilityLabel?: unknown;
			label?: unknown;
			children?: React.ReactNode;
		};
		if (typeof props.accessibilityLabel === "string") return props.accessibilityLabel;
		if (typeof props.label === "string") return props.label;
		return spokenText(props.children);
	}
	return "";
}

// The row's own pad (styles.row), which the split row's identity reaches into
// with its hit frame so the card's edge is still the row's door. A flat row
// has no side pad, so its frame grows only up and down.
const ROW_PAD_V = SPACE.sm;
const ROW_PAD_H = SPACE.md;
const IDENTITY_SLOP = { top: ROW_PAD_V, bottom: ROW_PAD_V, left: ROW_PAD_H, right: 0 };
const IDENTITY_SLOP_FLAT = { top: ROW_PAD_V, bottom: ROW_PAD_V, left: 0, right: 0 };

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
	// The split row's identity takes the row's whole height (a row with a
	// floor taller than its content, the friend row), so its hit frame plus the
	// pad covers the card edge to edge.
	identityFill: { alignSelf: "stretch" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		// `pad` lays down the sanctioned card inset; a row is tighter top-to-bottom
		// and wider side-to-side than a card, so it restates both axes.
		paddingVertical: ROW_PAD_V,
		paddingHorizontal: ROW_PAD_H,
	},
	// A row inside a card: the card owns the side inset; the row keeps its
	// vertical rhythm and its 44pt frame.
	flat: {
		paddingHorizontal: 0,
		minHeight: TAP_MIN,
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
	// The split row's chevron answers taps on a full-height frame.
	rail: {
		minHeight: TAP_MIN,
		justifyContent: "center",
	},
	// The stacked split row (text past the chrome ceiling): the identity and
	// its rail on one line, the action under them at its own width.
	rowStacked: {
		flexDirection: "column",
		alignItems: "stretch",
		gap: SPACE.sm,
	},
	stackLine: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	actionStacked: { alignSelf: "flex-start" },
});
