// The Truffle Exchange — the war shop. Four shelf slots rotate weekly on the
// ISO week (the same "bog turns over on Monday" clock as Bog Weather): one
// Muddy, one Caked, one Prize, and a marquee alternating Champion/Heirloom.
// Priced ONLY in Golden Truffles (war items stay cost=0 — unbuyable with
// snouts, ever). Server: exchange_rotation()/redeem_war_cosmetic()
// (20260704300000, HELD) via useTruffles; until it's applied the sheet shows
// the cozy "opens with the season" state.
//
// The chrome is the `Sheet` panel — grabber, title row, close affordance,
// scrolling body and a pinned footer. It used to hand-roll all of that on a
// raw `animationType="slide"` Modal, which is exactly the grey-flash opening
// SlideUpSheet's header comment exists to prevent. [C-09] (2026-09-11)
//
// Dressing art routes through EXCHANGE_ART so Batch-7 art (banner/shelf)
// drops in with zero code changes.
import { useEffect, useState } from "react";
import {
	View,
	Image,
	StyleSheet,
	type ImageSourcePropType,
} from "react-native";
import * as Haptics from "expo-haptics";
import {
	Button,
	EmptyState,
	Hand,
	Label,
	Sheet,
	Sticker,
	T,
	Tag,
} from "@/components/ui";
import { HAT_IMAGES } from "@/constants/hats";
import {
	RARITY_TO_TIER,
	EXCHANGE_TIER_LABEL,
} from "@/constants/dig";
import { restockWhisper } from "@/utils/truffleExchange";
import {
	WHIMSY,
	RADII,
	SPACE,
	BORDER,
	RARITY_BADGE,
	RARITY_BG_SOLID,
	UI_COLORS,
} from "@/constants/theme";
import { useTruffles } from "@/hooks/useTruffles";
import { observeFieldGuide } from "@/utils/fieldGuide";

// Batch-7 dressing slots (docs/great-hunger-art-manifest.md → exchange/).
const EXCHANGE_ART: { banner: ImageSourcePropType | null; shelf: ImageSourcePropType | null } = {
	banner: null,
	shelf: null,
};

// Drawing geometry for the shelf: two cards to a row, a 4:3-ish thumbnail
// well, and the golden-truffle sprite riding a price button. Art sizes, not
// spacing steps — named so no style line carries a bare number.
const CARD_WIDTH = "48%";
const THUMB_ASPECT = 1.35;
const PRICE_MARK = 16;

interface Props {
	open: boolean;
	onClose: () => void;
	truffles: ReturnType<typeof useTruffles>;
}

