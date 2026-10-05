// Invite pigs to a table. Pick the game (when the sheet was not opened from
// one), then who: Friends (pick up to the table's empty chairs, each friend
// shown with their pig), Your Sounder (one ping to every crewmate, first pigs
// to tap take the seats; offered only to a pig who rides with one), or A link
// (anyone holding it can sit down; the share sheet opens with it). Live or
// by post, when the game plays both. Creating the invite opens its table's
// lobby, where the link stays to copy and share.

import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
	Button,
	CardTitle,
	EmptyState,
	Hand,
	Icon,
	Kicker,
	ListRow,
	LoadingBeat,
	PigAvatar,
	SegmentedControl,
	Sheet,
	Sticker,
	T,
	type SegmentOption,
} from "@/components/ui";
import { ART_SIZE, AVATAR_SIZE, BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import type { CreateInviteRequest, PlayResult } from "@/hooks/useMultiplayer";
import { GAMES, GAME_IDS } from "@/multiplayer/games";
import type { InviteKind, InviteSummary, PlayerCard } from "@/multiplayer/protocol";
import type { GameId, Pace } from "@/multiplayer/types";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { GAME_ICONS } from "./playArt";
import { GAME_ICON_CARD } from "./layout";
import { INVITE_SHEET_COPY, defaultPace, fill } from "./playCopy";
import { showRefusal } from "./refusal";
import { useInviteTargets } from "./useInviteTargets";

// A game tile: three across a phone, like the Trader's offers.
const TILE_MIN_W = 96;
const TILE_MAX_W = "32%";
// The selected mark on a friend's row: a sage disc with a check.
const CHECK_DISC = 28;

type Who = "direct" | "crew" | "link";

export interface InviteSheetProps {
	open: boolean;
	onClose: () => void;
	/** The game, when opened from its sheet; null asks the player to pick. */
	game: GameId | null;
	asyncAllowed: boolean;
	onCreate: (request: CreateInviteRequest) => Promise<PlayResult<{ invite: InviteSummary | null }>>;
	/** The invite exists: the caller closes the sheet and opens the lobby. */
	onCreated: (invite: InviteSummary | null, kind: InviteKind) => void;
}

export function InviteSheet({ open, onClose, game, asyncAllowed, onCreate, onCreated }: InviteSheetProps) {
	const targets = useInviteTargets(open);
	// A fresh sheet every opening (adjusted during render, no effect).
	const [openSeen, setOpenSeen] = useState(open);
	const [picked, setPicked] = useState<GameId | null>(game);
	const [who, setWho] = useState<Who>("direct");
	const [selected, setSelected] = useState<string[]>([]);
	const [pace, setPace] = useState<Pace>("live");
	const [busy, setBusy] = useState(false);
	if (openSeen !== open) {
		setOpenSeen(open);
		if (open) {
			setPicked(game);
			setWho("direct");
			setSelected([]);
			setPace(game ? defaultPace(GAMES[game].paces) : "live");
		}
	}

	const def = picked ? GAMES[picked] : null;
	const maxFriends = def ? Math.max(1, def.seats.max - 1) : 1;
	const paces = def ? def.paces.filter((p) => p === "live" || asyncAllowed) : [];
	const crew = targets.crewName;
	const whoOptions: SegmentOption<Who>[] = [
		{ value: "direct", label: INVITE_SHEET_COPY.friends, accessibilityHint: "Invite friends by name" },
		...(crew ? [{ value: "crew" as const, label: INVITE_SHEET_COPY.crew, accessibilityHint: "Invite everyone in your Sounder" }] : []),
		{ value: "link", label: INVITE_SHEET_COPY.link, accessibilityHint: "Make a link anyone can open" },
	];
	const effectiveWho: Who = who === "crew" && !crew ? "direct" : who;

	const pick = (id: GameId) => {
		Haptics.selectionAsync().catch(() => {});
		setPicked(id);
		setSelected([]);
		setPace(defaultPace(GAMES[id].paces));
	};

	const toggle = (userId: string) => {
		Haptics.selectionAsync().catch(() => {});
		setSelected((cur) => {
			if (cur.includes(userId)) return cur.filter((id) => id !== userId);
			if (maxFriends === 1) return [userId];
			return cur.length >= maxFriends ? cur : [...cur, userId];
		});
	};

	const send = async () => {
		if (!picked || busy) return;
		if (effectiveWho === "direct" && selected.length === 0) return;
		setBusy(true);
		const request: CreateInviteRequest =
			effectiveWho === "direct" ? { game: picked, kind: "direct", to: selected, pace } : { game: picked, kind: effectiveWho, pace };
		const res = await onCreate(request);
		setBusy(false);
		if (!res.ok) {
			showRefusal("invite", res.error);
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		onCreated(res.invite, request.kind);
	};

	const firstName = targets.friends?.find((f) => f.userId === selected[0])?.name ?? "";
	const commitLabel =
		effectiveWho === "crew"
			? INVITE_SHEET_COPY.inviteCrew
			: effectiveWho === "link"
				? INVITE_SHEET_COPY.makeLink
				: selected.length === 0
					? INVITE_SHEET_COPY.inviteNone
					: selected.length === 1
						? fill(INVITE_SHEET_COPY.inviteOne, { name: firstName })
						: fill(INVITE_SHEET_COPY.inviteMany, { n: String(selected.length) });
	const commitHint =
		effectiveWho === "crew"
			? INVITE_SHEET_COPY.inviteHintCrew
			: effectiveWho === "link"
				? INVITE_SHEET_COPY.inviteHintLink
				: INVITE_SHEET_COPY.inviteHintFriends;

	const footer = def ? (
		<Button
			variant="primary"
			size="lg"
			full
			disabled={effectiveWho === "direct" && selected.length === 0}
			loading={busy}
			loadingLabel="sending"
			onPress={() => void send()}
			accessibilityHint={commitHint}
			testID="invite-send"
		>
			{commitLabel}
		</Button>
	) : undefined;

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker={INVITE_SHEET_COPY.kicker}
			title={def ? INVITE_SHEET_COPY.whoTitle : INVITE_SHEET_COPY.pickTitle}
			subtitle={def ? def.title : undefined}
			footer={footer}
			testID="invite-sheet"
		>
			{!def ? (
				<View style={styles.tiles} accessibilityRole="list">
					{GAME_IDS.map((id) => (
						<Sticker
							key={id}
							color="paper"
							radius={RADII.lg}
							shadow="sm"
							rotate={0}
							onPress={() => pick(id)}
							accessibilityLabel={GAMES[id].title}
							accessibilityHint={fill(INVITE_SHEET_COPY.pickHint, { game: GAMES[id].title })}
							style={styles.tile}
							testID={`invite-game-${id}`}
						>
							<Image source={GAME_ICONS[id]} resizeMode="contain" style={styles.tileIcon} />
							<T role="kicker" align="center" numberOfLines={2}>
								{GAMES[id].title}
							</T>
						</Sticker>
					))}
				</View>
			) : (
				<View style={styles.body}>
					{game === null ? (
						<Button variant="handLink" size="sm" onPress={() => setPicked(null)} accessibilityHint={INVITE_SHEET_COPY.backHint} style={styles.back}>
							{`‹ ${INVITE_SHEET_COPY.back}`}
						</Button>
					) : null}
					<SegmentedControl label={INVITE_SHEET_COPY.kindsLabel} options={whoOptions} value={effectiveWho} onChange={setWho} />
					{paces.length > 1 ? (
						<SegmentedControl
							label={INVITE_SHEET_COPY.paceLabel}
							options={[
								{ value: "live", label: INVITE_SHEET_COPY.live, accessibilityHint: "Everyone plays now" },
								{ value: "async", label: INVITE_SHEET_COPY.byPost, accessibilityHint: "A move a day, with a ping when it's your turn" },
							]}
							value={pace}
							onChange={setPace}
						/>
					) : null}

					{effectiveWho === "direct" ? (
						<FriendPicker
							friends={targets.friends}
							loading={targets.loading}
							selected={selected}
							max={maxFriends}
							onToggle={toggle}
							onRetry={targets.retry}
						/>
					) : effectiveWho === "crew" ? (
						<Sticker color="sage" pad rotate={0} shadow="sm">
							<Kicker>{crew ?? ""}</Kicker>
							<Hand>{fill(INVITE_SHEET_COPY.crewLine, { crew: crew ?? "" })}</Hand>
						</Sticker>
					) : (
						<Sticker color="sky" pad rotate={0} shadow="sm">
							<CardTitle>{INVITE_SHEET_COPY.link}</CardTitle>
							<Hand>{pace === "async" ? INVITE_SHEET_COPY.linkLineAsync : INVITE_SHEET_COPY.linkLine}</Hand>
						</Sticker>
					)}
				</View>
			)}
		</Sheet>
	);
}

function FriendPicker({
	friends,
	loading,
	selected,
	max,
	onToggle,
	onRetry,
}: {
	friends: PlayerCard[] | null;
	loading: boolean;
	selected: string[];
	max: number;
	onToggle: (userId: string) => void;
	onRetry: () => void;
}) {
	if (loading) return <LoadingBeat label={INVITE_SHEET_COPY.loadingFriends} />;
	if (friends === null) {
		return (
			<EmptyState
				kind="error"
				sub={INVITE_SHEET_COPY.friendsError}
				action={
					<Button variant="ghost" size="sm" onPress={onRetry} accessibilityHint={INVITE_SHEET_COPY.retryHint}>
						{INVITE_SHEET_COPY.retry}
					</Button>
				}
			/>
		);
	}
	if (friends.length === 0) return <EmptyState glyph="friends" title={INVITE_SHEET_COPY.noFriendsTitle} sub={INVITE_SHEET_COPY.noFriendsSub} />;
	const full = selected.length >= max && max > 1;
	return (
		<View style={styles.friends}>
			<Hand tone="secondary">{full ? INVITE_SHEET_COPY.full : max === 1 ? INVITE_SHEET_COPY.upToOne : fill(INVITE_SHEET_COPY.upTo, { n: String(max) })}</Hand>
			{friends.map((friend, i) => {
				const on = selected.includes(friend.userId);
				const pig = pigStagePropsForLook(friend.look);
				return (
					<ListRow
						key={friend.userId}
						index={i}
						selected={on}
						fill={on ? "sun" : "paper"}
						disabled={!on && full}
						leading={<PigAvatar size={AVATAR_SIZE[1]} pigId={pig.pigId} hatId={friend.look.hat} bowId={friend.look.bow} mode="worn" />}
						title={
							<T role="cardTitleSm" numberOfLines={1}>
								{friend.name}
							</T>
						}
						trailing={
							on ? (
								<View style={styles.check}>
									<Icon name="check" size={ART_SIZE.mark} color={UI_COLORS.textPrimary} />
								</View>
							) : undefined
						}
						onPress={() => onToggle(friend.userId)}
						accessibilityLabel={friend.name}
						accessibilityHint={on ? INVITE_SHEET_COPY.unselectHint : INVITE_SHEET_COPY.selectHint}
						testID={`invite-friend-${friend.userId}`}
					/>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	tile: {
		flexGrow: 1,
		flexBasis: TILE_MIN_W,
		maxWidth: TILE_MAX_W,
		alignItems: "center",
		gap: SPACE.xxs,
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.xs,
	},
	tileIcon: { width: GAME_ICON_CARD, height: GAME_ICON_CARD },
	body: { gap: SPACE.md },
	back: { alignSelf: "flex-start" },
	friends: { gap: SPACE.sm },
	check: {
		width: CHECK_DISC,
		height: CHECK_DISC,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sage,
		alignItems: "center",
		justifyContent: "center",
	},
});
