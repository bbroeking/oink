// The reward return — a pig comes home with something, and it is a moment.
//
// Three beats (utils/rewardReturn.ts): the pig walks in across a paddock at
// the top of the screen, stops and celebrates; a card springs up under her
// with what she found and one gold action; on the tap the items hop to where
// they now live (the host's target — its Satchel coin, its bag) while the
// grant runs, and a last beat says where they landed. The hook
// (hooks/useRewardReturn.ts) keeps time; this file only draws.
//
// Hosts: the errand's homecoming (docs/pig-errands-spec.md §6.6) first; any
// "back with something" moment after. Nothing here knows what a Find or an
// errand is — the host names the pig, the items, the copy, the target and
// the grant. (2026-09-18)

import { useCallback, useEffect, useRef, useState } from "react";
import {
	Animated,
	Image,
	StyleSheet,
	View,
	useWindowDimensions,
	type LayoutChangeEvent,
} from "react-native";
import {
	AdaptiveModalScaffold,
	Body,
	Button,
	ConfettiBurst,
	Glyph,
	Hand,
	KickerPill,
	Numeral,
	SectionTitle,
	Sticker,
	Tape,
	type ConfettiBurstHandle,
} from "@/components/ui";
import { PigStage } from "@/components/ui/PigStage";
import { FindArt } from "@/components/satchel/FindArt";
import { habitatItemAsset } from "@/constants/habitat";
import { PIG_CANVAS, resolveAnchor } from "@/constants/hats";
import { isSatchelFindId } from "@/constants/satchel";
import {
	ART_SIZE,
	BORDER,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useRewardReturn } from "@/hooks/useRewardReturn";
import { MOTION_DURATION } from "@/hooks/useMotionPolicy";
import type { PigId } from "@/utils/pigs";
import { flyKeyframes, grantFailureLine, type GrantResult, type Point, type RewardItem } from "@/utils/rewardReturn";

// ── Drawing constants ───────────────────────────────────────────────────────
// The return is a drawn scene — a strip of paddock with a pig crossing it —
// so its geometry is art, not spacing.
/** The paddock strip's height and the pig standing in it. */
const STAGE_H = 250;
const PIG_SIZE = 176;
/** Where the walk ends: the pig stops just right of centre, facing the card. */
const PIG_REST_X_FRAC = 0.56;
/** The fence: rails and posts, as the Pen draws them. */
const FENCE_RAIL_H = 8;
const FENCE_POST = { w: 12, h: 72 };
/** The carried item on the walk, the coin on the card, and the widest a
 *  coin's name gets before it ellipsizes. */
const CARRY_SIZE = 40;
const COIN_SIZE = ART_SIZE.badge;
const COIN_NAME_W = 80;
/** How high a coin hops on its way to the bag. */
const FLY_LIFT = -56;
/** The default target when the host gives none: near the top-right corner,
 *  where the bag and the coin live on the Barn. */
const DEFAULT_TARGET_INSET = { x: 48, y: 96 };

export interface RewardReturnProps {
	open: boolean;
	pigId: PigId;
	/** What the pig carries in on the walk — usually `items[0]`. */
	carry?: RewardItem | null;
	items: readonly RewardItem[];
	/** The kicker over the title ("he found it"); `tape` is its older name and
	 *  is used when `kicker` is absent. */
	tape?: string;
	kicker?: string;
	title: string;
	body?: string;
	/** The gold action and the ghost one. `secondary` leaves without granting
	 *  unless the host gives `onSecondary`, which then owns the ghost tap (the
	 *  errand's "Keep it" beside "Give it": a different grant, not a skip —
	 *  the host performs it and closes by unmounting). */
	primaryLabel: string;
	primaryBusyLabel?: string;
	secondaryLabel?: string;
	onSecondary?: () => void;
	/** The beat after a successful grant ("in your Satchel · 4 finds"). */
	grantedLine?: string;
	/** Where the items fly, in window coordinates (measureInWindow). */
	target?: Point | null;
	onGrant: () => Promise<GrantResult>;
	onDone: (outcome: "granted" | "skipped") => void;
	testID?: string;
}

