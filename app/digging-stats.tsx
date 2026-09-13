import { useCallback, useEffect, useState } from "react";
import {
	Image,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { PageHeader } from "@/components/ui/PageHeader";
import { StackPage } from "@/components/ui/StackPage";
import { Glyph } from "@/components/ui/Glyph";
import { EmptyState, LoadingBeat } from "@/components/ui/EmptyState";
import { Sticker, Tape } from "@/components/ui/Sticker";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { T } from "@/components/ui/Text";
import { fetchPlayerDigStats, type PlayerDigStats } from "@/utils/digStats";
import { MOTE_MACHINE_VISIBLE } from "@/constants/featureFlags";
import { supabase } from "@/utils/supabase";
import {
	BORDER,
	OPACITY,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TAB_SAFE,
	WHIMSY,
	UI_COLORS,
} from "@/constants/theme";

const ART = {
	shovel: require("@/assets/images/hats/mud_shovel.png"),
	truffle: require("@/assets/images/glyphs/receipt/truffle.png"),
	mote: require("@/assets/images/tickle-particles/bubble.png"),
	stone: require("@/assets/images/patch/stone.png"),
} as const;

// The page is a pasted-up collage: cut-out art overlapping inside its cards, at
// hand-placed offsets. These are DRAWING measurements — where a cut-out sits on
// the page — not spacing decisions, so they are named here rather than bent onto
// SPACE (which would move the pieces out from under each other) or ART_SIZE
// (whose steps stop at thumb/portrait — see System asks).
const COLLAGE = {
	heroH: 150,
	shovelClipW: 108,
	shovelW: 132,
	shovelBleedX: -18,
	shovelBleedY: -22,
	findCardH: 126,
	findArtW: 118,
	findArtH: 92,
	truffle: 82,
	stone: 46,
	tapeW: 58,
	tapeH: 16,
	tapeRight: 42,
	scrapH: 184,
	mote: 68,
	sounderArtW: 72,
	sounderArtH: 68,
	ringBack: 66,
	ring: 58,
	emptyShovel: 94,
	meaningLabelW: 58,
	sparkle: 28,
	ringGlyph: 42,
} as const;

type LoadState = PlayerDigStats | null | undefined;

export default function DiggingStatsScreen() {
	const params = useLocalSearchParams<{
		userId?: string;
		name?: string;
		preview?: string;
	}>();
	const [viewerId, setViewerId] = useState<string | null>(null);
	const [stats, setStats] = useState<LoadState>(undefined);
	const [retry, setRetry] = useState(0);
	const previewStats: PlayerDigStats | null =
		__DEV__ && params.preview === "populated"
			? {
					ok: true,
					user_id: "digging-story-preview",
					digs: 42,
					finds: 107,
					motes: 11,
					echoes: 29,
				}
			: __DEV__ && params.preview === "empty"
				? {
						ok: true,
						user_id: "digging-story-preview",
						digs: 0,
						finds: 0,
						motes: 0,
						echoes: 0,
					}
					: null;
	const isPreview = previewStats !== null;
	const targetId = typeof params.userId === "string" ? params.userId : viewerId;
	const displayName =
		typeof params.name === "string" && params.name.trim()
			? params.name.trim()
			: "This pig";
	const isSelf = isPreview || (!!viewerId && (!params.userId || params.userId === viewerId));

	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => setViewerId(data.user?.id ?? null));
	}, []);

	useEffect(() => {
		if (isPreview) return;
		if (!targetId) return;
		let cancelled = false;
		fetchPlayerDigStats(targetId).then((next) => {
			if (!cancelled) setStats(next);
		});
		return () => {
			cancelled = true;
		};
	}, [targetId, retry, isPreview]);

	const tryAgain = useCallback(() => {
		setStats(undefined);
		setRetry((value) => value + 1);
	}, []);
	const visibleStats = previewStats ?? stats;
	const zero = visibleStats?.digs === 0;

	return (
		<>
			<StackPage>
				<PageHeader
					kicker={isSelf ? "your truffle patch" : `${displayName}'s truffle patch`}
					title={isSelf ? "Your digging story" : "Digging story"}
					onBack={() => router.back()}
				/>

				{visibleStats === undefined ? (
					<LoadingBeat label="counting muddy hoofprints" />
				) : visibleStats === null ? (
					// `null` from the fetch is a FAILURE, not an empty shelf — it wears
					// the error state, announces itself, and offers the retry.
					<View style={styles.messageWrap}>
						<EmptyState
							kind="error"
							glyph="zzz"
							title="The ledger stayed shut."
							sub="Couldn't open this digging story. Give the patch another try."
							action={
								<Button
									variant="gold"
									size="sm"
									onPress={tryAgain}
									accessibilityLabel="Try again"
									accessibilityHint="Asks the patch for this digging story once more."
								>
									Try again
								</Button>
							}
						/>
					</View>
				) : zero ? (
					<ZeroStory isSelf={isSelf} />
				) : (
					<ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
						<DigHero digs={visibleStats.digs} />
						<FindLedger finds={visibleStats.finds} />
						<View style={styles.scrapRow}>
							{MOTE_MACHINE_VISIBLE && (
								<MoteScrap
									motes={visibleStats.motes}
									onPress={isSelf ? () => router.push("/mote-machine" as Href) : undefined}
								/>
							)}
							<SounderBonusScrap bonuses={visibleStats.echoes} />
						</View>
						<MeaningLedger />
					</ScrollView>
				)}
			</StackPage>
		</>
	);
}

