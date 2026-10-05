// The table's clock, under the seat strip.
//
// Live: a track that drains on the table's own clock (useServerClock with the
// table's RoomSource: server time at a real table, the device clock at a
// Practice one) whenever a pig owes a move. The window is the game's own
// (GameUI.clock: Mud Volley and Snout Says fold a reveal beat into their
// deadlines and show only the part a pig can act in), else the room
// deadline. The track turns from sun to rose for the last quarter; it is a
// progression, so it may carry its seconds.
//
// By post: no ticking. One hand line: "Your move · 11h left", or "Waiting
// for Bandit · we'll ping you". Nobody watches a by-post table tick down.

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Hand, Icon, Label, ProgressTrack } from "@/components/ui";
import { ART_SIZE, CHROME_TYPE_CAP, SPACE, UI_COLORS } from "@/constants/theme";
import { useServerClock, type RoomSource } from "@/hooks/useMultiplayer";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { GameUI } from "./types";
import { MATCH_COPY, asyncLine, clockWho, fill } from "./playCopy";

// How often the live track redraws, and the by-post line (minutes are enough).
const LIVE_TICK_MS = 200;
const POST_TICK_MS = 30_000;
// The last quarter of a window reads as hurry.
const HURRY_FRAC = 0.25;

export interface TurnClockProps {
	room: RoomSnapshot;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ui: GameUI<any>;
	source: RoomSource;
	/** The game's decision window at this pace, for a clock first seen mid-turn. */
	decisionMs: number | null;
}

export function TurnClock(props: TurnClockProps) {
	const { room } = props;
	if (room.phase !== "playing" || room.activeSeats.length === 0) return null;
	return room.pace === "async" ? <PostLine {...props} /> : <LiveClock {...props} />;
}

/** The window the track draws: the game's own, else the room deadline with
 *  an opening time the screen observed (or, first seen mid-turn, worked out
 *  from the game's decision window). Null when no clock runs. */
function useWindow({ room, ui, decisionMs }: TurnClockProps, now: number): { opensAt: number; closesAt: number } | null {
	const [seen, setSeen] = useState<{ deadline: number; opensAt: number } | null>(null);
	let custom: { opensAt: number; closesAt: number } | null = null;
	if (ui.clock && room.view !== null) {
		try {
			custom = ui.clock(room.view, room);
		} catch {
			custom = null;
		}
	}
	const deadline = room.deadline;
	let opensAt: number | null = null;
	if (deadline !== null && (!seen || seen.deadline !== deadline)) {
		// A deadline that changed while the screen watched opened just now; one
		// first seen mid-turn opened a decision window ago.
		opensAt = seen === null && decisionMs ? Math.min(deadline - decisionMs, now) : Math.min(now, deadline);
		setSeen({ deadline, opensAt });
	} else if (deadline !== null && seen) {
		opensAt = seen.opensAt;
	}
	if (custom && custom.closesAt > custom.opensAt) return custom;
	if (deadline === null || opensAt === null || deadline <= opensAt) return null;
	return { opensAt, closesAt: deadline };
}

function LiveClock(props: TurnClockProps) {
	const now = useServerClock(LIVE_TICK_MS, props.source);
	const span = useWindow(props, now);
	const who = clockWho(props.room);
	if (!span) {
		return (
			<View style={styles.row} testID="turn-clock">
				<Hand tone={youOwe(props.room) ? "accent" : "secondary"} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					{who}
				</Hand>
			</View>
		);
	}
	const total = span.closesAt - span.opensAt;
	const left = Math.max(0, Math.min(total, span.closesAt - now));
	const seconds = Math.ceil(left / 1000);
	return (
		<View style={styles.row} testID="turn-clock">
			<Hand tone={youOwe(props.room) ? "accent" : "secondary"} numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.who}>
				{who}
			</Hand>
			<ProgressTrack
				value={left}
				max={total}
				tone={left / total > HURRY_FRAC ? "sun" : "rose"}
				height="sm"
				announceValue={false}
				accessibilityLabel={fill(MATCH_COPY.clockLabel, { who, s: String(seconds) })}
				style={styles.track}
			/>
			<Label tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.seconds} testID="turn-clock-seconds">
				{fill(MATCH_COPY.secondsLeft, { s: String(seconds) })}
			</Label>
		</View>
	);
}

function PostLine({ room, source }: TurnClockProps) {
	const now = useServerClock(POST_TICK_MS, source);
	const mine = youOwe(room);
	return (
		<View style={styles.row} testID="turn-clock">
			<Icon name="clock" size={ART_SIZE.mark} color={mine ? UI_COLORS.action : UI_COLORS.textSecondary} />
			<Hand tone={mine ? "accent" : "secondary"} maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.post} testID="turn-clock-post">
				{asyncLine(room, now)}
			</Hand>
		</View>
	);
}

function youOwe(room: RoomSnapshot): boolean {
	return room.you !== null && room.activeSeats.includes(room.you);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: SPACE.xl },
	who: { flexShrink: 1, maxWidth: "45%" },
	track: { flex: 1 },
	seconds: { minWidth: SPACE.xl, textAlign: "right" },
	post: { flex: 1, minWidth: 0 },
});