export function TruffleExchangeSheet({ open, onClose, truffles }: Props) {
	const [confirming, setConfirming] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	// Field Guide: opening the Exchange meets its page (fail-soft, idempotent).
	useEffect(() => {
		if (open) observeFieldGuide("exchange");
	}, [open]);

	const onRedeem = async (hatId: string, price: number) => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await truffles.redeem(hatId);
		setBusy(false);
		setConfirming(null);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setNote("Traded. It's yours — wear it proud.");
		} else {
			setNote(
				r.reason === "insufficient"
					? `Not enough truffles — you have ${r.have ?? 0}, it wants ${r.need ?? price}.`
					: r.reason === "already_owned"
					? "Already in your trunk."
					: r.reason === "heirloom_rested"
					? "The heirloom shelf rests a while after a trade — come back in a few weeks."
					: r.reason === "not_in_stock"
					? "That one's left the shelf — the stock turned over."
					: "The trade didn't go through — try again."
			);
		}
	};

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="THE TRUFFLE EXCHANGE"
			title="Spend your golden truffles"
			closeLabel="Close the Truffle Exchange"
			footer={
				// Pinned, like the panel pinned them before: the outcome line and
				// the "never bought" promise sit with the CTA rather than scrolling
				// away under the shelf.
				<View>
					{note ? (
						<T
							role="kicker"
							tone="accent"
							align="center"
							accessibilityLiveRegion="polite"
							style={styles.note}
						>
							{note}
						</T>
					) : null}
					<Hand tone="secondary" align="center" style={styles.footnote}>
						Earned at the feedings, never bought.
					</Hand>
					<Button
						variant="gold"
						full
						onPress={onClose}
						accessibilityLabel="Done at the Truffle Exchange"
						accessibilityHint="Closes the Exchange. Your truffles stay in your pouch."
						style={styles.doneBtn}
					>
						Done
					</Button>
				</View>
			}
		>
			<View style={styles.pouchRow}>
				{/* The pouch balance. `coin` would prefix the Snout Coin, and truffles
				    are emphatically NOT snouts — `art` puts the real currency's own
				    sprite in the mark slot. */}
				<Tag
					art={HAT_IMAGES.golden_truffle}
					label={String(truffles.balance)}
					tone="sun"
					accessibilityLabel={`${truffles.balance} golden ${
						truffles.balance === 1 ? "truffle" : "truffles"
					} in your pouch`}
				/>
				{truffles.available && truffles.restockAt ? (
					<T role="kicker" tone="secondary">
						{restockWhisper(truffles.restockAt)}
					</T>
				) : null}
			</View>

			{!truffles.available ? (
				<EmptyState
					glyph="zzz"
					color="cream2"
					title="The stall is still being built."
					sub="The Exchange opens with the season — dig truffles at every feeding so your pouch is heavy on opening day."
				/>
			) : (
				<View style={styles.shelf}>
					{truffles.items.map((item) => {
						const rarityColor =
							RARITY_BADGE[item.rarity]?.ink ?? UI_COLORS.uiMuted;
						const thumbFill = RARITY_BG_SOLID[item.rarity] ?? WHIMSY.cream;
						const tier = RARITY_TO_TIER[item.rarity] ?? "muddy";
						const img = HAT_IMAGES[item.id];
						const isConfirming = confirming === item.id;
						const canAfford = truffles.balance >= item.price;
						const cost = `${item.price} golden ${
							item.price === 1 ? "truffle" : "truffles"
						}`;
						return (
							<Sticker
								key={item.id}
								// An owned card is spent, not broken: cream2 and mute ink,
								// the "trotted on" treatment — never an opacity crush. [C-07]
								color={item.owned ? "cream2" : "cream"}
								rotate={0}
								radius={RADII.lg}
								border={BORDER.ink}
								shadow="none"
								style={[styles.card, { borderColor: rarityColor }]}
							>
								<Label style={[styles.tierTag, { color: rarityColor }]}>
									{EXCHANGE_TIER_LABEL[tier]}
								</Label>
								<View style={[styles.thumbWrap, { backgroundColor: thumbFill }]}>
									{img ? <Image source={img} style={styles.thumb} resizeMode="contain" /> : null}
								</View>
								<Label
									align="center"
									numberOfLines={1}
									tone={item.owned ? "secondary" : "primary"}
									style={styles.name}
								>
									{item.name}
								</Label>
								{item.owned ? (
									<Tag
										label="yours"
										icon="check"
										tone="sage"
										style={styles.ownedBadge}
									/>
								) : isConfirming ? (
									<Button
										size="xs"
										variant="primary"
										disabled={busy}
										onPress={() => onRedeem(item.id, item.price)}
										accessibilityLabel={`Confirm trading ${cost} for ${item.name}`}
										accessibilityHint="Spends the truffles and puts the item in your trunk."
										accessibilityState={{ busy }}
										style={styles.buyBtn}
									>
										{busy ? "Trading…" : `Trade ${item.price}?`}
									</Button>
								) : (
									<Button
										size="xs"
										// Can't afford it yet? The control keeps its whole shape
										// and goes to sleep — it still answers, with the honest
										// "you have N, it wants M" line. [C-07]
										variant={canAfford ? "gold" : "locked"}
										onPress={() => {
											Haptics.selectionAsync().catch(() => {});
											setNote(null);
											setConfirming(item.id);
										}}
										icon={
											HAT_IMAGES.golden_truffle ? (
												<Image
													source={HAT_IMAGES.golden_truffle}
													style={styles.priceImg}
													resizeMode="contain"
												/>
											) : undefined
										}
										accessibilityLabel={`${item.name}, ${cost}`}
										accessibilityHint={
											canAfford
												? "Asks you to confirm the trade."
												: "You don't have enough truffles yet."
										}
										style={styles.buyBtn}
									>
										{String(item.price)}
									</Button>
								)}
							</Sticker>
						);
					})}
				</View>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	pouchRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: SPACE.md,
	},
	shelf: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md, justifyContent: "space-between" },
	card: {
		width: CARD_WIDTH,
		padding: SPACE.sm,
		alignItems: "center",
	},
	tierTag: { alignSelf: "flex-start" },
	thumbWrap: {
		width: "100%",
		aspectRatio: THUMB_ASPECT,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.sm,
		marginTop: SPACE.xs,
	},
	thumb: { width: "70%", height: "82%" },
	name: { marginTop: SPACE.sm },

	ownedBadge: { marginTop: SPACE.sm },
	buyBtn: { marginTop: SPACE.sm },
	priceImg: { width: PRICE_MARK, height: PRICE_MARK },

	note: { marginBottom: SPACE.sm },
	footnote: { marginBottom: SPACE.sm },
	doneBtn: { marginTop: SPACE.xs },
});
