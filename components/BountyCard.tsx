// A single weekly-bounty row for the season-tab bounty board. Shows
// a sun-tinted icon well + name + progress bar + reward, and a
// state-aware CTA: Claim (ready), a claimed check tag, or the live
// progress fraction (in progress).
//
// Layout matches the redesign: row of [icon well, body grow, CTA], with
// the progress bar above the reward line.
//
// Wave-4 conformance pass: the card mounts `Sticker` (it hand-rolled the
// tilt, the 2px ink border and a third shadow tier that claimed parity with
// the primitive it wasn't using — C-06, C-17, C-29); the bar is
// `ProgressTrack`; the reward and the claimed tick are `Tag`s; both spend /
// claim controls are `Button`s carrying their cost and consequence (C-03);
// and the in-progress state shows its fraction instead of an ellipsis that
// also meant "busy" (C-27).
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import {
	Button,
	ConfirmDialog,
	Glyph,
	Icon,
	ProgressTrack,
	SnoutCoin,
	Sticker,
	T,
	Tag,
	useUnmanagedModalHold,
	type GlyphName,
	type IconName,
} from "./ui";
import { BORDER, RADII, SPACE, WHIMSY } from "@/constants/theme";

export interface WeeklyBounty {
	code: string;
	// Original rotation slot identity — immutable per week. Differs
	// from `code` when the user has rerolled this slot.
	slot_code: string;
	// True if the user has already used their one reroll on this
	// slot this week (the visible `code` is the replacement).
	rerolled: boolean;
	name: string;
	description: string;
	goal: number;
	progress: number;
	reward_snouts: number;
	claimed: boolean;
}

// Cost in snouts to swap a bounty you don't want. Server enforces
// this same value in reroll_bounty(); keep them in sync.
const REROLL_COST = 25;

// Drawing geometry, not spacing: the square well the bounty's mark sits in and
// the mark inside it. Sized by eye against a two-line card title, so they are
// named here rather than borrowed from SPACE. (2026-09-11)
const WELL_SIZE = 52;
const WELL_MARK = 26;
// The coin riding a small pill label — cap-height match for the xs button.
const COIN_SIZE = 11;
// The CTA column's floor, so the card's right edge stays put as the control
// swaps between "Claim", the claimed tick and the progress fraction.
const CTA_MIN_WIDTH = 64;

interface Props {
	bounty: WeeklyBounty;
	tilt: number;
	// Fired after a successful claim so the board can refresh.
	onClaimed?: () => void;
}

// Best-effort visual per bounty type. The schema doesn't expose an
// icon field; derive from the bounty code so each card has an
// anchor in the icon well. Returns an Icon name (SVG equivalents), a
// hand-drawn Glyph (the semantic ♥ love-count mark routes to art per
// the dingbat ruling), or a sanctioned typographic flourish (★ ✦ ☁ —
// print characters, not Unicode emojis).
type BountyVisual =
	| { kind: "icon"; name: IconName }
	| { kind: "glyph"; name: GlyphName }
	| { kind: "char"; text: string };

function bountyVisual(code: string): BountyVisual {
	const c = code.toLowerCase();
	if (c.includes("trade") || c.includes("fulfill") || c.includes("ask"))
		return { kind: "icon", name: "handshake" };
	if (c.includes("bless") || c.includes("halo"))
		return { kind: "char", text: "✦" };
	if (c.includes("curse") || c.includes("itch"))
		return { kind: "char", text: "☁" };
	if (c.includes("tickle") || c.includes("tap"))
		return { kind: "glyph", name: "heart" };
	if (c.includes("friend") || c.includes("sounder"))
		return { kind: "icon", name: "pig" };
	if (c.includes("shop") || c.includes("buy") || c.includes("equip"))
		return { kind: "icon", name: "hat" };
	return { kind: "icon", name: "target" };
}

function BountyMark({ code }: { code: string }) {
	const v = bountyVisual(code);
	if (v.kind === "icon")
		return (
			<Icon name={v.name} size={WELL_MARK} color={WHIMSY.ink} filled />
		);
	if (v.kind === "glyph") return <Glyph name={v.name} size={WELL_MARK} />;
	return <T role="sectionTitle">{v.text}</T>;
}

