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
	Modal,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { lifetimeTickles } from "@/utils/tickles";
import { submitFeedback, type FeedbackKind } from "@/utils/feedback";
import { stampFeedbackEverSent } from "@/utils/feedbackNudge";
import { ReleaseNotesModal } from "./ReleaseNotesModal";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Button, SectionHeader } from "./ui";
import { LoadingBeat } from "./ui/EmptyState";
import { Glyph } from "./ui/Glyph";
import { Icon, type IconName } from "./ui/Icon";
import { Image } from "react-native";
import { PigAvatar } from "./ui/PigAvatar";
import type { TitlePlacement } from "@/constants/title_types";
import { Sticker, Tape } from "./ui/Sticker";
import Constants from "expo-constants";
import { COLORS, FONTS, KICKER_TEXT, TITLE_RULE, WHIMSY, STICKER_SHADOW, SPACE, RADII, PAGE_PAD, TAB_SAFE, MODAL_BACKDROP_BG } from "@/constants/theme";
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
import { isUsernameAllowed } from "@/constants/bannedWords";

// Aggregate counts from me_lifetime_stats() — the social tallies the "long
// story" sheet lists beneath the scalar lifetime figures.
type LifetimeAgg = {
	barn_visits_made: number;
	barn_visits_hosted: number;
	truffles_buried: number;
	friend_mound_digs: number;
	blessings_sent: number;
	curses_sent: number;
	trades_fulfilled: number;
};

