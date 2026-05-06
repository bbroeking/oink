import { useCallback, useMemo, useState } from "react";
import {
	View,
	StyleSheet,
	ScrollView,
	Platform,
	SafeAreaView,
	Alert,
	Text,
	Image,
	Pressable,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../utils/supabase";
import {
	initIAP,
	isPro,
	presentPaywall,
} from "../../utils/iap";
import { Sticker } from "../../components/ui/Sticker";
import { Icon } from "../../components/ui/Icon";
import { TickleIcon } from "../../components/ui/SnoutCoin";
import { BattlePassSaleModal } from "../../components/BattlePassSaleModal";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, KICKER_TEXT, ROW_TILTS, TITLE_RULE, WHIMSY } from "@/constants/theme";

interface SeasonRow {
	id: string;
	name: string;
	starts_at: string;
	ends_at: string;
	total_tiers: number;
	xp_per_tier: number;
	premium_price_cents: number;
	premium_plus_price_cents: number;
}

// reward_value shape varies per reward_type (e.g. { hat_id } for "hat",
// { count } for "tickles") — Supabase jsonb. Narrow at use sites below.
type RewardValue = { hat_id?: string; count?: number } | null;

interface TierRow {
	tier: number;
	track: "free" | "premium";
	reward_type: string;
	reward_value: RewardValue;
	display_label: string;
}

interface ClaimRow {
	tier: number;
	track: "free" | "premium";
}

interface SeasonState {
	active: boolean;
	season?: SeasonRow;
	tiers?: TierRow[];
	xp?: number;
	current_tier?: number;
	premium_unlocked?: boolean;
	claims?: ClaimRow[];
}

function StoneThumb({ reward, locked }: { reward: TierRow; locked: boolean }) {
	const { reward_type: type, reward_value: val } = reward;
	let inner: React.ReactNode = (
		<Icon name="star" size={20} color={WHIMSY.muteSoft} />
	);
	if (type === "tickles") inner = <TickleIcon size={26} />;
	else if (type === "hat" && val?.hat_id && HAT_IMAGES[val.hat_id]) {
		inner = (
			<Image
				source={HAT_IMAGES[val.hat_id]}
				style={{ width: 32, height: 32 }}
				resizeMode="contain"
			/>
		);
	} else if (type === "title")
		inner = <Text style={styles.titleGlyph}>"</Text>;
	else if (type === "boost")
		inner = <Icon name="flame" size={22} filled color="#F58F4A" strokeWidth={1.5} />;
	else if (type === "background")
		inner = <Icon name="globe" size={22} color={WHIMSY.ink} strokeWidth={1.6} />;
	else if (type === "mystery_box" || type === "cap_increase" || type === "pig_skin")
		inner = <Icon name="star" size={22} filled color="#C99B23" strokeWidth={1.6} />;

	return (
		<View style={[styles.stone, locked && { opacity: 0.55 }]}>{inner}</View>
	);
}

function TierStone({
	reward,
	state,
	premium,
	isFinale,
	onClaim,
}: {
	reward: TierRow | undefined;
	state: "claim" | "claimed" | "locked";
	premium?: boolean;
	isFinale?: boolean;
	onClaim?: () => void;
}) {
	if (!reward) return <View style={{ flex: 1 }} />;
	const isLocked = state === "locked";
	const isClaim = state === "claim";
	const isClaimed = state === "claimed";

	const color = isFinale ? "sun" : premium ? "lilac" : "paper";

	return (
		<Sticker
			color={color}
			rotate={0}
			radius={14}
			border={isLocked ? 1.5 : 2}
			style={[styles.stoneCell, isLocked && { opacity: 0.85 }]}
		>
			<View style={styles.stoneTop}>
				<StoneThumb reward={reward} locked={isLocked} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.stoneLabel} numberOfLines={2}>
						{reward.display_label}
					</Text>
					{premium && !isFinale && (
						<Text style={styles.stonePrem}>
							{isLocked ? "🔒 premium" : "★ premium"}
						</Text>
					)}
					{isFinale && <Text style={styles.stoneFinale}>FINALE</Text>}
				</View>
			</View>
			{isClaim && (
				<Pressable onPress={onClaim} style={styles.claimBtn}>
					<Text style={styles.claimBtnText}>Claim</Text>
				</Pressable>
			)}
			{isClaimed && (
				<View style={styles.claimedRow}>
					<Icon name="check" size={11} color={WHIMSY.ink} strokeWidth={2.5} />
					<Text style={styles.claimedText}>claimed</Text>
				</View>
			)}
			{isLocked && !isFinale && (
				<View style={styles.lockedRow}>
					<View style={styles.lockedDashed} />
					<Text style={styles.lockedText}>locked</Text>
				</View>
			)}
		</Sticker>
	);
}

