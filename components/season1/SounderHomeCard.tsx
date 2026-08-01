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
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Sticker } from "../ui/Sticker";
import { Glyph } from "../ui/Glyph";
import { Button } from "../ui/Button";
import { LoadingBeat } from "../ui/EmptyState";
import { CrewPortrait } from "../CrewRow";
import { JoinableSounders } from "../JoinableSounders";
import type { FeedingCta } from "../mudwar/useFeedingCta";
import { NotifyChip, BurrowBookLink } from "./GuardedCtaExtras";
import { useRosterProfiles } from "@/hooks/useRosterHats";
import { ProfileIdentity } from "../ui/ProfileIdentity";
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
import { FONTS, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";

const AVATAR = 44;

export function SounderHomeCard({
	crewHook,
	uid,
	cta,
	refreshKey,
	showFeedingAction = true,
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
}) {
	const { crew } = crewHook;

	if (crew.crew) {
		return (
			<Sticker color="paper" rotate={-0.4} radius={RADII.lg} style={styles.card}>
				<CrewedHome
					crewHook={crewHook}
					uid={uid}
					cta={cta}
					refreshKey={refreshKey}
					showFeedingAction={showFeedingAction}
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
			<JoinDoor crewHook={crewHook} />
		</Sticker>
	);
}

/** One authoritative Feeding action, promoted above secondary systems on Season. */
export function FeedingAction({
	cta,
	prominent = false,
}: {
	cta: FeedingCta;
	prominent?: boolean;
}) {
	const content = (
		<View style={styles.playRow}>
			{prominent && (
				<>
					<Text style={styles.feedingKicker}>★ THIS FEEDING</Text>
					<Text accessibilityRole="header" style={styles.feedingTitle}>
						{cta.dugThisWindow
							? "20 Pass XP banked"
							: cta.phaseOpen
								? "Dig for Golden Truffles"
								: "The Hungerer is guarding"}
					</Text>
					<Text style={styles.feedingReward}>
						Golden Truffles + relics · +20 Pass XP
					</Text>
					<Text style={styles.feedingPromise}>
						{"Bring home a find to join the next 15-Truffle stage reward and your Sounder's Monday payout."}
					</Text>
				</>
			)}
			{cta.dugThisWindow ? (
				<Button size={prominent ? "lg" : "md"} variant="locked" full disabled>
					dug this feeding ★
				</Button>
			) : cta.noCrew ? null : cta.phaseOpen ? (
				<>
					<Button
						size={prominent ? "lg" : "md"}
						variant="primary"
						full
						onPress={cta.start}
					>
						{patchCtaLabel(true, cta.countdown)}
					</Button>
					<Text style={styles.digSub}>root the patch</Text>
					<Text style={styles.cooldownLine}>
						the patch closes in {cta.countdown}
					</Text>
				</>
			) : (
				<>
					<Button
						size={prominent ? "lg" : "md"}
						variant="locked"
						full
						disabled
					>
						{patchCtaLabel(false, cta.countdown)}
					</Button>
					<NotifyChip />
				</>
			)}
			{!!cta.note && <Text style={styles.note}>{cta.note}</Text>}
			{__DEV__ && cta.startPractice && (
				<Pressable
					onPress={cta.startPractice}
					hitSlop={6}
					style={({ pressed }) => pressed && { opacity: 0.65 }}
				>
					<Text style={styles.burrowLink}>dev · practice dig ›</Text>
				</Pressable>
			)}
		</View>
	);

	if (!prominent) return content;

	return (
		<Sticker
			color={cta.phaseOpen && !cta.dugThisWindow ? "sun" : "cream"}
			rotate={-0.4}
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
}: {
	crewHook: UseCrew;
	uid: string | null;
	cta: FeedingCta;
	refreshKey?: number;
	showFeedingAction: boolean;
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
			{showFeedingAction && <FeedingAction cta={cta} />}

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
									prestigeLevel={
										__DEV__ && mem.user_id === uid
											? 5
											: profiles.get(mem.user_id)?.wallowCount ?? 0
									}
								/>
								{isLit && <Glyph name="sparkle" size={16} style={styles.sparkle} />}
							</View>
							<ProfileIdentity
								username={mem.username ?? "a pig"}
								title={profiles.get(mem.user_id)?.title}
								align="center"
								nameStyle={styles.memberName}
							/>
							{detail != null && (
								<Text style={styles.memberFinds} numberOfLines={1}>
									{finds.get(mem.user_id) ?? 0}
									{(finds.get(mem.user_id) ?? 0) === 1 ? " find" : " finds"}
								</Text>
							)}
						</View>
					);
				})}
			</View>

			{/* cta.modal renders once at the owner (season.tsx), not here. */}

			{/* One quiet milestone line + thin bar. */}
			<View style={styles.milestone}>
				{!m.allDone ? (
					<>
						<View style={styles.track}>
							<View style={[styles.fill, { width: `${Math.round(m.pct * 100)}%` }]} />
						</View>
						<Text style={styles.milestoneLine}>
							{m.lifetimeFinds} / {m.nextThreshold} finds to {m.nextTitle}
						</Text>
					</>
				) : (
					<Text style={styles.milestoneLine}>
						every herd milestone earned — {m.earnedTitle}
					</Text>
				)}
			</View>
			{/* Collection stays reachable with herd context, below the primary action. */}
			<BurrowBookLink />
		</>
	);
}

