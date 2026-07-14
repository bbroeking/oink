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
//               under it. The practice-dig modal renders here.
//   join      — framed benefits + the JoinDoor (delegated to SounderHomeCard's
//               crewless render), plus a "replay the practice dig ›" link.
//   first_dig — the patch is open → the dig CTA; else the countdown + an
//               "oink me when it opens ›" chip (scheduleOpenReminder).
//
// The `hook` step never renders here — the tale auto-presents at login
// (app/_layout.tsx); this card takes over once the tale's been seen.

import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Sticker } from "../ui/Sticker";
import { Button } from "../ui/Button";
import { Glyph } from "../ui/Glyph";
import { SounderHomeCard } from "./SounderHomeCard";
import { NotifyChip } from "./GuardedCtaExtras";
import { useFeedingCta } from "../mudwar/useFeedingCta";
import { scheduleOpenReminder } from "@/utils/pushNotifications";
import type { SounderStep } from "@/hooks/useSounderPath";
import type { UseCrew } from "@/hooks/useCrew";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

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
	crewHook,
	uid,
	onDug,
	refreshKey,
	onAdvance,
}: {
	step: SounderStep;
	/** After SOUNDER_STALL_SESSIONS on this step, compress to the single line. */
	stalled: boolean;
	crewHook: UseCrew;
	uid: string | null;
	onDug?: () => void;
	refreshKey?: number;
	/** Re-derive the path step (e.g. right after a practice dig closes). */
	onAdvance?: () => void;
}) {
	// The shared feeding CTA drives BOTH the practice dig (taste) and the real dig
	// (first_dig) — one plumbing, so this card can never drift from the real gate.
	const cta = useFeedingCta(onDug);

	// done / hook never render here — the tab shows the normal card (done) or the
	// login intro owns the tale (hook).
	if (step === "done" || step === "hook") return null;

	// The compact escape valve — a single sticker line that keeps prompting
	// without shouting, once the player's parked on a step for a few sessions.
	if (stalled) {
		return (
			<CompactStep step={step} cta={cta} onAdvance={onAdvance} />
		);
	}

	if (step === "taste") {
		return (
			<Sticker color="paper" rotate={-0.5} radius={RADII.lg} style={styles.card}>
				<Text style={styles.kicker}>first, the fun part</Text>
				<Text style={styles.title}>Try a dig — no herd needed</Text>
				<Text style={styles.body}>
					Have a practice root at the Hungerer's patch. Your first find mints one
					real Golden Truffle to keep.
				</Text>
				<Button
					size="md"
					variant="primary"
					full
					onPress={() => {
						cta.openPractice();
					}}
				>
					Try a dig
				</Button>
				<Text style={styles.sub}>dig for truffles</Text>
				<StepDots step="taste" />
				{cta.modal}
			</Sticker>
		);
	}

	if (step === "join") {
		// VALUE + JOIN folded into one card: the JoinDoor (with its three benefit
		// lines) is the crewless SounderHomeCard render; this card frames it and
		// keeps the "taste" reachable via a replay link.
		return (
			<View>
				<Sticker color="cream" rotate={-0.4} radius={RADII.lg} style={styles.frameCard}>
					<Text style={styles.kicker}>that was the taste — now dig for keeps</Text>
					<Text style={styles.body}>
						A Sounder digs deeper and shares the spoils. Slip into one below.
					</Text>
					<StepDots step="join" />
					<Pressable
						onPress={() => cta.openPractice()}
						hitSlop={6}
						style={({ pressed }) => [styles.replayRow, pressed && { opacity: 0.6 }]}
					>
						<Glyph name="gem" size={14} />
						<Text style={styles.replayLink}>replay the practice dig ›</Text>
					</Pressable>
				</Sticker>
				{/* The join door itself — invites → open Sounders → found-in-one-tap. */}
				<SounderHomeCard
					crewHook={crewHook}
					uid={uid}
					onDug={onDug}
					refreshKey={refreshKey}
				/>
				{cta.modal}
			</View>
		);
	}

	// first_dig — crewed, no real dig yet. Window open → the real dig CTA; else the
	// countdown + a one-tap "oink me when it opens" opt-in.
	return (
		<Sticker color="paper" rotate={-0.5} radius={RADII.lg} style={styles.card}>
			<Text style={styles.kicker}>you're in a Sounder — one thing left</Text>
			<Text style={styles.title}>Dig your first feeding</Text>
			{cta.phaseOpen ? (
				<>
					<Button size="md" variant="primary" full onPress={cta.start}>
						Dig for truffles
					</Button>
					<Text style={styles.sub}>root the patch</Text>
					<Text style={styles.cooldown}>the patch closes in {cta.countdown}</Text>
				</>
			) : (
				<>
					<Button size="md" variant="locked" full disabled>
						he's guarding — opens in {cta.countdown}
					</Button>
					<NotifyChip />
				</>
			)}
			{!!cta.note && <Text style={styles.note}>{cta.note}</Text>}
			<StepDots step="first_dig" />
			{cta.modal}
		</Sticker>
	);
}

// The single-line stalled variant — one calm sticker line per step, still wired
// to the step's action. No dots, no body: persistence without shouting.
function CompactStep({
	step,
	cta,
	onAdvance,
}: {
	step: SounderStep;
	cta: ReturnType<typeof useFeedingCta>;
	onAdvance?: () => void;
}) {
	const line =
		step === "taste"
			? "still curious? — try a dig ›"
			: step === "join"
			? "still herdless — join a Sounder ›"
			: "your herd's waiting — dig your first feeding ›";

	const onPress = () => {
		Haptics.selectionAsync().catch(() => {});
		if (step === "taste") {
			cta.openPractice();
		} else if (step === "join") {
			router.push("/(tabs)/friends?seg=sounder");
		} else if (cta.phaseOpen) {
			cta.start();
		} else {
			// Guarded — the compact first_dig line can't dig; nudge into the notify.
			scheduleOpenReminder().catch(() => {});
		}
		onAdvance?.();
	};

	return (
		<>
			<Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
				<Sticker color="paper" rotate={-0.4} radius={RADII.md} style={styles.compact}>
					<Glyph name="gem" size={16} />
					<Text style={styles.compactLine}>{line}</Text>
				</Sticker>
			</Pressable>
			{cta.modal}
		</>
	);
}

const styles = StyleSheet.create({
	card: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
	frameCard: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, marginBottom: SPACE.sm },
	kicker: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textTransform: "uppercase",
		letterSpacing: 0.8,
		marginBottom: SPACE.xs,
	},
	title: {
		...TYPE.cardTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		marginBottom: SPACE.xs,
	},
	body: {
		...TYPE.bodySm,
		fontFamily: FONTS.body,
		color: WHIMSY.mute,
		marginBottom: SPACE.md,
	},
	sub: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	cooldown: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.xs,
	},
	note: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		marginTop: SPACE.xs,
	},
	// The ·●·· path hint.
	dotsRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: SPACE.xs,
		marginTop: SPACE.md,
	},
	// The path dots are 6/8px circles; their radii (3/4) are bespoke half-of-size
	// values — the smallest RADII token (sm: 8) would over-round a 6px dot into a
	// square-ish blob. Kept as exact half-widths so each dot stays a true circle.
	dot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: WHIMSY.muteSoft,
	},
	dotActive: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	dotDone: { backgroundColor: WHIMSY.sage },
	// Join framing card's replay link.
	replayRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		marginTop: SPACE.sm,
	},
	replayLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	// The single-line stalled sticker.
	compact: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	compactLine: {
		flex: 1,
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.ink,
	},
});
