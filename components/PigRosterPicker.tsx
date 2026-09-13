// "Who's hanging out?" — the pig roster: pick which pig greets you at home,
// and (once, permanently) recruit your one long-term Slop Club companion.
//
// Wave-3 conformance pass (area B):
//   · the picker was a hand-rolled `Modal` + scrim + its own grabber geometry;
//     it is now the `Sheet` primitive, so it opens the way every other sheet in
//     the app opens and inherits the Reduce-Motion crossfade [B-06, B-25];
//   · the recruit `ConfirmDialog` (which already replaced the system Alert that
//     gated the one permanent choice, B-01) now presents INLINE inside this
//     sheet's own Modal and names the consequence in its confirm hint [B-11];
//   · both `ActivityIndicator`s are gone — the roster load is a `LoadingBeat`
//     and a busy pig is a `Button loading` label swap [B-09];
//   · the action is a `Button`, so the disabled state keeps its whole shape
//     instead of an `opacity: 0.45` crush [B-08] — and it no longer paints ink
//     on the two cool-grey pig accents (then `#646269` / `#4B4A50`), which
//     measured 1.9:1 and 2.9:1 on the button that performs the permanent
//     choice [B-05]. The pig's identity hue survives as `PIG_ACCENT[id].tint`,
//     the pale surface companion the token map exists for. (Both greys were
//     re-picked in wave 4 so every `solid` carries ink at AA too.)
//   · `▾` renders through `Icon` [B-13], the masking tape through `Tape` +
//     `WHIMSY.tape`/`tapeEdge`, and a roster that comes back with no pigs is an
//     ERROR, never an empty shelf [B-02, B-14].
//
// Wave-4: that error is now REACHABLE and retryable. `usePigRoster` used to
// swallow a failed read into `DEFAULT_PIG_ROSTER` — six pigs, Rosie owned,
// nothing recruitable — so the shelf lied instead of failing. The hook exposes
// `error` + `refresh`; this sheet renders `EmptyState kind="error"` with a
// "Try again" that calls it. [B-02] (2026-09-11)
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
	ART_SIZE,
	BORDER,
	PIG_ACCENT,
	RADII,
	SPACE,
	WHIMSY,
} from "@/constants/theme";
import { pigRosterActionMessage, type PigRoster } from "@/utils/pigRoster";
import { pigDefinition, type PigId } from "@/utils/pigs";
import type { RpcResult } from "@/utils/rpc";
import {
	Button,
	ConfirmDialog,
	EmptyState,
	Glyph,
	Icon,
	LoadingBeat,
	PigPortrait,
	Sheet,
	Sticker,
	T,
	Tape,
	type GlyphName,
} from "./ui";

// Card drawing geometry — the scrapbook furniture, not spacing steps.
const CARD_WIDTH = "48.5%";
const ART_HEIGHT = 118;
const PORTRAIT = 112;
const MOTIF_BUBBLE = 28;
const MOTIF_GLYPH = 18;
const TAPE_WIDTH = 52;
const TAPE_HEIGHT = 17;
const TAPE_TOP = -7;
const TAPE_TILT = -2;
const RIBBON_MIN_WIDTH = 100;
const RIBBON_TAIL = 13;
const RIBBON_LIFT = -4;
const RIBBON_TAIL_INSET = -9;
const RIBBON_TAIL_DROP = 7;
const COAT_MIN_HEIGHT = 34;

interface Props {
	roster: PigRoster;
	loading: boolean;
	/** The last roster read never came back — show the error, not the shelf. */
	error?: boolean;
	busyPigId: PigId | null;
	openSignal?: string;
	/** Re-asks for the roster from the error state (`usePigRoster().refresh`). */
	onRetry?: () => void;
	onRecruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	onActivate: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
}

function motifGlyph(motif: ReturnType<typeof pigDefinition>["motif"]): GlyphName {
	switch (motif) {
		case "mask":
			return "mask";
		case "heart":
			return "heart";
		case "spark":
			return "sparkle";
		case "leaf":
		case "wheat":
			return "sun";
		default:
			return "pigface";
	}
}

