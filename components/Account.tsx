import { useCallback, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	View,
	SafeAreaView,
	Pressable,
	Text,
	TextInput,
	Alert,
	Linking,
	Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { router, type Href } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { lifetimeTickles } from "@/utils/tickles";
import { ReleaseNotesModal } from "./ReleaseNotesModal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Card, Button, SectionHeader } from "./ui";
import { Icon, type IconName } from "./ui/Icon";
import { Image } from "react-native";
import { PigAvatar } from "./ui/PigAvatar";
import type { TitlePlacement } from "@/constants/title_types";
import { Sticker, Tape } from "./ui/Sticker";
import Constants from "expo-constants";
import { COLORS, FONTS, KICKER_TEXT, TITLE_RULE, WHIMSY, STICKER_SHADOW, SPACE, PAGE_PAD, TAB_SAFE } from "@/constants/theme";
import {
	IAP_ENABLED,
	initIAP,
	isPro,
	presentPaywall,
	OFFERING_IDS,
	presentCustomerCenter,
	restorePurchases,
	onCustomerInfoUpdate,
} from "../utils/iap";
import { PURCHASES_LIVE, SOUNDER_VISIBLE } from "@/constants/featureFlags";
import { showPurchaseToast } from "./PurchaseToast";
import { SnoutCoin } from "./ui/SnoutCoin";
import { useStipend, type StipendStatus } from "@/hooks/useStipend";
import {
	myReferralSummary,
	shareMessageForCode,
	redeemReferralCode,
	referralErrorMessage,
	rewardNameForMilestone,
	PENDING_REFERRAL_CODE_KEY,
	REFERRAL_CODE_PATTERN,
	type ReferralSummary,
	type ReferralFriend,
} from "@/utils/referrals";
import { clearPushToken, ensurePushPermission } from "@/utils/pushNotifications";

export function Account({ session }: { session: Session }) {
	const [username, setUsername] = useState<string | null>(null);
	const [discriminator, setDiscriminator] = useState<string | null>(null);
	const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
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
	// "Have a code?" entry — the Me-page home for redeeming a friend's
	// referral code (the onboarding step was bypassed in build 89, which
	// left the flow with no UI at all). Hidden once this account has
	// redeemed (referred_by set) or after an in-session success.
	const [hasRedeemed, setHasRedeemed] = useState<boolean | null>(null);
	const [codeInput, setCodeInput] = useState("");
	const [codeBusy, setCodeBusy] = useState(false);
	const [codeError, setCodeError] = useState<string | null>(null);
	const [codeInviter, setCodeInviter] = useState<string | null>(null);
	// Pending-claim count for the Achievements row badge — achievements that
	// have been earned (auto-granted) but not yet acknowledged on the screen
	// (server: claimed && viewed_at IS NULL). Refreshed on focus.
	const [unclaimedAchv, setUnclaimedAchv] = useState(0);

	// A deep-linked code stashed before sign-in (PENDING_REFERRAL_CODE_KEY)
	// pre-fills the input — finally consuming the stranded stash.
	useFocusEffect(
		useCallback(() => {
			AsyncStorage.getItem(PENDING_REFERRAL_CODE_KEY)
				.then((c) => {
					if (c) setCodeInput((cur) => cur || c);
				})
				.catch(() => {});
		}, [])
	);

	useFocusEffect(
		useCallback(() => {
			rpc<number>("my_unclaimed_achievement_count").then((n) =>
				setUnclaimedAchv(n ?? 0)
			);
		}, [])
	);

	const handleApplyCode = async () => {
		const code = codeInput.trim().toUpperCase();
		if (codeBusy || !code) return;
		if (!REFERRAL_CODE_PATTERN.test(code)) {
			setCodeError("Codes look like PIGGY-1234 — check with your friend?");
			return;
		}
		setCodeBusy(true);
		setCodeError(null);
		const r = await redeemReferralCode(code);
		setCodeBusy(false);
		if (r?.ok) {
			setCodeInviter(r.inviter_username ?? "your friend");
			setHasRedeemed(true);
			setSnouts((s) => s + 50); // server pays +50 on redeem
			AsyncStorage.removeItem(PENDING_REFERRAL_CODE_KEY).catch(() => {});
			showPurchaseToast({
				type: "success",
				title: "Code applied!",
				text: `You're in ${r.inviter_username ?? "your friend"}'s sounder — +50 snouts.`,
			});
		} else {
			setCodeError(referralErrorMessage(r && "reason" in r ? r.reason : undefined));
		}
	};
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
	// All-time tickles across archived seasons (migration 20260737). Displayed
	// lifetime = this base + the live-season tickles_earned. 0 until the column
	// lands (feature-dark), so lifetime simply shows the live count pre-push.
	const [ticklesLifetimeBase, setTicklesLifetimeBase] = useState<number>(0);
	// Snouts balance + current season tier — feed the 3-column stats
	// row inside the identity card (LIFETIME TICKLES · SNOUTS · SEASON).
	const [snouts, setSnouts] = useState<number>(0);
	const [currentTier, setCurrentTier] = useState<number | null>(null);
	const [activeHat, setActiveHat] = useState<string | null>(null);
	const [isVip, setIsVip] = useState<boolean>(false);
	const [busy, setBusy] = useState<boolean>(false);
	// Slop Club monthly snout stipend — manual claim from the membership card.
	const [stipendStatus, setStipendStatus] = useState<StipendStatus | null>(null);
	const [stipendBusy, setStipendBusy] = useState(false);
	const stipend = useStipend({
		onClaimed: (granted) => {
			setSnouts((s) => s + granted);
			showPurchaseToast({
				type: "success",
				title: "Slop Club",
				text: `+${granted} snouts — your monthly stipend`,
			});
		},
	});
	useFocusEffect(
		useCallback(() => {
			let cancelled = false;
			stipend.status().then((s) => {
				if (!cancelled) setStipendStatus(s);
			});
			return () => {
				cancelled = true;
			};
		}, [stipend])
	);
	const handleClaimStipend = async () => {
		if (stipendBusy) return;
		setStipendBusy(true);
		await stipend.claim(); // onClaimed handles the toast + snout bump
		setStipendBusy(false);
		stipend.status().then(setStipendStatus);
	};
	// Show the user's currently equipped title alongside their code so
	// they can confirm at-a-glance that their title is wired up. Manage
	// (equip/unequip) lives in the Closet (Shop → Wardrobe view), which
	// renders TitlesSection inline; buying stays in the Titles tab.
	const [activeTitle, setActiveTitle] = useState<{
		name: string;
		placement: TitlePlacement;
	} | null>(null);
	useFocusEffect(
		useCallback(() => {
			// active_title joins through the FK on profiles.active_title_id.
			// If the titles migration isn't deployed yet the join 400s; fall
			// back to the no-title select so Account still loads.
			supabase
				.from("profiles")
				.select(
					"username, discriminator, tickles_earned, tickles_lifetime_base, counter, active_hat_id, is_vip, referred_by, active_title:titles!profiles_active_title_id_fkey(name, placement)"
				)
				.eq("id", session.user.id)
				.single()
				.then(async ({ data, error }) => {
					type ProfileRow = {
						username?: string | null;
						discriminator?: string | null;
						tickles_earned?: number;
						tickles_lifetime_base?: number;
						counter?: number;
						active_hat_id?: string | null;
						is_vip?: boolean;
						referred_by?: string | null;
						active_title?:
							| { name: string; placement: TitlePlacement }
							| { name: string; placement: TitlePlacement }[]
							| null;
					};
					// The supabase client is created without a Database
					// generic, so `data` is untyped at the source; cast it to
					// the row shape this select projects.
					let row: ProfileRow | null = data as ProfileRow | null;
					if (error) {
						const fallback = await supabase
							.from("profiles")
							.select("username, discriminator, tickles_earned, tickles_lifetime_base, counter, active_hat_id, is_vip, referred_by")
							.eq("id", session.user.id)
							.single();
						row = fallback.data;
					}
					setUsername(row?.username ?? null);
					setDiscriminator(row?.discriminator ?? null);
					setTicklesEarned(row?.tickles_earned ?? 0);
					setTicklesLifetimeBase(row?.tickles_lifetime_base ?? 0);
					setSnouts(row?.counter ?? 0);
					setActiveHat(row?.active_hat_id ?? null);
					setIsVip(row?.is_vip ?? false);
					setHasRedeemed(!!row?.referred_by);
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

	// Whether to show the "Got a code from a friend?" apply box. Mirrors the
	// FULL server eligibility gate in redeem_referral_code, not just the
	// already-redeemed check — otherwise an old/active account (e.g. the
	// founder) whose referred_by is null still sees a box that can only ever
	// fail with too_old / too_active. Server rules:
	//   • referred_by IS NULL            → hasRedeemed === false
	//   • account < 24h old              → too_old otherwise
	//   • tickles_earned < 5             → too_active otherwise
	// hasRedeemed === null means the profile fetch hasn't resolved yet — hide
	// (no flash for redeemed/ineligible users); the in-session redeem success
	// flips hasRedeemed → true, which also hides it.
	const accountCreatedMs = Date.parse(session.user.created_at ?? "");
	const accountUnder24h =
		Number.isFinite(accountCreatedMs) &&
		Date.now() - accountCreatedMs < 24 * 60 * 60 * 1000;
	const canRedeemCode =
		hasRedeemed === false && accountUnder24h && ticklesEarned < 5;

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
		// Plan selection (monthly/yearly) + purchase live entirely in
		// RevenueCat's hosted paywall. is_vip is flipped server-side by the
		// webhook on the purchase; we set it optimistically for instant UI.
		const result = await presentPaywall(OFFERING_IDS.slopClub);
		setBusy(false);
		if (result.ok) {
			setIsVip(true);
			showPurchaseToast({
				type: "success",
				title: "Welcome to the Slop Club!",
				text: "You're in — manage anytime in Settings.",
			});
			return;
		}
		if (result.reason === "cancelled") return;
		if (result.reason === "no_offering") {
			// Dev-only: the "unlock for free" shortcut must never reach a real
			// user or an App Review pass (it reads as a broken/incomplete store).
			// In production, no_offering degrades to a plain "not available" note.
			if (__DEV__) {
				Alert.alert(
					"Slop Club",
					"Storefront not configured yet (need ASC products + RC offering/paywall). Unlock for free in dev?",
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
			} else {
				Alert.alert(
					"Slop Club",
					"The Slop Club isn't available right now — please try again soon."
				);
			}
			return;
		}
		Alert.alert("Couldn't join the Slop Club", "Please try again.");
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
					<View style={styles.header}>
						<Text style={styles.kicker}>★ your scrapbook</Text>
						<Text style={styles.title}>Account</Text>
						<View style={styles.titleRule} />
					</View>

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
										{/* Me rows render bare pigs by founder call
										    2026-07-11 — the scrapbook flowers charm was
										    removed; the avatar shows only the pig's own
										    equipped cosmetic (activeHat) if any. */}
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
									</View>
								</View>

								{/* Lifetime stats — 3-col band inside the identity
								    card. Divided by 1px ink-mute verticals + a
								    dashed top border. Matches the design's StatPiece
								    cluster (LIFETIME TICKLES · SNOUTS · SEASON). */}
								<View style={styles.lifetimeStatsRow}>
									<LifetimeStat
										label="LIFETIME TICKLES"
										value={lifetimeTickles(
											ticklesLifetimeBase,
											ticklesEarned
										).toLocaleString()}
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
								Track your devotion, generous + greedy ladders.
							</Text>
						</View>
						{unclaimedAchv > 0 && (
							<View style={achievementStyles.badge}>
								<Text style={achievementStyles.badgeText}>
									{unclaimedAchv > 99 ? "99+" : unclaimedAchv}
								</Text>
							</View>
						)}
						<Text style={achievementStyles.chev}>›</Text>
					</Pressable>

					{/* Slop Club membership card — perks, Join CTA (→ RevenueCat
					    hosted paywall for plan/price), fine-print. */}
					{IAP_ENABLED && (
						<Sticker
							color={isVip ? "lilac" : "sun"}
							rotate={-1}
							radius={16}
							style={[styles.slopWrap, { overflow: "hidden" }]}
						>
							{/* Member badge — shown once joined */}
							{isVip && (
								<View style={styles.slopMemberBadge}>
									<Text style={styles.slopMemberBadgeText}>★ MEMBER</Text>
								</View>
							)}

							<Text style={styles.slopKicker}>★ membership ★</Text>
							<Text style={styles.slopTitle}>Slop Club</Text>
							<Text style={styles.slopTagline}>
								{isVip
									? "You're in — these perks are active:"
									: "The good life for swine of standing."}
							</Text>

							{/* Monthly stipend claim — members claim 250 snouts once a
							    month (resets on the 1st). */}
							{isVip && stipendStatus?.isMember && (
								stipendStatus.claimedThisMonth ? (
									<View style={styles.stipendDone}>
										<Icon name="check" size={13} color={WHIMSY.ink} strokeWidth={2.4} />
										<Text style={styles.stipendDoneText}>
											Stipend claimed —{" "}
											{stipendStatus.nextAt
												? `next on ${new Date(
														stipendStatus.nextAt
													).toLocaleDateString(undefined, {
														month: "short",
														day: "numeric",
													})}`
												: "next on the 1st"}
										</Text>
									</View>
								) : (
									<Pressable
										onPress={handleClaimStipend}
										disabled={stipendBusy}
										style={({ pressed }) => [
											styles.stipendBtn,
											(pressed || stipendBusy) && { opacity: 0.7 },
										]}
									>
										<SnoutCoin size={16} />
										<Text style={styles.stipendBtnText}>
											{stipendBusy
												? "Claiming…"
												: `Claim ${stipendStatus.amount} snouts`}
										</Text>
									</Pressable>
								)
							)}

							{/* Perks — shown in BOTH states. For members the icon
							    wells light up gold (active) so the card celebrates
							    membership instead of sitting empty; for prospects
							    they're the pitch above the plan toggle. */}
							<View style={styles.slopPerks}>
								<SlopPerk
									node={
										<Image
											source={require("@/assets/images/perks/bigger_bank.png")}
											style={styles.perkArtImg}
											resizeMode="contain"
										/>
									}
									label="Bigger tickle bank"
									detail="Hold 50 tickles, up from 25"
								/>
								<SlopPerk
									node={
										<Image
											source={require("@/assets/images/perks/stipend.png")}
											style={styles.perkArtImg}
											resizeMode="contain"
										/>
									}
									label="Monthly snout stipend"
									detail="250 snouts on the 1st, every month"
								/>
								<SlopPerk
									node={
										<Image
											source={require("@/assets/images/perks/members_drops.png")}
											style={styles.perkArtImg}
											resizeMode="contain"
										/>
									}
									label="Members-only drops"
									detail="Cosmetics you can't get in the shop"
								/>
							</View>

							{isVip ? (
								<Pressable
									onPress={handleManage}
									style={[styles.slopBtn, { backgroundColor: WHIMSY.paper }]}
								>
									<Text style={styles.slopBtnText}>Manage subscription</Text>
								</Pressable>
							) : (
								<Pressable
									onPress={PURCHASES_LIVE ? handleUnlockPro : undefined}
									disabled={busy || !PURCHASES_LIVE}
									style={({ pressed }) => [
										styles.slopBtn,
										{ backgroundColor: WHIMSY.lilac },
										(pressed || busy) && { opacity: 0.7 },
										!PURCHASES_LIVE && { opacity: 0.75 },
									]}
								>
									<Text style={styles.slopBtnText}>
										{!PURCHASES_LIVE
											? "Coming soon…"
											: busy
											? "…"
											: "Join the Slop Club"}
									</Text>
								</Pressable>
							)}

							{!isVip && PURCHASES_LIVE && (
								<Text style={styles.slopFinePrint}>
									Auto-renews. Cancel anytime in Settings.
								</Text>
							)}
							{/* Terms + Privacy on the purchase surface — Apple review
							    expects both linked where a subscription is sold. */}
							<View style={styles.slopLegal}>
								<Pressable
									onPress={() =>
										Linking.openURL("https://ticklethepig.com/terms")
									}
								>
									<Text style={styles.slopLegalLink}>Terms</Text>
								</Pressable>
								<Text style={styles.slopLegalDot}>·</Text>
								<Pressable
									onPress={() =>
										Linking.openURL("https://ticklethepig.com/privacy")
									}
								>
									<Text style={styles.slopLegalLink}>Privacy</Text>
								</Pressable>
							</View>
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

							{/* Recruiter downline strip — folds in the former
							    standalone "Your Sounder" card. One quiet strip
							    (not a nested card, banned by the taste lens):
							    the downline count recopied WITHOUT the "sounder"
							    word (that word is now the war crew), the next
							    earned-title line (title NAMES stay as-is), and
							    the leaderboard link (→ /sounder, same
							    destination as before). Kept behind SOUNDER_VISIBLE
							    via the my_sounder fetch so it can be dark-toggled;
							    only renders once that fetch lands. */}
							{SOUNDER_VISIBLE && sounder && (
								<View style={referralStyles.downlineStrip}>
									<View style={referralStyles.downlineTextCol}>
										<Text style={referralStyles.downlineCount}>
											{sounder.engaged_count}{" "}
											{sounder.engaged_count === 1
												? "friend brought to the bog"
												: "friends brought to the bog"}
										</Text>
										{sounder.next_title && (
											<Text style={referralStyles.downlineNext}>
												{sounder.next_threshold! - sounder.engaged_count} more to
												unlock{" "}
												<Text style={referralStyles.downlineNextTitle}>
													{sounder.next_title}
												</Text>
											</Text>
										)}
									</View>
									<Pressable
										onPress={() => router.push("/sounder")}
										hitSlop={6}
									>
										<Text style={referralStyles.downlineLink}>leaderboard →</Text>
									</Pressable>
								</View>
							)}
							{/* Slop Club granted at a referral milestone — show its
							    live window while it's active. */}
							{referral.slop_club_grant_until &&
								new Date(referral.slop_club_grant_until).getTime() >
									Date.now() && (
									<Text style={referralStyles.grantNote}>
										★ Slop Club active — until{" "}
										{new Date(
											referral.slop_club_grant_until
										).toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
										})}
									</Text>
								)}

							{/* Recent referred friends + how close each is to counting
							    (100 tickles · 3 active days). Replaces the bare
							    "{N} on the way" aggregate. */}
							{(referral.recent_friends ?? []).length > 0 && (
								<View style={referralStyles.friendList}>
									{(referral.recent_friends ?? []).slice(0, 3).map((f, i) => (
										<ReferralFriendRow key={(f.username ?? "pig") + i} friend={f} />
									))}
								</View>
							)}

							{/* Into the full sounder + the reward ladder. */}
							{(referral.referrals_completed > 0 ||
								referral.referrals_pending > 0) && (
								<Pressable
									onPress={() => router.push("/sounder-progress" as Href)}
									style={referralStyles.seeMore}
									hitSlop={6}
								>
									<Text style={referralStyles.seeMoreText}>
										Your sounder + rewards ›
									</Text>
								</Pressable>
							)}

							<Text style={referralStyles.fine}>
								Each completed referral: +100 ★
							</Text>
							<Text style={referralStyles.finePrint}>
								Your friend has to play a bit before the credit lands —
								keeps it fair.
							</Text>

							{/* Have a code? — redeem a friend's code right here.
							    Shown only to accounts the server would actually
							    let redeem: never-redeemed AND < 24h old AND
							    < 5 tickles (canRedeemCode mirrors the server
							    gate). An old/active account never sees a box it
							    can't use; a genuinely-eligible new player still
							    gets specific refusal copy on any edge case. */}
							{canRedeemCode && (
								<View style={referralStyles.haveWrap}>
									<View style={referralStyles.divider} />
									<Text style={referralStyles.haveLabel}>
										Got a code from a friend?
									</Text>
									<View style={referralStyles.entryRow}>
										<TextInput
											style={referralStyles.entryInput}
											value={codeInput}
											onChangeText={(t) => {
												setCodeInput(t.toUpperCase());
												if (codeError) setCodeError(null);
											}}
											placeholder="PIGGY-1234"
											placeholderTextColor={WHIMSY.muteSoft}
											autoCapitalize="characters"
											autoCorrect={false}
											maxLength={10}
											editable={!codeBusy}
										/>
										<Pressable
											onPress={handleApplyCode}
											disabled={codeBusy || !codeInput.trim()}
											style={[
												referralStyles.applyBtn,
												(codeBusy || !codeInput.trim()) &&
													referralStyles.applyBtnDisabled,
											]}
										>
											<Text style={referralStyles.applyBtnText}>
												{codeBusy ? "…" : "Apply"}
											</Text>
										</Pressable>
									</View>
									{codeError && (
										<Text style={referralStyles.entryError}>{codeError}</Text>
									)}
								</View>
							)}
							{codeInviter && (
								<View style={referralStyles.successRow}>
									<Text style={referralStyles.entrySuccess}>
										You're in {codeInviter}'s sounder! +50
									</Text>
									<Image
										source={require("@/assets/images/emoji/pig.png")}
										style={referralStyles.successPig}
										resizeMode="contain"
									/>
								</View>
							)}
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
								onPress={async () => {
									// Drop the push token while still authenticated so this
									// device stops receiving pushes for the signed-out account.
									await clearPushToken();
									await supabase.auth.signOut();
								}}
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
					await clearPushToken();
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
	node,
	label,
	detail,
	active,
}: {
	icon?: IconName;
	// Custom art (e.g. the snout/tickle coin) rendered in the well instead of
	// a vector Icon.
	node?: React.ReactNode;
	label: string;
	detail: string;
	// Members see their perks "lit up" (gold well); prospects see the plain pitch.
	active?: boolean;
}) {
	return (
		<View style={styles.slopPerk}>
			{node ? (
				// Custom sticker art stands on its own (no bordered well).
				<View style={styles.slopPerkArt}>{node}</View>
			) : (
				<View style={[styles.slopPerkIcon, active && styles.slopPerkIconActive]}>
					{icon ? (
						<Icon name={icon} size={14} color={WHIMSY.ink} strokeWidth={2.2} />
					) : null}
				</View>
			)}
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
// One recent referred friend on the Account card: name + progress toward
// counting (tickles/100, active-days/3), or a "counted" tick once complete.
function ReferralFriendRow({ friend }: { friend: ReferralFriend }) {
	const done = !!friend.completed;
	const tRatio = Math.max(0, Math.min(1, friend.tickles / 100));
	const dRatio = Math.max(0, Math.min(1, friend.active_days / 3));
	return (
		<View style={referralStyles.friendRow}>
			<View style={referralStyles.friendTop}>
				<Text style={referralStyles.friendName} numberOfLines={1}>
					{friend.username ?? "a new pig"}
				</Text>
				{done ? (
					<View style={referralStyles.friendDone}>
						<Icon name="check" size={11} color={WHIMSY.ink} strokeWidth={2.4} />
						<Text style={referralStyles.friendDoneText}>counted</Text>
					</View>
				) : (
					<Text style={referralStyles.friendProg}>
						{friend.tickles}/100 · {friend.active_days}/3
					</Text>
				)}
			</View>
			{!done && (
				<View style={referralStyles.friendBars}>
					<View style={referralStyles.friendBarTrack}>
						<View
							style={[referralStyles.friendBarFill, { width: `${tRatio * 100}%` }]}
						/>
					</View>
					<View style={referralStyles.friendBarTrack}>
						<View
							style={[referralStyles.friendBarFill, { width: `${dRatio * 100}%` }]}
						/>
					</View>
				</View>
			)}
		</View>
	);
}

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
	// The bar tracks whichever ladder rung is next (3/5/10/25/100/500/1000).
	const reward = rewardNameForMilestone(goal);
	return (
		<View style={referralStyles.milestoneWrap}>
			<View style={referralStyles.milestoneHeader}>
				<Text style={referralStyles.milestoneLabel}>
					Friends invited: {completed} / {capped ? completed : goal}
				</Text>
				{capped && (
					<Text style={referralStyles.milestoneBadge}>✓ Rewards earned</Text>
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
					{goal - completed} more for {reward}
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
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: PAGE_PAD,
		paddingBottom: TAB_SAFE,
		gap: SPACE.lg,
	},
	header: {},
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
		width: 64,
	},
	codeWrap: {
		position: "relative",
		paddingTop: 12,
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
	slopWrap: { padding: 18 },
	stipendBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 7,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingVertical: 9,
		marginTop: 12,
		marginBottom: 4,
	},
	stipendBtnText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	stipendDone: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		marginTop: 12,
		marginBottom: 4,
		paddingVertical: 6,
	},
	stipendDoneText: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute },
	slopMemberBadge: {
		position: "absolute",
		top: 12,
		right: 12,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 3,
		zIndex: 2,
	},
	slopMemberBadgeText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 1,
		color: WHIMSY.ink,
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
	// Member state: the perk well lights up gold to read as "active".
	slopPerkIconActive: { backgroundColor: WHIMSY.sun },
	// Sticker-art perk icon — slightly larger than the vector well, no chrome.
	slopPerkArt: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
	perkArtImg: { width: 44, height: 44 },
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
	slopLegal: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 8,
		marginTop: 10,
	},
	slopLegalLink: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.ink,
		opacity: 0.6,
		textDecorationLine: "underline",
	},
	slopLegalDot: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.ink,
		opacity: 0.4,
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

const achievementStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 14,
		paddingVertical: 14,
		backgroundColor: WHIMSY.paper,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...STICKER_SHADOW,
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
	// "N ready to claim" badge — gold pill matching the icon bubble. Caps at
	// "99+" so the pill never widens past a couple of glyphs.
	badge: {
		minWidth: 22,
		height: 22,
		borderRadius: 11,
		paddingHorizontal: 6,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	badgeText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.ink,
	},
});

// Settings card — paper sticker grouping the housekeeping actions
// into dashed-divided rows, with a hand-script footer underneath.
const settingsStyles = StyleSheet.create({
	wrap: {},
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
	card: { padding: 16 },
	haveWrap: { marginTop: 10 },
	divider: {
		borderBottomWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderStyle: "dashed",
		opacity: 0.25,
		marginBottom: 10,
	},
	entryRow: { flexDirection: "row", gap: 8, alignItems: "center" },
	entryInput: {
		flex: 1,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		letterSpacing: 1.2,
		color: WHIMSY.ink,
	},
	applyBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 9,
	},
	applyBtnDisabled: { opacity: 0.45 },
	applyBtnText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	entryError: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: "#c0504d",
		marginTop: 6,
	},
	pendingRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 6,
		marginTop: 6,
	},
	pendingPig: {
		width: 16,
		height: 16,
		marginTop: 1,
	},
	pendingNote: {
		flex: 1,
		fontFamily: FONTS.hand,
		fontSize: 12.5,
		color: WHIMSY.ink,
	},
	successRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 10,
	},
	successPig: {
		width: 16,
		height: 16,
	},
	entrySuccess: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: COLORS.successText,
	},
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
	// "Got a code from a friend?" — raised from hand 12 mute to
	// bodyExtra 13 ink so the redeem entry reads as a real prompt,
	// not fine print (June 2026 UI audit).
	haveLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
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
	// Live banner for an active referral-granted free month of Slop Club.
	grantNote: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
		marginTop: 10,
		alignSelf: "flex-start",
		overflow: "hidden",
	},
	finePrint: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// Recent referred-friends list (per-friend progress).
	friendList: { marginTop: 12, gap: 9 },
	friendRow: { gap: 5 },
	friendTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	friendName: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
		flex: 1,
		minWidth: 0,
	},
	friendProg: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginLeft: 8,
	},
	friendDone: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8 },
	friendDoneText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.ink,
		letterSpacing: 0.3,
	},
	friendBars: { flexDirection: "row", gap: 6 },
	friendBarTrack: {
		flex: 1,
		height: 6,
		borderRadius: 3,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
	},
	friendBarFill: { height: "100%", backgroundColor: WHIMSY.angel },
	seeMore: { marginTop: 12, paddingVertical: 4 },
	seeMoreText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
		letterSpacing: 0.3,
	},
	// Recruiter downline strip (folded-in "Your Sounder" content). A quiet
	// dashed-top-divided row — count + next-title on the left, leaderboard
	// link on the right. Reuses the card's own type tokens (bodyExtra count,
	// hand next-line, accent link) so it reads as part of the card, not a
	// card-in-card.
	downlineStrip: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		marginBottom: 12,
		paddingTop: 10,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	downlineTextCol: { flex: 1, minWidth: 0 },
	downlineCount: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	downlineNext: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 3,
	},
	downlineNextTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 12,
		color: WHIMSY.accent,
	},
	downlineLink: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
});
