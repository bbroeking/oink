// Plain-words copy + action mapping for the Mud Scuffle surfaces.
//
// One home for "given a WarState, what does a new player read and what can
// they do?" — kept free of React/React-Native so jest tests the state →
// rendering mapping directly (see __tests__/warCopy.test.ts). Both the
// Season-tab entry strip (SounderSteps) and the war page (app/mud-war.tsx)
// compose these so the two surfaces can never drift on the same war.
//
// Every string here is player-facing and cozy: no "fronts", no "notches",
// no "per-capita" — a new pig should parse each line on first read.

import type { WarState, RecapFront, RecapFrontRhythm } from "@/utils/mudWars";
import {
	WAR_LENGTH_DAYS,
	WAR_LENGTH_DAYS_FRONTS,
	BOT_CREW_NAME,
	DIFFICULTY_LABEL,
	frontName,
} from "@/constants/mudFights";

// Total days this war runs (fronts wars are 7, legacy per-capita wars 5).
export function warTotalDays(war: Pick<WarState, "frontsEnabled">): number {
	return war.frontsEnabled ? WAR_LENGTH_DAYS_FRONTS : WAR_LENGTH_DAYS;
}

// Which day of the term we're on, from the end time. Mirrors the private
// siegeDay in mud-war.tsx + warDay in stepState.ts (kept here so the copy
// module is self-contained and the war page can retire its private copy).
export function siegeDay(
	endsAt: string | null,
	totalDays: number,
	now: number = Date.now()
): number {
	if (!endsAt) return 1;
	const daysLeft = Math.ceil((new Date(endsAt).getTime() - now) / 86_400_000);
	return Math.min(totalDays, Math.max(1, totalDays - daysLeft + 1));
}

// The opponent's cozy name. Bot wars fall back to the house crew's name
// ("The Mudlarks") so a nameless bot war still reads as a real rival.
export function opponentName(war: Pick<WarState, "them" | "isBotWar">): string {
	return (
		war.them.crew?.name ?? (war.isBotWar ? BOT_CREW_NAME : "the other Sounder")
	);
}

// Your own crew's name for the scoreboard.
export function myName(war: Pick<WarState, "mine">): string {
	return war.mine.crew?.name ?? "Your Sounder";
}

// ── Where the rope is, in plain words ────────────────────────────────────────

export type RopeStanding = "leading" | "trailing" | "even";

export interface RopeState {
	standing: RopeStanding;
	/** Absolute per-pig mud margin, rounded — the "by N" in "you lead by N". */
	margin: number;
	/** Cozy one-liner a new player parses: "You lead by 2 per pig", etc. */
	line: string;
	/** |ropeNorm| ≥ 0.75 — a rout is close (either way). */
	nearRout: boolean;
}

// The scoreboard shows each side's mud "per pig"; the honest, parseable lead is
// the difference between those two numbers, so that's what we speak. ropeNorm
// (the daily-tug rope, −1..1) only colors the rout flavor.
export function ropeState(
	war: Pick<WarState, "mine" | "them" | "ropeNorm">
): RopeState {
	const margin = Math.round(war.mine.perCapita - war.them.perCapita);
	const ropeNorm = war.ropeNorm ?? null;
	const nearRout = ropeNorm != null && Math.abs(ropeNorm) >= 0.75;

	if (margin > 0) {
		return {
			standing: "leading",
			margin,
			nearRout,
			line: nearRout
				? `Your herd's pulling joy back fast — up ${margin} per pig.`
				: `Your herd's won back more joy — you lead by ${margin} per pig.`,
		};
	}
	if (margin < 0) {
		const by = Math.abs(margin);
		return {
			standing: "trailing",
			margin: by,
			nearRout,
			line: nearRout
				? `They're pulling joy back fast — down ${by} per pig. Rally your Sounder!`
				: `Their herd's won back more joy — they lead by ${by} per pig.`,
		};
	}
	return {
		standing: "even",
		margin: 0,
		nearRout,
		line: "Dead even — every scoop pulls joy back.",
	};
}