export function RewardReturn({
	open,
	pigId,
	carry,
	items,
	tape = "back",
	kicker,
	title,
	body,
	primaryLabel,
	primaryBusyLabel = "Handing it over…",
	secondaryLabel,
	onSecondary,
	grantedLine,
	target,
	onGrant,
	onDone,
	testID = "reward-return",
}: RewardReturnProps) {
	const { width: winW } = useWindowDimensions();
	const drive = useRewardReturn({ open, items, onGrant, onDone });
	const { state } = drive;

	// The celebration: one `happy` reaction when the walk ends, and confetti.
	const confetti = useRef<ConfettiBurstHandle>(null);
	const [reaction, setReaction] = useState<{ id: number; kind: "happy" } | null>(null);
	useEffect(() => {
		if (state.phase === "reveal") {
			setReaction({ id: Date.now(), kind: "happy" });
			confetti.current?.fire();
		}
	}, [state.phase]);

	// The carried item rides the walk family's snout anchor, frame by frame.
	const [frame, setFrame] = useState(0);
	const snout = resolveAnchor("walk", frame, "snout");
	const pigScale = PIG_SIZE / PIG_CANVAS;

	// Where each coin sits on screen, so its flying twin starts exactly there.
	const coinRefs = useRef<(View | null)[]>([]);
	const [origins, setOrigins] = useState<(Point | null)[]>([]);
	const measureCoins = useCallback(() => {
		coinRefs.current.forEach((ref, i) => {
			ref?.measureInWindow((x, y, w, h) => {
				setOrigins((prev) => {
					const next = [...prev];
					next[i] = { x: x + w / 2, y: y + h / 2 };
					return next;
				});
			});
		});
	}, []);
	const onCardLayout = useCallback((_e: LayoutChangeEvent) => measureCoins(), [measureCoins]);
	// The card pops in from scale 0, so a layout-time measurement lands at the
	// card's centre; measure again once the spring has settled, and once more
	// as the flight is about to start.
	useEffect(() => {
		if (state.phase !== "reveal") return;
		const t = setTimeout(measureCoins, drive.cuts ? 0 : MOTION_DURATION.celebration);
		return () => clearTimeout(t);
	}, [state.phase, drive.cuts, measureCoins]);

	const to: Point = target ?? { x: winW - DEFAULT_TARGET_INSET.x, y: DEFAULT_TARGET_INSET.y };

	const walkX = drive.walk.interpolate({
		inputRange: [0, 1],
		outputRange: [-PIG_SIZE, winW * PIG_REST_X_FRAC - PIG_SIZE / 2],
	});

	const failure = state.phase === "failed" ? state.failure : null;
	const busy = state.phase === "granting";
	const landed = state.phase === "granted";

	return (
		<AdaptiveModalScaffold
			visible={open && state.phase !== "closed" && state.phase !== "done"}
			onRequestClose={drive.dismiss}
			bare
			fullScreen
			animationType="fade"
			testID={testID}
		>
			<View style={styles.root} accessibilityLabel={`${title}: ${pigId} is back`}>
				{/* ── the paddock strip ── */}
				<View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
					<View style={styles.sky} />
					<View style={styles.grass} />
					<View style={styles.fence} pointerEvents="none">
						<View style={[styles.rail, styles.railTop]} />
						<View style={[styles.rail, styles.railBottom]} />
						{[0, 1, 2, 3].map((post) => (
							<View key={post} style={[styles.post, { left: `${12 + post * 25}%` }]} />
						))}
					</View>
					<Animated.View style={[styles.pigWrap, { transform: [{ translateX: walkX }] }]}>
						<View style={[styles.pigCanvas, { transform: [{ scale: pigScale }] }]}>
							<PigStage
								pigId={pigId}
								pigAnimation={state.phase === "arrive" && !drive.cuts ? "walk" : "idle"}
								pigReaction={reaction}
								onPigFrame={setFrame}
								hideAccessory
							/>
							{carry && state.phase === "arrive" ? (
								<View
									style={[
										styles.carry,
										{ left: snout.x - CARRY_SIZE / 2, top: snout.y - CARRY_SIZE / 2 },
									]}
								>
									<ItemArt item={carry} size={CARRY_SIZE * 0.7} />
								</View>
							) : null}
						</View>
						<ConfettiBurst ref={confetti} size={PIG_SIZE} style={styles.confetti} />
					</Animated.View>
				</View>

				{/* ── the card ── */}
				<Animated.View
					style={[
						styles.cardWrap,
						{ opacity: drive.cardOpacity, transform: [{ scale: drive.cardScale }] },
					]}
					onLayout={onCardLayout}
				>
					<Sticker color="paper" rotate={TILT.dialog} radius={RADII.lg} style={styles.card}>
						<Tape color="sun" width={72} style={styles.tape} />
						<KickerPill star={false}>{kicker ?? tape}</KickerPill>
						<SectionTitle>{title}</SectionTitle>
						{body ? (
							<Body tone="secondary" style={styles.body}>
								{body}
							</Body>
						) : null}

						<View style={styles.coins}>
							{items.map((item, i) => (
								<View
									key={`${item.id}-${i}`}
									ref={(r) => {
										coinRefs.current[i] = r;
									}}
									onLayout={measureCoins}
								>
									{/* The coin dims while its twin is in the air, and stays
									    dim once it has landed. */}
									<Animated.View
										style={{
											opacity: drive.flights[i]?.interpolate({ inputRange: [0, 0.05, 1], outputRange: [1, 0.25, 0.25] }) ?? 1,
										}}
									>
										<Coin item={item} />
									</Animated.View>
									<Hand tone="secondary" align="center" style={styles.coinName} numberOfLines={1}>
										{item.name}
									</Hand>
								</View>
							))}
						</View>

						{failure ? (
							<Body tone="secondary" align="center" style={styles.failure}>
								{grantFailureLine(failure.reason)}
							</Body>
						) : null}

						{landed ? (
							<Hand tone="secondary" align="center" style={styles.landed}>
								{grantedLine ?? "handed over"}
							</Hand>
						) : (
							<>
								<Button
									variant="gold"
									size="md"
									full
									disabled={!drive.canGrant}
									loading={busy}
									loadingLabel={primaryBusyLabel}
									onPress={drive.grant}
									accessibilityLabel={failure ? `Try again: ${primaryLabel}` : primaryLabel}
									accessibilityHint={
										failure
											? "Tries the hand-over again"
											: "Hands the reward over; the items go where they belong"
									}
									testID={`${testID}-primary`}
								>
									{failure ? (failure.retryable ? "Try again" : primaryLabel) : primaryLabel}
								</Button>
								{secondaryLabel ? (
									<Button
										variant="ghost"
										size="sm"
										full
										disabled={busy}
										onPress={onSecondary ?? drive.skip}
										accessibilityLabel={secondaryLabel}
										accessibilityHint={onSecondary ? "Keeps it instead" : "Leaves this for later; nothing is handed over"}
										testID={`${testID}-secondary`}
									>
										{secondaryLabel}
									</Button>
								) : null}
							</>
						)}
					</Sticker>
				</Animated.View>

				{/* ── the flight: a twin of each coin hops from the card to the target ── */}
				{!drive.cuts &&
					items.map((item, i) => {
						const from = origins[i];
						const flight = drive.flights[i];
						if (!from || !flight) return null;
						const kf = flyKeyframes(from, to, FLY_LIFT);
						return (
							<Animated.View
								key={`fly-${item.id}-${i}`}
								pointerEvents="none"
								style={[
									styles.flyer,
									{
										left: from.x - COIN_SIZE / 2,
										top: from.y - COIN_SIZE / 2,
										opacity: flight.interpolate({ inputRange: [0, 0.02, 0.9, 1], outputRange: [0, 1, 1, 0] }),
										transform: [
											{ translateX: flight.interpolate({ inputRange: kf.input, outputRange: kf.x }) },
											{ translateY: flight.interpolate({ inputRange: kf.input, outputRange: kf.y }) },
											{ scale: flight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 0.5] }) },
										],
									},
								]}
							>
								<Coin item={item} />
							</Animated.View>
						);
					})}
			</View>
		</AdaptiveModalScaffold>
	);
}

