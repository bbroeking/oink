// EffectCard — the ONE drawing of an active blessing or curse.
//
// Audit finding A-10: three components render the same `Effect` object in three
// visual languages — `BarnActiveEffectsStrip` (a hand-rolled View + SHADOW_SM,
// no Sticker and no a11y), `ActiveEffects` (a Sticker row with a corner pill),
// `HoofprintsSheet` (a Sticker card with a RitualIconWell). Three reads of the
// same state teach three mental models. This is the one drawing, at three
// sizes; the sizes differ in DENSITY, never in language.
//
//   · `chip`   — the capsule on the Barn, under the stat tickets. Kind glyph +
//                name, nothing else: a chip is an at-a-glance count, and the
//                full read is one tap away.
//   · `row`    — the list entry (Inbox panel). Avatar in the kind's surface,
//                name, "from X · 3h", countdown on the right in the kind's ink.
//   · `detail` — the card in the Hoofprints sheet. Big glyph, title, the
//                from-line, and — when the caller knows the effect's full
//                duration — a track of how much time is left.
//
// **The kind is never colour alone.** Every size carries the kind GLYPH
// (haloed star for a blessing, storm cloud for a curse) as well as the surface, so
// the two read apart in greyscale and for a colour-blind player. A caller may
// pass `icon` to swap in the ritual's own art; the surface pair still carries
// the kind.
//
// Colour vocabulary (spec §1.1): `WHIMSY.bless` / `WHIMSY.curseGreen` are the
// INK a countdown is written in; `blessSurface` / `curseSurface` are the paper
// it sits on. Both pairs are tokens — five files hand-mixed them before.
import React from "react";
import {
	Image,
	StyleSheet,
	View,
	type ImageSourcePropType,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { AVATAR_SIZE, SPACE, WHIMSY } from "@/constants/theme";
import { formatExpiry } from "@/utils/duration";
import { Avatar, type AvatarFill } from "./Avatar";
import { Chip, Tag, type ChipTone } from "./Chip";
import { Glyph, type GlyphName } from "./Glyph";
import { ListRow } from "./ListRow";
import { ProgressTrack } from "./ProgressTrack";
import { Sticker } from "./Sticker";
import { CardTitle, Hand, Numeral } from "./Text";

/** Which side of the ritual loop this effect is on. */
export type EffectKind = "bless" | "curse";

/** How dense a drawing of the effect this surface wants. */
export type EffectCardSize = "chip" | "row" | "detail";

/**
 * The display shape of an active effect. Deliberately NOT `utils/activeEffects`'
 * server row: this primitive renders a blessing or a curse, it does not know
 * about `source` / `expires_at` / `sender_username` column names. The three
 * consumers map their row onto this.
 */
export interface EffectCardEffect {
	kind: EffectKind;
	/** The ritual's player-facing name ("Mud Wrap"). */
	name: string;
	/** Who laid it on you. Omitted when the sender is unknown. */
	from?: string;
	/** When it lifts. ISO string or epoch ms. */
	expiresAt?: string | number;
	/**
	 * The ritual's own art — a Glyph name, or the ritual's PNG (`RitualMeta.icon`
	 * is a `require()`d image). Falls back to the kind glyph. A chip can only
	 * carry a Glyph, so an image icon falls back there.
	 */
	icon?: GlyphName | ImageSourcePropType;
	/** The ritual's one-line blurb, shown on `detail` only. */
	blurb?: string;
}

// The kind vocabulary, in one place: glyph, surface, ink, capsule tone and the
// word a screen reader says. Adding a third kind means adding a row here.
const KIND = {
	bless: {
		glyph: "bless" as GlyphName,
		surface: "blessSurface" as AvatarFill,
		ink: WHIMSY.bless,
		tone: "sun" as ChipTone,
		track: "sun" as const,
		word: "blessing",
	},
	curse: {
		glyph: "curse" as GlyphName,
		surface: "curseSurface" as AvatarFill,
		ink: WHIMSY.curseGreen,
		tone: "sage" as ChipTone,
		track: "sage" as const,
		word: "curse",
	},
} as const;

// The glyph on the `detail` card — one step up from the avatar's largest frame,
// because the detail card is where the ritual's art is the subject rather than
// a marker beside a name.
const DETAIL_GLYPH = AVATAR_SIZE[2];

const MS_PER_MINUTE = 60_000;

/**
 * The countdown text on every effect surface: "45m", "3h", "2h 10m", and
 * "expiring" once the deadline has passed. Hours and minutes only — an effect
 * that lasted days would be a different feature, and seconds would make a
 * static card lie the moment it rendered.
 *
 * Exported because the consumers announce the same string in places this
 * component does not draw (a toast, a push body, an accessibility hint).
 */
export function formatEffectCountdown(expiresAt?: string | number): string {
	if (expiresAt === undefined) return "";
	const at = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
	if (Number.isNaN(at)) return "";
	return formatExpiry(at - Date.now());
}

// How long is left, in ms, or `undefined` when the caller gave us nothing
// readable. Lives beside `formatEffectCountdown` rather than inside the
// component for the same reason: reading the clock is the one impure thing an
// effect surface has to do, and it is done in exactly these two places.
function remainingMs(expiresAt?: string | number): number | undefined {
	if (expiresAt === undefined) return undefined;
	const at = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
	if (Number.isNaN(at)) return undefined;
	return Math.max(at - Date.now(), 0);
}

// "from Rosie · 3h" — with either half missing, the dot goes too.
function subLine(from: string | undefined, countdown: string): string {
	const parts: string[] = [];
	if (from) parts.push(`from ${from}`);
	if (countdown) parts.push(countdown);
	return parts.join(" · ");
}

interface Props {
	effect: EffectCardEffect;
	size?: EffectCardSize;
	/**
	 * The effect's FULL duration in ms. `detail` needs it to draw the remaining
	 * time as a fraction — an expiry alone says when, not how far through.
	 * Without it the card simply omits the track.
	 */
	durationMs?: number;
	onPress?: () => void;
	/** Position in a list, so stacked rows take their turn from `ROW_TILTS`. */
	index?: number;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}

export function EffectCard({
	effect,
	size = "row",
	durationMs,
	onPress,
	index = 0,
	testID,
	style,
}: Props) {
	const kind = KIND[effect.kind];
	const imageIcon =
		effect.icon !== undefined && typeof effect.icon !== "string"
			? effect.icon
			: undefined;
	const glyph: GlyphName =
		typeof effect.icon === "string" ? effect.icon : kind.glyph;
	const countdown = formatEffectCountdown(effect.expiresAt);
	const sub = subLine(effect.from, countdown);
	// One spoken sentence for all three sizes, so the chip on the Barn and the
	// card in the sheet announce the same fact.
	const label = [
		effect.name,
		kind.word,
		effect.from ? `from ${effect.from}` : "",
		countdown ? `${countdown} left` : "",
	]
		.filter(Boolean)
		.join(", ");

	if (size === "chip") {
		return onPress ? (
			<Chip
				label={effect.name}
				glyph={glyph}
				tone={kind.tone}
				onPress={onPress}
				accessibilityLabel={label}
				accessibilityHint="Opens the full effect"
				testID={testID}
				style={style}
			/>
		) : (
			<Tag
				label={effect.name}
				glyph={glyph}
				tone={kind.tone}
				accessibilityLabel={label}
				testID={testID}
				style={style}
			/>
		);
	}

	if (size === "row") {
		return (
			<ListRow
				leading={
					<Avatar
						size={AVATAR_SIZE[1]}
						fill={kind.surface}
						source={imageIcon}
						glyph={imageIcon ? undefined : glyph}
						label={kind.word}
					/>
				}
				title={effect.name}
				sub={sub || undefined}
				trailing={
					countdown ? (
						<Numeral style={{ color: kind.ink }}>{countdown}</Numeral>
					) : undefined
				}
				onPress={onPress}
				index={index}
				accessibilityLabel={label}
				testID={testID}
				style={style}
			/>
		);
	}

	// `detail`. The track reads in MINUTES rather than raw ms: a screen reader
	// announcing "180 of 360" is a duration a player can picture, and the number
	// a millisecond track would speak is not.
	const left = remainingMs(effect.expiresAt);
	const showTrack =
		left !== undefined && durationMs !== undefined && durationMs > 0;

	return (
		<Sticker
			color={WHIMSY[kind.surface]}
			pad
			onPress={onPress}
			accessibilityLabel={label}
			testID={testID}
			style={style}
		>
			<View style={styles.detailRow}>
				{imageIcon ? (
					<Image
						source={imageIcon}
						style={styles.detailImage}
						resizeMode="contain"
						accessible={false}
					/>
				) : (
					<Glyph name={glyph} size={DETAIL_GLYPH} />
				)}
				<View style={styles.detailText}>
					<CardTitle numberOfLines={1}>{effect.name}</CardTitle>
					{sub ? (
						<Hand tone="secondary" numberOfLines={1}>
							{sub}
						</Hand>
					) : null}
					{effect.blurb ? (
						<Hand tone="secondary" numberOfLines={2}>
							{effect.blurb}
						</Hand>
					) : null}
				</View>
			</View>
			{showTrack ? (
				<ProgressTrack
					value={Math.round((left ?? 0) / MS_PER_MINUTE)}
					max={Math.round(durationMs / MS_PER_MINUTE)}
					tone={kind.track}
					height="sm"
					style={styles.track}
				/>
			) : null}
		</Sticker>
	);
}

const styles = StyleSheet.create({
	detailRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	detailImage: {
		width: DETAIL_GLYPH,
		height: DETAIL_GLYPH,
	},
	detailText: {
		flex: 1,
		minWidth: 0,
		gap: SPACE.xxs,
	},
	track: {
		marginTop: SPACE.md,
	},
});