function DigHero({ digs }: { digs: number }) {
	return (
		<View style={styles.hero}>
			<View style={styles.heroCopy}>
				<T role="kickerPill" tone="onDarkAccent">
					COMPLETED PATCHES
				</T>
				<T role="displayLg" tone="onDark" style={styles.heroNumber}>
					{digs.toLocaleString()}
				</T>
				<T role="handLg" tone="onDarkMute">
					{digs === 1 ? "dig banked" : "digs banked"}
				</T>
			</View>
			<View style={styles.shovelClip}>
				<Image source={ART.shovel} style={styles.shovel} resizeMode="contain" accessible={false} />
			</View>
		</View>
	);
}

function FindLedger({ finds }: { finds: number }) {
	return (
		<View style={styles.findWrap}>
			<Tape color="sun" rotate={-8} width={COLLAGE.tapeW} height={COLLAGE.tapeH} style={styles.findTape} />
			<Sticker color="sun" rotate={0.6} radius={RADII.xl} style={styles.findCard}>
				<View style={styles.findArt}>
					<Image source={ART.truffle} style={styles.truffle} resizeMode="contain" accessible={false} />
					<Image source={ART.stone} style={styles.stone} resizeMode="contain" accessible={false} />
					<Glyph name="sparkles" size={COLLAGE.sparkle} style={styles.findSparkle} />
				</View>
				<View style={styles.findCopy}>
					<T role="kickerPill" tone="secondary">
						FINDS BROUGHT HOME
					</T>
					<T role="display" style={styles.findNumber}>
						{finds.toLocaleString()}
					</T>
					<T role="hand" tone="secondary">
						every banked thing the patch gave up
					</T>
				</View>
			</Sticker>
		</View>
	);
}

function MoteScrap({ motes, onPress }: { motes: number; onPress?: () => void }) {
	const body = (
		<>
			<Image source={ART.mote} style={styles.mote} resizeMode="contain" accessible={false} />
			<Stat value={motes.toLocaleString()} label="MOTES FOUND" size="lg" />
			{onPress ? (
				<T role="label" tone="accent" align="center" style={styles.scrapAction}>
					OPEN MACHINE ›
				</T>
			) : null}
		</>
	);
	if (!onPress) {
		return (
			<Sticker color="lilac" rotate={-1.5} radius={RADII.lg} style={styles.scrap}>
				{body}
			</Sticker>
		);
	}
	return (
		<Sticker
			color="lilac"
			rotate={-1.5}
			radius={RADII.lg}
			onPress={onPress}
			accessibilityLabel={`${motes} Motes found. Open the Mote Machine.`}
			accessibilityHint="Opens the machine where one Mote powers one reward reveal."
			style={styles.scrap}
		>
			{body}
		</Sticker>
	);
}

function SounderBonusScrap({ bonuses }: { bonuses: number }) {
	return (
		<Sticker color="sky" rotate={1.2} radius={RADII.lg} style={styles.scrap}>
			<View style={styles.sounderArt}>
				<View style={styles.sounderRingBack} />
				<View style={styles.sounderRing}>
					<Glyph name="handshake" size={COLLAGE.ringGlyph} />
				</View>
			</View>
			<Stat value={bonuses.toLocaleString()} label="SOUNDER BONUSES" size="lg" />
		</Sticker>
	);
}

function MeaningLedger() {
	return (
		<View style={styles.meaning}>
			<T role="kicker" tone="accent" style={styles.meaningKicker}>
				★ what the patch remembers
			</T>
			<MeaningRow label="Digs" text="completed Truffle Patches" />
			<MeaningRow label="Finds" text="everything uncovered and banked" />
			{MOTE_MACHINE_VISIBLE && (
				<MeaningRow label="Motes" text="shimmer pockets uncovered in the mud" />
			)}
			<MeaningRow label="Bonuses" text="extra Golden Truffles earned by digging with your Sounder" last />
		</View>
	);
}

function MeaningRow({ label, text, last }: { label: string; text: string; last?: boolean }) {
	return (
		<View style={[styles.meaningRow, last && styles.meaningRowLast]}>
			<T role="label" style={styles.meaningLabel}>
				{label}
			</T>
			<T role="bodySm" tone="secondary" style={styles.meaningText}>
				{text}
			</T>
		</View>
	);
}

