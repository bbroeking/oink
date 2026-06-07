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
	Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { ReleaseNotesModal } from "./ReleaseNotesModal";
import { AlignmentExplainerModal } from "./AlignmentExplainerModal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Card, Button, SectionHeader } from "./ui";
import { Icon, type IconName } from "./ui/Icon";
import { Image } from "react-native";
import { PigAvatar } from "./ui/PigAvatar";
import { HAT_IMAGES } from "@/constants/hats";
import { Sticker, Tape } from "./ui/Sticker";
import { AlignmentBar } from "./ui/AlignmentBar";
import { alignmentEffects } from "@/utils/alignment";
import Constants from "expo-constants";
import { COLORS, FONTS, KICKER_PILL, KICKER_TEXT, TITLE_RULE, WHIMSY, STICKER_SHADOW } from "@/constants/theme";
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
import { showPurchaseToast } from "./PurchaseToast";
import {
	myReferralSummary,
	shareMessageForCode,
	type ReferralSummary,
} from "@/utils/referrals";
import { ensurePushPermission } from "@/utils/pushNotifications";

export function Account({ session }: { session: Session }) {
	const [username, setUsername] = useState<string | null>(null);
	const [discriminator, setDiscriminator] = useState<string | null>(null);
	const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
	const [alignmentExplainerOpen, setAlignmentExplainerOpen] = useState(false);
	// Account-deletion confirm — required for App Store 5.1.1(v).
	// On confirm: delete_my_account RPC cascades through every public
	// table via ON DELETE CASCADE, then we sign out so the auth
	// listener routes back to SupaAuth.
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [copied, setCopied] = useState(false);
	const [sounder, setSounder] = useState<{
		engaged_count: number;
		signup_count: number;
		rank: number | null;
		next_threshold: number | null;
		next_title: string | null;
	} | null>(null);
	// New code-based referral state (per docs/referrals.md). The
	// "Refer friends" card hydrates from my_referral_summary on focus
	// so the milestone progress bar advances live as friends cross
	// the engagement gate.
	const [referral, setReferral] = useState<ReferralSummary | null>(null);
	const [referralCodeCopied, setReferralCodeCopied] = useState(false);
	useFocusEffect(
		useCallback(() => {
			// New referral summary — drives the "Refer friends" card.
			// Cheap RPC; refetch on focus so milestone progress bumps
			// as soon as the user returns from sharing.
			myReferralSummary().then((r) => {
				if (r && "ok" in r && r.ok) setReferral(r);
			});
		}, [])
	);
	useFocusEffect(
		useCallback(() => {
			// Sounder UI is hidden behind a feature flag — skip the
			// fetch entirely while it's off; nothing renders anyway.
			if (!SOUNDER_VISIBLE) return;
			rpc<
				| { ok: false; reason?: string }
				| ({ ok: true } & NonNullable<typeof sounder>)
			>("my_sounder").then((r) => {
				// my_sounder RPC returns jsonb: { ok: false, reason } when
				// unauthenticated, otherwise { ok: true, ...sounder fields }.
				if (r?.ok) {
					const { ok: _ok, ...stats } = r;
					setSounder(stats);
				}
			});
		}, [])
	);
	const [ticklesEarned, setTicklesEarned] = useState<number>(0);
	// Snouts balance + current season tier — feed the 3-column stats
	// row inside the identity card (LIFETIME TICKLES · SNOUTS · SEASON).
	const [snouts, setSnouts] = useState<number>(0);
	const [currentTier, setCurrentTier] = useState<number | null>(null);
	const [activeHat, setActiveHat] = useState<string | null>(null);
	const [isVip, setIsVip] = useState<boolean>(false);
	const [alignmentScore, setAlignmentScore] = useState<number>(0);
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
					"username, discriminator, tickles_earned, counter, active_hat_id, is_vip, alignment_score, active_title:titles!profiles_active_title_id_fkey(name, placement)"
				)
				.eq("id", session.user.id)
				.single()
				.then(async ({ data, error }) => {
					type ProfileRow = {
						username?: string | null;
						discriminator?: string | null;
						tickles_earned?: number;
						counter?: number;
						active_hat_id?: string | null;
						is_vip?: boolean;
						alignment_score?: number;
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
							.select("username, discriminator, tickles_earned, counter, active_hat_id, is_vip, alignment_score")
							.eq("id", session.user.id)
							.single();
						row = fallback.data;
					}
					setUsername(row?.username ?? null);
					setDiscriminator(row?.discriminator ?? null);
					setTicklesEarned(row?.tickles_earned ?? 0);
					setSnouts(row?.counter ?? 0);
					setActiveHat(row?.active_hat_id ?? null);
					setIsVip(row?.is_vip ?? false);
					setAlignmentScore(row?.alignment_score ?? 0);
					const t = Array.isArray(row?.active_title)
						? row?.active_title[0]
						: row?.active_title;
					setActiveTitle(t ?? null);
				});
			// Pull current_tier alongside so the SEASON column reads
			// "T8" rather than collapsing to "—". Best-effort: a failure
			// just leaves the column blank.
			rpc<{ current_tier?: number }>("season_state").then((s) => {
				if (typeof s?.current_tier === "number") setCurrentTier(s.current_tier);
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
					await rpc("dev_set_vip", { target: true });
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
				await rpc("dev_set_vip", { target: true });
				setIsVip(true);
				showPurchaseToast({
					type: "success",
					title: "Welcome to the Slop Club!",
					text:
						slopPlan === "yearly"
							? "Auto-renews $29.99/yr"
							: "Auto-renews $3.99/mo",
				});
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
							await rpc("dev_set_vip", { target: true });
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

	// Copy the player's referral code to the clipboard. Distinct from
	// handleCopyCode (which copies their username#discriminator handle
	// for in-app friend-add) — different purpose, different target.
	const handleCopyReferralCode = async () => {
		if (!referral?.code) return;
		await Clipboard.setStringAsync(referral.code);
		setReferralCodeCopied(true);
		setTimeout(() => setReferralCodeCopied(false), 1800);
	};

	// Open the system share sheet with the pre-filled invite message
	// from utils/referrals. Errors swallowed — share sheet rejections
	// are user actions, not bugs.
	//
	// Share is the second push-permission ask site after Friends. A user
	// sharing their code is about to trigger inbound social activity
	// (friend requests, the +100 referral-completed push); permission
	// makes sense at this exact moment. Awaited so the prompt resolves
	// before the share sheet covers it. Idempotent — no-op after grant
	// or denial; the function in utils/pushNotifications coalesces.
	const handleShareReferral = async () => {
		if (!referral?.code) return;
		await ensurePushPermission();
		try {
			await Share.share({ message: shareMessageForCode(referral.code) });
		} catch {
			// User cancelled or share sheet errored — nothing to do.
		}
	};

	const handleRestore = async () => {
		const result = await restorePurchases();
		if (result.ok) {
			const pro = await isPro();
			if (pro) {
				await rpc("dev_set_vip", { target: true });
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
										{/* Scrapbook flowers overlay — small charm
										    detail from the redesign. Only shows when
										    the player isn't already wearing flowers
										    in the main slot. */}
										{activeHat !== "flowers" &&
											HAT_IMAGES["flowers"] && (
												<Image
													source={HAT_IMAGES["flowers"]}
													style={styles.avatarFlowers}
												/>
											)}
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
									</View>
								</View>

								{/* Lifetime stats — 3-col band inside the identity
								    card. Divided by 1px ink-mute verticals + a
								    dashed top border. Matches the design's StatPiece
								    cluster (LIFETIME TICKLES · SNOUTS · SEASON). */}
								<View style={styles.lifetimeStatsRow}>
									<LifetimeStat
										label="LIFETIME TICKLES"
										value={ticklesEarned.toLocaleString()}
									/>
									<View style={styles.lifetimeStatDivider} />
									<LifetimeStat label="SNOUTS" value={snouts.toLocaleString()} />
									<View style={styles.lifetimeStatDivider} />
									<LifetimeStat
										label="SEASON"
										value={currentTier == null ? "—" : `T${currentTier}`}
									/>
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

					{/* Alignment story — the audit found alignment was
					    invisible on the user's own profile. Block lives
					    between the identity card and Achievements:
					    Greedy ↔ score ↔ Generous + the bar + a hand-
					    written one-liner about what moves it. */}
					<View style={alignmentStoryStyles.wrap}>
						<Text style={alignmentStoryStyles.kicker}>★ alignment</Text>
						<View style={alignmentStoryStyles.labelRow}>
							<Text style={alignmentStoryStyles.greedy}>Greedy</Text>
							<Text style={alignmentStoryStyles.score}>
								{alignmentScore >= 0 ? "+" : ""}
								{alignmentScore}
							</Text>
							<Text style={alignmentStoryStyles.generous}>Generous</Text>
						</View>
						<AlignmentBar score={alignmentScore} />
						{(() => {
							const fx = alignmentEffects(alignmentScore);
							const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
							return (
								<View style={alignmentStoryStyles.effectsRow}>
									<Text style={alignmentStoryStyles.effect}>
										Regen {sgn(fx.regenPct)}%
									</Text>
									<Text style={alignmentStoryStyles.effect}>
										Blessings {sgn(fx.blessingPct)}%
									</Text>
									<Text style={alignmentStoryStyles.effect}>
										Curses {sgn(fx.cursePct)}%
									</Text>
								</View>
							);
						})()}
						<Text style={alignmentStoryStyles.effectHint}>
							Give freely → your blessings grow stronger. Keep to
							yourself → your curses bite harder.
						</Text>
						<Text style={alignmentStoryStyles.hint}>
							★ blessings push you up. asks for tickles pull you
							down. ★
						</Text>
						<Pressable
							testID="alignment-how-it-works"
							onPress={() => setAlignmentExplainerOpen(true)}
							hitSlop={8}
						>
							<Text style={alignmentStoryStyles.howLink}>
								how alignment works ›
							</Text>
						</Pressable>
					</View>

					{/* Achievements entry — single-line tappable row that
					    routes to the full grid. Sits above Sounder so it's
					    discoverable as the primary "see your progress" surface. */}
					<Pressable
						onPress={() => router.push("/achievements")}
						style={achievementStyles.row}
					>
						<View style={achievementStyles.iconBubble}>
							<Icon name="trophy" size={22} color={WHIMSY.ink} filled />
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

					{/* Refer friends — code-based invite card. Drops between
					    Slop Club and Settings per docs/referrals.md. Shows
					    the player's persistent code + Copy + Share + a
					    milestone progress bar toward the Messenger Hat. */}
					{referral?.code && (
						<Sticker
							color="rose"
							rotate={-0.8}
							radius={16}
							style={referralStyles.card}
						>
							<Text style={referralStyles.kicker}>★ refer friends ★</Text>
							<Text style={referralStyles.label}>Your code:</Text>
							<View style={referralStyles.codePill}>
								<Text style={referralStyles.codeValue}>{referral.code}</Text>
								<Pressable
									onPress={handleCopyReferralCode}
									style={referralStyles.copyBtn}
								>
									<Icon
										name={referralCodeCopied ? "check" : "copy"}
										size={14}
										color={WHIMSY.ink}
										strokeWidth={2.2}
									/>
									<Text style={referralStyles.copyBtnText}>
										{referralCodeCopied ? "Copied" : "Copy"}
									</Text>
								</Pressable>
							</View>
							<Pressable
								onPress={handleShareReferral}
								style={referralStyles.shareBtn}
							>
								<Text style={referralStyles.shareBtnText}>Share invite</Text>
							</Pressable>
							<ReferralMilestoneRow
								completed={referral.referrals_completed}
								goal={referral.next_milestone_at ?? 3}
								capped={referral.next_milestone_at == null}
							/>
							<Text style={referralStyles.fine}>
								Each completed referral: +100 ★
							</Text>
							<Text style={referralStyles.finePrint}>
								Your friend has to play a bit before the credit lands —
								keeps it fair.
							</Text>
						</Sticker>
					)}

					{/* Settings — paper sticker grouping the housekeeping
					    actions (release notes, restore IAP, sign out) into
					    dashed-divided rows. Replaces three scattered link
					    Pressables that broke the screen's visual rhythm.
					    From the redesign's Settings card. */}
					<View style={settingsStyles.wrap}>
						<Text style={settingsStyles.kicker}>★ settings</Text>
						<Sticker
							color="paper"
							rotate={-0.3}
							radius={14}
							style={settingsStyles.card}
						>
							<SettingRow
								icon="scroll"
								label="What's new"
								onPress={() => setReleaseNotesOpen(true)}
							/>
							{IAP_ENABLED && (
								<SettingRow
									icon="refresh"
									label="Restore purchases"
									onPress={handleRestore}
								/>
							)}
							<SettingRow
								icon="exit"
								label="Sign out"
								onPress={() => supabase.auth.signOut()}
							/>
							<SettingRow
								icon="x"
								label="Delete account"
								onPress={() => setDeleteOpen(true)}
								destructive
								last
							/>
						</Sticker>
						<Text style={settingsStyles.footer}>
							★ tickle the pig · v{Constants.expoConfig?.version ?? "1.0.0"} ★
						</Text>
					</View>
				</ScrollView>
			</SafeAreaView>

			<ReleaseNotesModal
				visible={releaseNotesOpen}
				onClose={() => setReleaseNotesOpen(false)}
			/>
			{alignmentExplainerOpen && (
				<AlignmentExplainerModal
					onDismiss={() => setAlignmentExplainerOpen(false)}
				/>
			)}
			<ConfirmDialog
				open={deleteOpen}
				title="Delete your account?"
				body="This wipes your username, friends, trades, blessings/curses, owned items, season progress, and achievements. Permanent — no undo. The account is also signed out."
				confirmLabel="Delete"
				cancelLabel="Keep account"
				destructive
				busy={deleting}
				onCancel={() => setDeleteOpen(false)}
				onConfirm={async () => {
					if (deleting) return;
					setDeleting(true);
					try {
						await rpc("delete_my_account");
					} catch {}
					await supabase.auth.signOut();
					setDeleting(false);
					setDeleteOpen(false);
				}}
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

// A single row inside the Settings card. Icon + label + optional chev,
// dashed bottom border unless it's the last row. Icon takes an Icon
// name from the shared ui/Icon set (e.g. "scroll", "refresh", "exit")
// — kept off Unicode emoji per the design-language no-emoji rule.
function SettingRow({
	icon,
	label,
	onPress,
	destructive,
	last,
}: {
	icon: IconName;
	label: string;
	onPress: () => void;
	destructive?: boolean;
	last?: boolean;
}) {
	const iconColor = destructive ? WHIMSY.accent : WHIMSY.ink;
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => [
				settingsStyles.row,
				!last && settingsStyles.rowDivider,
				pressed && { opacity: 0.65 },
			]}
		>
			<View style={settingsStyles.rowIconWrap}>
				<Icon name={icon} size={20} color={iconColor} />
			</View>
			<Text
				style={[
					settingsStyles.rowLabel,
					destructive && { color: WHIMSY.accent },
				]}
			>
				{label}
			</Text>
			<Text style={settingsStyles.rowChev}>›</Text>
		</Pressable>
	);
}

// Milestone progress row for the "Refer friends" card. Renders the
// "Friends invited: N / 3" line + a fill bar + a "Hat earned" badge
// once capped. Pure presentational — caller computes completed / goal
// from my_referral_summary.
function ReferralMilestoneRow({
	completed,
	goal,
	capped,
}: {
	completed: number;
	goal: number;
	capped: boolean;
}) {
	const ratio = Math.max(0, Math.min(1, capped ? 1 : completed / goal));
	return (
		<View style={referralStyles.milestoneWrap}>
			<View style={referralStyles.milestoneHeader}>
				<Text style={referralStyles.milestoneLabel}>
					Friends invited: {completed} / {capped ? completed : goal}
				</Text>
				{capped && (
					<Text style={referralStyles.milestoneBadge}>✓ Hat earned</Text>
				)}
			</View>
			<View style={referralStyles.barTrack}>
				<View
					style={[
						referralStyles.barFill,
						{ width: `${ratio * 100}%` },
					]}
				/>
			</View>
			{!capped && (
				<Text style={referralStyles.milestoneFoot}>
					{goal - completed} more for the Messenger Hat
				</Text>
			)}
		</View>
	);
}

// Single LifetimeStat column for the identity card's 3-col band.
function LifetimeStat({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.lifetimeStatCol}>
			<Text style={styles.lifetimeStatValue}>{value}</Text>
			<Text style={styles.lifetimeStatLabel}>{label}</Text>
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
	avatarFlowers: {
		position: "absolute",
		top: -10,
		left: 4,
		width: 52,
		height: 38,
		resizeMode: "contain",
		transform: [{ rotate: "-6deg" }],
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
	// 3-col lifetime-stats band inside the identity card. Dashed top
	// border separates it from the avatar/handle. Inner 1px ink-mute
	// verticals divide the three columns.
	lifetimeStatsRow: {
		flexDirection: "row",
		alignItems: "stretch",
		marginTop: 14,
		paddingTop: 12,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	lifetimeStatCol: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	lifetimeStatDivider: {
		width: 1,
		backgroundColor: WHIMSY.muteSoft,
		marginVertical: 4,
	},
	lifetimeStatValue: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		lineHeight: 22,
	},
	lifetimeStatLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		marginTop: 4,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		textAlign: "center",
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
	// ── Slop Club membership card ──────────────────────────────────
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
	kicker: { ...KICKER_PILL, letterSpacing: 1.4 },
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

// Alignment story block on Account — the on-your-own-profile
// surface that closes the audit's "alignment is invisible on the
// user's own screens" finding.
const alignmentStoryStyles = StyleSheet.create({
	wrap: { marginTop: 22 },
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		letterSpacing: 1.6,
		textTransform: "uppercase",
		marginBottom: 6,
	},
	labelRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		marginBottom: 6,
	},
	greedy: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.goblin,
	},
	generous: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.angel,
	},
	score: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	hint: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 8,
	},
	effectsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
		marginTop: 8,
	},
	effect: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 3,
		overflow: "hidden",
	},
	effectHint: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 7,
		lineHeight: 17,
	},
	howLink: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.accent,
		textAlign: "center",
		letterSpacing: 0.3,
		marginTop: 10,
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