export function BountyCard({ bounty, tilt, onClaimed }: Props) {
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);

	const ready = bounty.progress >= bounty.goal && !bounty.claimed;
	const shown = Math.min(bounty.progress, bounty.goal);

	// Reroll affordances: only shown for in-progress bounties that
	// haven't been rerolled yet this week. Ready / claimed / already-
	// rerolled bounties hide the option entirely.
	const canReroll = !bounty.claimed && !ready && !bounty.rerolled;
	const [confirmOpen, setConfirmOpen] = useState(false);
	// The reroll ConfirmDialog is an unmanaged native Modal (direct-tap, outside
	// the popup queue): hold the queue while it's open so a foreground poll can't
	// present a queued popup over it — the #50152 wedge (issue #4).
	useUnmanagedModalHold(confirmOpen);

	const doReroll = async () => {
		setConfirmOpen(false);
		if (busy) return;
		setBusy(true);
		const r = await rpc<{ ok?: boolean; reason?: string }>("reroll_bounty", {
			bounty_code: bounty.code,
		});
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			onClaimed?.();
		} else if (r?.reason === "insufficient_snouts") {
			setFeedback(`Not enough snouts — reroll costs ${REROLL_COST}.`);
		} else if (r?.reason === "already_rerolled") {
			setFeedback("This slot's already been rerolled this week.");
		} else {
			setFeedback("Couldn't swap. Try again.");
		}
	};

	const claim = async () => {
		if (busy || !ready) return;
		setBusy(true);
		const r = await rpc<{ ok?: boolean; reason?: string }>("claim_bounty", {
			bounty_code: bounty.code,
		});
		setBusy(false);
		if (r?.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			onClaimed?.();
		} else {
			setFeedback("Couldn't claim. Try again.");
		}
	};

	return (
		<Sticker
			// A finished bounty rests on the muted fill rather than behind an
			// opacity crush — a done card is quieter, not dissolved. [C-07]
			color={bounty.claimed ? "cream2" : "paper"}
			rotate={tilt}
			radius={RADII.lg}
			border={BORDER.ink}
			pad
			style={styles.card}
		>
			<View style={styles.row}>
				{/* Sun-tinted icon well — visual anchor at the left edge */}
				<Sticker
					color="sun"
					rotate={0}
					radius={RADII.md}
					shadow="sm"
					style={styles.iconWell}
				>
					<BountyMark code={bounty.code} />
				</Sticker>

				<View style={styles.body}>
					<T role="cardTitle" numberOfLines={2}>
						{bounty.name}
					</T>

					{/* Server-side description — WHAT to do ("Fulfill 3
					    trade requests this week."). Was previously
					    in the data but never rendered, so players
					    only saw the cryptic title. */}
					{!!bounty.description && (
						<T
							role="kicker"
							tone="secondary"
							numberOfLines={2}
							style={styles.description}
						>
							{bounty.description}
						</T>
					)}

					{/* Progress bar — ink-bordered pill, sage when claimable */}
					<ProgressTrack
						value={bounty.progress}
						max={bounty.goal}
						tone={ready ? "sage" : "lilac"}
						height="sm"
						accessibilityLabel={`Progress on ${bounty.name}`}
						style={styles.track}
					/>

					{/* Meta line — the reward this bounty pays. The count lives on
					    the CTA now, so it is stated once. [C-27] */}
					<View style={styles.metaRow}>
						<Tag
							label={`+${bounty.reward_snouts} snouts`}
							coin
							accessibilityLabel={`Pays ${bounty.reward_snouts} snouts`}
						/>
					</View>

					{/* Reroll pill — only on in-progress, not-yet-rerolled
					    bounties. Description above already tells you
					    WHAT to do; players can find their way to the
					    right tab. Earlier draft also rendered a how-to
					    hint + deep-link button, but that read too
					    heavy-handed against the card's small frame. */}
					{canReroll && (
						<View style={styles.rerollRow}>
							<Button
								variant="ghost"
								size="xs"
								onPress={() => setConfirmOpen(true)}
								loading={busy}
								accessibilityLabel={`Swap this bounty · ${REROLL_COST} snouts`}
								accessibilityHint={`Replaces "${bounty.name}" with a random bounty. One swap per slot per week.`}
								testID={`bounty-reroll-${bounty.code}`}
							>
								<>
									{`Swap · ${REROLL_COST}`}
									<SnoutCoin size={COIN_SIZE} />
								</>
							</Button>
						</View>
					)}
					{bounty.rerolled && !bounty.claimed && !ready && (
						<T role="kicker" tone="secondary" align="right" style={styles.rerolledTag}>
							★ swapped this week
						</T>
					)}
				</View>

				{/* State-aware CTA at the right */}
				{bounty.claimed ? (
					<Tag
						icon="check"
						label=""
						tone="sage"
						accessibilityLabel="Claimed"
						style={styles.cta}
					/>
				) : ready ? (
					<Button
						variant="gold"
						size="sm"
						testID={`bounty-claim-${bounty.code}`}
						onPress={claim}
						loading={busy}
						accessibilityLabel={`Claim ${bounty.reward_snouts} snouts`}
						accessibilityHint={`Collects the reward for "${bounty.name}"`}
						style={styles.cta}
					>
						Claim
					</Button>
				) : (
					<Tag
						label={`${shown}/${bounty.goal}`}
						accessibilityLabel={`${shown} of ${bounty.goal} done`}
						style={styles.cta}
					/>
				)}
			</View>

			{!!feedback && (
				<T role="kicker" tone="danger" align="center" style={styles.feedback}>
					{feedback}
				</T>
			)}
			<ConfirmDialog
				open={confirmOpen}
				title="Swap this bounty?"
				body={`Replace "${bounty.name}" with a random one. Costs ${REROLL_COST} snouts; one swap per slot per week.`}
				confirmLabel={`Swap · ${REROLL_COST}`}
				confirmCoin
				confirmHint={`Spends ${REROLL_COST} snouts and replaces this bounty with a random one`}
				cancelHint="Keeps this bounty"
				onConfirm={doReroll}
				onCancel={() => setConfirmOpen(false)}
				busy={busy}
			/>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: {
		marginVertical: SPACE.xs,
	},
	row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	iconWell: {
		width: WELL_SIZE,
		height: WELL_SIZE,
		alignItems: "center",
		justifyContent: "center",
	},
	body: { flex: 1, minWidth: 0 },
	// Server-side description (what to do) — sits directly under
	// the title in muted hand-script, so the title still leads but
	// the player immediately sees the requirement.
	description: {
		marginTop: SPACE.xxs,
	},
	// Reroll pill — right-aligned, small + muted so it doesn't
	// compete with the description text above. Carries its own
	// snout-coin badge so the cost reads at a glance.
	rerollRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		marginTop: SPACE.xs,
	},
	// After-the-reroll receipt — replaces the pill once used.
	rerolledTag: {
		marginTop: SPACE.xs,
	},
	track: {
		marginTop: SPACE.xs,
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
		alignSelf: "flex-start",
	},
	cta: {
		minWidth: CTA_MIN_WIDTH,
	},
	feedback: {
		marginTop: SPACE.xs,
	},
});
