// The daily ritual picker. One component, two modes:
//   mode="bless" → casts today's blessing via send_blessing
//   mode="curse" → casts today's curse via send_curse
//
// The kind is NOT chosen by the user — it's whatever today's rotation
// surfaces. Mounted from UserSheet as a small inline panel.
//
// It renders one of five phases so every outcome is a clear state,
// not a one-line error:
//   ready  — today's ritual + a Cast button
//   sent   — "✦ sent ✦" confirmation
//   done   — you already cast this ritual on this friend today
//   capped — you've used all today's blessings & curses
//   error  — an unexpected failure; the Cast button stays for a retry
//
// Audit A-05: casting is an irreversible, once-per-friend-per-day social send,
// so the Cast control names its target in its label and its consequence in its
// hint, and reports `disabled` as state. A-15: the cap / in-flight state is the
// `Button` primitive's "asleep" chrome (muted fill, outline kept) instead of the
// old `opacity: 0.7`, which spelled pressed and disabled the same way.
import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Button } from "./ui/Button";
import { GameIcon } from "./ui/GameIcon";
import { RitualIconWell } from "./ui/RitualIconWell";
import { CardTitle, Hand, Kicker, Label, T } from "./ui/Text";
import { Sticker } from "./ui/Sticker";
import { useRitualCaster } from "@/hooks/useRitualCaster";
import { untilDailyReset, type RitualMode } from "../utils/rituals";
import { BORDER, OPACITY, RADII, SPACE, WHIMSY } from "@/constants/theme";

// The kicker's mark uses the shared ritual vocabulary at the kicker's cap height.
const KICKER_ICON = SPACE.lg;
// The ritual art on a terminal beat (sent / done). A drawing constant: the size
// the ritual icon assets read at as the beat's subject rather than a marker.
const BEAT_ICON = 56;
// The ritual well in the ready state — bigger than the shared 40pt well because
// here the art IS the offer.
const WELL_SIZE = 60;
const WELL_FILL = 0.84;

interface Props {
	mode: RitualMode;
	targetUserId: string;
	targetName: string;
	// Fired after a successful cast so the parent can refresh.
	onCast?: () => void;
}

type Phase = "ready" | "sent" | "done" | "capped" | "error";

