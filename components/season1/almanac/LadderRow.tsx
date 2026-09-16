// One rung of the pass ladder — the reward's art in a 40pt well, `TIER N` with
// its type pill, the reward's name, and a trailing state: a check once claimed,
// a gold `Claim` while ready, a hand `N XP away` while locked. A ready rung sits
// on the sun; a locked one keeps its shape behind a dashed well (mute the fill,
// never dissolve the outline). Rows stack inside PassPanel's bordered sticker.

import { Image, StyleSheet, View } from "react-native";
import {
	Button,
	Glyph,
	Hand,
	Icon,
	T,
	Tag,
	TickleIcon,
	type ChipTone,
} from "@/components/ui";
import {
	ART_SIZE,
	BORDER,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { resolveRewardArt, rewardKind, type RewardKind } from "@/utils/rewardArt";
import type { TierRow, TierState } from "@/utils/seasonPass";

// Drawing geometry: the art well and the art inside it.
const WELL = ART_SIZE.glyph;
const WELL_ART = 32;
const WELL_MARK = 20;
const CHECK_MARK = 18;

// The pastel each reward kind's pill wears. The kind itself is
// `utils/rewardArt.rewardKind` — the one owner of reward_type → word.
export const REWARD_KIND_TONE: Record<RewardKind, ChipTone> = {
	wear: "lilac",
	barn: "sage",
	title: "rose",
	tickles: "sky",
	mystery: "lilac",
	milestone: "rose",
};

function RewardWell({ reward, locked }: { reward: TierRow; locked: boolean }) {
	if (locked) {
		return (
			<View style={[styles.well, styles.wellLocked]}>
				<Icon name="lock" size={WELL_MARK} color={UI_COLORS.uiMuted} />
			</View>
		);
	}
	const art = resolveRewardArt(reward);
	let inner: React.ReactNode;
	switch (art.kind) {
		case "tickles":
			inner = <TickleIcon size={WELL_MARK} />;
			break;
		case "snouts":
			inner = <Glyph name="pigface" size={WELL_MARK} />;
			break;
		case "goldenTruffle":
		case "image":
			inner = <Image source={art.source} style={styles.art} resizeMode="contain" />;
			break;
		// A Barn furnishing — the catalog art, drawn as the Barn draws it.
		case "habitat":
			inner = <Image source={art.source} style={styles.habitatArt} resizeMode="contain" />;
			break;
		case "title":
			inner = <T role="cardTitle">&quot;</T>;
			break;
		case "boost":
			inner = <Icon name="flame" size={WELL_MARK} filled color={WHIMSY.flame} />;
			break;
		case "special":
			inner = <Glyph name="gift" size={WELL_MARK} />;
			break;
		default:
			inner = <Icon name="star" size={WELL_MARK} color={UI_COLORS.uiMuted} />;
			break;
	}
	return <View style={styles.well}>{inner}</View>;
}

export interface LadderRowProps {
	tier: number;
	state: TierState;
	reward: TierRow;
	/** XP still to earn — printed on a locked rung. */
	xpAway?: number;
	busy?: boolean;
	onClaim?: () => void;
	testID?: string;
}

export function LadderRow({ tier, state, reward, xpAway = 0, busy, onClaim, testID }: LadderRowProps) {
	const kind = rewardKind(reward);
	const ready = state === "ready";
	const claimed = state === "claimed";
	const locked = state === "locked";
	return (
		<View
			style={[styles.row, ready && styles.rowReady]}
			testID={testID}
			accessible={!ready}
			accessibilityLabel={
				ready
					? undefined
					: claimed
						? `Tier ${tier}, ${reward.display_label}, claimed`
						: `Tier ${tier}, ${reward.display_label}, ${xpAway} XP away`
			}
		>
			<RewardWell reward={reward} locked={locked} />
			<View style={styles.text}>
				<View style={styles.capRow}>
					<T role="kickerPill" tone="secondary">
						TIER {tier}
					</T>
					<Tag tone={REWARD_KIND_TONE[kind]} label={kind} />
				</View>
				<T role="body" tone={locked ? "secondary" : "primary"} numberOfLines={1}>
					{reward.display_label}
				</T>
			</View>
			{ready ? (
				<Button
					size="sm"
					variant="gold"
					onPress={onClaim}
					loading={busy}
					accessibilityLabel={`Claim ${reward.display_label}`}
					accessibilityHint={`Adds tier ${tier}'s reward to your account`}
					testID={`ladder-claim-${tier}`}
				>
					Claim
				</Button>
			) : claimed ? (
				<Icon name="check" size={CHECK_MARK} color={UI_COLORS.successText} strokeWidth={3} />
			) : (
				<Hand tone="secondary">{`${xpAway} XP away`}</Hand>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.xs,
	},
	rowReady: { backgroundColor: WHIMSY.sun },
	well: {
		width: WELL,
		height: WELL,
		borderRadius: RADII.md,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		alignItems: "center",
		justifyContent: "center",
	},
	wellLocked: {
		borderStyle: "dashed",
		borderColor: UI_COLORS.uiMuted,
	},
	art: { width: WELL_ART, height: WELL_ART },
	// Furnishing thumbnails fill their well — they are product shots, not
	// sprites cut for the pig.
	habitatArt: { width: WELL, height: WELL, borderRadius: RADII.md },
	text: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	capRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
});
