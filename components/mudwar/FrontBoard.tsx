// The contested-areas board — sits above the skill minigame on the war screen.
// PHASE-AWARE (Phase 1d):
//   • build (Tend): show the 3 areas (value, fuzzy hold-pressure hint, my crew's
//     committed mud + committers) and let a member TAP an area to commit their
//     throws there (the existing fronts flow). The toss banks into it.
//   • war (Hold): the same area picker (your runs bank into your chosen area) PLUS
//     a leader-only DEPLOY sheet (map your one hard/med/easy wave onto the
//     opponent's 3 areas) and an access-token indicator (extra Hold-run attempts).
// The post-day RECAP renders BOTH shapes — the head-to-head fronts fold (winner per
// area) and the rhythm MIRROR (mineHeld/themHeld + the hidden wave that attacked
// MY area). The opponent's CURRENT-day allocation is never shown (the fog).
//
// Redeploy: the one-per-war token STATUS is shown here; the leader move-a-member
// picker is a follow-up (v1 is self-commit only).

import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { FrontsState, RecapFront, Difficulty } from "@/utils/mudWars";
import {
	frontName,
	P_BAND_LABEL,
	WEEKLY_MODIFIER_LABEL,
	DIFFICULTY_LABEL,
} from "@/constants/mudFights";
import {
	frontValueLabel,
	recapOutcomeSentence,
	commitMarkerLine,
	frontBoardLead,
	weeklyModifierExplainer,
} from "./warCopy";
import { FONTS, WHIMSY } from "@/constants/theme";

interface Props {
	fronts: FrontsState;
	onPick: (frontKey: string) => void; // commit my throws/runs to this area (set_front_plan)
	// Whether this is a RHYTHM war. Gates ALL the Hold-phase UI (deploy sheet,
	// access indicator, "defend"/"holding" copy) so a plain fronts war — whose
	// server phase is also 'war' — keeps rendering EXACTLY as before.
	rhythm?: boolean;
	// Leader-only deploy (Hold phase). Maps hard/med/easy onto 3 distinct areas.
	onDeploy?: (hardFront: string, medFront: string, easyFront: string) => Promise<{ ok: boolean; reason?: string }>;
	isLeader?: boolean;     // gates the deploy sheet
	note?: string | null;
}

export function FrontBoard({ fronts, onPick, rhythm, onDeploy, isLeader, note }: Props) {
	const myFront = fronts.myPlan?.front_key ?? null;
	const locked = !!fronts.myPlan?.locked;
	const modLabel = fronts.weeklyModifier ? WEEKLY_MODIFIER_LABEL[fronts.weeklyModifier] : "";
	const modWhy = fronts.weeklyModifier ? weeklyModifierExplainer(fronts.weeklyModifier) : "";
	// Hold-phase UI (deploy sheet, access tokens, "defend" copy) is RHYTHM-only —
	// a plain fronts war also reports phase 'war' but must look exactly as before.
	const isWarPhase = !!rhythm && fronts.phase === "war";
	const isBuildPhase = !!rhythm && fronts.phase === "build";

	return (
		<View style={styles.wrap}>
			{!!modLabel && (
				<>
					<View style={styles.modChip}>
						<Text style={styles.modText}>This week · {modLabel}</Text>
					</View>
					{!!modWhy && <Text style={styles.modWhy}>{modWhy}</Text>}
				</>
			)}

			{isBuildPhase && (
				<Text style={styles.phaseNote}>Tend the Mire — build your areas before the horde marches.</Text>
			)}

			{fronts.recap && (fronts.recap.fronts?.length ?? 0) > 0 && (
				<View style={styles.recap}>
					<Text style={styles.recapTitle}>Last round</Text>
					{fronts.recap.fronts.map((rf) => (
						<RecapRow key={rf.front_key} rf={rf} />
					))}
				</View>
			)}

			<Text style={styles.heading}>
				{isWarPhase ? "Areas — defend your line" : "Areas — where your mud lands"}
			</Text>
			<Text style={styles.lead}>{frontBoardLead(isWarPhase)}</Text>
			{fronts.board.map((f) => {
				const mine = f.front_key === myFront;
				return (
					<Pressable
						key={f.front_key}
						onPress={() => {
							if (mine && locked) return; // already committed here
							Haptics.selectionAsync().catch(() => {});
							onPick(f.front_key);
						}}
						style={[styles.front, mine && styles.frontMine]}
					>
						<View style={styles.valueBadge}>
							<Text style={styles.valueText}>{f.value}</Text>
						</View>
						<View style={styles.frontMid}>
							<Text style={styles.frontName} numberOfLines={1}>
								{frontName(f.front_key)}
							</Text>
							<Text style={styles.frontHint}>
								{frontValueLabel(f.value)} · {P_BAND_LABEL[f.p_band] ?? f.p_band}
								{f.mineMud > 0 ? ` · ${f.mineMud} mud from your herd` : ""}
							</Text>
							{mine && (
								<Text style={styles.mineNote}>
									▸ {commitMarkerLine(locked, isWarPhase)}
								</Text>
							)}
						</View>
						{/* my crew's committers as pips */}
						<View style={styles.pips}>
							{Array.from({ length: Math.max(f.mineCommitters, mine ? 1 : 0) }).map((_, i) => (
								<View key={i} style={styles.pip} />
							))}
						</View>
					</Pressable>
				);
			})}

			{/* Access-token indicator (war phase) — extra Hold-run attempts from barn visits. */}
			{isWarPhase && fronts.accessTokens > 0 && (
				<Text style={styles.access}>
					Barn relief: +{fronts.accessTokens} extra {fronts.accessTokens === 1 ? "run" : "runs"} today
				</Text>
			)}

			{/* Leader-only deploy sheet (war phase) — loose your horde on their areas. */}
			{isWarPhase && isLeader && onDeploy && (
				<DeploySheet fronts={fronts} onDeploy={onDeploy} />
			)}

			<Text style={styles.redeploy}>
				Redeploy token: {fronts.redeployUsed ? "spent" : "1 available (leader)"}
			</Text>
			{locked && (
				<Text style={styles.lockedNote}>
					{isWarPhase
						? "Your area locks once you commit — only a leader redeploy can move you."
						: "Your front locks once you throw — only a leader redeploy can move you."}
				</Text>
			)}
			{!!note && <Text style={styles.note}>{note}</Text>}
		</View>
	);
}