export function RitualPicker({ mode, targetUserId, targetName, onCast }: Props) {
	const [busy, setBusy] = useState(false);
	const [phase, setPhase] = useState<Phase>("ready");
	const [result, setResult] = useState<string | null>(null);

	// The panel no longer owns any of this — today's ritual, the allowance, the
	// RPC and the haptics all live in the shared caster, so the friend-row doors
	// and this panel cast the same ritual the same way.
	const caster = useRitualCaster();
	const ritual = caster.today(mode);
	const usage = caster.usage(mode);
	const isBless = mode === "bless";

	const remaining = usage ? usage.remaining : null;

	const cast = async () => {
		if (busy) return;
		setBusy(true);
		setResult(null);
		const outcome = await caster.cast(mode, targetUserId, targetName);
		setBusy(false);

		if (outcome.kind === "sent") {
			setResult(outcome.text);
			setPhase("sent");
			onCast?.();
			return;
		}
		if (outcome.kind === "done") {
			setPhase("done");
		} else if (outcome.kind === "capped") {
			setPhase("capped");
		} else {
			setResult(outcome.text);
			setPhase("error");
		}
	};

	const spent = remaining === 0;
	const castLabel = isBless ? `Bless ${targetName}` : `Curse ${targetName}`;

	return (
		<Sticker
			color={isBless ? WHIMSY.sun : WHIMSY.curseSurface}
			rotate={0}
			radius={RADII.lg}
			border={BORDER.ink}
			shadow="none"
			style={styles.wrap}
		>
			{/* The kicker names the mode — the two sides share one drawing: a
			    hand-drawn mark beside a hand-script line. */}
			<View style={styles.kickerRow}>
				<GameIcon name={mode} size={KICKER_ICON} />
				<Kicker star={false}>
					{isBless ? "today's blessing" : "today's curse"}
				</Kicker>
			</View>

			{/* sent — the cast landed */}
			{phase === "sent" && (
				<View style={styles.beat}>
					<Image source={ritual.icon} style={styles.beatImg} />
					<CardTitle align="center">
						{isBless ? "✦ blessing sent ✦" : "✦ curse cast ✦"}
					</CardTitle>
					<Hand align="center" style={styles.beatSub}>
						{result}
					</Hand>
					<Label align="center" style={styles.beatEffect}>
						{ritual.blurb}
					</Label>
				</View>
			)}

			{/* done — already cast this ritual on this friend today */}
			{phase === "done" && (
				<View style={styles.beat}>
					<Image
						source={ritual.icon}
						style={[styles.beatImg, styles.beatImgSpent]}
					/>
					<CardTitle align="center">
						{isBless ? "already blessed today" : "already cursed today"}
					</CardTitle>
					<Hand align="center" style={styles.beatSub}>
						Next {isBless ? "blessing" : "curse"} in {untilDailyReset()} —
						one per friend a day.
					</Hand>
				</View>
			)}

			{/* capped — today's blessing (or curse) is already spent */}
			{phase === "capped" && (
				<View style={styles.beat}>
					<CardTitle align="center">
						{isBless ? "blessing spent" : "curse spent"}
					</CardTitle>
					<Hand align="center" style={styles.beatSub}>
						{usage
							? `All ${usage.cap} ${isBless ? "blessings" : "curses"} used today`
							: `${isBless ? "Blessings" : "Curses"} spent`}{" "}
						— your next is in {untilDailyReset()}.
					</Hand>
				</View>
			)}

			{/* ready / error — the picker + Cast button */}
			{(phase === "ready" || phase === "error") && (
				<>
					<View style={styles.ritualRow}>
						{/* No corner badge — the kicker above already names
						    the mode (today's blessing / today's curse). */}
						<RitualIconWell
							icon={ritual.icon}
							blessed={isBless}
							size={WELL_SIZE}
							fillRatio={WELL_FILL}
							badge={false}
						/>
						<View style={styles.ritualText}>
							<T role="cardTitleSm">{ritual.name}</T>
							<Hand>{ritual.blurb}</Hand>
						</View>
					</View>
					<Button
						variant="ghost"
						full
						testID="ritual-cast"
						onPress={cast}
						disabled={spent}
						loading={busy}
						accessibilityLabel={castLabel}
						accessibilityHint={
							isBless
								? `Sends today's blessing to ${targetName}. One blessing per friend a day — it can't be taken back.`
								: `Casts today's curse on ${targetName}. One curse per friend a day — it can't be taken back.`
						}
						accessibilityState={{ disabled: busy || spent }}
					>
						{castLabel}
					</Button>
					{remaining !== null && usage && (
						<T role="kicker" tone="secondary" align="center" style={styles.left}>
							{remaining} of {usage.cap} {isBless ? "blessings" : "curses"} left
							today · resets in {untilDailyReset()}
						</T>
					)}
					{phase === "error" && !!result && (
						<Hand align="center" style={styles.result}>
							{result}
						</Hand>
					)}
				</>
			)}
		</Sticker>
	);
}

const styles = StyleSheet.create({
	wrap: {
		padding: SPACE.md,
		marginTop: SPACE.md,
	},
	kickerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		marginBottom: SPACE.sm,
	},
	ritualRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		marginBottom: SPACE.md,
	},
	ritualText: {
		flex: 1,
		minWidth: 0,
	},
	result: {
		marginTop: SPACE.sm,
	},
	left: {
		marginTop: SPACE.sm,
	},
	// Shared terminal-state layout (sent / done / capped).
	beat: {
		alignItems: "center",
		paddingVertical: SPACE.sm,
	},
	beatImg: {
		width: BEAT_ICON,
		height: BEAT_ICON,
		resizeMode: "contain",
		marginBottom: SPACE.xs,
	},
	// The spent ritual's art is a ghost of itself — decorative, not a control,
	// so it may fade where a disabled button may not.
	beatImgSpent: {
		opacity: OPACITY.ghost,
	},
	beatSub: {
		marginTop: SPACE.xxs,
	},
	// The effect itself ("2× tickle regen for an hour") so the caster sees what
	// the ritual actually does, not just that it sent.
	beatEffect: {
		marginTop: SPACE.xs,
	},
});
