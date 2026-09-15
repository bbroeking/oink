// The Me tab — identity, prestige, membership, referrals, settings.
//
// Wave-3 conformance pass (2026-09-11, section E). The screen is unchanged; it
// is spoken in the design system instead of hand-drawn:
//   · the crown is `PageHeader variant="tab"`, and the tab sign, page title and
//     kicker finally name one thing — "Me", "★ your scrapbook" [E20]
//   · every literal folded onto TYPE / SPACE / RADII / BORDER / ART_SIZE — the
//     already-tokenized `wallowWallStyles` block was the in-file template [E3]
//   · the purchase surface's fine print and legal links are `BodySm tone="secondary"`
//     + `Button variant="link"` at the 44pt floor; no opacity-derived text [E4]
//   · sign-out asks first, like the delete row one line below it [E6]
//   · one loading beat for six reads, and a failed profile is an error + retry [E7]
//   · every pressable is a Button / Chip / NavRow / Sticker onPress, so the label
//     and the 44pt frame come from the primitive, not from memory [E9]
//   · the redeem field is a `TextField` (it owns `placeholderTextColor`) [E10]
//   · the identity handle is "your friend code", the invite string is "your
//     referral code" — two nouns for two objects [E11]
//   · the three hand-rolled modal shells are `AdaptiveModalScaffold` (rename,
//     whisper) and `Sheet` (the long story) [E12]
//   · settings rows and the two nav rows are one `NavRow` geometry, grouped [E18, E25]
import { useCallback, useState } from "react";
import {
	ScrollView,
	StyleSheet,
	View,
	SafeAreaView,
	Image,
	Linking,
	Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router/react-navigation";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { lifetimeTickles } from "@/utils/tickles";
import type { SeasonState } from "@/utils/seasonPass";
import { submitFeedback, type FeedbackKind } from "@/utils/feedback";
import { stampFeedbackEverSent } from "@/utils/feedbackNudge";
import { ReleaseNotesModal } from "./ReleaseNotesModal";
import { BlockedUsersSheet } from "./BlockedUsersSheet";
import {
	AdaptiveModalScaffold,
	Body,
	BodySm,
	Button,
	CardTitle,
	Chip,
	ConfirmDialog,
	DialogButtonRow,
	EmptyState,
	Glyph,
	Hand,
	Icon,
	Kicker,
	KickerPill,
	Label,
	LoadingBeat,
	NavRow,
	PageHeader,
	PigPortrait,
	PrestigeAvatar,
	ProfileIdentity,
	ProgressTrack,
	Ribbon,
	SectionHeader,
	Sheet,
	Stat,
	showToast,
	Sticker,
	T,
	Tag,
	Tape,
	TextField,
	useUnmanagedModalHold,
} from "@/components/ui";
import type { TitlePlacement } from "@/constants/title_types";
import Constants from "expo-constants";
import {
	ART_SIZE,
	BORDER,
	PAGE_PAD,
	RADII,
	SPACE,
	TAB_SAFE,
	TAP_MIN,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
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
import { showHabitatIntro } from "@/utils/habitatIntro";
import {
	refreshWallowTuning,
	wallowRankLabel,
	wallowRegenPercent,
	wallowRegenSeconds as compiledWallowRegenSeconds,
	wallowVisitCooldownHours,
} from "@/utils/wallow";

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

// Drawing constants, not spacing steps — the geometry of things that are drawn
// rather than laid out. Named here the way `Chip`'s RIBBON_WIDTH and
// `PageHeader`'s PLAQUE_WIDTH are, so no raw number sits in a StyleSheet.
// (2026-09-11)
const RANK_DECAL = 54; // the square W-rank stamp
const STEP_DROP = 28; // the connector between the two rank steps
const SLOP_PAIR_W = 126; // the overlapping Rosie + companion portrait frame
const SLOP_PAIR_H = 100;
const PORTRAIT_SIZE = 82; // the companion portraits inside that frame
// The inline mark beside a button label (copy / check).
const LABEL_MARK = ART_SIZE.mark;
// How far a referred friend has to get before the referral counts.
const REFERRAL_TICKLE_GOAL = 100;
// A referral code is read one character at a time, so it is set wide. Tracking
// is a property of THIS string, not a step on a scale — named here rather than
// inlined, the way `Chip`'s RIBBON_ANGLE is. (2026-09-11)
const CODE_TRACKING = 1.2;

// The profile read is the screen's spine: five other fetches decorate it, so it
// alone decides whether the Me tab is waiting, broken, or ready. [E7]
type ProfileState = "loading" | "ready" | "error";

export function Account({ session }: { session: Session }) {
	const [username, setUsername] = useState<string | null>(null);
	const [discriminator, setDiscriminator] = useState<string | null>(null);
	// One gate for six independent reads — the tab shows one loading beat, not N
	// pop-ins, and a hard failure gets a retry instead of a permanently missing
	// card. [E7]
	const [profileState, setProfileState] = useState<ProfileState>("loading");
	const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
	const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
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
	// Ending a session is an exit with no undo, so it asks first — the row one
	// line below it already did, and the screen shouldn't teach a promise it
	// breaks. [E6]
	const [signOutOpen, setSignOutOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	// Legacy `my_sounder` RPC, now used only for recruiter/referral standing.
	// "Sounder" is reserved in player-facing copy for the eight-pig crew.
	const [recruiterStats, setRecruiterStats] = useState<{
		engaged_count: number;
		signup_count: number;
		rank: number | null;
		next_threshold: number | null;
		next_title: string | null;
	} | null>(null);
	// Code-based referral state (per docs/referrals.md). The
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
	const [wallowCount, setWallowCount] = useState(0);
	const [wallowRegenSeconds, setWallowRegenSeconds] = useState<number | null>(null);
	const [devWallowPreview, setDevWallowPreview] = useState(false);
	const [, setWallowTuningVersion] = useState(0);
	useFocusEffect(
		useCallback(() => {
			refreshWallowTuning().then((changed) => {
				if (changed) setWallowTuningVersion((version) => version + 1);
			});
		}, []),
	);

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
			showToast({
				tone: "success",
				title: "Code applied!",
				text: `${r.inviter_username ?? "Your friend"} brought you in — +50 snouts.`,
			});
		} else {
			setCodeError(referralErrorMessage(r && "reason" in r ? r.reason : undefined));
		}
	};
	useFocusEffect(
		useCallback(() => {
			// Referral summary — drives the "Refer friends" card.
			// Cheap RPC; refetch on focus so milestone progress bumps
			// as soon as the user returns from sharing.
			myReferralSummary().then((r) => {
				if (r && "ok" in r && r.ok) setReferral(r);
			});
		}, [])
	);
	useFocusEffect(
		useCallback(() => {
			// The recruiter leaderboard's RPC still uses the old `sounder`
			// name internally.
			rpc<
				| { ok: false; reason?: string }
				| ({ ok: true } & NonNullable<typeof recruiterStats>)
			>("my_sounder").then((r) => {
				// my_sounder RPC returns jsonb: { ok: false, reason } when
				// unauthenticated, otherwise { ok: true, ...sounder fields }.
				if (r?.ok) {
					const { ok: _ok, ...stats } = r;
					setRecruiterStats(stats);
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
	const [vipUntil, setVipUntil] = useState<string | null>(null);
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
	// __DEV__ only: the storefront-missing shortcut that flips is_vip locally.
	// Never reachable in a production build (see handleUnlockPro).
	const [devUnlockOpen, setDevUnlockOpen] = useState(false);
	// The Me tab's sheets/dialogs are all unmanaged native Modals (direct-tap,
	// outside the popup queue): the release notes, delete-account confirm, paid
	// rename, feedback whisper, and the long-story ledger. Hold the queue while any
	// is open so a foreground poll can't present a queued popup over it — the
	// #50152 wedge (issue #4). ReleaseNotesModal is also queue-slotted in the Barn;
	// this holds only for its Me-tab (plain-state) open.
	useUnmanagedModalHold(
		releaseNotesOpen ||
			blockedUsersOpen ||
			deleteOpen ||
			signOutOpen ||
			renameOpen ||
			feedbackOpen ||
			longStoryOpen ||
			devUnlockOpen
	);
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
	// Show the user's currently equipped title alongside their code so
	// they can confirm at-a-glance that their title is wired up. Manage
	// (equip/unequip) lives in the Closet (Shop → Wardrobe view), which
	// renders TitlesSection inline; buying stays in the Titles tab.
	const [activeTitle, setActiveTitle] = useState<{
		name: string;
		placement: TitlePlacement;
	} | null>(null);
	// The screen's spine read, memoized so both the focus effect and the error
	// state's retry run exactly the same thing. [E7]
	const loadProfile = useCallback(() => {
			// active_title joins through the FK on profiles.active_title_id.
			supabase
				.from("profiles")
				.select(
					"username, discriminator, tickles_earned, tickles_lifetime_base, counter, active_hat_id, is_vip, vip_until, referred_by, distinct_active_days, war_wins, tickles_wasted_total, referrals_completed, active_title:titles!profiles_active_title_id_fkey(name, placement)"
				)
				.eq("id", session.user.id)
				.single()
				.then(({ data, error }) => {
					type ProfileRow = {
						username?: string | null;
						discriminator?: string | null;
						tickles_earned?: number;
						tickles_lifetime_base?: number;
						counter?: number;
						renames_used?: number;
						active_hat_id?: string | null;
						is_vip?: boolean;
						vip_until?: string | null;
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
					// `titles.placement` is plain `text` in Postgres; ProfileRow
					// narrows it to the TitlePlacement union the renderer switches
					// on. That narrowing is all this assertion does — every other
					// field comes straight from the generated row type.
					const row: ProfileRow | null = error
						? null
						: (data as ProfileRow | null);
					// A null row is UNKNOWN, not empty: the read failed, so the
					// screen says so and offers the read again. [E7]
					if (!row) {
						setProfileState("error");
						return;
					}
					setUsername(row.username ?? null);
					setDiscriminator(row.discriminator ?? null);
					setTicklesEarned(row.tickles_earned ?? 0);
					setTicklesLifetimeBase(row.tickles_lifetime_base ?? 0);
					setSnouts(row.counter ?? 0);
					setActiveHat(row.active_hat_id ?? null);
					setIsVip(row.is_vip ?? false);
					setVipUntil(row.vip_until ?? null);
					setActiveDays(row.distinct_active_days ?? 0);
					setWarWins(row.war_wins ?? 0);
					setTicklesWasted(row.tickles_wasted_total ?? 0);
					setReferralsCompleted(row.referrals_completed ?? 0);
					setHasRedeemed(!!row.referred_by);
					const t = Array.isArray(row.active_title)
						? row.active_title[0]
						: row.active_title;
					setActiveTitle(t ?? null);
					setProfileState("ready");
				},
				// A rejected read is the same unknown as a null row. [E7]
				() => setProfileState("error"),
			);
			// renames_used shipped with the rename migration (it IS in the live
			// schema — see utils/database.types.ts). Still fetched separately so a
			// per-column failure can't 400 the main profile select and zero out the
			// whole page. Fails soft to 0.
			supabase
				.from("profiles")
				.select("renames_used")
				.eq("id", session.user.id)
				.single()
				.then(({ data, error }) => {
					if (!error) {
						setRenamesUsed(data?.renames_used ?? 0);
					}
				});
			// Isolated fail-soft reads. profiles.wallow_count is live, but the
			// Wallow RPCs around it are still dark, so a missing function must not
			// break Account — keep each read on its own request.
			supabase
				.from("profiles")
				.select("wallow_count")
				.eq("id", session.user.id)
				.single()
				.then(({ data, error }) => {
					if (!error) setWallowCount(data?.wallow_count ?? 0);
				});
			rpc<SeasonState>("season_state").then((state) => {
				if (typeof state?.wallow_regen_seconds === "number") {
					setWallowRegenSeconds(state.wallow_regen_seconds);
				}
			});
	}, [session.user.id]);
	useFocusEffect(loadProfile);

	const retryProfile = () => {
		setProfileState("loading");
		loadProfile();
	};

	const handle = username
		? discriminator
			? `${username}#${discriminator}`
			: username
		: null;

	// Whether to show the "Got a friend's referral code?" apply box. Mirrors the
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
	const referralGrantUntil = referral?.slop_club_grant_until
		? new Date(referral.slop_club_grant_until)
		: null;
	const hasActiveReferralGrant =
		referralGrantUntil != null && referralGrantUntil.getTime() > Date.now();
	const hasActiveSubscription =
		vipUntil != null && new Date(vipUntil).getTime() > Date.now();
	const hasReferralOnlySlopClub =
		isVip && hasActiveReferralGrant && !hasActiveSubscription;
	const referralGrantDateLabel = hasActiveReferralGrant
		? referralGrantUntil.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			})
		: null;

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
	const visibleWallowCount = __DEV__ && devWallowPreview ? 5 : wallowCount;
	const visibleRegenSeconds = __DEV__ && devWallowPreview
		? compiledWallowRegenSeconds(5)
		: wallowRegenSeconds ?? Math.round(3600 * (1 - wallowRegenPercent(visibleWallowCount) / 100));

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
			showToast({
				tone: "success",
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

	// Deep-link auto-open for explicit links into the whisper dialog. Clear the
	// param immediately so a back-nav / re-focus cannot re-trigger it.
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

	// Copies the player's FRIEND CODE (username#discriminator) to the clipboard
	// — the string a friend types into Friends → Add. Distinct from the referral
	// code below, and now named apart everywhere on this screen. [E11]
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
		// initIAP absorbs its own failures (logged in utils/iap) — it never rejects.
		await initIAP(session.user.id);
		// Plan selection (monthly/yearly) + purchase live entirely in
		// RevenueCat's hosted paywall. is_vip is flipped server-side by the
		// webhook on the purchase; we set it optimistically for instant UI.
		const result = await presentPaywall(OFFERING_IDS.slopClub);
		setBusy(false);
		if (result.ok) {
			setIsVip(true);
			showToast({
				tone: "success",
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
				setDevUnlockOpen(true);
			} else {
				showToast({
					tone: "fail",
					title: "Slop Club",
					text: "The Slop Club isn't available right now — please try again soon.",
				});
			}
			return;
		}
		showToast({
			tone: "fail",
			title: "Couldn't join the Slop Club",
			text: "Please try again.",
		});
	};

	const handleManage = async () => {
		await presentCustomerCenter();
	};

	// Copy the player's REFERRAL CODE to the clipboard. Distinct from
	// handleCopyCode (which copies their friend code for in-app friend-add)
	// — different purpose, different target, different noun. [E11]
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
				showToast({
					tone: "success",
					title: "Restored",
					text: "Your Slop Club membership is active.",
				});
			} else {
				showToast({
					tone: "fail",
					title: "Nothing to restore",
					text: "No active Slop Club subscription on this Apple ID.",
				});
			}
		} else {
			showToast({
				tone: "fail",
				title: "Restore failed",
				text: "Please try again.",
			});
		}
	};

	// Drop the push token while still authenticated so this device stops
	// receiving pushes for the signed-out account.
	const handleSignOut = async () => {
		setSignOutOpen(false);
		await clearPushToken();
		await supabase.auth.signOut();
	};

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safe}>
				<ScrollView contentContainerStyle={styles.content}>
					<PageHeader
						variant="tab"
						kicker="your scrapbook"
						title="Me"
						style={styles.crown}
					/>

					{profileState === "loading" ? (
						<LoadingBeat label="turning to your page" />
					) : profileState === "error" ? (
						<EmptyState
							kind="error"
							title="Couldn't open your scrapbook"
							sub="The bog ate that one. Give it another nudge."
							action={
								<Button
									variant="ghost"
									size="sm"
									onPress={retryProfile}
									accessibilityLabel="Try loading your page again"
									accessibilityHint="Re-reads your profile from the farm"
								>
									Try again
								</Button>
							}
						/>
					) : (
						<>
							{/* Your friend code card — scrapbook page */}
							<View style={styles.codeWrap}>
								<Tape
									color="sun"
									rotate={-10}
									width={66}
									height={18}
									style={styles.codeTape}
								/>
								<Sticker
									color="rose"
									rotate={TILT.card}
									radius={RADII.xl}
									pad
									footer={
										<Button
											variant="ghost"
											size="sm"
											full
											icon={
												<Icon
													name={copied ? "check" : "copy"}
													size={LABEL_MARK}
													color={UI_COLORS.textPrimary}
													strokeWidth={2.2}
												/>
											}
											onPress={handleCopyCode}
											accessibilityLabel={
												copied
													? "Friend code copied"
													: "Copy my friend code"
											}
											accessibilityHint="Copies your friend code so a friend can add you"
										>
											{copied ? "Copied!" : "Copy my friend code"}
										</Button>
									}
								>
									<View style={styles.codeRow}>
										<PrestigeAvatar
											size={visibleWallowCount > 0 ? 76 : 56}
											hatId={activeHat}
											prestigeLevel={visibleWallowCount}
										/>
										<View style={styles.codeCol}>
											<Hand tone="secondary">your friend code</Hand>
											<ProfileIdentity
												username={username}
												title={activeTitle}
												variant="profile"
											/>
											{!!handle && discriminator && (
												<T
													role="kicker"
													tone="secondary"
													style={styles.codeHandle}
												>
													{handle}
												</T>
											)}
											<Tag
												label={isVip ? "SLOP CLUB" : "FREE RANGE"}
												tone={isVip ? "sun" : "paper"}
												style={styles.memberTag}
											/>
										</View>
									</View>

									{/* Identity-card band — 3-col cluster inside the card.
									    Divided by 1px ink-mute verticals + a dashed top
									    border. Lifetime figures live HERE (the standalone
									    "long story" card was folded in 2026-07-17); tapping
									    the band opens the full long-story ledger sheet. */}
									<Sticker
										color="rose"
										rotate={0}
										border={0}
										shadow="none"
										radius={RADII.md}
										onPress={openLongStory}
										accessibilityLabel="Your lifetime story"
										accessibilityHint="Opens the full lifetime ledger"
										style={styles.lifetimeStatsRow}
									>
										<Stat
											label="lifetime tickles"
											value={lifetimeTickles(
												ticklesLifetimeBase,
												ticklesEarned
											).toLocaleString()}
											style={styles.lifetimeStatCol}
										/>
										<View style={styles.lifetimeStatDivider} />
										<Stat
											label="active days"
											value={activeDays.toLocaleString()}
											style={styles.lifetimeStatCol}
										/>
										<View style={styles.lifetimeStatDivider} />
										<Stat
											label="joined"
											value={joinedLabel}
											style={styles.lifetimeStatCol}
										/>
									</Sticker>
								</Sticker>
							</View>

							<WallowWall
								count={visibleWallowCount}
								regenSeconds={visibleRegenSeconds}
								previewing={__DEV__ && devWallowPreview}
								onTogglePreview={__DEV__ ? () => setDevWallowPreview((shown) => !shown) : undefined}
							/>

							{/* The achievements grid sits with the progress surfaces
							    (above the membership card), not down in Settings. [E18] */}
							<NavRow
								icon="trophy"
								label="Achievements"
								sub="Track your devotion, generous + greedy ladders."
								badge={
									unclaimedAchv > 0 ? (
										<Tag
											label={unclaimedAchv > 99 ? "99+" : String(unclaimedAchv)}
											tone="sun"
											accessibilityLabel={`${unclaimedAchv} ready to claim`}
										/>
									) : undefined
								}
								onPress={() => router.push("/achievements")}
								accessibilityHint="Opens the achievements grid"
							/>

							{/* Slop Club membership card — perks, Join CTA (→ RevenueCat
							    hosted paywall for plan/price), fine-print. */}
							{IAP_ENABLED && (
								<Sticker
									color="slopBand"
									rotate={TILT.card}
									radius={RADII.xl}
									pad
									style={styles.slopWrap}
								>
									<Ribbon
										label={isVip ? "ACTIVE" : "ONE FRIEND"}
										tone={isVip ? "slopGold" : "sun"}
									/>
									<View style={styles.slopHeader}>
										<CardTitle>Slop Club</CardTitle>
										<KickerPill star={false} tone="secondary">
											membership
										</KickerPill>
									</View>

									<View style={styles.slopHero}>
										<View style={styles.slopPigPair} accessibilityElementsHidden>
											<View style={styles.slopPigRosie}>
												<PigPortrait pigId="rosie" size={PORTRAIT_SIZE} />
											</View>
											<View style={styles.slopPigFriend}>
												<PigPortrait pigId="bandit" size={PORTRAIT_SIZE} />
											</View>
										</View>
										<View style={styles.slopHeroCopy}>
											<CardTitle>
												{isVip ? "Rosie has company." : "Give Rosie a friend."}
											</CardTitle>
											<Hand style={styles.slopTagline}>
												{hasReferralOnlySlopClub
													? `Your companion access is active through ${referralGrantDateLabel}.`
													: "Choose one long-term companion in the Pen, then decide who greets you at home."}
											</Hand>
										</View>
									</View>

									<View style={styles.slopSeasonRow}>
										<Image
											source={require("@/assets/images/perks/members_drops.png")}
											style={styles.slopSeasonArt}
											resizeMode="contain"
											accessible={false}
										/>
										<View style={styles.slopSeasonCopy}>
											<KickerPill star={false} tone="secondary">
												Also included
											</KickerPill>
											<T role="cardTitleSm">Premium season collectibles</T>
											<Hand>
												Earn cosmetic rewards as you play—never a gameplay advantage.
											</Hand>
										</View>
									</View>

									{isVip ? (
										<>
											<Button
												variant="ghost"
												full
												style={styles.slopBtn}
												onPress={() => router.push("/(tabs)/shop?view=pen" as Href)}
												accessibilityLabel="Visit the Pen"
												accessibilityHint="Opens the Pen, where you choose your companion"
											>
												Visit the Pen
											</Button>
											{!hasReferralOnlySlopClub ? (
												<Button
													variant="link"
													size="sm"
													full
													onPress={handleManage}
													accessibilityLabel="Manage subscription"
													accessibilityHint="Opens the App Store subscription settings"
												>
													Manage subscription
												</Button>
											) : (
												<BodySm align="center" style={styles.slopGrantFinePrint}>
													No subscription needed. You won’t be charged.
												</BodySm>
											)}
										</>
									) : (
										<Button
											variant="gold"
											full
											style={styles.slopBtn}
											onPress={handleUnlockPro}
											loading={busy}
											accessibilityLabel="Join the Slop Club"
											accessibilityHint="Opens the subscription plans and prices"
										>
											Join the Slop Club
										</Button>
									)}

									{!isVip && (
										<BodySm
											tone="secondary"
											align="center"
											style={styles.slopFinePrint}
										>
											Auto-renews. Cancel anytime in Settings.
										</BodySm>
									)}
									{/* Terms + Privacy on the purchase surface — Apple review
									    expects both linked where a subscription is sold. Ink,
									    not an opacity crush, and a full 44pt target. [E4] */}
									{!isVip && (
										<View style={styles.slopLegal}>
											<Button
												variant="link"
												size="sm"
												onPress={() =>
													Linking.openURL("https://ticklethepig.com/terms")
												}
												accessibilityLabel="Terms of service"
												accessibilityHint="Opens ticklethepig.com/terms in your browser"
											>
												Terms
											</Button>
											<BodySm tone="secondary">·</BodySm>
											<Button
												variant="link"
												size="sm"
												onPress={() =>
													Linking.openURL("https://ticklethepig.com/privacy")
												}
												accessibilityLabel="Privacy policy"
												accessibilityHint="Opens ticklethepig.com/privacy in your browser"
											>
												Privacy
											</Button>
										</View>
									)}
								</Sticker>
							)}

							{/* Refer friends — code-based invite card. Drops between
							    Slop Club and Settings per docs/referrals.md. Shows
							    the player's persistent referral code + Copy + Share +
							    a milestone progress bar toward the Messenger Hat. */}
							{referral?.code && (
								<Sticker
									color="rose"
									rotate={TILT.card}
									radius={RADII.xl}
									pad
								>
									<Kicker>referrals</Kicker>
									<CardTitle>Invite new pigs</CardTitle>
									<BodySm tone="secondary" style={styles.referralIntro}>
										Share your code with a new player. When they join and play, you both earn rewards.
									</BodySm>
									<Hand tone="secondary">Your referral code</Hand>
									<View style={styles.codePill}>
										<T role="sectionTitle" style={styles.codePillValue}>
											{referral.code}
										</T>
										<Button
											variant="ghost"
											size="sm"
											icon={
												<Icon
													name={referralCodeCopied ? "check" : "copy"}
													size={LABEL_MARK}
													color={UI_COLORS.textPrimary}
													strokeWidth={2.2}
												/>
											}
											onPress={handleCopyReferralCode}
											accessibilityLabel={
												referralCodeCopied
													? "Referral code copied"
													: "Copy your referral code"
											}
											accessibilityHint="Copies your referral code to the clipboard"
										>
											{referralCodeCopied ? "Copied" : "Copy"}
										</Button>
									</View>
									<Button
										variant="lilac"
										full
										style={styles.referralShare}
										onPress={handleShareReferral}
										accessibilityLabel="Share your referral code"
										accessibilityHint="Opens the share sheet with your invite message"
									>
										Share your referral code
									</Button>
									<ReferralMilestoneRow
										completed={referral.referrals_completed}
										goal={referral.next_milestone_at ?? 3}
										capped={referral.next_milestone_at == null}
									/>

									{/* Recruiter standing. The backing RPC/route keep their
									    legacy names, but player-facing language stays firmly
									    in the referral model; Sounder means the eight-pig crew. */}
									{recruiterStats && (
										<View style={styles.downlineStrip}>
											<View style={styles.downlineTextCol}>
												<BodySm>
													{recruiterStats.engaged_count} completed{" "}
													{recruiterStats.engaged_count === 1 ? "referral" : "referrals"}
												</BodySm>
												{recruiterStats.next_title && recruiterStats.next_threshold !== null && (
													<Hand tone="secondary">
														{recruiterStats.next_threshold - recruiterStats.engaged_count} more to
														unlock{" "}
														<T role="hand" tone="accent">
															{recruiterStats.next_title}
														</T>
													</Hand>
												)}
											</View>
											<Button
												variant="handLink"
												size="sm"
												onPress={() => router.push("/recruits" as Href)}
												accessibilityLabel="Referral board"
												accessibilityHint="Opens Your Recruits"
											>
												referral board →
											</Button>
										</View>
									)}
									{/* Recent referrals + how close each is to counting
									    (100 tickles). Replaces the bare
									    "{N} on the way" aggregate. */}
									{(referral.recent_friends ?? []).length > 0 && (
										<View style={styles.friendList}>
											<Label tone="secondary">Recent referrals</Label>
											{(referral.recent_friends ?? []).slice(0, 3).map((f, i) => (
												<ReferralFriendRow key={(f.username ?? "pig") + i} friend={f} />
											))}
										</View>
									)}

									{/* Full referral progress + reward ladder. */}
									{(referral.referrals_completed > 0 ||
										referral.referrals_pending > 0) && (
										<Button
											variant="handLink"
											size="sm"
											onPress={() => router.push("/recruits-progress" as Href)}
											accessibilityLabel="Referral details and rewards"
											accessibilityHint="Opens Referral Rewards"
										>
											Referral details + rewards ›
										</Button>
									)}

									<BodySm style={styles.referralFine}>
										Each completed referral earns you 100 tickles.
									</BodySm>
									<Hand tone="secondary">
										A referral counts as soon as the new player reaches 100 tickles.
									</Hand>

									{/* Have a code? — redeem a friend's referral code right
									    here. Shown only to accounts the server would actually
									    let redeem: never-redeemed AND < 24h old AND
									    < 5 tickles (canRedeemCode mirrors the server
									    gate). An old/active account never sees a box it
									    can't use; a genuinely-eligible new player still
									    gets specific refusal copy on any edge case. */}
									{canRedeemCode && (
										<View style={styles.haveWrap}>
											<View style={styles.haveDivider} />
											<Body style={styles.haveLabel}>
												Got a friend&apos;s referral code?
											</Body>
											<TextField
												label="Friend's referral code"
												labelHidden
												variant="code"
												value={codeInput}
												onChangeText={(t) => {
													setCodeInput(t.toUpperCase());
													if (codeError) setCodeError(null);
												}}
												placeholder="PIGGY-1234"
												autoCapitalize="characters"
												autoCorrect={false}
												maxLength={10}
												editable={!codeBusy}
												state={codeError ? "error" : "default"}
												errorText={codeError ?? undefined}
											/>
											<Button
												variant="ghost"
												full
												style={styles.applyBtn}
												onPress={handleApplyCode}
												disabled={!codeInput.trim()}
												loading={codeBusy}
												accessibilityLabel="Apply this referral code"
												accessibilityHint="Credits your friend and pays you 50 snouts"
											>
												Apply
											</Button>
										</View>
									)}
									{codeInviter && (
										<View style={styles.successRow}>
											<BodySm tone="success">
												You&apos;re in — thanks to {codeInviter}! +50
											</BodySm>
											<Image
												source={require("@/assets/images/emoji/pig.png")}
												style={styles.successPig}
												resizeMode="contain"
												accessible={false}
											/>
										</View>
									)}
								</Sticker>
							)}

							{/* Settings — three groups, not eight flat rows: what's
							    yours, what you've bought, and the two ways out. [E25] */}
							<View style={styles.settingsWrap}>
								<SectionHeader kicker="settings" title="Settings" />
								<View style={styles.settingsGroup}>
									<NavRow
										icon="edit"
										label="Change your name"
										onPress={openRename}
										accessibilityHint="Opens the rename dialog and its cost"
									/>
									<NavRow
										icon="lock"
										label="Blocked users"
										onPress={() => setBlockedUsersOpen(true)}
										accessibilityHint="Opens the list of pigs you've blocked"
									/>
									<NavRow
										icon="scroll"
										label="What's new"
										onPress={() => setReleaseNotesOpen(true)}
										accessibilityHint="Opens the release notes"
									/>
									<NavRow
										icon="refresh"
										label="Barn introduction"
										onPress={() => showHabitatIntro(session.user.id)}
										accessibilityHint="Replays the barn introduction"
									/>
									{/* Report a bug / idea — the single quiet door into the
									    in-app Den whisper, grouped with the rest of "your
									    pig" rather than orphaned below the card. [E25] */}
									<NavRow
										icon="bell"
										label="Found a bug or have an idea? Report it"
										onPress={openFeedback}
										accessibilityHint="Opens the whisper dialog"
									/>
								</View>

								{IAP_ENABLED && (
									<View style={styles.settingsGroup}>
										<NavRow
											icon="refresh"
											label="Restore purchases"
											onPress={handleRestore}
											accessibilityHint="Re-checks this Apple ID for a Slop Club subscription"
										/>
									</View>
								)}

								<View style={styles.settingsGroup}>
									<NavRow
										icon="exit"
										label="Sign out"
										onPress={() => setSignOutOpen(true)}
										accessibilityHint="Asks before signing this device out"
									/>
									<NavRow
										icon="x"
										label="Delete account"
										tone="danger"
										onPress={() => setDeleteOpen(true)}
										accessibilityHint="Asks before permanently erasing your account"
									/>
								</View>

								<Hand tone="secondary" align="center" style={styles.footer}>
									★ tickle the pig · v{Constants.expoConfig?.version ?? "1.0.0"} ★
								</Hand>
							</View>
						</>
					)}
				</ScrollView>
			</SafeAreaView>

			<ReleaseNotesModal
				visible={releaseNotesOpen}
				onClose={() => setReleaseNotesOpen(false)}
			/>
			<BlockedUsersSheet
				visible={blockedUsersOpen}
				blockerId={session.user.id}
				onClose={() => setBlockedUsersOpen(false)}
			/>
			{/* Leaving should ask as warmly as arriving did. [E6] */}
			<ConfirmDialog
				open={signOutOpen}
				title="Sign out of the barn?"
				body="Rosie will be here when you get back."
				confirmLabel="Sign out"
				cancelLabel="Stay"
				confirmHint="Signs this device out and stops its notifications"
				cancelHint="Keeps you signed in"
				onCancel={() => setSignOutOpen(false)}
				onConfirm={handleSignOut}
			/>
			<ConfirmDialog
				open={deleteOpen}
				title="Delete your account?"
				body="This wipes your username, friends, trades, blessings/curses, owned items, season progress, and achievements. Permanent — no undo. The account is also signed out."
				confirmLabel="Delete"
				cancelLabel="Keep account"
				tone="destructive"
				confirmHint="Erases your account and everything in it. This cannot be undone."
				cancelHint="Keeps your account exactly as it is"
				busy={deleting}
				onCancel={() => setDeleteOpen(false)}
				onConfirm={async () => {
					if (deleting) return;
					setDeleting(true);
					// Sign the device out whatever the delete returned — a half-failed
					// delete must never strand the player inside the account they just
					// asked us to destroy. (rpc() never rejects; it resolves null.)
					await rpc("delete_my_account");
					await clearPushToken();
					await supabase.auth.signOut();
					setDeleting(false);
					setDeleteOpen(false);
				}}
			/>
			{/* __DEV__ only: no RevenueCat offering configured, so offer the
			    local unlock. Gated at the call site — a production build never
			    sets devUnlockOpen. */}
			<ConfirmDialog
				open={devUnlockOpen}
				title="Slop Club"
				body="Storefront not configured yet (need ASC products + RC offering/paywall). Unlock for free in dev?"
				confirmLabel="Unlock (dev)"
				confirmHint="Flips is_vip locally for this development build"
				onCancel={() => setDevUnlockOpen(false)}
				onConfirm={async () => {
					setDevUnlockOpen(false);
					await rpc("dev_set_vip", { target: true });
					setIsVip(true);
				}}
			/>

			{/* Paid rename dialog — the shared dialog shell (safe-area sizing, a
			    scroll path at 200% type, the a11y modal flags) rather than a
			    fourth hand-rolled backdrop. [E12] */}
			<AdaptiveModalScaffold
				visible={renameOpen}
				onRequestClose={() => {
					if (!renameBusy) setRenameOpen(false);
				}}
				bare
				keyboardAware
				dismissOnBackdrop
				contentContainerStyle={styles.dialogContent}
			>
				<Sticker
					color="paper"
					rotate={TILT.dialog}
					radius={RADII.xl}
					pad
					style={styles.dialogCard}
				>
					<CardTitle align="center" accessibilityRole="header">
						Change your name
					</CardTitle>
					<Hand tone="secondary" align="center" style={styles.dialogSub}>
						{renameCostCopy}
					</Hand>
					<TextField
						label="New name"
						labelHidden
						value={renameInput}
						onChangeText={(t) => {
							setRenameInput(t);
							if (renameError) setRenameError(null);
						}}
						placeholder="3–24 characters"
						autoCapitalize="none"
						autoCorrect={false}
						maxLength={24}
						editable={!renameBusy}
						state={renameError ? "error" : "default"}
						errorText={renameError ?? undefined}
					/>
					<View style={styles.dialogButtons}>
						<DialogButtonRow
							confirmLabel="Save"
							cancelLabel="Cancel"
							busy={renameBusy}
							onConfirm={handleRename}
							onCancel={() => setRenameOpen(false)}
							confirmHint={
								renameCost === 0
									? "Renames you for free"
									: `Spends ${renameCost.toLocaleString()} snouts and renames you`
							}
						/>
					</View>
				</Sticker>
			</AdaptiveModalScaffold>

			{/* "Send an idea to the den" — the whisper dialog. A 3-way kind picker
			    (Chips), a note, and a "whisper it" commit. On success the body
			    swaps to a one-beat confirmation that auto-dismisses. */}
			<AdaptiveModalScaffold
				visible={feedbackOpen}
				onRequestClose={() => {
					if (!feedbackBusy) setFeedbackOpen(false);
				}}
				bare
				keyboardAware
				dismissOnBackdrop
				contentContainerStyle={styles.dialogContent}
			>
				<Sticker
					color="paper"
					rotate={TILT.dialog}
					radius={RADII.xl}
					pad
					style={styles.dialogCard}
				>
					{feedbackSent ? (
						// One-beat confirmation — auto-dismisses (~1.5s) or a backdrop tap.
						<CardTitle align="center" style={styles.sentText}>
							the bog heard you. thank you for the whisper.
						</CardTitle>
					) : (
						<>
							<CardTitle align="center" accessibilityRole="header">
								send an idea to the den
							</CardTitle>
							<View style={styles.chipRow}>
								{(
									[
										["idea", "an idea"],
										["bug", "something's broken"],
										["love", "a love note"],
									] as [FeedbackKind, string][]
								).map(([k, label]) => (
									<Chip
										key={k}
										label={label}
										tone="lilac"
										selected={feedbackKind === k}
										disabled={feedbackBusy}
										onPress={() => setFeedbackKind(k)}
										accessibilityHint="Picks what kind of whisper this is"
									/>
								))}
							</View>
							<TextField
								label="Your whisper"
								labelHidden
								value={feedbackInput}
								onChangeText={(t) => {
									setFeedbackInput(t);
									if (feedbackError) setFeedbackError(null);
								}}
								placeholder="what should the bog know?"
								multiline
								rows={4}
								maxLength={1000}
								editable={!feedbackBusy}
								state={feedbackError ? "error" : "default"}
								errorText={feedbackError ?? undefined}
							/>
							<View style={styles.dialogButtons}>
								<DialogButtonRow
									confirmLabel="whisper it"
									cancelLabel="Cancel"
									busy={feedbackBusy}
									onConfirm={handleFeedback}
									onCancel={() => setFeedbackOpen(false)}
									confirmHint="Sends this note to the den"
								/>
							</View>
						</>
					)}
				</Sticker>
			</AdaptiveModalScaffold>

			{/* The long story — full lifetime ledger. The shared bottom-sheet
			    panel, which gives the list its own scroll path and retires the
			    hardcoded 380pt cap. [E12] */}
			<Sheet
				open={longStoryOpen}
				onClose={() => setLongStoryOpen(false)}
				kicker="the long story"
				title="all you've done"
			>
				<LedgerRow
					label="lifetime tickles"
					value={lifetimeTickles(
						ticklesLifetimeBase,
						ticklesEarned
					).toLocaleString()}
				/>
				<LedgerRow label="tickles wasted" value={ticklesWasted.toLocaleString()} />
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

				<View style={styles.ledgerDivider} />

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
			</Sheet>
		</View>
	);
}

// One recent referred friend on the Account card: name + progress toward
// counting (tickles/100), or a "counted" tag once complete.
function ReferralFriendRow({ friend }: { friend: ReferralFriend }) {
	const done = !!friend.completed;
	const name = friend.username ?? "a new pig";
	return (
		<View style={styles.friendRow}>
			<View style={styles.friendTop}>
				<BodySm numberOfLines={1} style={styles.friendName}>
					{name}
				</BodySm>
				{done ? (
					<Tag label="counted" icon="check" tone="sage" />
				) : (
					<Hand tone="secondary">
						{friend.tickles}/{REFERRAL_TICKLE_GOAL} tickles
					</Hand>
				)}
			</View>
			{!done && (
				<ProgressTrack
					value={friend.tickles}
					max={REFERRAL_TICKLE_GOAL}
					tone="lilac"
					height="sm"
					accessibilityLabel={`${name}'s progress toward counting`}
				/>
			)}
		</View>
	);
}

// Milestone progress row for the "Refer friends" card. Renders the
// "Completed referrals: N / 3" line + the meter + a "Rewards earned" tag
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
	// The bar tracks whichever ladder rung is next (3/5/10/25/100/500/1000).
	const reward = rewardNameForMilestone(goal);
	const max = capped ? Math.max(completed, 1) : goal;
	const value = capped ? max : completed;
	return (
		<View style={styles.milestoneWrap}>
			<View style={styles.milestoneHeader}>
				<Label>
					Completed referrals: {completed} / {capped ? completed : goal}
				</Label>
				{capped && <Tag label="Rewards earned" icon="check" tone="sage" />}
			</View>
			<ProgressTrack
				value={value}
				max={max}
				tone="sun"
				height="sm"
				accessibilityLabel="Completed referrals"
			/>
			{!capped && (
				<Hand tone="secondary" style={styles.milestoneFoot}>
					{goal - completed} more for {reward}
				</Hand>
			)}
		</View>
	);
}

// One "label · value" line in the long-story ledger sheet. Dashed bottom
// divider unless it's the last row.
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
		<View style={[styles.ledgerRow, !last && styles.ledgerRowDivider]}>
			<Body style={styles.ledgerLabel}>{label}</Body>
			<T role="numeral">{value}</T>
		</View>
	);
}