// ── CREWLESS — the join-first door (invites → open Sounders → found your own) ──
// Ported wholesale from the retired SounderSteps' join step; the season's first
// verb is joining, so invites + the open-Sounder list lead and founding is the
// demoted fallback.
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
					<Glyph name="gem" size={16} />
					<Text style={styles.benefitText}>{line}</Text>
				</View>
			))}
		</View>
	);
}

function JoinDoor({ crewHook }: { crewHook: UseCrew }) {
	const invites = crewHook.crew.invitesIn;
	const joinable = useJoinableCrews();
	const [founding, setFounding] = useState(false);

	const nothingToJoin =
		!joinable.loading && joinable.crews.length === 0 && invites.length === 0;
	const showFoundForm = founding || nothingToJoin;

	return (
		<View>
			<Text style={styles.doorTitle}>Join a Sounder</Text>
			<Text style={styles.doorSub}>
				{nothingToJoin
					? "No open Sounders right now — raise the first banner and the herd fills in behind you."
					: `${CREW_CAP_WORD} snouts, one banner. Ask into an open Sounder — when the herd opens the door, you dig the feedings together.`}
			</Text>

			{/* Sell the Sounder with its real benefits, not flavor — the three
			    concrete lines a crewless player never sees today. The depth-gain %
			    derives from the dig constants; truffles from RACE_TRUFFLE_TABLE. */}
			<SounderBenefits />
			{/* The word itself, taught as a gift (Animal Crossing's Blathers
			    pattern): "sounder" is the REAL collective noun for wild pigs —
			    one quiet flavor line turns the obscurity into charm. */}
			<Text style={styles.doorGloss}>
				a "sounder" is the true old word for a herd of wild pigs — now
				it's what you call your herd.
			</Text>

			{invites.map((inv) => (
				<View key={inv.id} style={styles.inviteRow}>
					<Glyph name="friends" size={18} />
					<Text style={styles.inviteText} numberOfLines={2}>
						{inv.inviter_name ?? "A friend"} wants you in {inv.crew_name}
					</Text>
					<Pressable
						onPress={() => crewHook.accept(inv.id)}
						style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.7 }]}
						hitSlop={6}
					>
						<Text style={styles.joinBtnText}>Join</Text>
					</Pressable>
					<Pressable onPress={() => crewHook.decline(inv.id)} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.65 }}>
						<Text style={styles.declineText}>decline</Text>
					</Pressable>
				</View>
			))}

			<JoinableSounders
				crews={joinable.crews}
				crewHook={crewHook}
				onStale={joinable.refresh}
			/>

			{showFoundForm ? (
				<FoundForm crewHook={crewHook} topGap={!nothingToJoin} />
			) : (
				<Pressable onPress={() => setFounding(true)} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.65 }}>
					<Text style={styles.foundLink}>or found your own ›</Text>
				</Pressable>
			)}
		</View>
	);
}