export function PigRosterPicker({
	roster,
	loading,
	error = false,
	busyPigId,
	openSignal,
	onRetry,
	onRecruit,
	onActivate,
}: Props) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	// The companion choice is permanent, so it's a decision — a ConfirmDialog,
	// never a system Alert. Holds the pig awaiting confirmation.
	const [pendingRecruitId, setPendingRecruitId] = useState<PigId | null>(null);
	const activePig = roster.pigs.find((pig) => pig.id === roster.activePigId);

	useEffect(() => {
		if (openSignal) setOpen(true);
	}, [openSignal]);

	const act = async (pigId: PigId, owned: boolean) => {
		Haptics.selectionAsync().catch(() => {});
		setMessage(null);
		const result = owned ? await onActivate(pigId) : await onRecruit(pigId);
		setMessage(pigRosterActionMessage(result));
		if (result.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		}
	};

	const requestAct = (pigId: PigId, owned: boolean) => {
		if (!owned && roster.recruitedPigId) return;
		if (!owned) {
			setPendingRecruitId(pigId);
			return;
		}
		void act(pigId, owned);
	};

	const pendingRecruitPig = pendingRecruitId
		? pigDefinition(pendingRecruitId)
		: null;

	const rosterBody =
		loading && busyPigId == null ? (
			<LoadingBeat label="rounding up the pigs" />
		) : error || roster.pigs.length === 0 ? (
			// A roster that didn't come back — or came back with no pigs — is a
			// failed read, not an empty shelf: every player owns Rosie. A null
			// fetch is never an empty state, and the retry is on the card.
			<EmptyState
				kind="error"
				title="Couldn't round up your pigs"
				sub="They're out in the field somewhere. Give it another go."
				action={
					onRetry ? (
						<Button
							variant="ghost"
							size="sm"
							onPress={onRetry}
							accessibilityLabel="Try again"
							accessibilityHint="Asks for your pigs again"
						>
							Try again
						</Button>
					) : undefined
				}
			/>
		) : (
			<View style={styles.grid}>
				{roster.pigs.map((pig) => {
					const selected = pig.id === roster.activePigId;
					const lockedByLapsedMembership =
						pig.owned && pig.id !== "rosie" && !roster.isMember;
					const disabled =
						busyPigId != null ||
						selected ||
						(!pig.owned && roster.recruitedPigId != null) ||
						(!pig.owned && !pig.recruitable) ||
						lockedByLapsedMembership;
					const buttonLabel = selected
						? "On homepage"
						: pig.owned
							? lockedByLapsedMembership
								? "Membership paused"
								: "Put on homepage"
							: pig.recruitable
								? "Recruit"
								: roster.recruitedPigId
									? "Choice locked"
									: "Slop Club friend";
					const definition = pigDefinition(pig.id);
					const tint = PIG_ACCENT[pig.id].tint;

					return (
						<Sticker
							key={pig.id}
							color="cream"
							shadow="sm"
							radius={RADII.md}
							rotate={0}
							border={selected ? BORDER.heavy : BORDER.ink}
							style={styles.pigCard}
						>
							<Tape
								color={WHIMSY.tape}
								width={TAPE_WIDTH}
								height={TAPE_HEIGHT}
								rotate={TAPE_TILT}
								style={styles.tape}
							/>
							<View style={[styles.pigArt, { backgroundColor: tint }]}>
								<View style={styles.motif}>
									<Glyph name={motifGlyph(definition.motif)} size={MOTIF_GLYPH} />
								</View>
								<PigPortrait size={PORTRAIT} pigId={pig.id} />
							</View>
							<View style={[styles.ribbon, { backgroundColor: tint }]}>
								<View style={styles.ribbonTailLeft} />
								<T role="handDisplay">{pig.name}</T>
								<View style={styles.ribbonTailRight} />
							</View>
							<T role="kicker" tone="secondary" align="center" style={styles.pigCoat}>
								{pig.coat}
							</T>
							<Button
								full
								size="sm"
								variant={disabled ? "locked" : pig.owned ? "lilac" : "primary"}
								disabled={disabled}
								loading={busyPigId === pig.id}
								onPress={() => requestAct(pig.id, pig.owned)}
								accessibilityLabel={`${buttonLabel} — ${pig.name}`}
								accessibilityHint={
									selected
										? `${pig.name} already greets you at home`
										: pig.owned
											? `Puts ${pig.name} on your homepage`
											: `Asks to confirm. Choosing ${pig.name} is your one long-term companion choice and can't be changed.`
								}
								accessibilityState={{ selected, disabled }}
								testID={`pig-roster-action-${pig.id}`}
								style={styles.action}
							>
								{buttonLabel}
							</Button>
						</Sticker>
					);
				})}
			</View>
		);

	return (
		<>
			<Sticker
				color="paper"
				shadow="sm"
				rotate={0}
				radius={RADII.pill}
				onPress={() => {
					setMessage(null);
					setOpen(true);
				}}
				accessibilityLabel={`Open pig roster. ${activePig?.name ?? "Rosie"} is on the homepage`}
				accessibilityHint="Opens the sheet where you pick which pig greets you at home"
				style={styles.homeChip}
			>
				<T role="cardTitle">{activePig?.name ?? "Rosie"}</T>
				<T role="kicker" tone="secondary">
					{roster.isMember ? "switch pig" : "pig roster"}
				</T>
				<Icon name="chevronDown" size={ART_SIZE.mark} color={WHIMSY.mute} />
			</Sticker>

			<Sheet
				open={open}
				onClose={() => setOpen(false)}
				kicker="your pigs"
				title="Who’s hanging out?"
				subtitle="Everyone starts with Rosie. Slop Club members choose one long-term friend, then choose whether Rosie or that friend greets them at home."
				closeLabel="Done"
				testID="pig-roster-sheet"
				footer={
					<Button
						full
						variant="dark"
						onPress={() => setOpen(false)}
						accessibilityLabel="Done"
						accessibilityHint="Closes the pig roster"
						testID="pig-roster-done"
					>
						Done
					</Button>
				}
				overlay={
					// Presents INLINE, inside this sheet's own Modal — iOS will not
					// reliably present a nested native one.
					<ConfirmDialog
						open={pendingRecruitPig != null}
						presentation="inline"
						title={`Choose ${pendingRecruitPig?.name ?? "this pig"} as Rosie’s friend?`}
						body="This is your one long-term companion choice. You can’t change it right now."
						confirmLabel={`Choose ${pendingRecruitPig?.name ?? "pig"}`}
						confirmHint={`${pendingRecruitPig?.name ?? "This pig"} becomes your one long-term companion. You can't pick a different one later.`}
						cancelLabel="Keep looking"
						cancelHint="Leaves your companion choice open"
						onCancel={() => setPendingRecruitId(null)}
						onConfirm={() => {
							const pigId = pendingRecruitId;
							setPendingRecruitId(null);
							if (pigId) void act(pigId, false);
						}}
					/>
				}
			>
				{rosterBody}
				{!!message && (
					<T role="bodySm" align="center" style={styles.message}>
						{message}
					</T>
				)}
			</Sheet>
		</>
	);
}