// ── The scoreboard — joy reclaimed, per pig ──────────────────────────────────
// The two big per-pig tallies read as joy pried back from the Great Hunger, not
// "mud" a herd threw at another herd. One caption frames both columns; each
// column just names whose herd it is. (Kept here so tests pin the reframe and
// the war page can't drift back to "your mud / pig".)
export interface ScoreboardCopy {
	caption: string;
	mine: string;
	theirs: string;
}

export function scoreboardCopy(): ScoreboardCopy {
	return {
		caption: "joy reclaimed from the Hunger · per pig",
		mine: "your herd",
		theirs: "their herd",
	};
}

// The Hunger drain line — makes explicit that BOTH herds' effort weakens him
// (the rivalry is collective; the rope only decides who carries more home).
export function drainLine(totalReclaimed: number): string {
	return `Every scoop — from either herd — weakens him. Together you've won back ${totalReclaimed} joy this scuffle.`;
}

// A compact "Day N of M · 2h left" standing subline for the header zone.
export function termLine(
	war: Pick<WarState, "frontsEnabled" | "endsAt">,
	countdown: string,
	now: number = Date.now()
): string {
	const total = warTotalDays(war);
	const day = siegeDay(war.endsAt, total, now);
	const tail = countdown ? ` · ${countdown} left` : "";
	return `Day ${day} of ${total}${tail}`;
}

// ── What to do now ───────────────────────────────────────────────────────────
// Slop Toss is retired (2026-07-04) — scuffles are dig-offs. The player's real
// verbs are: DIG the feeding patch (always, once per 8h window) and, in a
// rhythm war's Hold phase, HOLD THE LINE (rhythm runs). "See the bog" is the
// ever-present way onto the war page from the entry strip.

export type WarActionKey = "dig" | "hold" | "bog";

export interface WarActionCtx {
	/** Rhythm war in its Hold phase — the run minigame is live. */
	isHold?: boolean;
	/** Hold runs left today (rhythm). */
	runsRemaining?: number;
	/** Already rooted this feeding window. */
	dugThisWindow?: boolean;
	/** "2h 10m" — when the next feeding opens (for the dug-out reason). */
	feedingCountdown?: string;
}

export interface WarAction {
	key: WarActionKey;
	/** Cozy button label. */
	label: string;
	enabled: boolean;
	/** Deep-link ?focus= target the war page scrolls to. */
	focus: WarActionKey;
	/** Hand-font explanation shown when the action is spent/unavailable. */
	reason?: string;
}

// A rhythm war is in its playable Hold phase when the horde has marched.
export function isHoldPhase(
	war: Pick<WarState, "rhythmEnabled" | "phase">
): boolean {
	return war.rhythmEnabled === true && war.phase === "war";
}

// The ordered action list for a war. The entry strip passes a thin ctx (it
// only knows the war), the war page passes the live feeding/run budget so the
// disabled copy is honest.
export function warActions(
	war: Pick<WarState, "rhythmEnabled" | "phase">,
	ctx: WarActionCtx = {}
): WarAction[] {
	const actions: WarAction[] = [];
	const hold = ctx.isHold ?? isHoldPhase(war);

	// Dig — the Truffle Patch heartbeat, the game every scuffle now is.
	const dug = ctx.dugThisWindow ?? false;
	actions.push({
		key: "dig",
		label: dug ? "Dug this feeding" : "Dig the patch",
		enabled: !dug,
		focus: "dig",
		reason: dug
			? ctx.feedingCountdown
				? `You've dug this feeding — the patch fills again in ${ctx.feedingCountdown}.`
				: "You've dug this feeding — come back when he gorges again."
			: undefined,
	});

	// Hold the line — rhythm runs, only once the horde marches (Hold phase).
	if (hold) {
		const runs = ctx.runsRemaining ?? 0;
		actions.push({
			key: "hold",
			label: runs > 0 ? "Hold the line" : "Held for today",
			enabled: runs > 0,
			focus: "hold",
			reason:
				runs > 0
					? undefined
					: "That's your runs for today — rest up and rally tomorrow.",
		});
	}

	// See the bog — always present; the strip's way onto the war page.
	actions.push({ key: "bog", label: "See the bog", enabled: true, focus: "bog" });
	return actions;
}

