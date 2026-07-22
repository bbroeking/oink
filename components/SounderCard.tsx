// SounderCard — crew management on the Friends hub (the "Sounder"
// segment, dark-launched behind the `coop_dig` server flag). Implements
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
//             Golden Truffle economy doors (rewards + exchange), a herd
//             dig-milestone summary, and a quiet leave link.
//
// This card is crew bookkeeping only; the dig itself lives in the feeding
// strip.

import { useEffect, useState } from "react";
import {
	View,
	Text,
	Image,
	Pressable,
	StyleSheet,
	ScrollView,
} from "react-native";
import { supabase } from "@/utils/supabase";
import {
	fetchFriendsCrews,
	kickCrewMember,
	type InviteIn,
} from "@/utils/crews";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Sticker } from "./ui/Sticker";
import { LoadingBeat } from "./ui/EmptyState";
import {
	Accent,
	AccentNote,
	CrewPortrait,
	CrewRow,
	CrewSectionKicker,
	CREW_ROW_INDENT,
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
import { TruffleCatalogSheet } from "./TruffleCatalogSheet";
import { TruffleExchangeSheet } from "./mudwar/TruffleExchangeSheet";
import { useTruffles } from "@/hooks/useTruffles";
import { HAT_IMAGES } from "@/constants/hats";
import { useJoinableCrews, type UseCrew } from "@/hooks/useCrew";
import { useRosterProfiles } from "@/hooks/useRosterHats";
import { ProfileIdentity } from "./ui/ProfileIdentity";
import { milestoneProgress } from "@/utils/dig";
import { CREW_CAP } from "@/constants/crews";
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
// `onShowBoard` switches the Friends hub to its Board segment — the standings
// moved into the hub (Your Sounder redesign), so the card only points at them.
export function SounderCard({
	crewHook,
	onShowBoard,
}: {
	crewHook: UseCrew;
	onShowBoard?: () => void;
}) {
	const { crew, loading, create, accept, decline, cancel, acceptRequest, declineRequest, leave } =
		crewHook;
	const joinable = useJoinableCrews(!crew.crew);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [crownOpen, setCrownOpen] = useState(false);
	// Golden Truffle economy doors — the rewards catalog + the Truffle Exchange.
	const [spoilsOpen, setSpoilsOpen] = useState(false);
	const [exchangeOpen, setExchangeOpen] = useState(false);
	// Golden Truffle pouch + Exchange rotation (Season 1 P4; cozy-closed until
	// the 20260704300000 migration is live).
	const truffles = useTruffles();
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
	// A pending outgoing invite reserves a seat (matches the server's combined
	// cap), so an open slot is only truly open once the ask is answered or taken
	// back: open = cap - members - pendingOut.
	const pendingOut = crew.invitesOut.length;
	const openSlots = Math.max(0, CREW_CAP - memberCount - pendingOut);
	// crew_state omits avatar fields; pull each member's equipped hat so the
	// roster renders the same PigAvatar look the Leaderboard shows.
	const rosterProfiles = useRosterProfiles(crew.members.map((m) => m.user_id));

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

	async function onCancel(inviteId: string) {
		setNote(null);
		const r = await cancel(inviteId);
		if (!r.ok) {
			setNote("Couldn't take that ask back — try again.");
			await crewHook.refresh();
		}
	}

	// Incoming knock: let a crewless pig in (any member may). crew_full means the
	// door filled first — a quiet note, then the roster re-reads.
	async function onAcceptRequest(requestId: string) {
		setNote(null);
		const r = await acceptRequest(requestId);
		if (!r.ok) {
			setNote(
				r.reason === "crew_full"
					? "the banner filled up first — no seat to give."
					: "Couldn't let them in — try again."
			);
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
			setNote("Couldn't remove them — try again.");
		}
		await crewHook.refresh();
	}

	async function onCreate() {
		if (busy) return;
		setBusy(true);
		setNote(null);
		// No name — the server names the Sounder for you at birth.
		const r = await create();
		setBusy(false);
		if (!r.ok) setNote(createError(r.reason));
	}

	if (loading && !crew.crew && crew.invitesIn.length === 0) {
		return <LoadingBeat />;
	}

	// The founding form (Frame B). Leads with the "nobody's asked you in
	// yet" kicker when it's the only way in; expanded quietly otherwise.
	const foundForm = (leading: boolean) => (
		<View style={!leading && styles.sectGap}>
			{leading && <CrewSectionKicker plain>nobody's asked you in yet</CrewSectionKicker>}
			<Pressable
				onPress={onCreate}
				disabled={busy}
				style={[styles.foundBtn, busy && styles.foundBtnDim]}
			>
				<FlagIcon size={20} />
				<Text style={styles.foundBtnText}>
					{busy ? "Creating…" : "Found the Sounder"}
				</Text>
			</Pressable>
			<Text style={styles.foundCopy}>
				raise the first banner — we'll name your{"\n"}Sounder for you, and the herd fills in behind.
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
									the herd moves fast — that banner's full.
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
						) : i < memberCount + pendingOut ? (
							// A reserved seat — an outgoing ask is out. Dashed sun ring,
							// no "+": it's spoken for until answered or taken back.
							<View key={i} style={styles.pipPending} />
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
							left={
								<CrewPortrait
									size={40}
									hatId={rosterProfiles.get(m.user_id)?.hatId ?? null}
									prestigeLevel={
										__DEV__ && m.user_id === me
											? 5
											: rosterProfiles.get(m.user_id)?.wallowCount ?? 0
									}
								/>
							}
							title={m.username ?? "Pig"}
							titleNode={
								<ProfileIdentity
									username={m.username}
									title={rosterProfiles.get(m.user_id)?.title}
									suffix={m.user_id === me ? "you" : null}
								/>
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
							right={<HandLink onPress={() => onCancel(i.id)}>take it back</HandLink>}
						/>
					))}
					{/* Incoming knocks — a crewless pig asking to dig with you. Any
					    member may open the door; matches the ghost invite rows'
					    visual language, but these ACT (let them in / not now). */}
					{crew.joinRequestsIn.map((req) => (
						<CrewRow
							key={req.id}
							divider
							left={<CrewPortrait size={40} />}
							title={
								<>
									<Accent>{req.username ?? "A pig"}</Accent>
									{" wants to dig with you"}
								</>
							}
							sub="knocking at your banner"
							right={
								<>
									<SunPill onPress={() => onAcceptRequest(req.id)}>let them in</SunPill>
									<HandLink onPress={() => declineRequest(req.id)}>not now</HandLink>
								</>
							}
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

			{/* The Golden Truffle economy — the rewards catalog + the Exchange.
			    (The herd milestone summary leads the card.) */}
			<Sticker color="paper" rotate={0.4} radius={RADII.xl} style={styles.crewMini}>
				{/* Herd dig-milestone summary — the Sounder's lifetime finds toward
				    the next re-themed title (quiet accomplishment, never a chore). */}
				<MilestoneSummary lifetimeFinds={crew.lifetime_finds} />
				<View style={styles.troveRow}>
					<Pressable
						onPress={() => setSpoilsOpen(true)}
						hitSlop={8}
						style={({ pressed }) => [styles.troveBtn, pressed && styles.trovePressed]}
					>
						<Icon name="trophy" size={15} color={WHIMSY.accent} />
						<Text style={styles.troveText}>Rewards</Text>
					</Pressable>
					<Pressable
						onPress={() => setExchangeOpen(true)}
						hitSlop={8}
						style={({ pressed }) => [styles.troveBtn, pressed && styles.trovePressed]}
					>
						{HAT_IMAGES.golden_truffle ? (
							<Image
								source={HAT_IMAGES.golden_truffle}
								style={styles.troveIcon}
								resizeMode="contain"
							/>
						) : (
							<Icon name="gift" size={15} color={WHIMSY.accent} />
						)}
						<Text style={styles.troveText}>
							{truffles.available
								? `Exchange · ${truffles.balance}`
								: "Exchange"}
						</Text>
					</Pressable>
				</View>
			</Sticker>

			{/* Leaving is easy but quiet — a hand-written line, not a button. */}
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

			<TruffleCatalogSheet open={spoilsOpen} onClose={() => setSpoilsOpen(false)} />
			<TruffleExchangeSheet
				open={exchangeOpen}
				onClose={() => setExchangeOpen(false)}
				truffles={truffles}
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

// Compact herd-milestone line for the crew card — earned title + progress to
// the next, e.g. "Root Rustler earned · 214/600 to Truffle Baron". Kept small
// and social; the season tab owns the fuller milestones row.
function MilestoneSummary({ lifetimeFinds }: { lifetimeFinds: number }) {
	const m = milestoneProgress(lifetimeFinds);
	let line: string;
	if (m.allDone) {
		line = `${m.earnedTitle} earned · the herd's dug it all`;
	} else if (m.earnedTitle) {
		line = `${m.earnedTitle} earned · ${m.lifetimeFinds}/${m.nextThreshold} to ${m.nextTitle}`;
	} else {
		line = `${m.lifetimeFinds}/${m.nextThreshold} to ${m.nextTitle}`;
	}
	return (
		<View style={styles.milestoneRow}>
			<Icon name="trophy" size={15} color={WHIMSY.accent} />
			<Text style={styles.milestoneText} numberOfLines={1}>
				{line}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	milestoneRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		justifyContent: "center",
		marginBottom: SPACE.sm,
	},
	milestoneText: { ...TYPE.hand, color: WHIMSY.mute, flexShrink: 1 },
	content: { padding: PAGE_PAD, paddingBottom: TAB_SAFE, gap: SPACE.md },
	// The one paper sticker the crewless states live in (Frames A & B).
	muster: { padding: SPACE.lg, paddingBottom: SPACE.lg },
	sectGap: { marginTop: SPACE.lg },
	staleNote: { marginLeft: CREW_ROW_INDENT, marginTop: 2 },
	foundLink: { alignSelf: "center", marginTop: SPACE.lg },
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
	pips: { flexDirection: "row", alignItems: "center", gap: SPACE.sm + 1, marginTop: SPACE.sm },
	// Slot dots — 26px circles. Filled: sun with the SHADOW_SM tier (the design's
	// 1.5px micro-shadow rounds up to the small tier; the two-tier rule holds).
	pip: {
		width: 26,
		height: 26,
		borderRadius: 13,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		...SHADOW_SM,
	},
	// Open: dashed muteSoft ring around the "+" into the friends picker.
	pipOpen: {
		width: 26,
		height: 26,
		borderRadius: 13,
		borderWidth: 2.5,
		borderStyle: "dashed",
		borderColor: WHIMSY.muteSoft,
		alignItems: "center",
		justifyContent: "center",
	},
	// Reserved: an ask is out. A dashed SUN ring — half-lit toward filled, so a
	// pending seat reads as "spoken for", not "open".
	pipPending: {
		width: 26,
		height: 26,
		borderRadius: 13,
		borderWidth: 2.5,
		borderStyle: "dashed",
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		opacity: 0.5,
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
	// Golden Truffle economy doors — centered icon + hand-text pair, matching
	// HandLink's quiet weight.
	troveRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: SPACE.xl,
		marginTop: SPACE.md,
	},
	// Real button chrome — without it these read as plain text; the app's chip
	// grammar: cream face, ink border, sticker shadow, pressed dim.
	troveBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		backgroundColor: WHIMSY.cream,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs + 2,
		...SHADOW_SM,
	},
	trovePressed: { opacity: 0.7 },
	troveText: { ...TYPE.hand, color: WHIMSY.ink },
	troveIcon: { width: 16, height: 16 },
	leaveWrap: { alignSelf: "center", marginTop: SPACE.xs, marginBottom: SPACE.sm },
	note: {
		...TYPE.bodySm,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
});
