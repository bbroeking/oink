// "Claim a Barn furnishing" — the season pass sheet for a `habitat` tier
// (Almanac spec, Sheets). Kicker `season pass · tier N`, the tilted hero art
// card, the furnishing's name and Barn slot, its hand description, then two
// ways to take it: hang it now (claim, then the Barn editor opens on the spot
// it fits with the furnishing in hand — never placed for the player) or claim
// and hang it later. Either way it is theirs: a pass furnishing outlives the
// season.
//
// A component named `*Sheet` mounts the `Sheet` panel (spec §3.4). The panel
// owns the chrome — the slide, the scrim, Reduce Motion (a fade) — so this
// file animates nothing of its own. The art card's lean is a static tilt.

import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
	HABITAT_CATALOG_BY_ID,
	HABITAT_POSITION_META,
	habitatItemAsset,
} from "@/constants/habitat";
import { ART_SIZE, RADII, SPACE, TILT } from "@/constants/theme";
import {
	Button,
	Hand,
	HandLg,
	Kicker,
	PageTitle,
	POPUP_HANDOFF_GAP_MS,
	Sheet,
	Sticker,
	Tag,
} from "@/components/ui";
import type { ClaimResult } from "@/hooks/useSeason";
import type { TierRow } from "@/utils/seasonPass";
import type { HabitatCategory } from "@/utils/habitat";
import { rewardHabitatItemId } from "@/utils/rewardArt";

// The Barn spot a furnishing category hangs in, in the words the Barn editor
// uses for that spot (HABITAT_POSITION_META labels, lower-cased for the pill).
// floor_decor has two spots; the pill says the plainer "floor".
function barnSlotWord(category: HabitatCategory): string {
	if (category === "floor_decor") return "floor";
	const entry = Object.values(HABITAT_POSITION_META).find(
		(meta) => meta.category === category
	);
	return (entry?.label ?? "barn").toLowerCase();
}

interface Props {
	open: boolean;
	tier: TierRow;
	onClose: () => void;
	/** The season claim for this tier. Resolves null on a transport miss. */
	onClaim: (tier: TierRow) => Promise<ClaimResult | null>;
}

export function BarnRewardClaimSheet({ open, tier, onClose, onClaim }: Props) {
	const itemId = rewardHabitatItemId(tier);
	const item = itemId ? HABITAT_CATALOG_BY_ID[itemId] : undefined;
	const [busy, setBusy] = useState<"hang" | "later" | null>(null);
	const [missed, setMissed] = useState(false);
	// A missed claim's retry line belongs to THIS opening: forget it when the
	// sheet closes (state adjusted during render, not in an effect).
	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (!open) setMissed(false);
	}
	const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (handoff.current) clearTimeout(handoff.current);
		},
		[]
	);

	const claim = async (mode: "hang" | "later") => {
		if (busy) return;
		setBusy(mode);
		setMissed(false);
		const result = await onClaim(tier);
		setBusy(null);
		if (!result?.ok) {
			setMissed(true);
			return;
		}
		onClose();
		if (mode === "hang" && itemId) {
			// The sheet rides a native Modal; let it dismiss before the route
			// push, the same hand-off gap every popup-to-navigation path keeps.
			handoff.current = setTimeout(
				() =>
					router.push({
						pathname: "/barn-interior",
						params: { handItemId: itemId },
					}),
				POPUP_HANDOFF_GAP_MS
			);
		}
	};

	const name = item?.name ?? tier.display_label;
	const slot = item ? barnSlotWord(item.category) : "barn";

	return (
		<Sheet
			open={open}
			onClose={onClose}
			closeLabel="Close the furnishing"
			testID="barn-reward-claim-sheet"
			footer={
				<View style={styles.actions}>
					<Button
						variant="gold"
						size="lg"
						full
						loading={busy === "hang"}
						loadingLabel="Hanging it up…"
						disabled={busy === "later"}
						onPress={() => void claim("hang")}
						accessibilityLabel={`Hang the ${name} in the Barn`}
						accessibilityHint="Claims the furnishing and opens your Barn with it in hand"
						testID="barn-reward-hang"
					>
						Hang it in the Barn
					</Button>
					<Button
						variant="ghost"
						size="lg"
						full
						loading={busy === "later"}
						loadingLabel="Claiming…"
						disabled={busy === "hang"}
						onPress={() => void claim("later")}
						accessibilityLabel={`Claim the ${name} and hang it later`}
						accessibilityHint="Claims the furnishing into your Barn collection"
						testID="barn-reward-later"
					>
						Claim, hang it later
					</Button>
					{missed ? (
						<Hand tone="danger" style={styles.centered} accessibilityLiveRegion="polite">
							Couldn&apos;t claim it — give it another tap.
						</Hand>
					) : (
						<Hand tone="secondary" style={styles.centered}>
							Yours to keep, season over or not.
						</Hand>
					)}
				</View>
			}
		>
			<View style={styles.body}>
				<Kicker star={false} style={styles.centered}>
					season pass · tier {tier.tier}
				</Kicker>
				<Sticker
					color="cream"
					rotate={TILT.reveal}
					radius={RADII.lg}
					shadow
					style={styles.artCard}
					accessibilityRole="image"
					accessibilityLabel={`${name} art`}
				>
					<Image
						source={habitatItemAsset(item?.assetKey ?? "")}
						style={styles.art}
						resizeMode="contain"
						accessibilityIgnoresInvertColors
					/>
				</Sticker>
				<PageTitle accessibilityRole="header" style={styles.centered}>
					{name}
				</PageTitle>
				<Tag tone="sage" label={`barn · ${slot}`} testID="barn-reward-slot" />
				{!!item?.description && (
					<HandLg tone="secondary" style={styles.centered}>
						{item.description}
					</HandLg>
				)}
			</View>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	body: {
		alignItems: "center",
		gap: SPACE.md,
		paddingTop: SPACE.sm,
	},
	centered: { textAlign: "center" },
	artCard: {
		width: ART_SIZE.reveal,
		height: ART_SIZE.reveal,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: SPACE.sm,
	},
	art: {
		width: ART_SIZE.portrait,
		height: ART_SIZE.portrait,
	},
	actions: {
		gap: SPACE.sm,
		alignItems: "stretch",
	},
});
