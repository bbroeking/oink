// SounderCard — crew management on the Friends hub (the "Sounder"
// segment, dark-launched behind the `mud_wars` server flag). Implements
// the invite-matchmaking mockup (docs/design/claude-design/sounder/
// invite-matchmaking.html):
//
// No crew  → one paper sticker, join-first: incoming invites lead
//             ("a friend wants you" rows with Join / "not today", and a
//             stale "full now" state when the banner filled first), open
//             Sounders follow, founding demotes to "or found your own ›".
// In a crew → crew mini card (pips per CREW_CAP slot, slot hint, roster,
//             "Call a snout to your banner" CTA → FriendInvitePicker),
//             a NON-actionable incoming-invites strip ("asks waiting on
//             the wind" — one Sounder at a time, "let it go" only), the
//             Mud Scuffle CTA, the pass-the-crown sheet for leaders, and
//             a quiet leave link.
//
// All war flow (challenge / accept / sling / resolve) lives on the
// /mud-war screen; this card is crew bookkeeping only.

import { useEffect, useState } from "react";
import {
	View,
	Text,
	TextInput,
	Pressable,
	StyleSheet,
	ScrollView,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { supabase } from "@/utils/supabase";
import {
	fetchFriendsCrews,
	formatCountdown,
	kickCrewMember,
	type InviteIn,
	type WarState,
} from "@/utils/mudWars";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Glyph } from "./ui/Glyph";
import { Sticker } from "./ui/Sticker";
import { LoadingBeat } from "./ui/EmptyState";
import {
	Accent,
	AccentNote,
	CrewPortrait,
	CrewRow,
	CrewSectionKicker,
	CREW_ROW_INDENT,
	DiscText,
	FlagIcon,
	HandLink,
	RowStatus,
	SunPill,
	theCrew,
} from "./CrewRow";
import { JoinableSounders } from "./JoinableSounders";
import { FriendInvitePicker } from "./FriendInvitePicker";
import { TransferLeadershipSheet } from "./TransferLeadershipSheet";
import { UserSheet } from "./UserSheet";
import { useJoinableCrews, type UseCrew } from "@/hooks/useCrew";
import { useMudWar } from "@/hooks/useMudWar";
import { useRosterHats } from "@/hooks/useRosterHats";
import { CREW_CAP } from "@/constants/mudFights";
import {
	opponentName,
	ropeState,
	siegeDay,
	warActions,
	warTotalDays,
} from "./mudwar/warCopy";
import {
	acceptInviteResult,
	createError,
	isInviteStale,
	seatsLine,
} from "./sounder/inviteState";
import {
	FONTS,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TAB_SAFE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

// `crewHook` is lifted into the Friends hub (app/(tabs)/friends.tsx) and
// passed down so the crew-state-driven page title ("Find your Sounder" vs
// "Your Sounder") and this card share ONE fetch — no double subscription.
export function SounderCard({ crewHook }: { crewHook: UseCrew }) {
	const router = useRouter();
	const { crew, loading, create, accept, decline, leave } = crewHook;
	const joinable = useJoinableCrews(!crew.crew);
	// A live war turns the bare "View the Mud Scuffle" CTA into the informative
	// WarStrip treatment (opponent · rope · day). Only fetches while in a war;
	// until the state lands we fall back to the simple button.
	const mudWar = useMudWar(crew.warId ?? undefined, crew.inWar);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [crownOpen, setCrownOpen] = useState(false);
	// The founding form is demoted behind "or found your own ›" whenever
	// there's anything to join; this expands it in place.
	const [foundOpen, setFoundOpen] = useState(false);
	// Tapping a member row opens UserSheet — the one door for bless (and,
	// for friends, ask/curse/visit). Crewmates get the bless-only panel.
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	// Kick: first tap arms ("kick? sure ›"), second tap acts. Leadership
	// handoff moved to the pass-the-crown sheet.
	const [kickArmedId, setKickArmedId] = useState<string | null>(null);
	const [me, setMe] = useState<string | null>(null);
	// Frame A seat lines + proactive "full now": member counts for the
	// inviting crews come from friends_crews (an inviter must be a friend),
	// keyed by crew_id. Invites whose accept bounced with crew_full also
	// flip stale, so the row never shows a Join that lies.
	const [inviteCrewSizes, setInviteCrewSizes] = useState<Map<string, number>>(new Map());
	const [staleInviteIds, setStaleInviteIds] = useState<Set<string>>(new Set());

	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
	}, []);

	const inCrew = !!crew.crew;
	const isLeader = !!me && crew.crew?.leader_id === me;
	const memberCount = crew.members.length;
	const openSlots = Math.max(0, CREW_CAP - memberCount);
	// crew_state omits avatar fields; pull each member's equipped hat so the
	// roster renders the same PigAvatar look the Leaderboard shows.
	const rosterHats = useRosterHats(crew.members.map((m) => m.user_id));

	const inviteCrewKey = crew.invitesIn.map((i) => i.crew_id).join(",");
	useEffect(() => {
		if (inCrew || crew.invitesIn.length === 0) return;
		let cancelled = false;
		fetchFriendsCrews().then((fcs) => {
			if (cancelled) return;
			setInviteCrewSizes(new Map(fcs.map((fc) => [fc.crew_id, fc.memberCount])));
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [inCrew, inviteCrewKey]);

	const isStale = (inv: InviteIn): boolean =>
		isInviteStale(inv, staleInviteIds, inviteCrewSizes);

	async function onAccept(inv: InviteIn) {
		setNote(null);
		const r = await accept(inv.id);
		if (!r.ok) {
			const outcome = acceptInviteResult(r.reason);
			if (outcome.kind === "stale") {
				setStaleInviteIds((s) => new Set(s).add(inv.id));
			} else {
				setNote(outcome.note);
			}
		}
	}

	async function onKick(userId: string) {
		if (kickArmedId !== userId) {
			setKickArmedId(userId);
			return;
		}
		setKickArmedId(null);
		setNote(null);
		const r = await kickCrewMember(userId);
		if (!r.ok) {
			setNote(
				r.reason === "in_war"
					? "The scuffle holds the roster — kick once it's settled."
					: "Couldn't remove them — try again."
			);
		}
		await crewHook.refresh();
	}

	async function onCreate() {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await create(name.trim());
		setBusy(false);
		if (!r.ok) setNote(createError(r.reason));
		else setName("");
	}

	if (loading && !crew.crew && crew.invitesIn.length === 0) {
		return <LoadingBeat />;
	}

	// The founding form (Frame B). Leads with the "nobody's asked you in
	// yet" kicker when it's the only way in; expanded quietly otherwise.
	const foundForm = (leading: boolean) => (
		<View style={!leading && styles.sectGap}>
			{leading && <CrewSectionKicker plain>nobody's asked you in yet</CrewSectionKicker>}
			<Text style={styles.fieldLabel}>name your Sounder</Text>
			<TextInput
				style={styles.field}
				placeholder="The First Furrow"
				placeholderTextColor={WHIMSY.muteSoft}
				value={name}
				onChangeText={setName}
				maxLength={24}
			/>
			<Pressable
				onPress={onCreate}
				disabled={busy || name.trim().length < 1}
				style={[
					styles.foundBtn,
					(busy || name.trim().length < 1) && styles.foundBtnDim,
				]}
			>
				<FlagIcon size={20} />
				<Text style={styles.foundBtnText}>
					{busy ? "Creating…" : "Found the Sounder"}
				</Text>
			</Pressable>
			<Text style={styles.foundCopy}>
				raise the first banner and the{"\n"}bog fills in behind you.
			</Text>
		</View>
	);

	if (!inCrew) {
		const hasInvites = crew.invitesIn.length > 0;
		const hasJoinable = joinable.crews.length > 0;
		const anyStale = crew.invitesIn.some(isStale);
		return (
			<ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
				<Sticker color="paper" rotate={-0.5} radius={RADII.xxl} style={styles.muster}>
					{/* Invites — the warmest path, leads. Actionable ONLY while
					    crewless (one Sounder at a time; server enforces). */}
					{hasInvites && (
						<View>
							<CrewSectionKicker>a friend wants you</CrewSectionKicker>
							{crew.invitesIn.map((inv, idx) => {
								const stale = isStale(inv);
								return (
									<CrewRow
										key={inv.id}
										divider={idx > 0}
										left={<CrewPortrait />}
										title={
											<>
												<Accent>{inv.inviter_name ?? "A friend"}</Accent>
												{stale ? " wanted you in " : " wants you in "}
												<Accent>{inv.crew_name}</Accent>
											</>
										}
										sub={
											stale
												? "filled up before you tapped"
												: seatsLine(inviteCrewSizes.get(inv.crew_id))
										}
										right={
											stale ? (
												<RowStatus>full now</RowStatus>
											) : (
												<>
													<SunPill onPress={() => onAccept(inv)}>Join</SunPill>
													<HandLink onPress={() => decline(inv.id)}>
														not today
													</HandLink>
												</>
											)
										}
									/>
								);
							})}
							{anyStale && (
								<AccentNote style={styles.staleNote}>
									the bog moves fast — that banner's full.
								</AccentNote>
							)}
						</View>
					)}

					{/* Open Sounders — slip in without an invite. */}
					{hasJoinable && (
						<View style={hasInvites && styles.sectGap}>
							<CrewSectionKicker>join a Sounder</CrewSectionKicker>
							<JoinableSounders
								crews={joinable.crews}
								crewHook={crewHook}
								onStale={joinable.refresh}
							/>
						</View>
					)}

					{/* Founding — leads only when there's nothing to join. */}
					{hasInvites || hasJoinable ? (
						foundOpen ? (
							foundForm(false)
						) : (
							<HandLink onPress={() => setFoundOpen(true)} style={styles.foundLink}>
								or found your own ›
							</HandLink>
						)
					) : (
						foundForm(true)
					)}
				</Sticker>

				{note && <Text style={styles.note}>{note}</Text>}
			</ScrollView>
		);
	}

	return (
		<ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
			{/* Crew mini card — name, count, a pip per CREW_CAP slot (every
			    open slot is a "+" into the friends picker), roster, CTA. */}
			<Sticker color="paper" rotate={0} radius={RADII.xl} style={styles.crewMini}>
				<View style={styles.crewTop}>
					<Text style={styles.crewName} numberOfLines={1}>
						{crew.crew!.name}
					</Text>
					<Text style={styles.crewCount}>
						{memberCount}/{CREW_CAP}
					</Text>
				</View>
				<View style={styles.pips}>
					{Array.from({ length: CREW_CAP }).map((_, i) =>
						i < memberCount ? (
							<View key={i} style={styles.pip} />
						) : (
							<Pressable
								key={i}
								testID={`sounder-slot-plus-${i}`}
								onPress={() => setPickerOpen(true)}
								style={styles.pipOpen}
								hitSlop={6}
							>
								<Icon name="plus" size={12} color={WHIMSY.muteSoft} strokeWidth={3} />
							</Pressable>
						)
					)}
				</View>
				{/* One quiet hint line, per mock frame E: the crown hint OWNS the
				    slot when the leader could pass it — the pips + CTA already
				    carry the invite affordance. */}
				{isLeader && memberCount > 1 ? (
					<HandLink
						accent
						underline={false}
						onPress={() => setCrownOpen(true)}
						style={styles.crownLink}
					>
						you wear the crown · pass it before you leave ›
					</HandLink>
				) : openSlots > 0 ? (
					<Text style={styles.slotHint}>
						{openSlots} open {openSlots === 1 ? "slot" : "slots"} · tap ＋ or the
						button below to fill them
					</Text>
				) : null}

				{/* Roster — a pig per row; tap a row → UserSheet. The leader's
				    kick sits quietly on the right; pending invites join as
				    ghost rows so one card tells the whole herd story. */}
				<View style={styles.roster}>
					{crew.members.map((m, i) => (
						<CrewRow
							key={m.user_id}
							divider={i > 0}
							left={<CrewPortrait size={40} hatId={rosterHats.get(m.user_id) ?? null} />}
							title={
								<>
									{m.username ?? "Pig"}
									{m.user_id === me ? <DiscText> you</DiscText> : null}
								</>
							}
							sub={m.role === "leader" ? "wearing the crown now" : "rides with you"}
							right={
								m.role === "leader" ? (
									<RowStatus accent>leader</RowStatus>
								) : isLeader && m.user_id !== me ? (
									<HandLink
										accent={kickArmedId === m.user_id}
										onPress={() => onKick(m.user_id)}
									>
										{kickArmedId === m.user_id ? "kick? sure ›" : "kick"}
									</HandLink>
								) : undefined
							}
							onPress={() => setSelectedUserId(m.user_id)}
						/>
					))}
					{crew.invitesOut.map((i) => (
						<CrewRow
							key={i.id}
							divider
							dim
							left={<CrewPortrait size={40} ghost />}
							title={i.invitee_name ?? "Someone"}
							sub="waiting on your last ask…"
							right={<RowStatus>waiting…</RowStatus>}
						/>
					))}
				</View>

				{openSlots > 0 && (
					<Pressable onPress={() => setPickerOpen(true)} style={styles.inviteCta}>
						<Icon name="plus" size={18} color={WHIMSY.ink} strokeWidth={2.6} />
						<Text style={styles.inviteCtaText}>Call a snout to your banner</Text>
					</Pressable>
				)}
			</Sticker>

			{/* Incoming invites — NON-actionable while you ride with a crew.
			    One Sounder at a time: the server would refuse an accept, so
			    there's no Join that lies — just the ask and "let it go". */}
			{crew.invitesIn.length > 0 && (
				<Sticker color="paper" rotate={-0.5} radius={RADII.xxl} style={styles.muster}>
					<CrewSectionKicker>asks waiting on the wind</CrewSectionKicker>
					{crew.invitesIn.map((inv, idx) => (
						<CrewRow
							key={inv.id}
							divider={idx > 0}
							left={<CrewPortrait />}
							title={
								<>
									<Accent>{inv.inviter_name ?? "A friend"}</Accent>
									{" wants you in "}
									<Accent>{inv.crew_name}</Accent>
								</>
							}
							sub={`you're riding with ${theCrew(crew.crew!.name)}`}
							right={<HandLink onPress={() => decline(inv.id)}>let it go</HandLink>}
						/>
					))}
					<Text style={styles.oneSounderCopy}>
						one Sounder at a time —{"\n"}leave yours to answer an invite.
					</Text>
				</Sticker>
			)}

			{/* The scuffle — the section the roster exists for. */}
			<Sticker color="paper" rotate={0.4} radius={RADII.xl} style={styles.crewMini}>
				<CrewSectionKicker>the scuffle</CrewSectionKicker>
				{crew.inWar && mudWar.war ? (
					<ScuffleSummary
						war={mudWar.war}
						crewName={crew.crew!.name}
						onGo={(focus) => router.push(`/mud-war?focus=${focus}` as Href)}
					/>
				) : (
					<Button
						variant="gold"
						full
						icon={<Icon name="trophy" size={16} color="#5A3F00" />}
						// Cast: expo-router regenerates the typed-routes union to
						// include /mud-war on the next `expo start`; cast keeps tsc green now.
						onPress={() => router.push("/mud-war" as Href)}
					>
						{crew.inWar ? "View the Mud Scuffle" : "Start a Mud Scuffle"}
					</Button>
				)}
				<Pressable
					onPress={() => router.push("/clan-ladder" as Href)}
					style={styles.standingsRow}
					hitSlop={6}
				>
					<Text style={styles.standingsText}>Sounder standings</Text>
					<Text style={styles.standingsChevron}>›</Text>
				</Pressable>
			</Sticker>

			{/* Leaving is easy but quiet — a hand-written line, not a
			    button competing with the scuffle CTA. */}
			<HandLink onPress={() => leave()} style={styles.leaveWrap}>
				leave your Sounder › no hard feelings
			</HandLink>

			<FriendInvitePicker
				visible={pickerOpen}
				onDismiss={() => setPickerOpen(false)}
				crewHook={crewHook}
			/>

			<TransferLeadershipSheet
				visible={crownOpen}
				onDismiss={() => setCrownOpen(false)}
				crewHook={crewHook}
			/>

			<UserSheet
				targetUserId={selectedUserId}
				onDismiss={() => setSelectedUserId(null)}
				onFriendshipChanged={crewHook.refresh}
			/>

			{note && <Text style={styles.note}>{note}</Text>}
		</ScrollView>
	);
}

// ── Live-war summary — the WarStrip treatment, inlined under "the scuffle".
// WHO (you vs them) · WHERE THE ROPE IS (plain words + day/countdown) · then
// dig/bog actions that deep-link the war page. Reuses the same pure warCopy
// helpers as SounderSteps.WarStrip so the two surfaces never drift.
function ScuffleSummary({
	war,
	crewName,
	onGo,
}: {
	war: WarState;
	crewName: string;
	onGo: (focus: string) => void;
}) {
	const total = warTotalDays(war);
	const day = siegeDay(war.endsAt, total);
	const opp = opponentName(war);
	const rope = ropeState(war);
	const countdown = formatCountdown(war.endsAt);
	const actions = warActions(war);
	return (
		<View style={styles.scuffleSummary}>
			<View style={styles.warHead}>
				<Glyph name="flame" size={20} />
				<Text style={styles.warTitle} numberOfLines={1}>
					{crewName} vs {opp}
				</Text>
				<Text style={styles.warDay}>
					Day {day}/{total}
				</Text>
			</View>
			<Text style={styles.warLean}>{rope.line}</Text>
			{!!countdown && <Text style={styles.warClock}>{countdown} left in the day</Text>}
			<View style={styles.warActions}>
				{actions.map((a) => (
					<Button
						key={a.key}
						size="sm"
						variant={a.key === "bog" ? "ghost" : "primary"}
						onPress={() => onGo(a.focus)}
					>
						{a.label}
					</Button>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { padding: PAGE_PAD, paddingBottom: TAB_SAFE, gap: SPACE.md },
	// The one paper sticker the crewless states live in (Frames A & B).
	muster: { padding: SPACE.lg, paddingBottom: SPACE.lg },
	sectGap: { marginTop: SPACE.lg },
	staleNote: { marginLeft: CREW_ROW_INDENT, marginTop: 2 },
	foundLink: { alignSelf: "center", marginTop: SPACE.lg },
	fieldLabel: { ...TYPE.hand, color: WHIMSY.mute, marginBottom: SPACE.sm },
	field: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		backgroundColor: WHIMSY.cream,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.md,
		...TYPE.body,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
	},
	foundBtn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm + 2,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xxl,
		paddingVertical: SPACE.md,
		marginTop: SPACE.md,
		...SHADOW_SM,
	},
	foundBtnDim: { opacity: 0.6 },
	foundBtnText: { ...TYPE.cardTitle, fontFamily: FONTS.display, color: WHIMSY.ink },
	foundCopy: {
		...TYPE.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.md,
	},
	// Crew mini card (Frame D).
	crewMini: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md + 2 },
	crewTop: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	crewName: { ...TYPE.sectionTitle, color: WHIMSY.ink, flexShrink: 1 },
	crewCount: { ...TYPE.body, fontFamily: FONTS.display, color: WHIMSY.mute },
	pips: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.sm },
	pip: {
		width: 20,
		height: 20,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
	},
	pipOpen: {
		width: 20,
		height: 20,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderStyle: "dashed",
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	slotHint: { ...TYPE.kicker, color: WHIMSY.mute, marginTop: SPACE.sm },
	crownLink: { marginTop: SPACE.xs + 1 },
	roster: { marginTop: SPACE.sm },
	inviteCta: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xxl,
		paddingVertical: SPACE.md - 1,
		marginTop: SPACE.md,
		...SHADOW_SM,
	},
	inviteCtaText: { ...TYPE.body, fontFamily: FONTS.display, color: WHIMSY.ink },
	oneSounderCopy: {
		...TYPE.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.lg,
	},
	// Live-war summary — mirrors SounderSteps.WarStrip's visual grammar.
	scuffleSummary: { marginTop: SPACE.sm },
	warHead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	warTitle: {
		flex: 1,
		...TYPE.cardTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	warDay: { ...TYPE.label, fontFamily: FONTS.bodyExtra, color: WHIMSY.mute },
	warLean: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		marginTop: SPACE.xs,
	},
	warClock: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		marginTop: 2,
		marginBottom: SPACE.md,
	},
	warActions: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	standingsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
	},
	standingsText: { flex: 1, ...TYPE.bodySm, fontFamily: FONTS.bodyExtra, color: WHIMSY.ink },
	standingsChevron: { ...TYPE.cardTitle, color: WHIMSY.mute },
	leaveWrap: { alignSelf: "center", marginTop: SPACE.xs, marginBottom: SPACE.sm },
	note: {
		...TYPE.bodySm,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
});