// Settings card — paper sticker grouping the housekeeping actions
// into dashed-divided rows, with a hand-script footer underneath.
const settingsStyles = StyleSheet.create({
	wrap: { marginTop: 22 },
	kicker: {
		...KICKER_TEXT,
		marginBottom: 8,
	},
	card: { padding: 0 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: 14,
		gap: 12,
	},
	rowDivider: {
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	// Fixed-width well so each settings row's label baseline aligns
	// even when the icon glyph differs in optical width.
	rowIconWrap: {
		width: 26,
		alignItems: "center",
		justifyContent: "center",
	},
	rowLabel: {
		flex: 1,
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	rowChev: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.mute,
	},
	footer: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 22,
	},
});

// "Refer friends" card — code + Copy + Share + milestone progress.
// Sits between the Slop Club card and Settings on the Account screen.
const referralStyles = StyleSheet.create({
	card: { padding: 16, marginBottom: 16 },
	kicker: {
		...KICKER_TEXT,
		marginBottom: 8,
	},
	label: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginBottom: 6,
	},
	codePill: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingLeft: 12,
		paddingRight: 6,
		paddingVertical: 6,
		gap: 8,
		marginBottom: 12,
	},
	codeValue: {
		flex: 1,
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		letterSpacing: 1.2,
		color: WHIMSY.ink,
	},
	copyBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	copyBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.ink,
	},
	shareBtn: {
		paddingVertical: 12,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		backgroundColor: WHIMSY.lilac,
		marginBottom: 14,
	},
	shareBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	milestoneWrap: {
		marginBottom: 12,
	},
	milestoneHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 6,
	},
	milestoneLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	milestoneBadge: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.accent,
	},
	barTrack: {
		height: 8,
		borderRadius: 4,
		backgroundColor: WHIMSY.muteSoft,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: WHIMSY.ink,
	},
	barFill: {
		height: "100%",
		backgroundColor: WHIMSY.sun,
	},
	milestoneFoot: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.mute,
		marginTop: 4,
	},
	fine: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
		marginTop: 4,
	},
	finePrint: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 2,
	},
});