function formatRegenInterval(seconds: number): string {
	const safe = Math.max(60, Math.round(seconds));
	if (safe % 3600 === 0) return `${safe / 3600}h`;
	if (safe >= 3600) return `${Math.floor(safe / 3600)}h ${Math.round((safe % 3600) / 60)}m`;
	return `${Math.round(safe / 60)}m`;
}

function WallowWall({
	count,
	regenSeconds,
	previewing,
	onTogglePreview,
}: {
	count: number;
	regenSeconds: number;
	previewing: boolean;
	onTogglePreview?: () => void;
}) {
	const rank = Math.max(0, Math.floor(count));
	const nextRank = rank + 1;
	const currentBaseInterval = formatRegenInterval(compiledWallowRegenSeconds(rank));
	const nextBaseInterval = formatRegenInterval(compiledWallowRegenSeconds(nextRank));
	const currentVisitHours = wallowVisitCooldownHours(rank);
	const nextVisitHours = wallowVisitCooldownHours(nextRank);
	return (
		<View style={wallowWallStyles.wrap}>
			<SectionHeader
				kicker="your prestige"
				title="Wallow rank"
				right={
					onTogglePreview ? (
						<Chip
							label={previewing ? "W5 preview" : "Preview W5"}
							icon="flame"
							tone={previewing ? "sun" : "paper"}
							selected={previewing}
							onPress={onTogglePreview}
							accessibilityLabel="Preview Wallow rank 5"
							accessibilityHint="Shows what rank 5 would look like"
						/>
					) : undefined
				}
			/>
			<Sticker color="paper" rotate={0.4} radius={RADII.xl} pad style={wallowWallStyles.card}>
				<View style={wallowWallStyles.currentRow}>
					<View style={wallowWallStyles.currentDecal}>
						<T role="cardTitle">W{rank}</T>
					</View>
					<View style={wallowWallStyles.currentCopy}>
						<T role="kickerPill" tone="accent">CURRENT</T>
						<T role="cardTitleSm">{wallowRankLabel(rank)}</T>
						<BodySm tone="secondary">
							1 tickle / {formatRegenInterval(regenSeconds)} · visits every {currentVisitHours}h
						</BodySm>
					</View>
				</View>

				<View style={wallowWallStyles.stepConnector}>
					<View style={wallowWallStyles.stepConnectorLine} />
					<Icon name="chevronDown" size={LABEL_MARK} color={UI_COLORS.uiMuted} strokeWidth={2.4} />
				</View>

				<View style={wallowWallStyles.nextStep}>
					<View style={wallowWallStyles.nextHeading}>
						<View>
							<T role="kickerPill" tone="accent">NEXT WALLOW</T>
							<T role="cardTitleSm">Reach W{nextRank}</T>
						</View>
						<View style={wallowWallStyles.nextDecal}>
							<T role="cardTitleSm">W{nextRank}</T>
						</View>
					</View>
					<View style={wallowWallStyles.deltaRow}>
						<BodySm tone="secondary">Tickle refill</BodySm>
						<BodySm>
							{currentBaseInterval} → {nextBaseInterval}
						</BodySm>
					</View>
					<View style={wallowWallStyles.deltaRow}>
						<BodySm tone="secondary">Friend visits</BodySm>
						<BodySm>
							{currentVisitHours}h → {nextVisitHours}h
						</BodySm>
					</View>
					<Hand tone="accent" style={wallowWallStyles.unlockLine}>
						+ exclusive W{nextRank} wearable
					</Hand>
				</View>
				<Button
					variant="ghost"
					full
					style={wallowWallStyles.gearLink}
					icon={<Glyph name="crown" size={LABEL_MARK} />}
					onPress={() =>
						router.push({
							pathname: "/(tabs)/shop",
							params: { view: "wardrobe", filter: "prestige" },
						})
					}
					accessibilityLabel={`Prestige gear, ${rank} earned`}
					accessibilityHint="Opens the wardrobe filtered to prestige gear"
				>
					prestige gear · {rank} earned ›
				</Button>
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: UI_COLORS.surfaceMuted },
	safe: { flex: 1 },
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: PAGE_PAD,
		paddingBottom: TAB_SAFE,
		gap: SPACE.lg,
	},
	// The crown carries its own PAGE_PAD; the scroll already pads its sides.
	crown: { paddingHorizontal: 0, paddingTop: 0 },
	codeWrap: {
		position: "relative",
		paddingTop: SPACE.md,
	},
	codeTape: {
		position: "absolute",
		top: 0,
		left: SPACE.xxl,
		zIndex: 2,
	},
	codeRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	codeCol: { flex: 1, minWidth: 0, marginLeft: SPACE.md },
	codeHandle: { marginTop: SPACE.xxs },
	// Membership capsule under the handle — gold for Slop Club members, quiet
	// paper for free-range pigs. Status, not a sales pitch.
	memberTag: { alignSelf: "flex-start", marginTop: SPACE.xs },
	// 3-col lifetime-stats band inside the identity card. Dashed top border
	// separates it from the avatar/handle; inner hairline verticals divide the
	// three columns. Tapping it opens the long-story ledger.
	lifetimeStatsRow: {
		flexDirection: "row",
		alignItems: "stretch",
		marginTop: SPACE.card,
		paddingTop: SPACE.md,
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	lifetimeStatCol: { flex: 1, justifyContent: "center" },
	lifetimeStatDivider: {
		width: 1,
		backgroundColor: UI_COLORS.uiMuted,
		marginVertical: SPACE.xs,
	},
	// ── Slop Club membership card ──────────────────────────────────
	// The Ribbon crosses the corner, so the card clips.
	slopWrap: { overflow: "hidden" },
	slopHeader: { gap: SPACE.xxs },
	slopHero: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.md,
	},
	slopPigPair: {
		width: SLOP_PAIR_W,
		height: SLOP_PAIR_H,
		position: "relative",
		flexShrink: 0,
	},
	slopPigRosie: {
		position: "absolute",
		left: 0,
		top: SPACE.sm,
		transform: [{ rotate: "-3deg" }],
	},
	slopPigFriend: {
		position: "absolute",
		right: 0,
		top: 0,
		transform: [{ rotate: "3deg" }],
	},
	slopHeroCopy: { flex: 1, minWidth: 0 },
	slopTagline: { marginTop: SPACE.xs },
	slopSeasonRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.md,
		paddingTop: SPACE.md,
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.border,
	},
	slopSeasonArt: { width: ART_SIZE.glyph, height: ART_SIZE.glyph },
	slopSeasonCopy: { flex: 1, minWidth: 0 },
	slopBtn: { marginTop: SPACE.card },
	slopGrantFinePrint: { marginTop: SPACE.card },
	slopLegal: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
	},
	slopFinePrint: { marginTop: SPACE.sm },
	// ── Refer friends card ─────────────────────────────────────────
	referralIntro: { marginTop: SPACE.xs, marginBottom: SPACE.card },
	codePill: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.xs,
		backgroundColor: UI_COLORS.surface,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.md,
		paddingLeft: SPACE.md,
		paddingRight: SPACE.xs,
		paddingVertical: SPACE.xs,
	},
	codePillValue: { flex: 1, letterSpacing: CODE_TRACKING },
	referralShare: { marginTop: SPACE.md, marginBottom: SPACE.card },
	referralFine: { marginTop: SPACE.xs },
	milestoneWrap: { marginBottom: SPACE.md },
	milestoneHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: SPACE.sm,
		marginBottom: SPACE.sm,
	},
	milestoneFoot: { marginTop: SPACE.xs },
	friendList: { marginTop: SPACE.md, gap: SPACE.sm },
	friendRow: { gap: SPACE.xs },
	friendTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	friendName: { flex: 1, minWidth: 0 },
	// Recruiter-standing strip — a quiet dashed-top-divided row: count +
	// next-title on the left, board link on the right.
	downlineStrip: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.md,
		marginBottom: SPACE.md,
		paddingTop: SPACE.sm,
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	downlineTextCol: { flex: 1, minWidth: 0 },
	haveWrap: { marginTop: SPACE.sm, gap: SPACE.sm },
	haveDivider: {
		borderBottomWidth: BORDER.thin,
		borderColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	haveLabel: { marginTop: SPACE.xs },
	applyBtn: { marginTop: SPACE.xs },
	successRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
	},
	successPig: { width: ART_SIZE.mark, height: ART_SIZE.mark },
	// ── Settings ───────────────────────────────────────────────────
	settingsWrap: { gap: SPACE.md },
	settingsGroup: { gap: SPACE.sm },
	footer: { marginTop: SPACE.md },
	// ── Dialog shells ──────────────────────────────────────────────
	// The sticker tilts and wears the hard shadow; give both room inside the
	// bare scaffold frame.
	dialogContent: { padding: SPACE.sm },
	dialogCard: { gap: SPACE.sm },
	dialogSub: { marginBottom: SPACE.xs },
	dialogButtons: { alignSelf: "stretch", marginTop: SPACE.sm },
	chipRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.sm,
		justifyContent: "center",
	},
	sentText: { paddingVertical: SPACE.md },
	// ── Long-story ledger ──────────────────────────────────────────
	ledgerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.md,
		paddingVertical: SPACE.md,
	},
	ledgerRowDivider: {
		borderBottomWidth: BORDER.thin,
		borderBottomColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	ledgerLabel: { flex: 1, minWidth: 0 },
	ledgerDivider: {
		height: BORDER.thin,
		backgroundColor: UI_COLORS.uiMuted,
		marginVertical: SPACE.sm,
	},
});

