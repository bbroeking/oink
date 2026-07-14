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
import { useFeedingCta } from "../mudwar/useFeedingCta";
import { NotifyChip, BurrowBookLink } from "./GuardedCtaExtras";
import { useRosterHats } from "@/hooks/useRosterHats";
import { useJoinableCrews, type UseCrew } from "@/hooks/useCrew";
import {
	fetchFeedingState,
	fetchRaceCrewDetail,
	milestoneProgress,
	type FeedingState,
	type RaceCrewDetail,
} from "@/utils/dig";
import { CREW_CAP_WORD } from "@/constants/crews";
import { RACE_TRUFFLE_TABLE, STIR_BUDGET } from "@/constants/dig";
import { FONTS, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY } from "@/constants/theme";

// The full-Sounder dig budget — a crewmate who's dug this feeding lets you dig
// deeper (TrufflePatch's coop budget = STIR_BUDGET * 1.25, a quarter deeper).
// The join pitch now says "a quarter deeper" rather than raw stir counts; this
// derived depth-gain feeds that copy's percentage so the wording can't silently
// drift from the real coop budget. Rounded to a clean "%" for the sentence.
const COOP_DEPTH_GAIN_PCT = Math.round(
	((Math.round(STIR_BUDGET * 1.25) - STIR_BUDGET) / STIR_BUDGET) * 100
);

const AVATAR = 44;

export function SounderHomeCard({
	crewHook,
	uid,
	onDug,
	refreshKey,
}: {
	crewHook: UseCrew;
	/** The caller's own user id — lights their pig in the roster when they've dug. */
	uid: string | null;
	onDug?: () => void;
	/** Bumped after a dig so the roster's "who dug this feeding" re-reads. */
	refreshKey?: number;
}) {
	const { crew } = crewHook;

	if (crew.crew) {
		return (
			<Sticker color="paper" rotate={-0.4} radius={RADII.lg} style={styles.card}>
				<CrewedHome crewHook={crewHook} uid={uid} onDug={onDug} refreshKey={refreshKey} />
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

// ── CREWED — roster · play/cooldown · milestone ───────────────────────────────
function CrewedHome({
	crewHook,
	uid,
	onDug,
	refreshKey,
}: {
	crewHook: UseCrew;
	uid: string | null;
	onDug?: () => void;
	refreshKey?: number;
}) {
	const { crew } = crewHook;
	const members = crew.members;
	const hats = useRosterHats(members.map((m) => m.user_id));
	const cta = useFeedingCta(onDug);

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
			{/* Roster — every snout, lit when it's dug this feeding. */}
			<View style={styles.roster}>
				{members.map((mem) => {
					const isLit = lit.has(mem.user_id);
					return (
						<View key={mem.user_id} style={styles.memberCol}>
							<View style={styles.avatarWrap}>
								{isLit && <View style={styles.litRing} />}
								<CrewPortrait size={AVATAR} hatId={hats.get(mem.user_id) ?? null} />
								{isLit && <Glyph name="sparkle" size={16} style={styles.sparkle} />}
							</View>
							<Text style={styles.memberName} numberOfLines={1}>
								{mem.username ?? "a pig"}
							</Text>
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

			{/* Play the open patch, or the live cooldown until it opens again.
			    The patch alternates 4h open / 4h guarded within each feeding. */}
			<View style={styles.playRow}>
				{cta.dugThisWindow ? (
					<Button size="md" variant="locked" full disabled>
						dug this feeding — opens in {cta.countdown}
					</Button>
				) : cta.noCrew ? null : cta.phaseOpen ? (
					<>
						<Button size="md" variant="primary" full onPress={cta.start}>
							Dig for truffles
						</Button>
						{/* The dig verb leads; "root the patch" rides under it as the
						    small storybook whisper (inverted roles). */}
						<Text style={styles.digSub}>root the patch</Text>
						<Text style={styles.cooldownLine}>the patch closes in {cta.countdown}</Text>
					</>
				) : (
					<>
						<Button size="md" variant="locked" full disabled>
							he's guarding — opens in {cta.countdown}
						</Button>
						{/* Guarded, nothing to dig — offer the same "oink me" opt-in the
						    onboarding first_dig branch gives, so a retained player isn't
						    left at a dead disabled button. */}
						<NotifyChip />
					</>
				)}
				{!!cta.note && <Text style={styles.note}>{cta.note}</Text>}
				{/* Dev escape hatch: play the dig any time (fresh practice board,
				    mints nothing) — the phase gate makes on-device testing painful. */}
				{__DEV__ && cta.startPractice && (
					<Pressable onPress={cta.startPractice} hitSlop={6} style={({ pressed }) => pressed && { opacity: 0.65 }}>
						<Text style={styles.burrowLink}>dev · practice dig ›</Text>
					</Pressable>
				)}
				{/* The relic shelf — the dig's collection page (Part D). A real
				    bordered secondary affordance, not a bare afterthought link. */}
				<BurrowBookLink />
			</View>
			{cta.modal}

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
	// A percentage is a felt benefit with no unit to learn — unlike the old raw
	// "25 stirs, not 20". COOP_DEPTH_GAIN_PCT derives straight from STIR_BUDGET *
	// 1.25 (currently 25%) so this copy can never drift from the real coop budget.
	const lines = [
		`dig deeper together — a full Sounder digs ${COOP_DEPTH_GAIN_PCT}% deeper`,
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
					: `${CREW_CAP_WORD} snouts, one banner. Slip into an open Sounder — you'll dig the feedings together.`}
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
				it's what you call your friends.
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
				We'll name your Sounder for you — you can rename it once the herd's in.
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

	// Play / cooldown.
	playRow: { marginBottom: SPACE.sm },
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
