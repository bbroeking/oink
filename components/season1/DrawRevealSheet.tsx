// "You drew a furnishing" — the one reveal for both random-furnishing moments
// (2026-09-16 ruling): the Monday Barn Draw (a win of mine, first open; or
// the crew's last result, from the Race panel's row) and the Trough quarter
// reward (on the chip that crossed it). The grant already happened on the
// server — this sheet shows it, it never claims. Kicker names the moment, the
// tilted hero art card, the furnishing's name and Barn slot, its hand
// description; a purse (the winner owns every design) shows the tickle mark.
//
// Mine: a gold "Hang it in the Barn" opens the Barn editor with it in hand
// (never placed for the player) and a ghost "Later". Someone else's draw: a
// plain close, and the seed under the result so the draw can be recomputed.
//
// A component named `*Sheet` mounts the `Sheet` panel (spec §3.4). The panel
// owns the chrome; the art card's lean is a static tilt.

import { useEffect, useRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { HABITAT_CATALOG_BY_ID, HABITAT_POSITION_META, habitatItemAsset } from "@/constants/habitat";
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
	TickleIcon,
} from "@/components/ui";
import type { BarnPrize } from "@/utils/barnDraw";
import type { HabitatCategory } from "@/utils/habitat";

function barnSlotWord(category: HabitatCategory): string {
	if (category === "floor_decor") return "floor";
	const entry = Object.values(HABITAT_POSITION_META).find((meta) => meta.category === category);
	return (entry?.label ?? "barn").toLowerCase();
}

export interface DrawRevealSheetProps {
	open: boolean;
	/** The prize drawn. Null renders nothing (the sheet is keyed on a result). */
	prize: BarnPrize | null;
	/** Hand-voice line above the title: "the barn draw · monday", "the trough · past your quarter". */
	kicker: string;
	/** Whose draw it is. Mine gets the Barn door; a crewmate's is a look. */
	mine: boolean;
	/** The crewmate who drew, when it isn't mine. */
	winnerName?: string | null;
	/** The revealed seed — small print so the result can be recomputed by hand. */
	seed?: string | null;
	onClose: () => void;
	testID?: string;
}

export function DrawRevealSheet({
	open,
	prize,
	kicker,
	mine,
	winnerName,
	seed,
	onClose,
	testID = "draw-reveal-sheet",
}: DrawRevealSheetProps) {
	const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (handoff.current) clearTimeout(handoff.current);
		},
		[],
	);
	if (!prize) return null;

	const item = prize.itemId ? HABITAT_CATALOG_BY_ID[prize.itemId] : undefined;
	const purse = prize.kind === "tickles";
	const name = purse ? `A purse of ${prize.amount} tickles` : (item?.name ?? prize.itemName ?? "A new design");
	const slot = item ? barnSlotWord(item.category) : "barn";
	const who = winnerName ?? "A crewmate";
	const title = mine ? (purse ? name : `You drew the ${name}`) : purse ? `${who} drew ${name.toLowerCase()}` : `${who} drew the ${name}`;

	const hang = () => {
		onClose();
		if (!prize.itemId) return;
		// The sheet rides a native Modal; let it dismiss before the route push.
		handoff.current = setTimeout(
			() => router.push({ pathname: "/barn-interior", params: { handItemId: prize.itemId } }),
			POPUP_HANDOFF_GAP_MS,
		);
	};

	return (
		<Sheet
			open={open}
			onClose={onClose}
			closeLabel="Close the draw"
			testID={testID}
			footer={
				<View style={styles.actions}>
					{mine && !purse ? (
						<>
							<Button
								variant="gold"
								size="lg"
								full
								onPress={hang}
								accessibilityLabel={`Hang the ${name} in the Barn`}
								accessibilityHint="Opens your Barn with the furnishing in hand"
								testID="draw-reveal-hang"
							>
								Hang it in the Barn
							</Button>
							<Button variant="ghost" size="lg" full onPress={onClose} testID="draw-reveal-later">
								Later
							</Button>
							<Hand tone="secondary" style={styles.centered}>
								It&apos;s in your Barn collection already — yours to keep.
							</Hand>
						</>
					) : (
						<>
							<Button variant="gold" size="lg" full onPress={onClose} testID="draw-reveal-close">
								{mine ? "Lovely" : "Good for them"}
							</Button>
							{mine && purse ? (
								<Hand tone="secondary" style={styles.centered}>
									Your Barn already holds every design, so the draw paid tickles.
								</Hand>
							) : null}
						</>
					)}
				</View>
			}
		>
			<View style={styles.body}>
				<Kicker star={false} style={styles.centered}>
					{kicker}
				</Kicker>
				<Sticker
					color="cream"
					rotate={TILT.reveal}
					radius={RADII.lg}
					shadow
					style={styles.artCard}
					accessibilityRole="image"
					accessibilityLabel={purse ? "A purse of tickles" : `${name} art`}
				>
					{purse ? (
						<TickleIcon size={ART_SIZE.portrait} />
					) : (
						<Image
							source={habitatItemAsset(item?.assetKey ?? "")}
							style={styles.art}
							resizeMode="contain"
							accessibilityIgnoresInvertColors
						/>
					)}
				</Sticker>
				<PageTitle accessibilityRole="header" style={styles.centered}>
					{title}
				</PageTitle>
				{!purse ? <Tag tone="sage" label={`barn · ${slot}`} testID="draw-reveal-slot" /> : null}
				{!purse && !!item?.description && (
					<HandLg tone="secondary" style={styles.centered}>
						{item.description}
					</HandLg>
				)}
				{seed ? (
					<Hand tone="secondary" style={styles.centered} testID="draw-reveal-seed">
						drawn from seed {seed}
					</Hand>
				) : null}
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