const wallowWallStyles = StyleSheet.create({
	wrap: { gap: SPACE.sm },
	card: { overflow: "hidden" },
	currentRow: {
		minHeight: RANK_DECAL,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	currentDecal: {
		width: RANK_DECAL,
		height: RANK_DECAL,
		borderRadius: RADII.lg,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: "-2deg" }],
	},
	currentCopy: { flex: 1, minWidth: 0 },
	stepConnector: {
		width: RANK_DECAL,
		height: STEP_DROP,
		alignItems: "center",
		justifyContent: "flex-end",
	},
	stepConnectorLine: {
		position: "absolute",
		top: 0,
		bottom: SPACE.sm,
		width: BORDER.ink,
		backgroundColor: UI_COLORS.uiMuted,
	},
	nextStep: {
		borderRadius: RADII.md,
		backgroundColor: UI_COLORS.surfaceMuted,
		padding: SPACE.md,
		gap: SPACE.xs,
	},
	nextHeading: {
		minHeight: TAP_MIN,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	nextDecal: {
		minWidth: TAP_MIN,
		height: TAP_MIN,
		paddingHorizontal: SPACE.xs,
		borderRadius: RADII.md,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		alignItems: "center",
		justifyContent: "center",
	},
	deltaRow: {
		minHeight: SPACE.xl,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	unlockLine: { marginTop: SPACE.xs },
	gearLink: { marginTop: SPACE.md },
});
