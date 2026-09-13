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
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { supabase } from "@/utils/supabase";
import {
	fetchFriendsCrews,
	kickCrewMember,
	type InviteIn,
} from "@/utils/crews";
import { Icon } from "./ui/Icon";
import { Sticker } from "./ui/Sticker";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { LoadingBeat } from "./ui/EmptyState";
import { Hand, SectionTitle, T } from "./ui/Text";
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
} from "./ui";
import { JoinableSounders } from "./JoinableSounders";
import { FriendInvitePicker } from "./FriendInvitePicker";
import { PlayerInvitePicker } from "./PlayerInvitePicker";
import { SounderOinkSheet } from "./SounderOinkSheet";
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
	ART_SIZE,
	BORDER,
	FONTS,
	OPACITY,
	PRESSED_FLAT,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	TAB_SAFE,
	TAP_MIN,
	WHIMSY,
	UI_COLORS,
} from "@/constants/theme";

// Slot pips — 26px circles, the mockup's drawing of a seat. Art geometry, not
// spacing, so it is named here rather than borrowed from SPACE. The open pip
// restores the 44pt frame with hitSlop rather than by inflating the dot (the
// IconButton visual/frame split). [B-12]
const PIP_SIZE = 26;
const PIP_HIT = (TAP_MIN - PIP_SIZE) / 2;
const PIP_PLUS = ART_SIZE.mark;
// The mark riding a full-width CTA / the milestone line — one step under the
// label, so the word leads and the drawing follows.
const CTA_ICON = SPACE.lg;
const MILESTONE_ICON = SPACE.lg;

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
	// Leader-only recruiting picker (all-time truffle diggers + search; can poach).
	const [playerPickerOpen, setPlayerPickerOpen] = useState(false);
	const [oinkOpen, setOinkOpen] = useState(false);
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
	// The three irreversible acts on this card confirm before they fire — one
	// grammar (`ConfirmDialog`), not a two-tap arm and a bare link. [B-03]
	const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
	const [confirmLeave, setConfirmLeave] = useState(false);
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
		setKickTarget(null);
		setNote(null);
		const r = await kickCrewMember(userId);
		if (!r.ok) {
			setNote("Couldn't remove them — try again.");
		}
		await crewHook.refresh();
	}

	async function onLeave() {
		setConfirmLeave(false);
		setNote(null);
		await leave();
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
		return <LoadingBeat label="rounding up your sounder" />;
	}

	// The founding form (Frame B). Leads with the "nobody's asked you in
	// yet" kicker when it's the only way in; expanded quietly otherwise.
	const foundForm = (leading: boolean) => (
		<View style={!leading && styles.sectGap}>
			{leading && <CrewSectionKicker plain>nobody's asked you in yet</CrewSectionKicker>}
			<Button
				variant="gold"
				size="lg"
				full
				onPress={onCreate}
				loading={busy}
				icon={<FlagIcon size={ART_SIZE.glyphSm} />}
				accessibilityHint="Raises a new banner and names your Sounder for you"
				style={styles.foundBtn}
			>
				Found the Sounder
			</Button>
			<Hand tone="secondary" align="center" style={styles.foundCopy}>
				raise the first banner — we'll name your{"\n"}Sounder for you, and the herd fills in behind.
			</Hand>
		</View>
	);

	if (!crew.crew) {
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
													<SunPill
														onPress={() => onAccept(inv)}
														accessibilityLabel={`Join ${inv.crew_name}`}
														accessibilityHint="Takes the open seat — you can only ride with one Sounder"
													>
														Join
													</SunPill>
													<HandLink
														onPress={() => decline(inv.id)}
														accessibilityLabel={`Decline the invite to ${inv.crew_name}`}
														accessibilityHint="Turns the ask down; they can ask again later"
													>
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
							<HandLink
								onPress={() => setFoundOpen(true)}
								glyph="arrowRight"
								style={styles.foundLink}
								accessibilityHint="Opens the form that raises your own banner"
							>
								or found your own
							</HandLink>
						)
					) : (
						foundForm(true)
					)}
				</Sticker>

				{note && (
					<T role="bodySm" tone="accent" align="center" style={styles.note}>
						{note}
					</T>
				)}
			</ScrollView>
		);
	}

	// Narrowed above (the crewless branch returned); a const so JSX callbacks
	// below keep the non-null type.
	const myCrew = crew.crew;

	return (
		<ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
			{/* Crew mini card — name, count, a pip per CREW_CAP slot (every
			    open slot is a "+" into the friends picker), roster, CTA. */}
			<Sticker color="paper" rotate={0} radius={RADII.xl} style={styles.crewMini}>
				<View style={styles.crewTop}>
					<SectionTitle numberOfLines={1} style={styles.crewName} accessibilityRole="header">
						{myCrew.name}
					</SectionTitle>
					<T role="body" tone="secondary" style={styles.crewCount}>
						{memberCount}/{CREW_CAP}
					</T>
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
								style={({ pressed }) => [styles.pipOpen, pressed && PRESSED_FLAT]}
								hitSlop={PIP_HIT}
								accessibilityRole="button"
								accessibilityLabel="Open slot"
								accessibilityHint="Opens the friends list to fill this seat"
							>
								<Icon name="plus" size={PIP_PLUS} color={UI_COLORS.uiMuted} strokeWidth={3} />
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
						glyph="arrowRight"
						onPress={() => setCrownOpen(true)}
						style={styles.crownLink}
						accessibilityLabel="You wear the crown — pass it before you leave"
						accessibilityHint="Opens the pass-the-crown sheet"
					>
						you wear the crown · pass it before you leave
					</HandLink>
				) : openSlots > 0 ? (
					<T role="kicker" tone="secondary" style={styles.slotHint}>
						{openSlots} open {openSlots === 1 ? "slot" : "slots"} · tap an open slot
						or the button below to fill them
					</T>
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
										bowId={rosterProfiles.get(m.user_id)?.bowId ?? null}
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
										onPress={() =>
											setKickTarget({ id: m.user_id, name: m.username ?? "Pig" })
										}
										accessibilityLabel={`Remove ${m.username ?? "this pig"} from the Sounder`}
										accessibilityHint="Asks you to confirm first"
									>
										kick
									</HandLink>
								) : undefined
							}
							onPress={() => setSelectedUserId(m.user_id)}
							accessibilityHint="Opens their profile"
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
							right={
								<HandLink
									onPress={() => onCancel(i.id)}
									accessibilityLabel={`Take back the invite to ${i.invitee_name ?? "them"}`}
									accessibilityHint="Cancels the ask and frees the seat it was holding"
								>
									take it back
								</HandLink>
							}
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
									<SunPill
										onPress={() => onAcceptRequest(req.id)}
										accessibilityLabel={`Let ${req.username ?? "them"} into the Sounder`}
										accessibilityHint="Gives them one of your open seats"
									>
										let them in
									</SunPill>
									<HandLink
										onPress={() => declineRequest(req.id)}
										accessibilityLabel={`Turn down ${req.username ?? "their"} knock`}
										accessibilityHint="They can knock again later"
									>
										not now
									</HandLink>
								</>
							}
						/>
					))}
				</View>

				{openSlots > 0 && (
					<Button
						variant="gold"
						full
						onPress={() => setPickerOpen(true)}
						icon={<Icon name="plus" size={CTA_ICON} color={WHIMSY.goldInk} strokeWidth={2.6} />}
						accessibilityHint="Opens your friends list so you can fill an open seat"
						style={styles.cta}
					>
						Call a snout to your banner
					</Button>
				)}
				{/* Leaders reach beyond friends: all-time truffle diggers + username search
				    (can poach a rider from another Sounder — they choose to switch). */}
				{openSlots > 0 && isLeader && (
					<Button
						variant="gold"
						full
						onPress={() => setPlayerPickerOpen(true)}
						icon={<Icon name="search" size={CTA_ICON} color={WHIMSY.goldInk} strokeWidth={2.6} />}
						accessibilityHint="Opens the recruiting list — any digger, not just friends"
						style={styles.cta}
					>
						Recruit any snout
					</Button>
				)}
				<Button
					variant="ghost"
					size="sm"
					full
					onPress={() => setOinkOpen(true)}
					icon={<Icon name="bell" size={CTA_ICON} color={WHIMSY.ink} strokeWidth={2.4} />}
					accessibilityHint="Opens the preset notes you can send the herd — one of each per Feeding"
					style={styles.cta}
				>
					Oink the Sounder
				</Button>
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
							sub={`you're riding with ${theCrew(myCrew.name)}`}
							right={
							<HandLink
								onPress={() => decline(inv.id)}
								accessibilityLabel={`Let the invite to ${inv.crew_name} go`}
								accessibilityHint="Clears the ask; you stay with your Sounder"
							>
								let it go
							</HandLink>
						}
						/>
					))}
					<Hand tone="accent" align="center" style={styles.oneSounderCopy}>
						one Sounder at a time —{"\n"}leave yours to answer an invite.
					</Hand>
				</Sticker>
			)}

			{/* The Golden Truffle economy — the rewards catalog + the Exchange.
			    (The herd milestone summary leads the card.) */}
			<Sticker color="paper" rotate={0.4} radius={RADII.xl} style={styles.crewMini}>
				{/* Herd dig-milestone summary — the Sounder's lifetime finds toward
				    the next re-themed title (quiet accomplishment, never a chore). */}
				<MilestoneSummary lifetimeFinds={crew.lifetime_finds} />
				<View style={styles.troveRow}>
					<Chip
						label="Rewards"
						icon="trophy"
						tone="paper"
						onPress={() => setSpoilsOpen(true)}
						accessibilityHint="Opens the Golden Truffle rewards catalog"
					/>
					<Chip
						label={truffles.available ? `Exchange · ${truffles.balance}` : "Exchange"}
						icon={HAT_IMAGES.golden_truffle ? undefined : "gift"}
						art={HAT_IMAGES.golden_truffle ?? undefined}
						tone="paper"
						onPress={() => setExchangeOpen(true)}
						accessibilityLabel={
							truffles.available
								? `Truffle Exchange · ${truffles.balance} golden truffles`
								: "Truffle Exchange"
						}
						accessibilityHint="Opens the Truffle Exchange"
					/>
				</View>
			</Sticker>

			{/* Leaving is easy but quiet — a hand-written line, not a button. It
			    still confirms: the seat is gone the moment you tap, and a full
			    banner won't take you back. Warm, never shaming. [B-03] */}
			<HandLink
				onPress={() => setConfirmLeave(true)}
				style={styles.leaveWrap}
				accessibilityLabel="Leave your Sounder"
				accessibilityHint="Asks you to confirm first"
			>
				leave your Sounder · no hard feelings
			</HandLink>

			<FriendInvitePicker
				visible={pickerOpen}
				onDismiss={() => setPickerOpen(false)}
				crewHook={crewHook}
			/>

			<PlayerInvitePicker
				visible={playerPickerOpen}
				onDismiss={() => setPlayerPickerOpen(false)}
				crewHook={crewHook}
			/>

			<SounderOinkSheet
				visible={oinkOpen}
				onDismiss={() => setOinkOpen(false)}
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

			<ConfirmDialog
				open={confirmLeave}
				tone="warm"
				title="Leave your Sounder?"
				body={`You give up your seat in ${theCrew(myCrew.name)}. If the banner fills up, there's no way back in.`}
				confirmLabel="Leave"
				confirmHint="Gives up your seat and forfeits this week's spoils claim"
				cancelLabel="Stay"
				cancelHint="Keeps your seat"
				onConfirm={onLeave}
				onCancel={() => setConfirmLeave(false)}
			/>

			<ConfirmDialog
				open={kickTarget !== null}
				tone="destructive"
				title={kickTarget ? `Remove ${kickTarget.name}?` : "Remove them?"}
				body={`${kickTarget?.name ?? "They"} loses their seat in ${theCrew(myCrew.name)} right away. You can invite them back if a slot opens.`}
				confirmLabel="Remove"
				confirmHint={`Takes ${kickTarget?.name ?? "their"} seat back at once`}
				cancelLabel="Keep them"
				cancelHint="Leaves the roster as it is"
				onConfirm={() => kickTarget && onKick(kickTarget.id)}
				onCancel={() => setKickTarget(null)}
			/>

			{note && (
				<T role="bodySm" tone="accent" align="center" style={styles.note}>
					{note}
				</T>
			)}
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
			<Icon name="trophy" size={MILESTONE_ICON} color={WHIMSY.accent} />
			<Hand tone="secondary" numberOfLines={1} style={styles.milestoneText}>
				{line}
			</Hand>
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
	milestoneText: { flexShrink: 1 },
	content: { padding: PAGE_PAD, paddingBottom: TAB_SAFE, gap: SPACE.md },
	// The one paper sticker the crewless states live in (Frames A & B).
	muster: { padding: SPACE.lg, paddingBottom: SPACE.lg },
	sectGap: { marginTop: SPACE.lg },
	staleNote: { marginLeft: CREW_ROW_INDENT, marginTop: SPACE.xxs },
	foundLink: { alignSelf: "center", marginTop: SPACE.lg },
	foundBtn: { marginTop: SPACE.md },
	foundCopy: { marginTop: SPACE.md },
	// Crew mini card (Frame D).
	crewMini: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.card },
	crewTop: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	crewName: { flexShrink: 1 },
	crewCount: { fontFamily: FONTS.display },
	pips: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.sm },
	// Slot dots. Filled: sun with the SHADOW_SM tier (the design's 1.5px
	// micro-shadow rounds up to the small tier; the two-tier rule holds).
	pip: {
		width: PIP_SIZE,
		height: PIP_SIZE,
		borderRadius: PIP_SIZE / 2,
		borderWidth: BORDER.heavy,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		...SHADOW_SM,
	},
	// Open: dashed muteSoft ring around the "+" into the friends picker.
	pipOpen: {
		width: PIP_SIZE,
		height: PIP_SIZE,
		borderRadius: PIP_SIZE / 2,
		borderWidth: BORDER.heavy,
		borderStyle: "dashed",
		borderColor: UI_COLORS.uiMuted,
		alignItems: "center",
		justifyContent: "center",
	},
	// Reserved: an ask is out. A dashed SUN ring — half-lit toward filled, so a
	// pending seat reads as "spoken for", not "open". Decorative dimming, not a
	// disabled control, so the opacity ladder is the right tool here.
	pipPending: {
		width: PIP_SIZE,
		height: PIP_SIZE,
		borderRadius: PIP_SIZE / 2,
		borderWidth: BORDER.heavy,
		borderStyle: "dashed",
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		opacity: OPACITY.dim,
	},
	slotHint: { marginTop: SPACE.sm },
	crownLink: { marginTop: SPACE.xs },
	roster: { marginTop: SPACE.sm },
	cta: { marginTop: SPACE.md },
	oneSounderCopy: { marginTop: SPACE.lg },
	// Golden Truffle economy doors — the two chips into the rewards catalog and
	// the Exchange.
	troveRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: SPACE.xl,
		marginTop: SPACE.md,
	},
	leaveWrap: { alignSelf: "center", marginTop: SPACE.xs, marginBottom: SPACE.sm },
	note: { marginTop: SPACE.xs },
});