function ZeroStory({ isSelf }: { isSelf: boolean }) {
	return (
		<View style={styles.messageWrap}>
			<Sticker color="paper" rotate={-0.6} radius={RADII.lg} style={styles.messageCard}>
				<Image source={ART.shovel} style={styles.emptyShovel} resizeMode="contain" accessible={false} />
				<T role="cardTitle" align="center" style={styles.messageTitle}>
					{isSelf ? "Your first mark is waiting." : "No muddy marks yet."}
				</T>
				<T role="handLg" tone="secondary" align="center" style={styles.messageSub}>
					{isSelf
						? MOTE_MACHINE_VISIBLE
							? "Complete a Truffle Patch and this page will remember every dig, find, mote, and Sounder bonus."
							: "Complete a Truffle Patch and this page will remember every dig, find, and Sounder bonus."
						: "Their digging story begins when they complete a Truffle Patch."}
				</T>
				{isSelf ? (
					<Button
						variant="gold"
						size="sm"
						onPress={() => router.push("/(tabs)/season" as Href)}
						style={styles.messageButton}
						accessibilityLabel="Find the Truffle Patch"
						accessibilityHint="Opens the Season tab, where the patch is dug."
					>
						Find the Truffle Patch
					</Button>
				) : null}
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE, gap: SPACE.lg },
	hero: {
		minHeight: COLLAGE.heroH,
		backgroundColor: WHIMSY.bark,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		padding: SPACE.lg,
		flexDirection: "row",
		alignItems: "center",
		overflow: "hidden",
		...SHADOW_SM,
	},
	heroCopy: { flex: 1, zIndex: 1 },
	heroNumber: { marginTop: SPACE.xxs },
	shovelClip: {
		width: COLLAGE.shovelClipW,
		height: COLLAGE.heroH,
		marginRight: COLLAGE.shovelBleedX,
		marginBottom: COLLAGE.shovelBleedY,
		overflow: "hidden",
	},
	shovel: {
		position: "absolute",
		right: 0,
		width: COLLAGE.shovelW,
		height: COLLAGE.heroH,
		transform: [{ rotate: "6deg" }],
	},
	findWrap: { position: "relative", paddingTop: SPACE.sm },
	findTape: { position: "absolute", top: 0, right: COLLAGE.tapeRight, zIndex: 2 },
	findCard: {
		padding: SPACE.lg,
		flexDirection: "row",
		alignItems: "center",
		minHeight: COLLAGE.findCardH,
	},
	findArt: { width: COLLAGE.findArtW, height: COLLAGE.findArtH, position: "relative" },
	truffle: {
		width: COLLAGE.truffle,
		height: COLLAGE.truffle,
		position: "absolute",
		left: 0,
		top: 2,
		transform: [{ rotate: "-5deg" }],
	},
	stone: {
		width: COLLAGE.stone,
		height: COLLAGE.stone,
		position: "absolute",
		right: 0,
		bottom: 0,
		transform: [{ rotate: "8deg" }],
	},
	findSparkle: { position: "absolute", right: 2, top: 0 },
	findCopy: { flex: 1, minWidth: 0, marginLeft: SPACE.md },
	findNumber: { marginTop: SPACE.xxs },
	scrapRow: { flexDirection: "row", gap: SPACE.md, alignItems: "stretch" },
	scrap: { flex: 1, padding: SPACE.md, alignItems: "center", minHeight: COLLAGE.scrapH },
	mote: { width: COLLAGE.mote, height: COLLAGE.mote, marginBottom: SPACE.xs },
	sounderArt: {
		width: COLLAGE.sounderArtW,
		height: COLLAGE.sounderArtH,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: SPACE.xs,
	},
	sounderRingBack: {
		position: "absolute",
		width: COLLAGE.ringBack,
		height: COLLAGE.ringBack,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		opacity: OPACITY.rule,
		transform: [{ scale: 1.12 }],
	},
	sounderRing: {
		width: COLLAGE.ring,
		height: COLLAGE.ring,
		borderRadius: RADII.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	scrapAction: { marginTop: SPACE.sm },
	meaning: {
		backgroundColor: WHIMSY.paper,
		borderRadius: RADII.lg,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		paddingHorizontal: SPACE.lg,
		paddingTop: SPACE.lg,
	},
	meaningKicker: { marginBottom: SPACE.sm },
	meaningRow: {
		flexDirection: "row",
		gap: SPACE.md,
		paddingVertical: SPACE.md,
		borderBottomWidth: BORDER.hair,
		borderBottomColor: UI_COLORS.uiMuted,
	},
	meaningRowLast: { borderBottomWidth: 0 },
	meaningLabel: { width: COLLAGE.meaningLabelW },
	meaningText: { flex: 1 },
	messageWrap: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.lg },
	messageCard: { padding: SPACE.xl, alignItems: "center" },
	emptyShovel: {
		width: COLLAGE.emptyShovel,
		height: COLLAGE.emptyShovel,
		marginBottom: SPACE.sm,
	},
	messageTitle: { marginTop: SPACE.sm },
	messageSub: { marginTop: SPACE.xs },
	messageButton: { marginTop: SPACE.lg },
});
