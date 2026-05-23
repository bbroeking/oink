import { useCallback, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	View,
	SafeAreaView,
	Pressable,
	Text,
	Alert,
	Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";
import { ReleaseNotesModal } from "./ReleaseNotesModal";
import { Card, Button } from "./ui";
import { Icon, type IconName } from "./ui/Icon";
import { PigAvatar } from "./ui/PigAvatar";
import { Sticker, Tape } from "./ui/Sticker";
import { COLORS, FONTS, KICKER_TEXT, TITLE_RULE, WHIMSY, STICKER_SHADOW } from "@/constants/theme";
import {
	IAP_ENABLED,
	initIAP,
	isPro,
	presentPaywall,
	presentCustomerCenter,
	restorePurchases,
	onCustomerInfoUpdate,
} from "../utils/iap";
import { SOUNDER_VISIBLE } from "@/constants/featureFlags";

export function Account({ session }: { session: Session }) {
	const [username, setUsername] = useState<string | null>(null);
	const [discriminator, setDiscriminator] = useState<string | null>(null);
	const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const [sounder, setSounder] = useState<{
		engaged_count: number;
		signup_count: number;
		rank: number | null;
		next_threshold: number | null;
		next_title: string | null;
	} | null>(null);
	useFocusEffect(
		useCallback(() => {
			// Sounder UI is hidden behind a feature flag — skip the
			// fetch entirely while it's off; nothing renders anyway.
			if (!SOUNDER_VISIBLE) return;
			supabase.rpc("my_sounder").then(({ data }) => {
				// my_sounder RPC returns jsonb: { ok: false, reason } when
				// unauthenticated, otherwise { ok: true, ...sounder fields }.
				const r = data as
					| { ok: false; reason?: string }
					| ({ ok: true } & NonNullable<typeof sounder>)
					| null;
				if (r?.ok) {
					const { ok: _ok, ...stats } = r;
					setSounder(stats);
				}
			});
		}, [])
	);
	const [ticklesEarned, setTicklesEarned] = useState<number>(0);
	const [activeHat, setActiveHat] = useState<string | null>(null);
	const [isVip, setIsVip] = useState<boolean>(false);
	// Slop Club plan toggle on the membership card — yearly default
	// (matches the design's "BEST VALUE" ribbon on yearly).
	const [slopPlan, setSlopPlan] = useState<"monthly" | "yearly">("yearly");
	const [busy, setBusy] = useState<boolean>(false);
	// Show the user's currently equipped title alongside their code so
	// they can confirm at-a-glance that their title is wired up. Manage
	// (equip/unequip) lives in the Wardrobe's TitlesSection.
	const [activeTitle, setActiveTitle] = useState<{
		name: string;
		placement: "pre" | "post";
	} | null>(null);
	useFocusEffect(
		useCallback(() => {
			// active_title joins through the FK on profiles.active_title_id.
			// If the titles migration isn't deployed yet the join 400s; fall
			// back to the no-title select so Account still loads.
			supabase
				.from("profiles")
				.select(
					"username, discriminator, tickles_earned, active_hat_id, is_vip, active_title:titles!profiles_active_title_id_fkey(name, placement)"
				)
				.eq("id", session.user.id)
				.single()
				.then(async ({ data, error }) => {
					type ProfileRow = {
						username?: string | null;
						discriminator?: string | null;
						tickles_earned?: number;
						active_hat_id?: string | null;
						is_vip?: boolean;
						active_title?:
							| { name: string; placement: "pre" | "post" }
							| { name: string; placement: "pre" | "post" }[]
							| null;
					};
					// The supabase client is created without a Database
					// generic, so `data` is untyped at the source; cast it to
					// the row shape this select projects.
					let row: ProfileRow | null = data as ProfileRow | null;
					if (error) {
						const fallback = await supabase
							.from("profiles")
							.select("username, discriminator, tickles_earned, active_hat_id, is_vip")
							.eq("id", session.user.id)
							.single();
						row = fallback.data;
					}
					setUsername(row?.username ?? null);
					setDiscriminator(row?.discriminator ?? null);
					setTicklesEarned(row?.tickles_earned ?? 0);
					setActiveHat(row?.active_hat_id ?? null);
					setIsVip(row?.is_vip ?? false);
					const t = Array.isArray(row?.active_title)
						? row?.active_title[0]
						: row?.active_title;
					setActiveTitle(t ?? null);
				});
		}, [session.user.id])
	);

	const handle = username
		? discriminator
			? `${username}#${discriminator}`
			: username
		: null;

	// Copies the player's handle (username#discriminator) to the
	// clipboard. The referral-link flow was cut — a handle a friend
	// types into Friends → Add is robust where a GitHub-Pages deep
	// link was not.
	const handleCopyCode = async () => {
		if (!handle) return;
		await Clipboard.setStringAsync(handle);
		setCopied(true);
		setTimeout(() => setCopied(false), 1800);
	};

	// Listen for entitlement changes from RC (e.g., webhook flips after sandbox renewal)
	useFocusEffect(
		useCallback(() => {
			const unsub = onCustomerInfoUpdate(async (info) => {
				const pro = !!info.entitlements.active["tickle_the_pig_pro"];
				if (pro && !isVip) {
					setIsVip(true);
					await supabase.rpc("dev_set_vip", { target: true });
				}
			});
			return unsub;
		}, [isVip])
	);

	const handleUnlockPro = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await initIAP(session.user.id);
		} catch {}
		const result = await presentPaywall();
		setBusy(false);
		if (result.ok) {
			const pro = await isPro();
			if (pro) {
				await supabase.rpc("dev_set_vip", { target: true });
				setIsVip(true);
				Alert.alert(
					"Welcome to the Slop Club",
					"Your membership perks are live."
				);
			}
			return;
		}
		if (result.reason === "cancelled") return;
		if (result.reason === "no_offering") {
			Alert.alert(
				"Slop Club",
				"Storefront not configured yet (need ASC products + RC offering). Unlock for free in dev?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Unlock (dev)",
						onPress: async () => {
							await supabase.rpc("dev_set_vip", { target: true });
							setIsVip(true);
						},
					},
				]
			);
			return;
		}
		Alert.alert("Couldn't open paywall", "Please try again.");
	};

	const handleManage = async () => {
		await presentCustomerCenter();
	};

	const handleRestore = async () => {
		const result = await restorePurchases();
		if (result.ok) {
			const pro = await isPro();
			if (pro) {
				await supabase.rpc("dev_set_vip", { target: true });
				setIsVip(true);
				Alert.alert("Restored", "Your Slop Club membership is active.");
			} else {
				Alert.alert("Nothing to restore", "No active Slop Club subscription on this Apple ID.");
			}
		} else {
			Alert.alert("Restore failed", "Please try again.");
		}
	};

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safe}>
				<ScrollView contentContainerStyle={styles.content}>
					<Text style={styles.kicker}>★ your scrapbook</Text>
					<Text style={styles.title}>Account</Text>
					<View style={styles.titleRule} />

					{/* Your code card — scrapbook page */}
					{username && (
						<View style={styles.codeWrap}>
							<Tape
								color="sun"
								rotate={-10}
								width={66}
								height={18}
								style={styles.codeTape}
							/>
							<Sticker color="rose" rotate={-1} radius={18} style={styles.codeCard}>
								<View style={styles.codeRow}>
									<View style={styles.codeAvatar}>
										<PigAvatar size={56} hatId={activeHat} />
									</View>
									<View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
										<Text style={styles.codeLabel}>your code</Text>
										<Text style={styles.codeValue}>
											{activeTitle
												? activeTitle.placement === "pre"
													? `${activeTitle.name} ${username}`
													: `${username} ${activeTitle.name}`
												: username}
										</Text>
										{!!handle && discriminator && (
											<Text style={styles.codeHandle}>{handle}</Text>
										)}
										<View style={styles.codeStats}>
											<Text style={styles.codeStatsHeart}>♥</Text>
											<Text style={styles.codeStatsText}>
												{ticklesEarned.toLocaleString()} lifetime tickles
											</Text>
										</View>
									</View>
								</View>
								<Pressable onPress={handleCopyCode} style={styles.shareBtn}>
									<Icon
										name={copied ? "check" : "copy"}
										size={16}
										color={WHIMSY.ink}
										strokeWidth={2.2}
									/>
									<Text style={styles.shareBtnText}>
										{copied ? "Copied!" : "Copy my code"}
									</Text>
								</Pressable>
							</Sticker>
						</View>
					)}

					{/* Achievements entry — single-line tappable row that
					    routes to the full grid. Sits above Sounder so it's
					    discoverable as the primary "see your progress" surface. */}
					<Pressable
						onPress={() => router.push("/achievements" as any)}
						style={achievementStyles.row}
					>
						<View style={achievementStyles.iconBubble}>
							<Text style={achievementStyles.iconText}>🏆</Text>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={achievementStyles.label}>Achievements</Text>
							<Text style={achievementStyles.sub}>
								Track your generous + greedy ladders.
							</Text>
						</View>
						<Text style={achievementStyles.chev}>›</Text>
					</Pressable>

					{/* Your Sounder (referral). Hidden behind SOUNDER_VISIBLE.
				    Friends moved to the
					    dedicated Friends tab in the Season-1 social
					    redesign. */}
					{SOUNDER_VISIBLE && sounder && (
						<Sticker color="paper" rotate={-0.6} radius={14} style={sounderStyles.card}>
							<View style={sounderStyles.headerRow}>
								<Text style={sounderStyles.kicker}>★ your sounder</Text>
								<Pressable onPress={() => router.push("/sounder")}>
									<Text style={sounderStyles.link}>leaderboard →</Text>
								</Pressable>
							</View>
							<View style={sounderStyles.countRow}>
								<Text style={sounderStyles.bigCount}>
									{sounder.engaged_count}
								</Text>
								<View style={{ flex: 1, marginLeft: 12 }}>
									<Text style={sounderStyles.countLabel}>
										{sounder.engaged_count === 1 ? "pig in your sounder" : "pigs in your sounder"}
									</Text>
									{!!sounder.rank && (
										<Text style={sounderStyles.rankLine}>
											rank #{sounder.rank}
										</Text>
									)}
								</View>
							</View>
							{sounder.next_title && (
								<Text style={sounderStyles.progressLine}>
									{sounder.next_threshold! - sounder.engaged_count} more to unlock{" "}
									<Text style={sounderStyles.nextTitle}>{sounder.next_title}</Text>
								</Text>
							)}
							{!sounder.next_title && (
								<Text style={sounderStyles.progressLine}>
									You've unlocked every sounder title. Maintain the herd!
								</Text>
							)}
						</Sticker>
					)}

					{/* Slop Club membership card — gold sticker, BEST VALUE
					    ribbon on the yearly toggle, 4 perks, monthly/yearly
					    toggle, Join CTA, fine-print. From the redesign. */}
					{IAP_ENABLED && (
						<Sticker
							color={isVip ? "lilac" : "sun"}
							rotate={-1}
							radius={16}
							style={[styles.slopWrap, { overflow: "hidden" }]}
						>
							{/* Best-value ribbon — top-right corner overlay */}
							{!isVip && (
								<View style={styles.slopRibbon}>
									<Text style={styles.slopRibbonText}>BEST VALUE</Text>
								</View>
							)}

							<Text style={styles.slopKicker}>★ membership ★</Text>
							<Text style={styles.slopTitle}>Slop Club</Text>
							<Text style={styles.slopTagline}>
								{isVip
									? "You're in. Perks active."
									: "The good life for swine of standing."}
							</Text>

							{!isVip && (
								<>
									{/* Perks */}
									<View style={styles.slopPerks}>
										<SlopPerk
											icon="trending"
											label="Bigger bank"
											detail="Tickle cap to 50 (from 25)"
										/>
										<SlopPerk
											icon="clock"
											label="Faster regen"
											detail="Refills every 30m, not 60m"
										/>
										<SlopPerk
											icon="premium"
											label="Monthly stipend"
											detail="+250 snouts on the 1st"
										/>
										<SlopPerk
											icon="star"
											label="Members-only items"
											detail="Drops you won't see in the shop"
										/>
									</View>

									{/* Plan toggle */}
									<View style={styles.slopPlanRow}>
										<Pressable
											onPress={() => setSlopPlan("monthly")}
											style={[
												styles.slopPlan,
												slopPlan === "monthly" && styles.slopPlanActive,
											]}
										>
											<Text style={styles.slopPlanLabel}>Monthly</Text>
											<Text style={styles.slopPlanPrice}>
												$3.99<Text style={styles.slopPlanPeriod}>/mo</Text>
											</Text>
										</Pressable>
										<Pressable
											onPress={() => setSlopPlan("yearly")}
											style={[
												styles.slopPlan,
												slopPlan === "yearly" && styles.slopPlanActive,
											]}
										>
											<Text style={styles.slopPlanLabel}>Yearly</Text>
											<Text style={styles.slopPlanPrice}>
												$29.99<Text style={styles.slopPlanPeriod}>/yr</Text>
											</Text>
											<Text style={styles.slopPlanSave}>Save 37%</Text>
										</Pressable>
									</View>
								</>
							)}

							{isVip ? (
								<Pressable
									onPress={handleManage}
									style={[styles.slopBtn, { backgroundColor: WHIMSY.paper }]}
								>
									<Text style={styles.slopBtnText}>Manage subscription</Text>
								</Pressable>
							) : (
								<Pressable
									onPress={handleUnlockPro}
									disabled={busy}
									style={({ pressed }) => [
										styles.slopBtn,
										{ backgroundColor: WHIMSY.lilac },
										(pressed || busy) && { opacity: 0.7 },
									]}
								>
									<Text style={styles.slopBtnText}>
										{busy ? "…" : "Join the Slop Club"}
									</Text>
								</Pressable>
							)}

							{!isVip && (
								<Text style={styles.slopFinePrint}>
									Auto-renews. Cancel anytime in Settings.
								</Text>
							)}
						</Sticker>
					)}

					{IAP_ENABLED && (
						<Pressable onPress={handleRestore} style={styles.restoreLink}>
							<Text style={styles.restoreLinkText}>Restore purchases</Text>
						</Pressable>
					)}

					<Pressable
						onPress={() => setReleaseNotesOpen(true)}
						style={styles.restoreLink}
					>
						<Text style={styles.restoreLinkText}>What's new</Text>
					</Pressable>


					<Pressable
						onPress={() => supabase.auth.signOut()}
						style={({ pressed }) => [
							styles.signOut,
							{ opacity: pressed ? 0.6 : 1 },
						]}
					>
						<Text style={styles.signOutText}>Sign Out</Text>
					</Pressable>
				</ScrollView>
			</SafeAreaView>

			<ReleaseNotesModal
				visible={releaseNotesOpen}
				onClose={() => setReleaseNotesOpen(false)}
			/>
		</View>
	);
}

