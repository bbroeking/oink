// The Satchel sheet — the bag hanging by the Barn button.
//
// Spec: docs/satchel-spec.md. What it holds, top to bottom:
//   1. YOUR PIG'S WISH — what Rosie is hoping for, with the owner's one free
//      "Not this one" per wish. Never a picker (a request economy takes; a
//      rolled wish is a property of the pig).
//   2. THE BAG — the finds you carry, N of cap. Toss is the ONLY thing you
//      can do to a find here; giving happens in a friend's Barn, and there is
//      no selling. The line under the bag says where to take them.
//   3. THE CATALOG — every find as a silhouette until you have carried one
//      (the Field Guide's rule), with the rarity as a kicker: rarity lives in
//      Collect, never in the payout.
//   4. THE SHELF — what friends have brought your pig, and your deliveries
//      with the keepsakes at 10 / 50 / 100 (a count, never a payout).
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { SATCHEL_FINDS, satchelFind, type SatchelFindId } from "@/constants/satchel";
import { ART_SIZE, BORDER, RADII, SPACE, TAP_MIN } from "@/constants/theme";
import { satchelTuning, wishHoursLeft, type SatchelState } from "@/utils/satchel";
import { Button, EmptyState, Glyph, SectionHeader, Sheet, Sticker, T, Tag } from "../ui";
import { FindArt } from "./FindArt";

// The catalog tile: three across a phone with the gaps.
const CATALOG_TILE_MIN_W = 96;
// A keepsake's jar — the badge size the reveal marks share.
const KEEPSAKE_ART = ART_SIZE.badge;

export function SatchelSheet({
	open,
	onClose,
	state,
	loading,
	onToss,
	onNotThisOne,
}: {
	open: boolean;
	onClose: () => void;
	state: SatchelState;
	loading: boolean;
	onToss: (itemId: number) => void;
	onNotThisOne: () => void;
}) {
	const wish = state.wish;
	const wishFind = wish ? satchelFind(wish.find_id) : null;
	const hoursLeft = wishHoursLeft(wish);
	const met = new Set(state.met);
	const thresholds = satchelTuning().keepsakeThresholds;
	const nextKeepsake = thresholds.find((t) => t > state.deliveries) ?? null;

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker="your satchel"
			title={`${state.items.length} of ${state.cap} finds`}
			testID="satchel-sheet"
		>
			{/* ── 1. the wish ── */}
			<SectionHeader kicker="your pig" title="Hoping for" />
			{wishFind ? (
				<Sticker color="paper" radius={RADII.xl} pad rotate={0} style={styles.wishCard} testID="satchel-my-wish">
					<FindArt id={wishFind.id} size={ART_SIZE.glyph} />
					<View style={styles.wishText}>
						<T role="cardTitle">{wishFind.withArticle}</T>
						<T role="hand" tone="secondary">
							{hoursLeft > 0
								? `a friend can bring it — ${hoursLeft}h before she changes her mind`
								: "a friend can bring it"}
						</T>
					</View>
					<Button
						variant="link"
						size="xs"
						disabled={!!wish?.owner_rerolled}
						onPress={onNotThisOne}
						accessibilityLabel="Not this one"
						accessibilityHint="Rolls a different wish. Once per wish."
					>
						{wish?.owner_rerolled ? "asked once" : "Not this one"}
					</Button>
				</Sticker>
			) : (
				<T role="hand" tone="secondary">
					{loading ? "asking Rosie…" : "she hasn't decided yet"}
				</T>
			)}

			{/* ── 2. the bag ── */}
			<SectionHeader kicker="carried" title="In the bag" style={styles.section} />
			{state.items.length === 0 ? (
				<EmptyState
					glyph="digBag"
					title="Empty for now"
					sub="Every Dig can turn up a find. Carry them to a friend whose pig is hoping for one."
				/>
			) : (
				<>
					<View style={styles.bagRow} accessibilityRole="list">
						{state.items.map((it) => {
							const f = satchelFind(it.find_id);
							return (
								<Sticker
									key={it.id}
									color="paper"
									radius={RADII.lg}
									border={BORDER.thin}
									shadow="none"
									rotate={0}
									onLongPress={() => {
										Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
										onToss(it.id);
									}}
									onPress={() => {}}
									accessibilityRole="button"
									accessibilityLabel={f?.name ?? "a find"}
									accessibilityHint="Hold to toss it out of the bag"
									testID="satchel-bag-item"
									style={styles.bagTile}
								>
									<FindArt id={it.find_id} size={ART_SIZE.glyphSm} />
								</Sticker>
							);
						})}
					</View>
					<T role="hand" tone="secondary">
						a friend whose pig wants one shows it on their row. hold a find to toss it.
					</T>
				</>
			)}

			{/* ── 3. the catalog ── */}
			<SectionHeader kicker="field guide" title="Every find" style={styles.section} />
			<View style={styles.catalog} accessibilityRole="list">
				{SATCHEL_FINDS.map((f) => {
					const known = met.has(f.id);
					return (
						<Sticker
							key={f.id}
							color={known ? "paper" : "cream2"}
							radius={RADII.lg}
							border={BORDER.thin}
							borderStyle={known ? "solid" : "dashed"}
							shadow="none"
							rotate={0}
							accessibilityRole="text"
							accessibilityLabel={known ? `${f.name}, ${f.rarity}` : `an unknown ${f.rarity} find`}
							style={styles.catalogTile}
						>
							<FindArt id={f.id} size={ART_SIZE.glyph} silhouette={!known} />
							<T role="kickerPill" tone="secondary" numberOfLines={1}>
								{f.rarity}
							</T>
							<T role="kicker" numberOfLines={1} align="center">
								{known ? f.name : "?"}
							</T>
						</Sticker>
					);
				})}
			</View>

			{/* ── 4. the shelf ── */}
			<SectionHeader kicker="given and received" title="The shelf" style={styles.section} />
			<View style={styles.shelfRow}>
				<Tag
					tone="sun"
					glyph="digBag"
					label={state.deliveries === 1 ? "1 delivery" : `${state.deliveries} deliveries`}
				/>
				{nextKeepsake != null ? (
					<T role="hand" tone="secondary">{`keepsake at ${nextKeepsake}`}</T>
				) : null}
			</View>
			{state.keepsakes.length > 0 && (
				<View style={styles.keepsakeRow} accessibilityRole="list">
					{state.keepsakes.map((t) => (
						<Sticker
							key={t}
							color="sun"
							radius={RADII.xl}
							pad
							rotate={0}
							accessibilityRole="text"
							accessibilityLabel={`Keepsake for ${t} deliveries`}
							style={styles.keepsake}
						>
							<KeepsakeArt threshold={t} />
							<T role="kicker" align="center">{`${t} delivered`}</T>
						</Sticker>
					))}
				</View>
			)}
			{state.shelf.length > 0 ? (
				<View style={styles.bagRow} accessibilityRole="list">
					{state.shelf.map((s) => {
						const f = satchelFind(s.find_id);
						return (
							<View
								key={s.find_id}
								style={styles.shelfItem}
								accessibilityRole="text"
								accessibilityLabel={`${s.count} ${f?.name ?? "finds"} from friends`}
							>
								<FindArt id={s.find_id} size={ART_SIZE.glyphSm} />
								{s.count > 1 ? (
									<T role="kickerPillSm" tone="secondary">{`×${s.count}`}</T>
								) : null}
							</View>
						);
					})}
				</View>
			) : (
				<T role="hand" tone="secondary">
					nothing brought yet — friends who visit can hand Rosie what she's hoping for.
				</T>
			)}
		</Sheet>
	);
}