// ── The area board (FrontBoard), in plain words ──────────────────────────────
// The board's numbers and verdicts explain themselves: an area's value reads as
// rope-pulls (the thing the number actually buys), a recap row is one full
// sentence a new pig parses, and "▸ you" gets a line saying what committing did.

// "worth 5 rope-pulls" — what an area's value number means for the tug.
export function frontValueLabel(value: number): string {
	return `worth ${value} ${value === 1 ? "rope-pull" : "rope-pulls"}`;
}

// A rhythm-mode recap row carries mineHeld; the head-to-head row carries winner.
export function isRhythmRecap(rf: RecapFront): rf is RecapFrontRhythm {
	return "mineHeld" in rf;
}

// The last-round verdict as one full sentence — covers BOTH recap shapes.
export function recapOutcomeSentence(rf: RecapFront): string {
	const name = frontName(rf.front_key);
	if (isRhythmRecap(rf)) {
		const wave = DIFFICULTY_LABEL[rf.attackingMe] ?? rf.attackingMe;
		return rf.mineHeld
			? `You held ${name} — their ${wave} wave broke against you.`
			: `Their ${wave} wave broke through at ${name}.`;
	}
	if (rf.winner === "mine") {
		return `You held ${name} — ${rf.mineMud} mud to their ${rf.themMud}.`;
	}
	if (rf.winner === "them") {
		return `They took ${name} — ${rf.themMud} mud to your ${rf.mineMud}.`;
	}
	return `No one held ${name} — ${rf.mineMud} mud to ${rf.themMud}, not enough either way.`;
}

// The line under YOUR row — what committing here actually did/does.
export function commitMarkerLine(locked: boolean, holdPhase: boolean): string {
	if (!locked) {
		return holdPhase
			? "your pick — your runs will defend here"
			: "your pick — your mud will land here";
	}
	return holdPhase
		? "you're holding here — your runs defend this area"
		: "your mud lands here — locked in for today";
}

// One lead sentence above the board saying what picking an area means.
export function frontBoardLead(holdPhase: boolean): string {
	return holdPhase
		? "Pick an area to defend. Your holding runs bank there — richer areas pull the rope harder."
		: "Pick an area to dig for. The mud you win banks there — richer areas pull the rope harder.";
}

// A one-line explainer under the weekly-modifier chip (the chip's label alone
// is jargon). Empty string = no chip, no explainer.
export function weeklyModifierExplainer(mod: string): string {
	switch (mod) {
		case "marquee_double":
			return "The richest area is the marquee — it pays double this week.";
		case "fogged_gold":
			return "The gold's under fog this week — you won't see a perfect hit until it lands.";
		case "warboss_week":
			return "A warboss struts the bog this week — big, slow, and worth more.";
		default:
			return "";
	}
}

// ── Resolved wars ────────────────────────────────────────────────────────────

export type WarOutcome = "win" | "loss" | "draw";

export function warOutcome(
	war: Pick<WarState, "winnerCrew" | "mine">
): WarOutcome {
	if (!war.winnerCrew) return "draw";
	return war.winnerCrew === war.mine.crew?.id ? "win" : "loss";
}

export interface ResolvedCopy {
	title: string;
	body: string;
}

// The quiet on-screen recap copy (the big celebration is MudWarResolvedModal).
export function resolvedCopy(
	war: Pick<WarState, "winnerCrew" | "mine" | "isBotWar">
): ResolvedCopy {
	const outcome = warOutcome(war);
	if (outcome === "draw") {
		return {
			title: "A stalemate in the mire",
			body: "Dead even — both herds carried the same joy home, and the Hunger's the lighter for it.",
		};
	}
	if (outcome === "win") {
		return {
			title: "You carried more home!",
			body: war.isBotWar
				? `Your herd won back more joy than ${BOT_CREW_NAME} — a regen buff is on your whole Sounder.`
				: "Your herd won back more joy than theirs — a regen buff is on your whole Sounder.",
		};
	}
	return {
		title: "They carried more home",
		body: war.isBotWar
			? `${BOT_CREW_NAME} won back more joy this time — but you kept every truffle you rooted. Rally and scuffle again.`
			: "The other Sounder won back more joy this time — but you kept every truffle you rooted. Rally and scuffle again.",
	};
}