function FoundForm({ crewHook, topGap }: { crewHook: UseCrew; topGap: boolean }) {
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
		<View style={topGap ? { marginTop: SPACE.md } : undefined}>
			<Text style={styles.foundBlurb}>
				We'll name your Sounder for you — a good name's already waiting.
			</Text>
			<Button size="md" variant="primary" full onPress={found} disabled={busy}>
				{busy ? "Founding…" : "Found it"}
			</Button>
			{!!note && <Text style={styles.note}>{note}</Text>}
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
	memberCol: { alignItems: "center", maxWidth: 72 },
	avatarWrap: {
		alignItems: "center",
		justifyContent: "center",
		padding: 5,
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
	sparkle: { position: "absolute", top: -2, right: -2 },
	memberName: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		marginTop: 2,
		maxWidth: 72,
	},
	memberFinds: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		maxWidth: 72,
	},

	// Feeding action.
	playRow: { marginBottom: SPACE.sm },
	feedingCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	feedingKicker: {
		...TYPE.kicker,
		color: WHIMSY.accent,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginBottom: SPACE.xs,
	},
	feedingTitle: {
		...TYPE.sectionTitle,
		color: WHIMSY.ink,
		marginBottom: SPACE.xs,
	},
	feedingReward: {
		...TYPE.body,
		color: WHIMSY.ink,
	},
	feedingPromise: {
		...TYPE.bodySm,
		color: WHIMSY.mute,
		marginTop: 2,
		marginBottom: SPACE.md,
	},
	cooldownLine: { ...TYPE.hand, fontFamily: FONTS.hand, color: WHIMSY.mute },
	// The "root the patch" whisper subtitle under the "Dig for truffles" verb.
	digSub: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	note: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		marginTop: SPACE.xs,
	},
	// Link into the Burrow Book — matches the hand-font accent link grammar.
	burrowLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
		marginTop: SPACE.xs,
	},

	// Milestone.
	milestone: { marginBottom: SPACE.xs },
	track: {
		height: 8,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
		marginBottom: SPACE.xs,
	},
	fill: { height: "100%", backgroundColor: WHIMSY.sun },
	milestoneLine: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },

	// Join door.
	doorTitle: {
		...TYPE.cardTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		marginBottom: SPACE.xs,
	},
	doorGloss: {
		...TYPE.hand,
		color: WHIMSY.mute,
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	doorSub: {
		...TYPE.bodySm,
		fontFamily: FONTS.body,
		color: WHIMSY.mute,
		marginBottom: SPACE.sm,
	},
	// The three concrete benefit lines under the join-door pitch.
	benefits: { gap: SPACE.xs, marginBottom: SPACE.md },
	benefitRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	benefitText: {
		flex: 1,
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
	},
	inviteRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginBottom: SPACE.md,
	},
	inviteText: { flex: 1, ...TYPE.bodySm, fontFamily: FONTS.body, color: WHIMSY.ink },
	joinBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: 5,
		minHeight: 32,
		justifyContent: "center",
		...SHADOW_SM,
	},
	joinBtnText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	declineText: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	// One-line reassurance above the "Found it" button (we name it for you).
	foundBlurb: {
		...TYPE.body,
		fontFamily: FONTS.body,
		color: WHIMSY.mute,
		marginBottom: SPACE.sm,
	},
	foundLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.md,
		textDecorationLine: "underline",
	},
});