export default function SeasonScreen() {
	const [state, setState] = useState<SeasonState | null>(null);
	const [busy, setBusy] = useState(false);
	const [saleOpen, setSaleOpen] = useState(false);

	const load = useCallback(async () => {
		const { data, error } = await supabase.rpc("season_state");
		if (error) return console.error(error);
		setState(data as SeasonState);
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	const claimedSet = useMemo(() => {
		const s = new Set<string>();
		(state?.claims ?? []).forEach((c) => s.add(`${c.tier}:${c.track}`));
		return s;
	}, [state?.claims]);

	const tiersByNumber = useMemo(() => {
		const map: Record<number, { free?: TierRow; premium?: TierRow }> = {};
		(state?.tiers ?? []).forEach((t) => {
			if (!map[t.tier]) map[t.tier] = {};
			map[t.tier][t.track] = t;
		});
		return map;
	}, [state?.tiers]);

	const handleClaim = async (tier: number, track: "free" | "premium") => {
		if (busy) return;
		setBusy(true);
		const { data, error } = await supabase.rpc("claim_tier_reward", {
			target_tier: tier,
			target_track: track,
		});
		setBusy(false);
		if (error) return Alert.alert("Couldn't claim", "Try again.");
		const r = data as {
			ok: boolean;
			reason?: string;
			current_tier?: number;
		};
		if (!r.ok) {
			const map: Record<string, string> = {
				tier_locked: `Reach tier ${tier} first (you're at ${r.current_tier}).`,
				premium_locked: "Unlock the Premium pass to claim.",
				already_claimed: "Already claimed.",
				no_active_season: "No active season.",
				no_reward: "Nothing here.",
			};
			Alert.alert("Locked", map[r.reason ?? ""] ?? "Couldn't claim.");
			return;
		}
		load();
	};

	const handleUnlockPremium = async (_plus: boolean) => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;

		try {
			await initIAP(user.id);
		} catch {}

		const result = await presentPaywall();
		if (result.ok) {
			const pro = await isPro();
			if (pro) {
				await supabase.rpc("dev_unlock_premium", { plus: true });
				load();
				Alert.alert("Welcome to Pro!", "All premium pass rewards unlocked.");
			}
			return;
		}
		if (result.reason === "cancelled") return;
		if (result.reason === "no_offering") {
			Alert.alert(
				"Tickle the Pig Pro",
				"Storefront not configured yet. Unlock for free in dev?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Unlock (dev)",
						onPress: async () => {
							await supabase.rpc("dev_unlock_premium", { plus: true });
							load();
						},
					},
				]
			);
			return;
		}
		Alert.alert("Couldn't open paywall", "Please try again.");
	};

	if (!state) {
		return (
			<View style={[styles.container, styles.center]}>
				<Text style={styles.empty}>Loading...</Text>
			</View>
		);
	}
	if (!state.active) {
		return (
			<View style={[styles.container, styles.center]}>
				<Text style={styles.empty}>No active season.</Text>
			</View>
		);
	}

	const season = state.season!;
	const xp = state.xp ?? 0;
	const tier = state.current_tier ?? 1;
	const xpInTier = xp % season.xp_per_tier;
	const xpProgress = xpInTier / season.xp_per_tier;
	const premium = state.premium_unlocked ?? false;

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					<Text style={styles.kicker}>★ season pass</Text>
					<Text style={styles.title}>{season.name}</Text>
					<View style={styles.titleRule} />
				</View>

				<View style={styles.progressWrap}>
					<Sticker color="paper" rotate={-0.6} radius={16} style={styles.progressCard}>
						<View style={styles.progressTop}>
							<Text style={styles.tierLabel}>
								Tier {tier} <Text style={styles.tierLabelSub}>of {season.total_tiers}</Text>
							</Text>
							<Text style={styles.xpText}>
								{xpInTier} / {season.xp_per_tier} XP
							</Text>
						</View>
						<View style={styles.progressBar}>
							<View
								style={[
									styles.progressFill,
									{ width: `${Math.max(4, xpProgress * 100)}%` },
								]}
							/>
						</View>
						{!premium && (
							<Pressable
								onPress={() => setSaleOpen(true)}
								style={[
									styles.ctaBtn,
									{
										backgroundColor: WHIMSY.sun,
										marginTop: 12,
										flexDirection: "row",
										justifyContent: "center",
										gap: 8,
									},
								]}
							>
								<Icon name="star" size={16} filled color={WHIMSY.ink} strokeWidth={0} />
								<Text style={styles.ctaText}>Unlock Premium</Text>
							</Pressable>
						)}
					</Sticker>
				</View>

				<ScrollView contentContainerStyle={styles.tierList}>
					{Array.from({ length: season.total_tiers }, (_, i) => i + 1).map(
						(t, i) => {
							const free = tiersByNumber[t]?.free;
							const prem = tiersByNumber[t]?.premium;
							const isFinale = t === season.total_tiers;
							const reached = t <= tier;
							const isCurrent = t === tier;
							const freeState: "claim" | "claimed" | "locked" = claimedSet.has(`${t}:free`)
								? "claimed"
								: reached
									? "claim"
									: "locked";
							const premState: "claim" | "claimed" | "locked" = claimedSet.has(`${t}:premium`)
								? "claimed"
								: reached && premium
									? "claim"
									: "locked";

							return (
								<View
									key={t}
									style={[
										styles.tierRow,
										{ transform: [{ rotate: `${ROW_TILTS[i % ROW_TILTS.length]}deg` }] },
										isCurrent && styles.tierRowCurrent,
									]}
								>
									<View style={styles.tierStoneNum}>
										<View
											style={[
												styles.stoneCircle,
												isFinale
													? { backgroundColor: WHIMSY.sun }
													: reached
														? { backgroundColor: WHIMSY.rose }
														: { backgroundColor: WHIMSY.paper },
											]}
										>
											<Text style={styles.stoneCircleText}>{t}</Text>
										</View>
									</View>
									<TierStone
										reward={free}
										state={freeState}
										isFinale={isFinale}
										onClaim={() => handleClaim(t, "free")}
									/>
									<TierStone
										reward={prem}
										state={premState}
										premium
										isFinale={isFinale}
										onClaim={() => handleClaim(t, "premium")}
									/>
								</View>
							);
						}
					)}
				</ScrollView>
			</SafeAreaView>

			<BattlePassSaleModal
				visible={saleOpen}
				onClose={() => setSaleOpen(false)}
				onUnlock={async (plus) => {
					setSaleOpen(false);
					await handleUnlockPremium(plus);
				}}
				premiumPriceCents={season.premium_price_cents}
				premiumPlusPriceCents={season.premium_plus_price_cents}
				currentTier={tier}
				totalTiers={season.total_tiers}
				busy={busy}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safeArea: { flex: 1 },
	center: { alignItems: "center", justifyContent: "center" },
	empty: {
		color: WHIMSY.mute,
		padding: 24,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
	header: {
		paddingHorizontal: 18,
		paddingTop: Platform.OS === "ios" ? 8 : 20,
		paddingBottom: 8,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	title: {
		fontSize: 30,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 32,
	},
	titleRule: {
		...TITLE_RULE,
		width: 90,
		marginTop: 4,
	},
	progressWrap: { paddingHorizontal: 14, paddingVertical: 8 },
	progressCard: { padding: 14 },
	progressTop: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "baseline",
		marginBottom: 8,
	},
	tierLabel: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	tierLabelSub: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	xpText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
	progressBar: {
		height: 10,
		backgroundColor: WHIMSY.cream,
		borderRadius: 6,
		overflow: "hidden",
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	progressFill: {
		height: "100%",
		backgroundColor: WHIMSY.roseDeep,
		borderRadius: 4,
	},
	ctas: { flexDirection: "row", gap: 8, marginTop: 12 },
	ctaBtn: {
		flex: 1,
		paddingVertical: 9,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
	},
	ctaText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	tierList: {
		padding: 14,
		paddingBottom: 110,
		gap: 14,
	},
	tierRow: {
		flexDirection: "row",
		alignItems: "stretch",
		gap: 8,
	},
	tierRowCurrent: {},
	tierStoneNum: {
		width: 36,
		alignItems: "center",
		justifyContent: "flex-start",
		paddingTop: 8,
	},
	stoneCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	stoneCircleText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	stoneCell: {
		flex: 1,
		padding: 10,
		minHeight: 96,
	},
	stoneTop: {
		flexDirection: "row",
		gap: 8,
		alignItems: "flex-start",
	},
	stone: {
		width: 42,
		height: 42,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	titleGlyph: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
	},
	stoneLabel: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.ink,
		lineHeight: 16,
	},
	stonePrem: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.lilacDeep,
		marginTop: 3,
	},
	stoneFinale: {
		fontFamily: FONTS.whimsy,
		fontSize: 11,
		color: WHIMSY.accent,
		marginTop: 4,
		letterSpacing: 0.4,
	},
	claimBtn: {
		marginTop: 8,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingVertical: 6,
		alignItems: "center",
	},
	claimBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	claimedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		marginTop: 6,
	},
	claimedText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
	},
	lockedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		marginTop: 6,
	},
	lockedDashed: {
		flex: 0,
		width: 18,
		height: 0,
		borderTopWidth: 1.5,
		borderColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	lockedText: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.muteSoft,
	},
});