/** A reward drawn at coin size: the find glyph, the furnishing's art, or a gift. */
function ItemArt({ item, size }: { item: RewardItem; size: number }) {
	if (item.kind === "find" && isSatchelFindId(item.id)) return <FindArt id={item.id} size={size} />;
	if (item.kind === "furnishing")
		return <Image source={habitatItemAsset(item.id)} style={{ width: size, height: size }} resizeMode="contain" accessible={false} />;
	return <Glyph name="gift" size={size} />;
}

function Coin({ item }: { item: RewardItem }) {
	return (
		<View style={styles.coin}>
			<ItemArt item={item} size={COIN_SIZE * 0.62} />
			{item.count && item.count > 1 ? (
				<View style={styles.count}>
					<Numeral>{`×${item.count}`}</Numeral>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: WHIMSY.cream },
	stage: {
		height: STAGE_H,
		overflow: "hidden",
		borderBottomWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	sky: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: WHIMSY.sky },
	grass: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: STAGE_H * 0.36,
		backgroundColor: WHIMSY.sage,
		borderTopWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	fence: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
	rail: {
		position: "absolute",
		left: -SPACE.xs,
		right: -SPACE.xs,
		height: FENCE_RAIL_H,
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.pill,
	},
	railTop: { bottom: STAGE_H * 0.36 + 30 },
	railBottom: { bottom: STAGE_H * 0.36 },
	post: {
		position: "absolute",
		bottom: STAGE_H * 0.36 - 22,
		width: FENCE_POST.w,
		height: FENCE_POST.h,
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.sm,
	},
	pigWrap: { position: "absolute", bottom: SPACE.sm, width: PIG_SIZE, height: PIG_SIZE },
	// The 300pt stage scaled to PIG_SIZE about its top-left, so the wrapper's
	// box is the pig's box.
	pigCanvas: { position: "absolute", left: 0, top: 0, width: PIG_CANVAS, height: PIG_CANVAS, transformOrigin: "top left" },
	carry: {
		position: "absolute",
		width: CARRY_SIZE,
		height: CARRY_SIZE,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: "8deg" }],
	},
	confetti: { position: "absolute", left: 0, top: 0 },
	cardWrap: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.xl },
	card: { padding: SPACE.card, paddingTop: SPACE.lg, gap: SPACE.sm },
	tape: { position: "absolute", top: -SPACE.sm, left: "50%", marginLeft: -36 },
	body: { marginTop: -SPACE.xxs },
	coins: {
		flexDirection: "row",
		justifyContent: "center",
		gap: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	coin: {
		width: COIN_SIZE,
		height: COIN_SIZE,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
	count: {
		position: "absolute",
		right: -SPACE.xs,
		bottom: -SPACE.xs,
		paddingHorizontal: SPACE.xs,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	coinName: { maxWidth: COIN_NAME_W, marginTop: SPACE.xxs },
	failure: { marginTop: -SPACE.xxs },
	landed: { paddingVertical: SPACE.sm },
	flyer: { position: "absolute", width: COIN_SIZE, height: COIN_SIZE },
});