// One line of the Slop Club perks list — small ink icon + label + detail.
function SlopPerk({
	icon,
	label,
	detail,
}: {
	icon: IconName;
	label: string;
	detail: string;
}) {
	return (
		<View style={styles.slopPerk}>
			<View style={styles.slopPerkIcon}>
				<Icon name={icon} size={14} color={WHIMSY.ink} strokeWidth={2.2} />
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Text style={styles.slopPerkLabel}>{label}</Text>
				<Text style={styles.slopPerkDetail}>{detail}</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safe: { flex: 1 },
	content: { padding: 18, paddingBottom: 120 },
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	title: {
		fontSize: 32,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		marginBottom: 4,
	},
	titleRule: {
		...TITLE_RULE,
		width: 80,
		marginBottom: 18,
	},
	codeWrap: {
		position: "relative",
		paddingTop: 12,
		marginBottom: 18,
	},
	codeTape: {
		position: "absolute",
		top: 0,
		left: 32,
		zIndex: 2,
	},
	codeCard: {
		padding: 16,
	},
	codeRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	codeAvatar: {
		borderRadius: 32,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		padding: 2,
	},
	codeLabel: {
		fontSize: 12,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	codeValue: {
		fontSize: 24,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 26,
		marginTop: 2,
	},
	codeHandle: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		letterSpacing: 0.4,
		marginTop: 2,
	},
	codeStats: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 4,
	},
	codeStatsText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	codeStatsHeart: {
		fontSize: 14,
		color: WHIMSY.roseDeep,
	},
	shareBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		marginTop: 14,
		paddingVertical: 9,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	shareBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	vipWrap: {
		marginBottom: 16,
		padding: 16,
	},
	vipBadgeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginBottom: 4,
	},
	vipBadge: {
		fontSize: 11,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		letterSpacing: 1,
	},
	vipTitle: {
		fontSize: 22,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 24,
	},
	vipDesc: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		opacity: 0.7,
		marginTop: 2,
		lineHeight: 17,
	},
	vipCtas: {
		flexDirection: "row",
		gap: 8,
		marginTop: 12,
	},
	vipBtn: {
		paddingVertical: 9,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		marginTop: 12,
	},
	vipBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	// ── Slop Club membership card (redesign Phase 3) ────────────────
	slopWrap: { marginBottom: 16, padding: 18 },
	slopRibbon: {
		position: "absolute",
		top: 14,
		right: -32,
		paddingHorizontal: 32,
		paddingVertical: 3,
		backgroundColor: WHIMSY.accent,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		transform: [{ rotate: "35deg" }],
		zIndex: 2,
	},
	slopRibbonText: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 1,
	},
	slopKicker: {
		...KICKER_TEXT,
		fontSize: 11,
		marginBottom: 4,
	},
	slopTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		lineHeight: 26,
	},
	slopTagline: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.ink,
		opacity: 0.72,
		marginTop: 4,
		maxWidth: 260,
	},
	slopPerks: { marginTop: 14, gap: 10 },
	slopPerk: { flexDirection: "row", alignItems: "center", gap: 10 },
	slopPerkIcon: {
		width: 26,
		height: 26,
		borderRadius: 13,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	slopPerkLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	slopPerkDetail: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		opacity: 0.7,
		marginTop: 1,
	},
	slopPlanRow: { flexDirection: "row", gap: 10, marginTop: 16 },
	slopPlan: {
		flex: 1,
		paddingVertical: 10,
		paddingHorizontal: 10,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
	},
	slopPlanActive: {
		backgroundColor: WHIMSY.cream2,
		borderWidth: 2.5,
	},
	slopPlanLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	slopPlanPrice: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		marginTop: 2,
	},
	slopPlanPeriod: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
		opacity: 0.7,
	},
	slopPlanSave: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.accent,
		marginTop: 2,
	},
	slopBtn: {
		paddingVertical: 12,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		marginTop: 14,
	},
	slopBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	slopFinePrint: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.ink,
		opacity: 0.55,
		textAlign: "center",
		marginTop: 10,
	},
	restoreLink: {
		alignItems: "center",
		marginTop: 8,
		marginBottom: 8,
		paddingVertical: 8,
	},
	restoreLinkText: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	signOut: {
		alignItems: "center",
		marginTop: 22,
		paddingVertical: 12,
	},
	signOutText: {
		fontSize: 14,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
	},
	devLink: {
		alignItems: "center",
		marginTop: 18,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderStyle: "dashed",
	},
	devLinkText: {
		fontSize: 13,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		letterSpacing: 0.4,
	},
});

const sounderStyles = StyleSheet.create({
	card: {
		paddingHorizontal: 16,
		paddingVertical: 14,
		marginTop: 16,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		letterSpacing: 1.4,
		textTransform: "uppercase",
	},
	link: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	countRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	bigCount: {
		fontFamily: FONTS.whimsy,
		fontSize: 44,
		color: WHIMSY.ink,
		minWidth: 60,
		textAlign: "center",
	},
	countLabel: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	rankLine: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	progressLine: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.ink,
		marginTop: 10,
	},
	nextTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.accent,
	},
});

const achievementStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginTop: 16,
		paddingHorizontal: 14,
		paddingVertical: 14,
		backgroundColor: WHIMSY.paper,
		borderRadius: 14,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	iconBubble: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	iconText: { fontSize: 22 },
	label: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },
	sub: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	chev: {
		fontFamily: FONTS.whimsy,
		fontSize: 28,
		color: WHIMSY.mute,
	},
});