const styles = StyleSheet.create({
	homeChip: {
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "baseline",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginBottom: SPACE.xs,
		zIndex: 3,
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: SPACE.sm,
	},
	pigCard: {
		width: CARD_WIDTH,
		alignItems: "center",
		paddingHorizontal: SPACE.sm,
		paddingTop: SPACE.md,
		paddingBottom: SPACE.sm,
	},
	tape: {
		position: "absolute",
		top: TAPE_TOP,
		borderWidth: BORDER.hair,
		borderColor: WHIMSY.tapeEdge,
		zIndex: 4,
	},
	pigArt: {
		width: "100%",
		height: ART_HEIGHT,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: RADII.md,
	},
	motif: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		width: MOTIF_BUBBLE,
		height: MOTIF_BUBBLE,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
		zIndex: 3,
	},
	ribbon: {
		minWidth: RIBBON_MIN_WIDTH,
		alignItems: "center",
		marginTop: RIBBON_LIFT,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.hair,
		zIndex: 3,
	},
	ribbonTailLeft: {
		position: "absolute",
		left: RIBBON_TAIL_INSET,
		top: RIBBON_TAIL_DROP,
		width: RIBBON_TAIL,
		height: RIBBON_TAIL,
		backgroundColor: WHIMSY.ink,
		transform: [{ rotate: "45deg" }],
		zIndex: -1,
	},
	ribbonTailRight: {
		position: "absolute",
		right: RIBBON_TAIL_INSET,
		top: RIBBON_TAIL_DROP,
		width: RIBBON_TAIL,
		height: RIBBON_TAIL,
		backgroundColor: WHIMSY.ink,
		transform: [{ rotate: "45deg" }],
		zIndex: -1,
	},
	pigCoat: {
		minHeight: COAT_MIN_HEIGHT,
		marginTop: SPACE.xs,
	},
	action: { marginTop: SPACE.sm },
	message: { marginTop: SPACE.sm },
});
