// The invite landing: what a tapped invite link or invite push opens
// (app/play/[code].tsx). It previews the invite (useInvites().preview, which
// waits for the socket to come up) and shows who is asking: the inviter's
// pig, "Clover invited you to play Rootle", the game's icon and its one
// sentence, the seats taken and the time left. Join the table takes the seat
// and opens the table; Not now turns a direct invite down (the inviter hears
// "not this time") and simply steps away from a link or a Sounder invite.
//
// Every other way an invite can end is one warm state with a way on ("Find a
// pig instead"): it wandered off (expired), the table filled up, it was
// called off, or there is no such table. A pig already seated at it goes
// straight to the table. Signed out: a line asking them to sign in and tap
// the link again (no session juggling here). Play switched off: the hub's
// "on its way" line.
//
// The crown is pinned above the scroller, so it states its type ceiling; the
// scroller runs to the screen's foot and ends on the stack scroll pad.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import {
	Button,
	CardTitle,
	EmptyState,
	Hand,
	LoadingBeat,
	PageHeader,
	SectionTitle,
	STACK_SCROLL_EDGES,
	StackPage,
	Sticker,
	Tag,
	useStackScrollPad,
} from "@/components/ui";
import { CHROME_TYPE_CAP, PAGE_PAD, SPACE, TILT } from "@/constants/theme";
import { useInvites, usePlay, usePlayConnection, usePlayEnabled, useServerClock } from "@/hooks/useMultiplayer";
import { getGame } from "@/multiplayer/games";
import type { InviteSummary, RoomSnapshot } from "@/multiplayer/protocol";
import type { PlayErrorCode } from "@/utils/multiplayer/client";
import { errorCopy, inviteLine } from "@/utils/multiplayer/copy";
import { ConnectionBanner } from "./ConnectionBanner";
import { gameSentence } from "./GameCard";
import { GAME_ICONS } from "./playArt";
import { TablePig } from "./TablePig";
import { GAME_ICON_HERO, LANDING_PIG } from "./layout";
import { enterTable, leaveToHome, openHub } from "./nav";
import { GAME_COPY, HUB_COPY, LANDING_COPY, fill, leftWords } from "./playCopy";
import { showRefusal } from "./refusal";
import { claimTable } from "./tableClaims";
import { useSessionUserId } from "./useSessionUserId";

// The time left on an invite moves by the second near its end.
const LANDING_TICK_MS = 1_000;

type Loaded =
	| { key: string; ok: true; invite: InviteSummary | null; room: RoomSnapshot | null }
	| { key: string; ok: false; error: PlayErrorCode };

type Ended = "expired" | "full" | "cancelled" | "missing" | "blocked";

/** How an invite that cannot be joined ended, or null when it is open. */
export function endedState(invite: InviteSummary | null, error: PlayErrorCode | null, now: number): Ended | null {
	if (error === "expired") return "expired";
	if (error === "full") return "full";
	if (error === "blocked") return "blocked";
	if (error === "not_found" || error === "forbidden" || error === "bad_request") return "missing";
	if (!invite) return error ? null : "missing";
	switch (invite.status) {
		case "expired":
		case "declined":
			return "expired";
		case "full":
		case "accepted":
			return "full";
		case "cancelled":
			return "cancelled";
		default:
			return invite.expiresAt <= now ? "expired" : null;
	}
}

