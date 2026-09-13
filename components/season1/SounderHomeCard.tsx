// The Season-1 Sounder home — one compact card that replaces the old stepper +
// herd-presence + herd-milestones stack. Two states, driven by real crew state:
//
//   CREWLESS → the join-first door (incoming invites, then open Sounders, then a
//              found-your-own fallback). Joining is the season's first verb.
//   CREWED   → roster (every member as their pig, lit when they've dug this
//              feeding) · the play/cooldown line · a quiet milestone line.
//
// The game's explanation lives entirely in the guide dialog now; the "how it
// works ›" link into it, and leaving your Sounder, both live outside this card
// (the link sits in the "your sounder" SectionHeader in season.tsx; leaving is
// in the dialog's footer). The Sounder name is that SectionHeader — this card
// starts at the roster.

import { useCallback, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import {
	Avatar,
	BodySm,
	Button,
	CardTitle,
	Glyph,
	Hand,
	Kicker,
	KickerPill,
	ListRow,
	LoadingBeat,
	ProfileIdentity,
	ProgressTrack,
	SectionTitle,
	Sticker,
	Tag,
} from "@/components/ui";
import { CrewPortrait } from "../ui";
import { JoinableSounders } from "../JoinableSounders";
import type { FeedingCta } from "../mudwar/useFeedingCta";
import { NotifyChip, BurrowBookLink } from "./GuardedCtaExtras";
import { useRosterProfiles } from "@/hooks/useRosterHats";
import { useJoinableCrews, type UseCrew } from "@/hooks/useCrew";
import {
	fetchFeedingState,
	milestoneProgress,
	type FeedingState,
} from "@/utils/dig";
import { patchCtaLabel } from "@/utils/rooting";
import { fetchRaceCrewDetail, type RaceCrewDetail } from "@/utils/race";
import { CREW_CAP_WORD } from "@/constants/crews";
import { RACE_TRUFFLE_TABLE } from "@/constants/dig";
import {
	AVATAR_SIZE,
	RADII,
	SPACE,
	TILT,
	WHIMSY,
} from "@/constants/theme";

// The roster's pig portrait and the column it sits in — drawing geometry for a
// wrap grid of snouts, not steps on the spacing scale.
const AVATAR = 44;
const MEMBER_COL = 72;
// Inline marks: the "you dug" sparkle on a portrait, the bullet beside a benefit.
const SPARKLE_MARK = 16;
const SPARKLE_OFFSET = -SPACE.xxs;
const BENEFIT_MARK = 16;

export function SounderHomeCard({
	crewHook,
	uid,
	cta,
	refreshKey,
	showFeedingAction = true,
	hero = false,
}: {
	crewHook: UseCrew;
	/** The caller's own user id — lights their pig in the roster when they've dug. */
	uid: string | null;
	/**
	 * The season tab's ONE shared feeding CTA (owner mounts the hook + renders
	 * cta.modal once) — every dig surface reads the same session/dug state, so
	 * two buttons can never disagree about this feeding.
	 */
	cta: FeedingCta;
	/** Bumped after a dig so the roster's "who dug this feeding" re-reads. */
	refreshKey?: number;
	/** Hide the inline action when its prominent form is rendered above this card. */
	showFeedingAction?: boolean;
	/**
	 * The one-hero rule (C-26): this card holds the tab's `primaryAction`, so its
	 * CTA may wear the loud voice — the sun fill and the gold Button. The owner
	 * (`season.tsx`) derives it once; a card never decides it from its own state.
	 * Off, the same control keeps its shape and words in the quiet `lilac`.
	 */
	hero?: boolean;
}) {
	const { crew } = crewHook;

	if (crew.crew) {
		return (
			<Sticker color="paper" rotate={TILT.card} radius={RADII.lg} style={styles.card}>
				<CrewedHome
					crewHook={crewHook}
					uid={uid}
					cta={cta}
					refreshKey={refreshKey}
					showFeedingAction={showFeedingAction}
					hero={hero}
				/>
			</Sticker>
		);
	}

	// Still resolving the very first crew read — a cozy beat, not a join-door flash.
	if (
		crewHook.loading &&
		crew.invitesIn.length === 0 &&
		crew.invitesOut.length === 0
	) {
		return (
			<View style={styles.loadingWrap}>
				<LoadingBeat label="finding your herd" />
			</View>
		);
	}

	return (
		<Sticker color="paper" rotate={-0.5} radius={RADII.lg} style={styles.card}>
			<JoinDoor crewHook={crewHook} hero={hero} />
		</Sticker>
	);
}

/** One authoritative Feeding action, promoted above secondary systems on Season. */
export function FeedingAction({
	cta,
	prominent = false,
	hero = false,
}: {
	cta: FeedingCta;
	prominent?: boolean;
	/**
	 * Digging is the tab's `primaryAction` right now — wear the sun card and the
	 * gold Button. Off, the dig is still offered, just in the quiet voice, so
	 * whatever IS the primary action is the only thing shouting. [C-26]
	 */
	hero?: boolean;
}) {
	// A completed Feeding leaves the action surface entirely. The roster and
	// collection remain available; the window-stamped flag expires next Feeding.
	if (cta.dugThisWindow) return null;
	// A guarded patch keeps its quiet countdown until it becomes available.
	const digVariant = hero ? "gold" : "lilac";
	const content = (
		<View style={styles.playRow}>
			{prominent && (
				<>
					<KickerPill star={false} tone="accent" style={styles.feedingKicker}>
						this feeding
					</KickerPill>
					<SectionTitle accessibilityRole="header" style={styles.feedingTitle}>
						{cta.phaseOpen
							? "Dig for Golden Truffles"
							: "The Hungerer is guarding"}
					</SectionTitle>
					<BodySm style={styles.feedingReward}>
						Golden Truffles + relics · +20 Pass XP
					</BodySm>
					<BodySm tone="secondary" style={styles.feedingPromise}>
						{"Bring home a find to join the next 15-Truffle stage reward and your Sounder's Monday payout."}
					</BodySm>
				</>
			)}
			{cta.noCrew ? null : cta.phaseOpen ? (
				<>
					<Button
						size={prominent ? "lg" : "md"}
						variant={digVariant}
						full
						onPress={cta.start}
						accessibilityLabel="Dig the Truffle Patch"
						accessibilityHint={`The patch closes in ${cta.countdown}`}
					>
						{patchCtaLabel(true, cta.countdown)}
					</Button>
					<Kicker star={false} align="center" style={styles.digSub}>
						root the patch
					</Kicker>
					<Hand tone="secondary">the patch closes in {cta.countdown}</Hand>
				</>
			) : (
				<>
					{/* The resting dig CTA: a button asleep with its countdown on its
					    own face — the outline stays, nothing dissolves. [C-07] */}
					<Button
						size={prominent ? "lg" : "md"}
						variant="locked"
						full
						disabled
						accessibilityLabel={`The patch is guarded — ${patchCtaLabel(false, cta.countdown)}`}
						accessibilityHint="The Hungerer is digesting; the patch reopens when the countdown ends"
					>
						{patchCtaLabel(false, cta.countdown)}
					</Button>
					<NotifyChip />
				</>
			)}
			{!!cta.note && (
				<Hand tone="accent" style={styles.note}>
					{cta.note}
				</Hand>
			)}
			{__DEV__ && cta.startPractice && (
				<Button
					size="sm"
					variant="handLink"
					onPress={cta.startPractice}
					accessibilityLabel="Dev: start a practice dig"
					style={styles.devLink}
				>
					dev · practice dig ›
				</Button>
			)}
		</View>
	);

	if (!prominent) return content;

	return (
		<Sticker
			// The full sun highlight is the loudest sentence the tab can say, so it
			// is spent only on the derived primary action — an open patch that is
			// NOT the hero keeps the card and loses the shout. [C-26]
			color={hero && cta.phaseOpen && !cta.dugThisWindow ? "sun" : "cream"}
			rotate={TILT.card}
			radius={RADII.xl}
			style={styles.feedingCard}
		>
			{content}
		</Sticker>
	);
}

// ── CREWED — roster · play/cooldown · milestone ───────────────────────────────
function CrewedHome({
	crewHook,
	uid,
	cta,
	refreshKey,
	showFeedingAction,
	hero,
}: {
	crewHook: UseCrew;
	uid: string | null;
	cta: FeedingCta;
	refreshKey?: number;
	showFeedingAction: boolean;
	hero: boolean;
}) {
	const { crew } = crewHook;
	const members = crew.members;
	const profiles = useRosterProfiles(members.map((m) => m.user_id));

	// Who's dug THIS feeding — crewmates from crew_dug, plus the caller via `dug`.
	const [feeding, setFeeding] = useState<FeedingState | null>(null);
	useFocusEffect(
		useCallback(() => {
			let cancelled = false;
			fetchFeedingState().then((s) => {
				if (!cancelled) setFeeding(s);
			});
			return () => {
				cancelled = true;
			};
		}, [refreshKey])
	);

	const lit = new Set((feeding?.crew_dug ?? []).map((c) => c.user_id));
	if (feeding?.dug && uid) lit.add(uid);

	// Per-member contribution counts — dark (null) until the RPC is pushed, in
	// which case the roster renders exactly as before (no count lines).
	const crewId = crew.crew?.id ?? null;
	const [detail, setDetail] = useState<RaceCrewDetail | null>(null);
	useFocusEffect(
		useCallback(() => {
			if (!crewId) return;
			let cancelled = false;
			fetchRaceCrewDetail(crewId).then((d) => {
				if (!cancelled) setDetail(d);
			});
			return () => {
				cancelled = true;
			};
		}, [crewId, refreshKey])
	);
	const finds = new Map((detail?.members ?? []).map((mm) => [mm.user_id, mm.finds]));

	const m = milestoneProgress(crew.lifetime_finds);

	return (
		<>
			{showFeedingAction && <FeedingAction cta={cta} hero={hero} />}

			{/* Roster — every snout, lit when it's dug this feeding. */}
			<View style={styles.roster}>
				{members.map((mem) => {
					const isLit = lit.has(mem.user_id);
					return (
						<View key={mem.user_id} style={styles.memberCol}>
							<View style={styles.avatarWrap}>
								{isLit && <View style={styles.litRing} />}
								<CrewPortrait
									size={AVATAR}
									hatId={profiles.get(mem.user_id)?.hatId ?? null}
									bowId={profiles.get(mem.user_id)?.bowId ?? null}
									prestigeLevel={
										__DEV__ && mem.user_id === uid
											? 5
											: profiles.get(mem.user_id)?.wallowCount ?? 0
									}
								/>
								{isLit && (
									<Glyph name="sparkle" size={SPARKLE_MARK} style={styles.sparkle} />
								)}
							</View>
							<ProfileIdentity
								username={mem.username ?? "a pig"}
								title={profiles.get(mem.user_id)?.title}
								align="center"
								nameStyle={styles.memberName}
							/>
							{detail != null && (
								<Kicker star={false} tone="secondary" numberOfLines={1} style={styles.memberFinds}>
									{finds.get(mem.user_id) ?? 0}
									{(finds.get(mem.user_id) ?? 0) === 1 ? " find" : " finds"}
								</Kicker>
							)}
						</View>
					);
				})}
			</View>

			{/* cta.modal renders once at the owner (season.tsx), not here. */}

			{/* One quiet milestone line + thin bar — the shared meter, which
			    announces itself as a progressbar. [D-13] */}
			<View style={styles.milestone}>
				{!m.allDone && m.nextThreshold != null ? (
					<ProgressTrack
						value={m.lifetimeFinds}
						max={m.nextThreshold}
						tone="sun"
						height="sm"
						label={`finds to ${m.nextTitle}`}
						accessibilityLabel={`Herd milestone: ${m.lifetimeFinds} of ${m.nextThreshold} finds to ${m.nextTitle}`}
					/>
				) : (
					<Tag
						label={`every herd milestone earned — ${m.earnedTitle}`}
						tone="sage"
					/>
				)}
			</View>
			{/* Collection stays reachable with herd context, below the primary action. */}
			<BurrowBookLink />
		</>
	);
}

// ── CREWLESS — the join-first door (invites → open Sounders → found your own) ──
// The season's first verb is joining, so invites + the open-Sounder list lead
// and founding is the demoted fallback.
// The three concrete Sounder benefits, in the ladder-of-value order: dig deeper
// → milestones pay everyone → the weekly dig-off pays truffles. Every number is
// derived, never typed inline.
function SounderBenefits() {
	const lines = [
		"dig after a crewmate — get up to 5 more rubs",
		"herd milestones pay everyone — titles + snout purses",
		`weekly dig-off pays Golden Truffles — ${RACE_TRUFFLE_TABLE[1]} each for 1st`,
	];
	return (
		<View style={styles.benefits}>
			{lines.map((line) => (
				<View key={line} style={styles.benefitRow}>
					<Glyph name="gem" size={BENEFIT_MARK} />
					<BodySm style={styles.benefitText}>{line}</BodySm>
				</View>
			))}
		</View>
	);
}

function JoinDoor({ crewHook, hero }: { crewHook: UseCrew; hero: boolean }) {
	const invites = crewHook.crew.invitesIn;
	// Joining is the tab's primary action while you are herdless — the accept and
	// found buttons carry the gold then, and the quiet lilac when something else
	// (a ready reward) is the one thing to do. [C-26]
	const joinVariant = hero ? "gold" : "lilac";
	const joinable = useJoinableCrews();
	const [founding, setFounding] = useState(false);

	const nothingToJoin =
		!joinable.loading && joinable.crews.length === 0 && invites.length === 0;
	const showFoundForm = founding || nothingToJoin;

	return (
		<View>
			<CardTitle style={styles.doorTitle}>Join a Sounder</CardTitle>
			<BodySm tone="secondary" style={styles.doorSub}>
				{nothingToJoin
					? "No open Sounders right now — raise the first banner and the herd fills in behind you."
					: `${CREW_CAP_WORD} snouts, one banner. Ask into an open Sounder — when the herd opens the door, you dig the feedings together.`}
			</BodySm>

			{/* Sell the Sounder with its real benefits, not flavor — the three
			    concrete lines a crewless player never sees today. The depth-gain %
			    derives from the dig constants; truffles from RACE_TRUFFLE_TABLE. */}
			<SounderBenefits />
			{/* The word itself, taught as a gift (Animal Crossing's Blathers
			    pattern): "sounder" is the REAL collective noun for wild pigs —
			    one quiet flavor line turns the obscurity into charm. */}
			<Hand tone="secondary" style={styles.doorGloss}>
				a &quot;sounder&quot; is the true old word for a herd of wild pigs — now
				it&apos;s what you call your herd.
			</Hand>

			{invites.map((inv) => (
				<ListRow
					key={inv.id}
					tilt={false}
					fill="cream2"
					style={styles.inviteRow}
					leading={
						<Avatar
							size={AVATAR_SIZE[0]}
							fill="paper"
							glyph="friends"
							label="Sounder invite"
						/>
					}
					title={
						<BodySm numberOfLines={2}>
							{inv.inviter_name ?? "A friend"} wants you in {inv.crew_name}
						</BodySm>
					}
					trailing={
						<View style={styles.inviteActions}>
							<Button
								size="sm"
								variant={joinVariant}
								onPress={() => crewHook.accept(inv.id)}
								accessibilityLabel={`Join ${inv.crew_name}`}
								accessibilityHint="Puts you in this Sounder for the season"
							>
								Join
							</Button>
							<Button
								size="sm"
								variant="handLink"
								onPress={() => crewHook.decline(inv.id)}
								accessibilityLabel={`Decline the invite to ${inv.crew_name}`}
							>
								decline
							</Button>
						</View>
					}
				/>
			))}

			<JoinableSounders
				crews={joinable.crews}
				crewHook={crewHook}
				onStale={joinable.refresh}
			/>

			{showFoundForm ? (
				<FoundForm crewHook={crewHook} topGap={!nothingToJoin} variant={joinVariant} />
			) : (
				<Button
					size="sm"
					variant="handLink"
					onPress={() => setFounding(true)}
					accessibilityLabel="Found your own Sounder"
					accessibilityHint="Raises a new banner with you as its first member"
					style={styles.foundLink}
				>
					or found your own ›
				</Button>
			)}
		</View>
	);
}

function FoundForm({
	crewHook,
	topGap,
	variant,
}: {
	crewHook: UseCrew;
	topGap: boolean;
	/** Gold while founding is the tab's one hero action, lilac otherwise. */
	variant: "gold" | "lilac";
}) {
	// No name to type — the server names your Sounder for you at birth; the
	// leader renames it later. Founding is a single tap.
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	const found = async () => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await crewHook.create();
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		} else {
			setNote(
				r.reason === "already_in_crew"
					? "You're already in a Sounder."
					: "Couldn't raise the banner — give it another tap."
			);
		}
	};

	return (
		<View style={topGap ? styles.foundGap : undefined}>
			<BodySm tone="secondary" style={styles.foundBlurb}>
				We&apos;ll name your Sounder for you — a good name&apos;s already waiting.
			</BodySm>
			<Button
				size="md"
				variant={variant}
				full
				onPress={found}
				disabled={busy}
				accessibilityLabel="Found your own Sounder"
				accessibilityHint="Raises a new banner with you as its first member"
			>
				{busy ? "Founding…" : "Found it"}
			</Button>
			{!!note && (
				<Hand tone="accent" style={styles.note}>
					{note}
				</Hand>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	card: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
	loadingWrap: { alignItems: "center", paddingVertical: SPACE.md },

	// Roster.
	roster: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.md,
		marginBottom: SPACE.sm,
	},
	memberCol: { alignItems: "center", maxWidth: MEMBER_COL },
	avatarWrap: {
		alignItems: "center",
		justifyContent: "center",
		padding: SPACE.xs,
	},
	litRing: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.sun,
	},
	sparkle: { position: "absolute", top: SPARKLE_OFFSET, right: SPARKLE_OFFSET },
	memberName: { maxWidth: MEMBER_COL },
	memberFinds: { maxWidth: MEMBER_COL },

	// Feeding action.
	playRow: { marginBottom: SPACE.sm },
	feedingCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	feedingKicker: { marginBottom: SPACE.xs },
	feedingTitle: { marginBottom: SPACE.xs },
	feedingReward: { marginBottom: SPACE.xxs },
	feedingPromise: { marginBottom: SPACE.md },
	// The "root the patch" whisper subtitle under the "Dig for truffles" verb.
	digSub: { marginTop: SPACE.xs },
	note: { marginTop: SPACE.xs },
	// Link into the Burrow Book — matches the hand-font accent link grammar.
	devLink: { alignSelf: "flex-start" },

	// Milestone.
	milestone: { marginBottom: SPACE.xs },

	// Join door.
	doorTitle: { marginBottom: SPACE.xs },
	doorGloss: { marginTop: SPACE.sm, marginBottom: SPACE.xs },
	doorSub: { marginBottom: SPACE.sm },
	// The three concrete benefit lines under the join-door pitch.
	benefits: { gap: SPACE.xs, marginBottom: SPACE.md },
	benefitRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	benefitText: { flex: 1 },
	inviteRow: { marginBottom: SPACE.md },
	inviteActions: { alignItems: "center", gap: SPACE.xxs },
	// One-line reassurance above the "Found it" button (we name it for you).
	foundBlurb: { marginBottom: SPACE.sm },
	foundGap: { marginTop: SPACE.md },
	foundLink: { alignSelf: "center", marginTop: SPACE.md },
});