// One recap row — a full sentence a new pig parses, either fold shape. The
// wording (and the held/tied/lost coloring) comes from warCopy so tests pin it.
function RecapRow({ rf }: { rf: RecapFront }) {
	const held = "mineHeld" in rf ? rf.mineHeld : rf.winner === "mine";
	const tied = !("mineHeld" in rf) && rf.winner === "none";
	return (
		<View style={styles.recapRow}>
			<Text
				style={[styles.recapLine, held ? styles.held : tied ? styles.tied : styles.lost]}
			>
				{recapOutcomeSentence(rf)}
			</Text>
		</View>
	);
}

// Leader deploy sheet — assign hard/med/easy to 3 DISTINCT areas, then loose them.
// Enforces distinctness client-side (the server also rejects not_distinct) by
// rotating already-picked areas off as you assign each slot.
function DeploySheet({
	fronts,
	onDeploy,
}: {
	fronts: FrontsState;
	onDeploy: NonNullable<Props["onDeploy"]>;
}) {
	const keys = useMemo(() => fronts.board.map((f) => f.front_key), [fronts.board]);
	// Seed from the server's current deploy (myDeploy maps front_key -> difficulty),
	// inverted to difficulty -> front_key; else leave unset so the leader chooses.
	const seeded = useMemo(() => {
		const out: Partial<Record<Difficulty, string>> = {};
		if (fronts.myDeploy) {
			for (const [front, diff] of Object.entries(fronts.myDeploy)) {
				out[diff as Difficulty] = front;
			}
		}
		return out;
	}, [fronts.myDeploy]);

	const [pick, setPick] = useState<Partial<Record<Difficulty, string>>>(seeded);
	const [open, setOpen] = useState(false);
	const [deployNote, setDeployNote] = useState<string | null>(null);
	const [sending, setSending] = useState(false);

	const assign = (diff: Difficulty, front: string) => {
		Haptics.selectionAsync().catch(() => {});
		setDeployNote(null);
		setPick((prev) => {
			const next: Partial<Record<Difficulty, string>> = { ...prev, [diff]: front };
			// Keep the bijection: drop this front from any OTHER difficulty.
			(Object.keys(next) as Difficulty[]).forEach((d) => {
				if (d !== diff && next[d] === front) delete next[d];
			});
			return next;
		});
	};

	const complete = !!pick.hard && !!pick.med && !!pick.easy;
	const distinct =
		complete && new Set([pick.hard, pick.med, pick.easy]).size === 3;

	const send = async () => {
		if (!distinct || sending) return;
		setSending(true);
		setDeployNote(null);
		const r = await onDeploy(pick.hard!, pick.med!, pick.easy!);
		setSending(false);
		if (r.ok) {
			setDeployNote("Horde loosed — they won't know which wave hits where.");
			setOpen(false);
		} else {
			setDeployNote(
				r.reason === "deploy_opens_in_hold"
					? "Deploys open once the Hold begins."
					: r.reason === "not_distinct"
					? "Send a different wave to each area."
					: r.reason === "not_leader"
					? "Only your Sounder's leader can loose the horde."
					: "Couldn't loose the horde — try again."
			);
		}
	};

	const deployed = !!fronts.myDeploy && Object.keys(fronts.myDeploy).length === 3;

	if (!open) {
		return (
			<Pressable style={styles.deployToggle} onPress={() => setOpen(true)}>
				<Text style={styles.deployToggleText}>
					{deployed ? "▸ Loose the Horde — change your waves" : "▸ Loose the Horde (leader)"}
				</Text>
			</Pressable>
		);
	}

	return (
		<View style={styles.deploy}>
			<Text style={styles.deployTitle}>Loose the Horde</Text>
			<Text style={styles.deploySub}>Send one wave at each of their areas. They can't see which.</Text>
			{(["hard", "med", "easy"] as Difficulty[]).map((diff) => (
				<View key={diff} style={styles.deployRow}>
					<Text style={styles.deployDiff}>{DIFFICULTY_LABEL[diff]}</Text>
					<View style={styles.deployOptions}>
						{keys.map((k) => {
							const on = pick[diff] === k;
							return (
								<Pressable
									key={k}
									onPress={() => assign(diff, k)}
									style={[styles.deployChip, on && styles.deployChipOn]}
								>
									<Text style={[styles.deployChipText, on && styles.deployChipTextOn]} numberOfLines={1}>
										{frontName(k)}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</View>
			))}
			<Pressable
				onPress={send}
				disabled={!distinct || sending}
				style={[styles.deploySend, (!distinct || sending) && styles.deploySendOff]}
			>
				<Text style={styles.deploySendText}>{sending ? "Loosing…" : "Loose them"}</Text>
			</Pressable>
			{!!deployNote && <Text style={styles.deployNote}>{deployNote}</Text>}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: 18, marginBottom: 4 },
	modChip: {
		alignSelf: "center",
		backgroundColor: WHIMSY.lilac,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 3,
		marginBottom: 10,
	},
	modText: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.ink },
	modWhy: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: -6,
		marginBottom: 10,
	},
	phaseNote: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute, textAlign: "center", marginBottom: 10 },
	recap: {
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		padding: 10,
		marginBottom: 12,
	},
	recapTitle: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginBottom: 6,
	},
	recapRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
	recapLine: { fontFamily: FONTS.body, fontSize: 13, flex: 1 },
	held: { color: WHIMSY.accent },
	tied: { color: WHIMSY.mute },
	lost: { color: WHIMSY.lilacDeep },
	heading: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginBottom: 2,
	},
	lead: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginBottom: 8 },
	front: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 10,
		paddingVertical: 9,
		marginBottom: 8,
	},
	frontMine: { backgroundColor: WHIMSY.sun, borderWidth: 2.5 },
	valueBadge: {
		width: 28,
		height: 28,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.roseDeep,
		alignItems: "center",
		justifyContent: "center",
	},
	valueText: { fontFamily: FONTS.whimsy, fontSize: 15, color: "#fff" },
	frontMid: { flex: 1 },
	frontName: { fontFamily: FONTS.body, fontSize: 15, color: WHIMSY.ink },
	frontHint: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },
	mineNote: { fontFamily: FONTS.whimsy, fontSize: 12, color: WHIMSY.ink, marginTop: 2 },
	pips: { flexDirection: "row", gap: 3, alignItems: "center" },
	pip: {
		width: 10,
		height: 10,
		borderRadius: 5,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.lilacDeep,
	},
	access: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.accent, textAlign: "center", marginTop: 2, marginBottom: 2 },
	// Deploy sheet.
	deployToggle: {
		alignSelf: "center",
		backgroundColor: WHIMSY.lilac,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 6,
		marginTop: 6,
		marginBottom: 4,
	},
	deployToggleText: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	deploy: {
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		padding: 12,
		marginTop: 8,
		marginBottom: 4,
	},
	deployTitle: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	deploySub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginBottom: 8 },
	deployRow: { marginBottom: 8 },
	deployDiff: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginBottom: 4,
	},
	deployOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
	deployChip: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 9,
		paddingVertical: 5,
	},
	deployChipOn: { backgroundColor: WHIMSY.sun, borderWidth: 2 },
	deployChipText: { fontFamily: FONTS.body, fontSize: 12, color: WHIMSY.mute },
	deployChipTextOn: { color: WHIMSY.ink },
	deploySend: {
		alignSelf: "center",
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingHorizontal: 18,
		paddingVertical: 7,
		marginTop: 6,
	},
	deploySendOff: { backgroundColor: WHIMSY.cream2, opacity: 0.6 },
	deploySendText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	deployNote: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.accent, textAlign: "center", marginTop: 6 },
	redeploy: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, textAlign: "center", marginTop: 8 },
	lockedNote: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, textAlign: "center", marginTop: 2 },
	note: { fontFamily: FONTS.body, fontSize: 13, color: WHIMSY.accent, textAlign: "center", marginTop: 8 },
});
