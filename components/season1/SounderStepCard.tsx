// The season-tab onboarding step card — the "do this now" slot while a player is
// pre-DONE on the Sounder path. It IS the primary card: it replaces the normal
// SounderHomeCard until the funnel finishes, then retires (renders nothing at
// DONE / while the step is still resolving), letting the tab show the normal card.
//
// It is a Sticker in the page's own language — not a wizard overlay. No animation
// loops, no badges. One primary action per step, a small step-dots hint so it
// reads as a path, and a stalled single-line variant after SOUNDER_STALL_SESSIONS
// so persistence never curdles into nagging.
//
// Per step:
//   taste     — "try a dig — no herd needed" launches the practice patch
//               (openPractice via the shared feeding CTA). A calm value line
//               under it. The dig modal renders once at the owner (season.tsx).
//   join      — framed benefits + the JoinDoor (delegated to SounderHomeCard's
//               crewless render), plus a "replay the practice dig ›" link.
//   first_dig — the patch is open → the dig CTA; else the countdown + an
//               persistent "oink me for every Feeding" account toggle.
//
// The `hook` step never renders here — the tale auto-presents at login
// (app/_layout.tsx); this card takes over once the tale's been seen.

import { View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
	BodySm,
	Button,
	CardTitle,
	Glyph,
	Hand,
	IconButton,
	Kicker,
	KickerPill,
	Sticker,
} from "@/components/ui";
import { SounderHomeCard } from "./SounderHomeCard";
import { NotifyChip } from "./GuardedCtaExtras";
import { SpotlightTarget } from "@/components/ui/Spotlight";
import type { FeedingCta } from "../mudwar/useFeedingCta";
import { patchCtaLabel } from "@/utils/rooting";
import { markRejoinDismissed } from "@/utils/sounderPath";
import { JOIN_SPOTLIGHT_TARGET_ID } from "@/hooks/useJoinSpotlight";
import type { SounderStep } from "@/hooks/useSounderPath";
import type { UseCrew } from "@/hooks/useCrew";
import {
	BORDER,
	PRESSED_FLAT,
	RADII,
	SPACE,
	TAP_MIN,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

// The ·●·· path dots. Two exact circle diameters — drawing geometry, not
// spacing — paired with RADII.pill so each stays a true circle at any size.
const DOT = 6;
const DOT_ACTIVE = 8;
// The inline marks: a gem beside a compact line, a ✕ in the dismiss corner.
const LINE_MARK = 16;
const REPLAY_MARK = 14;

// The four visible path steps, in order, for the ·●·· progress dots. `hook` is
// omitted — it lives in the login intro, not this card.
const DOT_STEPS: SounderStep[] = ["taste", "join", "first_dig", "done"];

function StepDots({ step }: { step: SounderStep }) {
	const activeIdx = DOT_STEPS.indexOf(step);
	return (
		<View style={styles.dotsRow} accessibilityElementsHidden>
			{DOT_STEPS.map((s, i) => (
				<View
					key={s}
					style={[
						styles.dot,
						i === activeIdx && styles.dotActive,
						i < activeIdx && styles.dotDone,
					]}
				/>
			))}
		</View>
	);
}

export function SounderStepCard({
	step,
	stalled,
	leaver = false,
	joinSpotlightActive = false,
	crewHook,
	uid,
	cta,
	refreshKey,
	onAdvance,
	hero = false,
}: {
	step: SounderStep;
	/** After SOUNDER_STALL_SESSIONS on this step, compress to the single line. */
	stalled: boolean;
	/**
	 * On the `join` step, true when the player is here because they LEFT a Sounder
	 * — swaps the copy for "join another" encouragement and shows a quiet dismiss.
	 */
	leaver?: boolean;
	/**
	 * Gates the join-door spotlight target's measure work — only the join
	 * affordance (the crewless SounderHomeCard door) is wrapped, so the coach-mark
	 * hole hugs the door, not the whole card.
	 */
	joinSpotlightActive?: boolean;
	crewHook: UseCrew;
	uid: string | null;
	/**
	 * The season tab's ONE shared feeding CTA — it drives BOTH the practice dig
	 * (taste) and the real dig (first_dig), and it's the same instance every
	 * other dig surface reads, so no card can drift from the real gate. The
	 * owner (season.tsx) mounts the hook and renders cta.modal once.
	 */
	cta: FeedingCta;
	refreshKey?: number;
	/** Re-derive the path step (e.g. right after a practice dig closes). */
	onAdvance?: () => void;
	/**
	 * The one-hero rule (C-26). While the funnel is running this card IS the
	 * tab's "do this now" slot, so its step CTA carries the loud voice — but
	 * only when `season.tsx`'s single `primaryAction` derivation says so (a
	 * ready reward outranks the funnel). Off, the same button keeps its shape
	 * and its words in the quiet `lilac`.
	 */
	hero?: boolean;
}) {
	const stepVariant = hero ? "gold" : "lilac";

	// done / hook never render here — the tab shows the normal card (done) or the
	// login intro owns the tale (hook).
	if (step === "done" || step === "hook") return null;
	// Submission lands before the onboarding path's next server refresh. Hide
	// the completed first-dig prompt during that handoff, including compact mode.
	if (step === "first_dig" && cta.dugThisWindow) return null;

	// The compact escape valve — a single sticker line that keeps prompting
	// without shouting, once the player's parked on a step for a few sessions.
	if (stalled) {
		return (
			<CompactStep step={step} cta={cta} onAdvance={onAdvance} hero={hero} />
		);
	}

	if (step === "taste") {
		return (
			<Sticker color="paper" rotate={-0.5} radius={RADII.lg} style={styles.card}>
				<KickerPill star={false} tone="accent" style={styles.kicker}>
					first, the fun part
				</KickerPill>
				<CardTitle style={styles.title}>Try a dig — no herd needed</CardTitle>
				<BodySm tone="secondary" style={styles.body}>
					Have a practice root at the Hungerer&apos;s patch. Your first find mints one
					real Golden Truffle to keep.
				</BodySm>
				<Button
					size="md"
					variant={stepVariant}
					full
					onPress={() => {
						cta.openPractice();
					}}
					accessibilityLabel="Try a practice dig"
					accessibilityHint="Opens the practice Truffle Patch — no Sounder needed"
				>
					Try a dig
				</Button>
				<Kicker star={false} align="center" style={styles.sub}>
					dig for truffles
				</Kicker>
				<StepDots step="taste" />
			</Sticker>
		);
	}

	if (step === "join") {
		// VALUE + JOIN folded into one card: the JoinDoor (with its three benefit
		// lines) is the crewless SounderHomeCard render; this card frames it and
		// keeps the "taste" reachable via a replay link. A LEAVER lands here too —
		// same door, warmer "find your next herd" framing + a quiet dismiss.
		const onDismiss = () => {
			markRejoinDismissed(uid);
			onAdvance?.();
		};
		return (
			<View>
				<Sticker color="cream" rotate={TILT.card} radius={RADII.lg} style={styles.frameCard}>
					{/* Leaver-only quiet dismiss — retires the card to DONE. The
					    first-time join card stays non-dismissible (no ✕). */}
					{leaver && (
						<IconButton
							name="x"
							label="Dismiss"
							accessibilityHint="Hides the join-a-Sounder card"
							onPress={onDismiss}
							variant="none"
							iconSize={REPLAY_MARK}
							visualSize={SPACE.xxl}
							style={styles.dismiss}
						/>
					)}
					{leaver ? (
						<>
							<KickerPill star={false} tone="accent" style={styles.kicker}>
								herdless again
							</KickerPill>
							<BodySm tone="secondary" style={styles.body}>
								Join another Sounder to share milestones and earn co-op dig bonuses.
							</BodySm>
						</>
					) : (
						<>
							<KickerPill star={false} tone="accent" style={styles.kicker}>
								that was the taste — now dig for keeps
							</KickerPill>
							<BodySm tone="secondary" style={styles.body}>
								Dig after a crewmate for up to 5 more rubs. Sounders also share the spoils.
							</BodySm>
						</>
					)}
					<StepDots step="join" />
					<Pressable
						onPress={() => cta.openPractice()}
						hitSlop={6}
						accessibilityRole="button"
						accessibilityLabel="Replay the practice dig"
						accessibilityHint="Opens the practice Truffle Patch again"
						style={({ pressed }) => [styles.replayRow, pressed && PRESSED_FLAT]}
					>
						<Glyph name="gem" size={REPLAY_MARK} />
						<Kicker star={false} style={styles.replayLink}>
							replay the practice dig ›
						</Kicker>
					</Pressable>
				</Sticker>
				{/* The join door itself — invites → open Sounders → found-in-one-tap.
				    Wrapped as the spotlight target so the coach-mark hole hugs JUST
				    the join door, not the framing sticker above. The target is
				    self-sizing (no full-bleed style) so measureInWindow reports the
				    door's own bounds. */}
				<SpotlightTarget
					id={JOIN_SPOTLIGHT_TARGET_ID}
					active={joinSpotlightActive}
				>
					<SounderHomeCard
						crewHook={crewHook}
						uid={uid}
						cta={cta}
						refreshKey={refreshKey}
						hero={hero}
					/>
				</SpotlightTarget>
			</View>
		);
	}

	// first_dig — crewed, no real dig yet. Window open → the real dig CTA; else the
	// locked pill + the persistent every-Feeding notification toggle.
	return (
		<Sticker color="paper" rotate={-0.5} radius={RADII.lg} style={styles.card}>
			<KickerPill star={false} tone="accent" style={styles.kicker}>
				you&apos;re in a Sounder — one thing left
			</KickerPill>
			<CardTitle style={styles.title}>Dig your first feeding</CardTitle>
			{cta.phaseOpen ? (
				<>
					<Button
						size="md"
						variant={stepVariant}
						full
						onPress={cta.start}
						accessibilityLabel="Dig the Truffle Patch"
						accessibilityHint="Opens the patch for this feeding"
					>
						{patchCtaLabel(true, cta.countdown)}
					</Button>
					<Kicker star={false} align="center" style={styles.sub}>
						root the patch
					</Kicker>
					<Hand tone="secondary" align="center" style={styles.cooldown}>
						the patch closes in {cta.countdown}
					</Hand>
				</>
			) : (
				<>
					{/* The resting dig CTA: a button asleep, with the countdown on
					    its own face — never a dissolved control. [C-07] */}
					<Button
						size="md"
						variant="locked"
						full
						disabled
						accessibilityLabel={`The patch is guarded — ${patchCtaLabel(false, cta.countdown)}`}
						accessibilityHint="The Hungerer is digesting; the patch reopens when the countdown ends"
					>
						{patchCtaLabel(false, cta.countdown)}
					</Button>
					<NotifyChip />
				</>
			)}
			{!!cta.note && (
				<Hand tone="accent" style={styles.note}>
					{cta.note}
				</Hand>
			)}
			<StepDots step="first_dig" />
		</Sticker>
	);
}

// The single-line stalled variant — one calm sticker line per step, still wired
// to the step's action. No dots, no body: persistence without shouting.
function CompactStep({
	step,
	cta,
	onAdvance,
	hero,
}: {
	step: SounderStep;
	cta: FeedingCta;
	onAdvance?: () => void;
	/** Even the compact line only wears the sun when it IS the primary action. */
	hero: boolean;
}) {
	const line =
		step === "taste"
			? "still curious? — try a dig ›"
			: step === "join"
			? "still herdless — join a Sounder ›"
			: cta.phaseOpen
				? `${patchCtaLabel(true, cta.countdown)} ›`
				: patchCtaLabel(false, cta.countdown);

	// The guarded compact card still exposes the real synchronized toggle. It
	// is not nested inside another Pressable, so ON can always be tapped back OFF
	// and permission guidance remains reachable.
	if (step === "first_dig" && !cta.phaseOpen) {
		return (
			<Sticker
				color="paper"
				rotate={TILT.card}
				radius={RADII.md}
				style={[styles.compact, styles.compactGuarded]}
			>
				<View style={styles.compactLineRow}>
					<Glyph name="gem" size={LINE_MARK} />
					<BodySm style={styles.compactLine}>{line}</BodySm>
				</View>
				<NotifyChip />
			</Sticker>
		);
	}

	const onPress = () => {
		Haptics.selectionAsync().catch(() => {});
		if (step === "taste") {
			cta.openPractice();
		} else if (step === "join") {
			router.push("/(tabs)/friends?seg=sounder");
		} else if (cta.phaseOpen) {
			cta.start();
		}
		onAdvance?.();
	};

	return (
		<Sticker
			color={hero && step === "first_dig" && cta.phaseOpen ? "sun" : "paper"}
			rotate={TILT.card}
			radius={RADII.md}
			onPress={onPress}
			accessibilityLabel={line}
			accessibilityHint={
				step === "taste"
					? "Opens the practice Truffle Patch"
					: step === "join"
						? "Opens the Sounder list"
						: "Opens the patch for this feeding"
			}
			style={styles.compact}
		>
			<Glyph name="gem" size={LINE_MARK} />
			<BodySm style={styles.compactLine}>{line}</BodySm>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
	frameCard: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, marginBottom: SPACE.sm },
	kicker: { marginBottom: SPACE.xs },
	title: { marginBottom: SPACE.xs },
	body: { marginBottom: SPACE.md },
	sub: { marginTop: SPACE.xs },
	cooldown: { marginTop: SPACE.xs },
	note: { marginTop: SPACE.xs },
	// The ·●·· path hint.
	dotsRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: SPACE.xs,
		marginTop: SPACE.md,
	},
	dot: {
		width: DOT,
		height: DOT,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.uiMuted,
	},
	dotActive: {
		width: DOT_ACTIVE,
		height: DOT_ACTIVE,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	dotDone: { backgroundColor: WHIMSY.sage },
	// Leaver-only quiet dismiss — a small ✕ in the frame card's top-right corner
	// on a guaranteed 44pt frame (IconButton's visual/frame split).
	dismiss: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		zIndex: 1,
	},
	// Join framing card's replay link.
	replayRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
		minHeight: TAP_MIN,
	},
	replayLink: { textDecorationLine: "underline" },
	// The single-line stalled sticker.
	compact: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	compactLineRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	compactLine: { flex: 1 },
	compactGuarded: { flexDirection: "column", alignItems: "stretch" },
});