export function Account({ session }: { session: Session }) {
	const [username, setUsername] = useState<string | null>(null);
	const [discriminator, setDiscriminator] = useState<string | null>(null);
	const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
	// Paid username rename — the "Change your name" settings row opens this dialog.
	// First rename is free; then 1,000, then 10,000 snouts (server-priced
	// off renames_used; the client mirrors it for the cost line).
	const [renameOpen, setRenameOpen] = useState(false);
	const [renameInput, setRenameInput] = useState("");
	const [renameBusy, setRenameBusy] = useState(false);
	const [renameError, setRenameError] = useState<string | null>(null);
	// "Send an idea to the den" — a cozy whisper dialog. kind picker + a
	// multiline note; on success the body swaps to a one-beat confirmation
	// (feedbackSent) that auto-dismisses. feedbackError carries a refusal line.
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>("idea");
	const [feedbackInput, setFeedbackInput] = useState("");
	const [feedbackBusy, setFeedbackBusy] = useState(false);
	const [feedbackError, setFeedbackError] = useState<string | null>(null);
	const [feedbackSent, setFeedbackSent] = useState(false);
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
				text: `${r.inviter_username ?? "Your friend"} brought you in — +50 snouts.`,
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
	// Snouts balance — feeds the 3-column stats row inside the identity
	// card (LIFETIME TICKLES · SNOUTS · JOINED).
	const [snouts, setSnouts] = useState<number>(0);
	// How many times this account has renamed already — drives the rename
	// cost ladder (0 → free, 1 → 1,000, 2+ → 10,000 snouts).
	const [renamesUsed, setRenamesUsed] = useState<number>(0);
	const [activeHat, setActiveHat] = useState<string | null>(null);
	const [isVip, setIsVip] = useState<boolean>(false);
	const [busy, setBusy] = useState<boolean>(false);
	// Lifetime scalars for "the long story" dashboard — read straight off the
	// caller's own profiles row alongside the rest of the identity fetch.
	const [activeDays, setActiveDays] = useState<number>(0);
	const [warWins, setWarWins] = useState<number>(0);
	const [ticklesWasted, setTicklesWasted] = useState<number>(0);
	const [referralsCompleted, setReferralsCompleted] = useState<number>(0);
	// "The long story" — lifetime dashboard detail sheet. The card shows three
	// top-level lifetime figures always; the sheet opens the full ledger and
	// lazily pulls the aggregate counts (me_lifetime_stats) only on first open.
	const [longStoryOpen, setLongStoryOpen] = useState(false);
	const [lifetimeAgg, setLifetimeAgg] = useState<LifetimeAgg | null>(null);
	const [lifetimeAggBusy, setLifetimeAggBusy] = useState(false);
	const openLongStory = () => {
		setLongStoryOpen(true);
		// Lazy: fetch the aggregate counts once, the first time the sheet opens.
		if (lifetimeAgg || lifetimeAggBusy) return;
		setLifetimeAggBusy(true);
		rpc<LifetimeAgg & { ok?: boolean }>("me_lifetime_stats")
			.then((r) => {
				if (r?.ok) setLifetimeAgg(r);
			})
			.finally(() => setLifetimeAggBusy(false));
	};
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
					"username, discriminator, tickles_earned, tickles_lifetime_base, counter, active_hat_id, is_vip, referred_by, distinct_active_days, war_wins, tickles_wasted_total, referrals_completed, active_title:titles!profiles_active_title_id_fkey(name, placement)"
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
						renames_used?: number;
						active_hat_id?: string | null;
						is_vip?: boolean;
						referred_by?: string | null;
						distinct_active_days?: number;
						war_wins?: number;
						tickles_wasted_total?: number;
						referrals_completed?: number;
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
							.select("username, discriminator, tickles_earned, tickles_lifetime_base, counter, active_hat_id, is_vip, referred_by, distinct_active_days, war_wins, tickles_wasted_total, referrals_completed")
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
					setActiveDays(row?.distinct_active_days ?? 0);
					setWarWins(row?.war_wins ?? 0);
					setTicklesWasted(row?.tickles_wasted_total ?? 0);
					setReferralsCompleted(row?.referrals_completed ?? 0);
					setHasRedeemed(!!row?.referred_by);
					const t = Array.isArray(row?.active_title)
						? row?.active_title[0]
						: row?.active_title;
					setActiveTitle(t ?? null);
				});
			// renames_used ships with the (not-yet-pushed) rename migration —
			// fetched separately so a missing column can't 400 the main
			// profile select and zero out the whole page. Fails soft to 0.
			supabase
				.from("profiles")
				.select("renames_used")
				.eq("id", session.user.id)
				.single()
				.then(({ data, error }) => {
					if (!error) {
						setRenamesUsed(
							(data as { renames_used?: number } | null)?.renames_used ?? 0
						);
					}
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

	// Short "Jun 2026"-style join date for the identity card's JOINED stat.
	// Falls back to a dash if created_at didn't parse.
	const joinedLabel = Number.isFinite(accountCreatedMs)
		? new Date(accountCreatedMs).toLocaleDateString(undefined, {
				month: "short",
				year: "numeric",
			})
		: "—";

	// Cost of the NEXT rename, mirroring the server ladder in
	// rename_username: first free, second 1,000, third+ 10,000 snouts.
	const renameCost = renamesUsed === 0 ? 0 : renamesUsed === 1 ? 1000 : 10000;
	const renameCostCopy =
		renameCost === 0 ? "First rename is free." : `${renameCost.toLocaleString()} snouts.`;

	const openRename = () => {
		setRenameInput(username ?? "");
		setRenameError(null);
		setRenameOpen(true);
	};

	const handleRename = async () => {
		if (renameBusy) return;
		const next = renameInput.trim();
		if (next.length < 3 || next.length > 24) {
			setRenameError("Names are 3–24 characters.");
			return;
		}
		if (next === username) {
			setRenameError("That's already your name.");
			return;
		}
		// Client-side moderation pre-check saves a round trip; the DB
		// trigger is authoritative (same pattern as UsernameSetup).
		const allowed = isUsernameAllowed(next);
		if (!allowed.ok) {
			setRenameError("That name won't fly in the barn — pick a different one.");
			return;
		}
		setRenameBusy(true);
		setRenameError(null);
		const r = await rpc<
			| { ok: true; remaining: number; cost: number; next_cost: number }
			| { ok: false; reason: string; cost?: number }
		>("rename_username", { p_name: next });
		setRenameBusy(false);
		if (r?.ok) {
			setUsername(next);
			setSnouts(r.remaining);
			setRenamesUsed((n) => n + 1);
			setRenameOpen(false);
			showPurchaseToast({
				type: "success",
				title: "New name!",
				text: `You're ${next} now.`,
			});
			return;
		}
		const reason = r && "reason" in r ? r.reason : undefined;
		setRenameError(
			reason === "name_taken"
				? "That name is taken — try another."
				: reason === "not_allowed"
					? "That name won't fly in the barn — pick a different one."
					: reason === "not_enough_snouts"
						? "Not enough snouts for this rename."
						: reason === "bad_name"
							? "Names are 3–24 characters."
							: "Couldn't rename. Try again."
		);
	};

	// "Send an idea to the den" — opens the whisper dialog fresh each time.
	const openFeedback = () => {
		setFeedbackKind("idea");
		setFeedbackInput("");
		setFeedbackError(null);
		setFeedbackSent(false);
		setFeedbackOpen(true);
	};

	// Deep-link auto-open: the rare feedback nudge (FeedbackNudgeModal, armed in
	// app/_layout.tsx) routes here with ?feedback=1 to land the player straight in
	// the whisper dialog — one dialog, two entry points, no duplicated flow. We
	// clear the param immediately so a back-nav / re-focus can't re-trigger it.
	const { feedback: feedbackParam } = useLocalSearchParams<{ feedback?: string }>();
	useFocusEffect(
		useCallback(() => {
			if (feedbackParam === "1") {
				openFeedback();
				router.setParams({ feedback: undefined });
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [feedbackParam])
	);

	const handleFeedback = async () => {
		if (feedbackBusy) return;
		const body = feedbackInput.trim();
		if (body.length < 3) {
			setFeedbackError("the whisper got lost — try again?");
			return;
		}
		setFeedbackBusy(true);
		setFeedbackError(null);
		const r = await submitFeedback(feedbackKind, body);
		setFeedbackBusy(false);
		if (r.ok) {
			// Someone who whispers doesn't need the occasional feedback nudge —
			// stamp the local "ever sent" flag so the nudge backs off hard (60d).
			// Fail-soft: a missed stamp only means the nudge could still arm later.
			stampFeedbackEverSent(session.user.id);
			// Swap the body for the one-beat confirmation, then auto-dismiss.
			setFeedbackSent(true);
			setTimeout(() => setFeedbackOpen(false), 1500);
			return;
		}
		// 'resting' = the day's ears are full; anything else (including a
		// feature-dark miss when the migration is unpushed) is a lost whisper.
		setFeedbackError(
			r.reason === "resting"
				? "the den's ears are full for today — come whisper tomorrow."
				: "the whisper got lost — try again?"
		);
	};

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

	// Listen for entitlement changes from RC (e.g., webhook flips after sandbox
	// renewal). UI-optimistic only: the durable is_vip flip is the RevenueCat
	// webhook (supabase/functions/revenuecat-webhook) — dev_set_vip was revoked
	// from authenticated in the 20260537-39 lockdowns, so calling it here only
	// produced a permission-denied error log.
	useFocusEffect(
		useCallback(() => {
			const unsub = onCustomerInfoUpdate((info) => {
				const pro = !!info.entitlements.active["tickle_the_pig_pro"];
				if (pro && !isVip) setIsVip(true);
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
										<View style={styles.codeNameRow}>
											<Text style={styles.codeValue} numberOfLines={1}>
												{activeTitle
													? activeTitle.placement === "pre"
														? `${activeTitle.name} ${username}`
														: `${username} ${activeTitle.name}`
													: username}
											</Text>
										</View>
										{!!handle && discriminator && (
											<Text style={styles.codeHandle}>{handle}</Text>
										)}
										<View
											style={[
												styles.memberChip,
												isVip ? styles.memberChipVip : styles.memberChipFree,
											]}
										>
											<Text style={styles.memberChipText}>
												{isVip ? "SLOP CLUB" : "FREE RANGE"}
											</Text>
										</View>
									</View>
								</View>

								{/* Identity-card band — 3-col cluster inside the card.
								    Divided by 1px ink-mute verticals + a dashed top
								    border. Lifetime figures live HERE (the standalone
								    "long story" card was folded in 2026-07-17); tapping
								    the band opens the full long-story ledger sheet. */}
								<Pressable onPress={openLongStory}>
									<View style={styles.lifetimeStatsRow}>
										<LifetimeStat
											label="LIFETIME TICKLES"
											value={lifetimeTickles(
												ticklesLifetimeBase,
												ticklesEarned
											).toLocaleString()}
										/>
										<View style={styles.lifetimeStatDivider} />
										<LifetimeStat
											label="ACTIVE DAYS"
											value={activeDays.toLocaleString()}
										/>
										<View style={styles.lifetimeStatDivider} />
										<LifetimeStat label="JOINED" value={joinedLabel} />
									</View>
								</Pressable>
								<Pressable onPress={handleCopyCode} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}>
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
						style={({ pressed }) => [achievementStyles.row, pressed && { opacity: 0.7 }]}
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
								{/* 2× regen is a live server perk (regen_secs_for reads
								    is_vip) that the pitch never advertised. Sticker-heart
								    glyph until a dedicated perk art lands via the studio. */}
								<SlopPerk
									node={<Glyph name="heart" size={44} />}
									label="Tickles refill twice as fast"
									detail="Your bank regenerates at 2× speed"
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
									style={({ pressed }) => [referralStyles.copyBtn, pressed && { opacity: 0.7 }]}
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
								style={({ pressed }) => [referralStyles.shareBtn, pressed && { opacity: 0.7 }]}
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
										style={({ pressed }) => pressed && { opacity: 0.7 }}
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
									style={({ pressed }) => [referralStyles.seeMore, pressed && { opacity: 0.7 }]}
									hitSlop={6}
								>
									<Text style={referralStyles.seeMoreText}>
										Your recruits + rewards ›
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
										You're in — thanks to {codeInviter}! +50
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
								icon="edit"
								label="Change your name"
								onPress={openRename}
							/>
							<SettingRow
								icon="bell"
								label="Send an idea to the den"
								onPress={openFeedback}
							/>
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

			{/* Paid rename dialog — same paper-sticker treatment as
			    ConfirmDialog, with a UsernameSetup-styled input and the
			    cost line up top. Direct-tap (not PopupQueue-slotted), so
			    visible tracks open. */}
			<Modal
				visible={renameOpen}
				transparent
				animationType="fade"
				onRequestClose={() => !renameBusy && setRenameOpen(false)}
			>
				<KeyboardAvoidingView
					style={renameStyles.flex}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<Pressable
						style={renameStyles.backdrop}
						onPress={() => !renameBusy && setRenameOpen(false)}
					>
						<Pressable style={renameStyles.cardWrap} onPress={() => {}}>
							<Sticker
								color="paper"
								rotate={-0.8}
								radius={18}
								style={[renameStyles.card, STICKER_SHADOW]}
							>
								<Text style={renameStyles.title}>Change your name</Text>
								<Text style={renameStyles.cost}>{renameCostCopy}</Text>
								<TextInput
									style={[
										renameStyles.input,
										!!renameError && renameStyles.inputError,
									]}
									placeholder="3–24 characters"
									placeholderTextColor={WHIMSY.mute}
									value={renameInput}
									onChangeText={(t) => {
										setRenameInput(t);
										if (renameError) setRenameError(null);
									}}
									autoCapitalize="none"
									autoCorrect={false}
									maxLength={24}
									editable={!renameBusy}
								/>
								{renameError && (
									<Text style={renameStyles.error}>{renameError}</Text>
								)}
								<View style={renameStyles.btnRow}>
									<Pressable
										onPress={() => setRenameOpen(false)}
										disabled={renameBusy}
										style={({ pressed }) => [
											renameStyles.btn,
											renameStyles.btnGhost,
											pressed && { opacity: 0.7 },
										]}
									>
										<Text style={renameStyles.btnGhostText}>Cancel</Text>
									</Pressable>
									<Pressable
										onPress={handleRename}
										disabled={renameBusy}
										style={({ pressed }) => [
											renameStyles.btn,
											renameStyles.btnConfirm,
											(pressed || renameBusy) && { opacity: 0.7 },
										]}
									>
										<Text style={renameStyles.btnConfirmText}>
											{renameBusy ? "…" : "Save"}
										</Text>
									</Pressable>
								</View>
							</Sticker>
						</Pressable>
					</Pressable>
				</KeyboardAvoidingView>
			</Modal>

			{/* "Send an idea to the den" — the whisper dialog. Same paper-sticker
			    treatment as the rename dialog: a 3-way kind picker (chips), a
			    multiline note, and a "whisper it" button. On success the body
			    swaps to a one-beat confirmation that auto-dismisses. */}
			<Modal
				visible={feedbackOpen}
				transparent
				animationType="fade"
				onRequestClose={() => !feedbackBusy && setFeedbackOpen(false)}
			>
				<KeyboardAvoidingView
					style={feedbackStyles.flex}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<Pressable
						style={feedbackStyles.backdrop}
						onPress={() => !feedbackBusy && setFeedbackOpen(false)}
					>
						<Pressable style={feedbackStyles.cardWrap} onPress={() => {}}>
							<Sticker
								color="paper"
								rotate={-0.8}
								radius={18}
								style={[feedbackStyles.card, STICKER_SHADOW]}
							>
								{feedbackSent ? (
									// One-beat confirmation — auto-dismisses (~1.5s) or a tap.
									<Pressable onPress={() => setFeedbackOpen(false)}>
										<Text style={feedbackStyles.sentText}>
											the bog heard you. thank you for the whisper.
										</Text>
									</Pressable>
								) : (
									<>
										<Text style={feedbackStyles.title}>
											send an idea to the den
										</Text>
										<View style={feedbackStyles.chipRow}>
											{(
												[
													["idea", "an idea"],
													["bug", "something's broken"],
													["love", "a love note"],
												] as [FeedbackKind, string][]
											).map(([k, label]) => {
												const on = feedbackKind === k;
												return (
													<Pressable
														key={k}
														onPress={() => setFeedbackKind(k)}
														disabled={feedbackBusy}
														style={[
															feedbackStyles.chip,
															on && feedbackStyles.chipOn,
														]}
													>
														<Text
															style={[
																feedbackStyles.chipText,
																on && feedbackStyles.chipTextOn,
															]}
														>
															{label}
														</Text>
													</Pressable>
												);
											})}
										</View>
										<TextInput
											style={[
												feedbackStyles.input,
												!!feedbackError && feedbackStyles.inputError,
											]}
											placeholder="what should the bog know?"
											placeholderTextColor={WHIMSY.mute}
											value={feedbackInput}
											onChangeText={(t) => {
												setFeedbackInput(t);
												if (feedbackError) setFeedbackError(null);
											}}
											multiline
											maxLength={1000}
											editable={!feedbackBusy}
										/>
										{feedbackError && (
											<Text style={feedbackStyles.error}>
												{feedbackError}
											</Text>
										)}
										<View style={feedbackStyles.btnRow}>
											<Pressable
												onPress={() => setFeedbackOpen(false)}
												disabled={feedbackBusy}
												style={({ pressed }) => [
													feedbackStyles.btn,
													feedbackStyles.btnGhost,
													pressed && { opacity: 0.7 },
												]}
											>
												<Text style={feedbackStyles.btnGhostText}>
													Cancel
												</Text>
											</Pressable>
											<Pressable
												onPress={handleFeedback}
												disabled={feedbackBusy}
												style={({ pressed }) => [
													feedbackStyles.btn,
													feedbackStyles.btnConfirm,
													(pressed || feedbackBusy) && { opacity: 0.7 },
												]}
											>
												<Text style={feedbackStyles.btnConfirmText}>
													{feedbackBusy ? "…" : "whisper it"}
												</Text>
											</Pressable>
										</View>
									</>
								)}
							</Sticker>
						</Pressable>
					</Pressable>
				</KeyboardAvoidingView>
			</Modal>

			{/* The long story — full lifetime ledger. Same paper-sticker modal
			    treatment as the rename dialog; a scrollable "label · value"
			    ledger. The scalar rows read straight from the identity fetch;
			    the aggregate counts hydrate lazily from me_lifetime_stats on
			    first open (LoadingBeat until they land). */}
			<Modal
				visible={longStoryOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setLongStoryOpen(false)}
			>
				<Pressable
					style={longStoryStyles.backdrop}
					onPress={() => setLongStoryOpen(false)}
				>
					<Pressable style={longStoryStyles.sheetWrap} onPress={() => {}}>
						<Sticker
							color="paper"
							rotate={-0.6}
							radius={RADII.xxl}
							style={[longStoryStyles.sheet, STICKER_SHADOW]}
						>
							<Text style={longStoryStyles.sheetKicker}>★ the long story</Text>
							<Text style={longStoryStyles.sheetTitle}>all you've done</Text>
							<ScrollView
								style={longStoryStyles.ledgerScroll}
								contentContainerStyle={longStoryStyles.ledger}
								showsVerticalScrollIndicator={false}
							>
								<LedgerRow
									label="lifetime tickles"
									value={lifetimeTickles(
										ticklesLifetimeBase,
										ticklesEarned
									).toLocaleString()}
								/>
								<LedgerRow
									label="tickles wasted"
									value={ticklesWasted.toLocaleString()}
								/>
								<LedgerRow label="active days" value={activeDays.toLocaleString()} />
								<LedgerRow label="war wins" value={warWins.toLocaleString()} />
								<LedgerRow
									label="referrals completed"
									value={referralsCompleted.toLocaleString()}
								/>
								<LedgerRow label="snouts" value={snouts.toLocaleString()} />
								<LedgerRow label="joined" value={joinedLabel} />
								<LedgerRow
									label="membership"
									value={isVip ? "slop club" : "free range"}
								/>

								<View style={longStoryStyles.ledgerDivider} />

								{lifetimeAgg ? (
									<>
										<LedgerRow
											label="barn visits made"
											value={lifetimeAgg.barn_visits_made.toLocaleString()}
										/>
										<LedgerRow
											label="barn visits hosted"
											value={lifetimeAgg.barn_visits_hosted.toLocaleString()}
										/>
										<LedgerRow
											label="truffles buried"
											value={lifetimeAgg.truffles_buried.toLocaleString()}
										/>
										<LedgerRow
											label="friend-mound digs"
											value={lifetimeAgg.friend_mound_digs.toLocaleString()}
										/>
										<LedgerRow
											label="blessings sent"
											value={lifetimeAgg.blessings_sent.toLocaleString()}
										/>
										<LedgerRow
											label="curses sent"
											value={lifetimeAgg.curses_sent.toLocaleString()}
										/>
										<LedgerRow
											label="trades fulfilled"
											value={lifetimeAgg.trades_fulfilled.toLocaleString()}
											last
										/>
									</>
								) : (
									<LoadingBeat label="tallying it up" />
								)}
							</ScrollView>
							<Pressable
								onPress={() => setLongStoryOpen(false)}
								style={({ pressed }) => [
									longStoryStyles.closeBtn,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={longStoryStyles.closeBtnText}>Close</Text>
							</Pressable>
						</Sticker>
					</Pressable>
				</Pressable>
			</Modal>
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
					<View style={referralStyles.milestoneBadgeRow}>
						<Icon name="check" size={11} color={WHIMSY.accent} strokeWidth={2.4} />
						<Text style={referralStyles.milestoneBadge}>Rewards earned</Text>
					</View>
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

// One "label · value" line in the long-story ledger sheet. Dashed bottom
// divider unless it's the last row (mirrors the SettingRow treatment).
function LedgerRow({
	label,
	value,
	last,
}: {
	label: string;
	value: string;
	last?: boolean;
}) {
	return (
		<View style={[longStoryStyles.ledgerRow, !last && longStoryStyles.ledgerRowDivider]}>
			<Text style={longStoryStyles.ledgerLabel}>{label}</Text>
			<Text style={longStoryStyles.ledgerValue}>{value}</Text>
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
	codeNameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginTop: 2,
	},
	codeValue: {
		flexShrink: 1,
		fontSize: 24,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 26,
	},
	codeHandle: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		letterSpacing: 0.4,
		marginTop: 2,
	},
	// Membership chip under the handle — gold sticker for Slop Club members,
	// quiet paper chip for free-range pigs. Status, not a sales pitch.
	memberChip: {
		alignSelf: "flex-start",
		marginTop: SPACE.xs,
		paddingHorizontal: SPACE.sm,
		paddingVertical: 1,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	memberChipVip: { backgroundColor: WHIMSY.slopGold },
	memberChipFree: { backgroundColor: WHIMSY.paper },
	memberChipText: {
		fontFamily: FONTS.whimsy,
		fontSize: 11,
		color: WHIMSY.ink,
		letterSpacing: 0.6,
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
		borderRadius: RADII.md,
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
		borderRadius: RADII.md,
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
		borderRadius: RADII.pill,
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
		borderRadius: RADII.lg,
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
		borderRadius: RADII.md,
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
		borderRadius: RADII.lg,
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
		borderRadius: RADII.md,
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
		borderRadius: RADII.md,
		paddingHorizontal: 16,
		paddingVertical: 9,
	},
	applyBtnDisabled: { opacity: 0.45 },
	applyBtnText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	entryError: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.accent,
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
		fontSize: 13,
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
		borderRadius: RADII.md,
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
		gap: SPACE.xs + 2,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
		borderRadius: RADII.md,
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
		borderRadius: RADII.lg,
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
	milestoneBadgeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 3,
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
		borderRadius: RADII.pill,
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

// Paid-rename dialog — paper-sticker modal styled to match ConfirmDialog,
// with a UsernameSetup-styled input. Cost line sits under the title.
const renameStyles = StyleSheet.create({
	flex: { flex: 1 },
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 28,
	},
	cardWrap: { width: "100%", maxWidth: 340 },
	card: { paddingHorizontal: 22, paddingVertical: 20 },
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	cost: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 14,
	},
	input: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 16,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: 14,
		paddingVertical: 12,
	},
	inputError: { borderColor: WHIMSY.accent },
	error: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
		marginTop: 8,
	},
	btnRow: {
		flexDirection: "row",
		gap: 10,
		alignSelf: "stretch",
		marginTop: 18,
	},
	btn: {
		flex: 1,
		paddingHorizontal: 14,
		paddingVertical: 11,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	btnGhost: { backgroundColor: "transparent", borderColor: WHIMSY.muteSoft },
	btnGhostText: { fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.mute },
	btnConfirm: { backgroundColor: WHIMSY.lilac },
	btnConfirmText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
});

// The Den whisper dialog — same paper-sticker modal treatment as the rename
// dialog, plus a chip-row kind picker and a taller multiline note.
const feedbackStyles = StyleSheet.create({
	flex: { flex: 1 },
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 28,
	},
	cardWrap: { width: "100%", maxWidth: 340 },
	card: { paddingHorizontal: 22, paddingVertical: 20 },
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 14,
	},
	chipRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		justifyContent: "center",
		marginBottom: 14,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: RADII.md,
		borderWidth: 1.5,
		borderColor: WHIMSY.muteSoft,
		backgroundColor: "transparent",
	},
	chipOn: { borderColor: WHIMSY.ink, backgroundColor: WHIMSY.lilac },
	chipText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.mute },
	chipTextOn: { color: WHIMSY.ink },
	input: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 16,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: 14,
		paddingVertical: 12,
		minHeight: 88,
		textAlignVertical: "top",
	},
	inputError: { borderColor: WHIMSY.accent },
	error: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
		marginTop: 8,
	},
	sentText: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 26,
		paddingVertical: 12,
	},
	btnRow: {
		flexDirection: "row",
		gap: 10,
		alignSelf: "stretch",
		marginTop: 18,
	},
	btn: {
		flex: 1,
		paddingHorizontal: 14,
		paddingVertical: 11,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	btnGhost: { backgroundColor: "transparent", borderColor: WHIMSY.muteSoft },
	btnGhostText: { fontFamily: FONTS.bodyExtra, fontSize: 14, color: WHIMSY.mute },
	btnConfirm: { backgroundColor: WHIMSY.lilac },
	btnConfirmText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
});

// "The long story" — lifetime dashboard card + its detail-sheet ledger.
// Card sits under the identity card; the sheet reuses the paper-sticker
// modal treatment (backdrop + centered sticker) shared with the rename dialog.
const longStoryStyles = StyleSheet.create({
	wrap: {},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 8,
	},
	card: { padding: 16 },
	statsRow: {
		flexDirection: "row",
		alignItems: "stretch",
	},
	seeAll: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
		letterSpacing: 0.3,
		textAlign: "center",
		marginTop: 14,
		paddingTop: 12,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	// Detail sheet — paper-sticker modal, centered like the rename dialog.
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 24,
	},
	sheetWrap: { width: "100%", maxWidth: 360 },
	sheet: { paddingHorizontal: 22, paddingVertical: 20 },
	sheetKicker: { ...KICKER_TEXT, marginBottom: 4 },
	sheetTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		marginBottom: 12,
	},
	// Cap the ledger height so a long list scrolls inside the sheet rather
	// than pushing the Close button off a short screen.
	ledgerScroll: { maxHeight: 380 },
	ledger: {},
	ledgerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 12,
		paddingVertical: 11,
	},
	ledgerRowDivider: {
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	ledgerLabel: {
		flex: 1,
		minWidth: 0,
		fontFamily: FONTS.bodyExtra,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	ledgerValue: {
		fontFamily: FONTS.whimsy,
		fontSize: 17,
		color: WHIMSY.ink,
	},
	// Dashed rule between the scalar figures and the aggregate social counts.
	ledgerDivider: {
		height: 1.5,
		backgroundColor: WHIMSY.muteSoft,
		marginVertical: 8,
	},
	closeBtn: {
		marginTop: 16,
		paddingVertical: 11,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
	},
	closeBtnText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
});