export function InviteLanding({ code }: { code: string | null }) {
	const enabled = usePlayEnabled();
	const sessionUserId = useSessionUserId();
	const signedIn = sessionUserId === undefined ? null : sessionUserId !== null;
	const connection = usePlayConnection(enabled && !!code && signedIn === true);
	const play = usePlay();
	const invites = useInvites();
	const now = useServerClock(LANDING_TICK_MS);
	const scrollPad = useStackScrollPad();
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<Loaded | null>(null);
	const [busy, setBusy] = useState<"join" | "decline" | null>(null);
	const key = `${code ?? ""}:${attempt}`;
	const { previewInvite, acceptInvite, declineInvite } = play;

	useEffect(() => {
		if (!enabled || !code || signedIn !== true) return;
		let live = true;
		void previewInvite(code).then((res) => {
			if (!live) return;
			setLoaded(res.ok ? { key, ok: true, invite: res.invite, room: res.room } : { key, ok: false, error: res.error });
		});
		return () => {
			live = false;
		};
	}, [enabled, code, signedIn, key, previewInvite]);

	const current = loaded?.key === key ? loaded : null;
	// The store's copy is the freshest: an invite.state frame (the table filled
	// up, the host called it off) lands there while the player is reading.
	const invite = (code ? invites.byCode(code) : null) ?? (current?.ok ? current.invite : null);
	const previewRoom = current?.ok ? current.room : null;
	const meId = play.me?.userId ?? null;

	// Already at this table (the host, a seat taken on another visit, a tap
	// on the same push twice): straight to it.
	let seatedAt: string | null = null;
	if (invite?.roomId) {
		if (meId !== null && invite.from.userId === meId) seatedAt = invite.roomId;
		else if (previewRoom && previewRoom.roomId === invite.roomId && previewRoom.you !== null) seatedAt = invite.roomId;
		else if (play.games.some((t) => t.roomId === invite.roomId)) seatedAt = invite.roomId;
	}
	// Once: the seat taken by Join and the store learning about it a frame
	// later must not both replace this screen.
	const entered = useRef<string | null>(null);
	const goToTable = useCallback((roomId: string) => {
		if (entered.current === roomId) return;
		entered.current = roomId;
		enterTable(roomId);
	}, []);
	useEffect(() => {
		if (seatedAt) goToTable(seatedAt);
	}, [seatedAt, goToTable]);

	const game = invite ? getGame(invite.game) : null;
	const title = game?.title ?? HUB_COPY.title;

	const join = async () => {
		if (!code || busy) return;
		setBusy("join");
		// This screen opens the table itself: a search the hub is watching
		// underneath must not open it too.
		claimTable(invite?.roomId);
		const res = await acceptInvite(code);
		setBusy(null);
		if (res.ok) {
			const roomId = res.roomId ?? invite?.roomId ?? null;
			if (roomId) goToTable(roomId);
			return;
		}
		if (endedState(null, res.error, now)) {
			// The table ended under the player's thumb: the warm state says it.
			setLoaded({ key, ok: false, error: res.error });
			return;
		}
		showRefusal("accept", res.error);
	};

	const notNow = async () => {
		if (code && invite?.kind === "direct") {
			setBusy("decline");
			await declineInvite(code);
			setBusy(null);
		}
		leaveToHome();
	};

	const frame = (body: ReactNode) => (
		<StackPage testID="invite-landing" edges={STACK_SCROLL_EDGES}>
			<PageHeader kicker={LANDING_COPY.kicker} title={title} onBack={leaveToHome} maxFontSizeMultiplier={CHROME_TYPE_CAP} />
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
				showsVerticalScrollIndicator={false}
				testID="invite-landing-scroll"
			>
				{body}
			</ScrollView>
		</StackPage>
	);

	const instead = (
		<Button variant="ghost" size="sm" onPress={openHub} accessibilityHint={LANDING_COPY.insteadHint} testID="landing-instead">
			{LANDING_COPY.instead}
		</Button>
	);

	if (!enabled) return frame(<EmptyState glyph="zzz" title={HUB_COPY.offTitle} sub={HUB_COPY.offSub} />);
	if (signedIn === false) return frame(<EmptyState glyph="pigface" title={LANDING_COPY.signedOutTitle} sub={LANDING_COPY.signedOutSub} />);
	if (!code) return frame(<EmptyState glyph="search" title={LANDING_COPY.missingTitle} sub={LANDING_COPY.missingSub} action={instead} />);

	const error = current && !current.ok ? current.error : null;
	const ended = current || invite ? endedState(invite, error, now) : null;

	if (seatedAt) return frame(<LoadingBeat label={LANDING_COPY.loading} />);
	if (ended === "expired") return frame(<EmptyState glyph="zzz" title={LANDING_COPY.expiredTitle} sub={LANDING_COPY.expiredSub} action={instead} />);
	if (ended === "full") return frame(<EmptyState glyph="friends" title={LANDING_COPY.fullTitle} sub={LANDING_COPY.fullSub} action={instead} />);
	if (ended === "cancelled") {
		return frame(
			<EmptyState
				glyph="zzz"
				title={fill(LANDING_COPY.cancelledTitle, { name: invite?.from.name ?? "The host" })}
				sub={LANDING_COPY.cancelledSub}
				action={instead}
			/>,
		);
	}
	if (ended === "blocked") return frame(<EmptyState glyph="pigface" title={LANDING_COPY.blockedTitle} sub={LANDING_COPY.blockedSub} action={instead} />);
	if (ended === "missing") return frame(<EmptyState glyph="search" title={LANDING_COPY.missingTitle} sub={LANDING_COPY.missingSub} action={instead} />);
	if (error) {
		return frame(
			<>
				<ConnectionBanner connection={connection} />
				<EmptyState
					kind="error"
					title={LANDING_COPY.errorTitle}
					sub={errorCopy(error)}
					action={
						<Button variant="ghost" size="sm" onPress={() => setAttempt((n) => n + 1)} accessibilityHint={LANDING_COPY.retryHint} testID="landing-retry">
							{HUB_COPY.retry}
						</Button>
					}
				/>
			</>,
		);
	}
	if (!invite) {
		return frame(
			<>
				<ConnectionBanner connection={connection} />
				<LoadingBeat label={LANDING_COPY.loading} />
			</>,
		);
	}

	const line = inviteLine(invite, title);
	const left = leftWords(invite.expiresAt - now);
	return frame(
		<>
			<ConnectionBanner connection={connection} />
			<Sticker color="paper" pad rotate={TILT.card} style={styles.card} testID="landing-card">
				<View style={styles.inviter}>
					<TablePig look={invite.from.look} size={LANDING_PIG} testID="landing-pig" />
					<SectionTitle align="center" accessibilityRole="header">
						{line}
					</SectionTitle>
				</View>
				<View style={styles.game}>
					<Image source={GAME_ICONS[invite.game]} resizeMode="contain" style={styles.icon} />
					<View style={styles.gameWords}>
						<CardTitle>{title}</CardTitle>
						<Hand tone="secondary">{gameSentence({ id: invite.game, tagline: game?.tagline ?? "" })}</Hand>
					</View>
				</View>
				<View style={styles.tags}>
					<Tag flat label={fill(LANDING_COPY.seats, { taken: String(invite.seatsTaken), max: String(invite.seatsMax) })} tone="paper" testID="landing-seats" />
					<Tag flat label={left} tone="sun" icon="clock" testID="landing-left" />
					<Tag flat label={invite.pace === "async" ? GAME_COPY.byPostTag : GAME_COPY.live} tone="sky" />
				</View>
			</Sticker>
			<Button
				variant="primary"
				size="lg"
				full
				loading={busy === "join"}
				loadingLabel="pulling up a chair"
				disabled={busy !== null}
				onPress={() => void join()}
				accessibilityHint={fill(LANDING_COPY.joinHint, { name: invite.from.name })}
				testID="landing-join"
			>
				{LANDING_COPY.join}
			</Button>
			<Button
				variant="ghost"
				full
				loading={busy === "decline"}
				disabled={busy !== null}
				onPress={() => void notNow()}
				accessibilityHint={LANDING_COPY.notNowHint}
				testID="landing-not-now"
			>
				{LANDING_COPY.notNow}
			</Button>
		</>,
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	content: { paddingHorizontal: PAGE_PAD, gap: SPACE.md },
	card: { gap: SPACE.md },
	inviter: { alignItems: "center", gap: SPACE.sm },
	game: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	icon: { width: GAME_ICON_HERO, height: GAME_ICON_HERO },
	gameWords: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs, justifyContent: "center" },
});