// A keepsake is drawn from the finds themselves — a jar of what you've
// carried — so no new art is owed for it. The three thresholds stack the
// three rarities: pebbles, then a key, then the whistle.
function KeepsakeArt({ threshold }: { threshold: number }) {
	const ids: SatchelFindId[] =
		threshold >= 100
			? ["tin_whistle", "marble", "honeycomb"]
			: threshold >= 50
				? ["old_key", "blue_feather", "clover"]
				: ["river_pebble", "snail_shell", "pinecone"];
	return (
		<View style={styles.keepsakeArt}>
			{ids.map((id, i) => (
				<View key={id} style={[styles.keepsakePiece, { left: i * (KEEPSAKE_ART / 3) }]}>
					<FindArt id={id} size={KEEPSAKE_ART / 2} />
				</View>
			))}
			<Glyph name="sparkle" size={ART_SIZE.mark} style={styles.keepsakeSpark} />
		</View>
	);
}

const styles = StyleSheet.create({
	section: { marginTop: SPACE.lg },
	wishCard: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	wishText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	bagRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.sm },
	bagTile: { width: TAP_MIN, height: TAP_MIN, alignItems: "center", justifyContent: "center" },
	catalog: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	catalogTile: {
		flexGrow: 1,
		flexBasis: CATALOG_TILE_MIN_W,
		alignItems: "center",
		gap: SPACE.xxs,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
	shelfRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.sm },
	shelfItem: { alignItems: "center", gap: SPACE.xxs, width: TAP_MIN },
	keepsakeRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.sm },
	keepsake: { alignItems: "center", gap: SPACE.xs },
	keepsakeArt: { width: KEEPSAKE_ART, height: KEEPSAKE_ART, justifyContent: "flex-end" },
	keepsakePiece: { position: "absolute", bottom: 0 },
	keepsakeSpark: { position: "absolute", top: 0, right: 0 },
});
