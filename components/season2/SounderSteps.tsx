// The Season-2 front door — a three-step walkthrough that takes a pig from
// "no Sounder" to "marching on the bog", driven by real crew state:
//
//   1. Found your Sounder   (create + name — inline, right here)
//   2. Rally your friends   (invite via the Friends hub picker; pips show 5)
//   3. March on the bog     (challenge CTA → /mud-war)
//
// Completed steps collapse to checked stamps; the current step is expanded
// with ONE clear action. When a war is live the stepper yields to a compact
// war strip (day, standing, and the way back to the front). Reuses useCrew's
// actions — the SounderCard on the Friends hub stays the roster-management
// home; this is the season's guided path into it.

import { useState } from "react";
import {
	View,
	Text,
	TextInput,
	Pressable,
	StyleSheet,
} from "react-native";
import { router, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { Sticker } from "../ui/Sticker";
import { Icon } from "../ui/Icon";
import { Glyph } from "../ui/Glyph";
import { Button } from "../ui/Button";
import type { UseCrew } from "@/hooks/useCrew";
import type { WarState } from "@/utils/mudWars";
import {
	CREW_CAP,
	QUORUM,
	WAR_LENGTH_DAYS,
	WAR_LENGTH_DAYS_FRONTS,
} from "@/constants/mudFights";
import {
	FONTS,
	RADII,
	SHADOW_SM,
	SPACE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import { sounderStepView, warDay, ropeLeanLine } from "./stepState";

const STEP_META: { key: "create" | "invite" | "march"; n: number; title: string }[] = [
	{ key: "create", n: 1, title: "Found your Sounder" },
	{ key: "invite", n: 2, title: "Rally your friends" },
	{ key: "march", n: 3, title: "March on the bog" },
];

export function SounderSteps({
	crewHook,
	war,
}: {
	crewHook: UseCrew;
	war: WarState | null;
}) {
	const { crew } = crewHook;
	const view = sounderStepView(crew);

	// A live war replaces the stepper with the compact strip.
	if (view.current === "war") {
		return <WarStrip war={war} crewName={crew.crew?.name ?? null} />;
	}

	return (
		<View style={styles.wrap}>
			{STEP_META.map((s) => {
				const done = view.done.includes(s.key);
				const current = view.current === s.key;
				return (
					<View key={s.key} style={styles.stepRow}>
						{/* Stamp column */}
						<View
							style={[
								styles.stamp,
								done && styles.stampDone,
								current && styles.stampCurrent,
							]}
						>
							{done ? (
								<Icon name="check" size={16} color={WHIMSY.ink} strokeWidth={3} />
							) : (
								<Text style={styles.stampNum}>{s.n}</Text>
							)}
						</View>

						{/* Card column */}
						{current ? (
							<Sticker color="paper" rotate={-0.5} radius={RADII.lg} style={styles.currentCard}>
								<Text style={styles.stepTitle}>{s.title}</Text>
								{s.key === "create" && <CreateStep crewHook={crewHook} />}
								{s.key === "invite" && <InviteStep crewHook={crewHook} />}
								{s.key === "march" && <MarchStep />}
							</Sticker>
						) : (
							<View style={styles.collapsed}>
								<Text
									style={[
										styles.collapsedText,
										done ? styles.collapsedDone : styles.collapsedFuture,
									]}
								>
									{s.title}
									{done && s.key === "create" && crew.crew
										? ` — ${crew.crew.name}`
										: ""}
									{done && s.key === "invite"
										? ` — ${crew.members.length} of ${CREW_CAP}`
										: ""}
								</Text>
							</View>
						)}
					</View>
				);
			})}
		</View>
	);
}

// ── Step 1 — found + name, inline ────────────────────────────────────
function CreateStep({ crewHook }: { crewHook: UseCrew }) {
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const invites = crewHook.crew.invitesIn;

	const found = async () => {
		const trimmed = name.trim();
		if (!trimmed || busy) return;
		setBusy(true);
		setNote(null);
		const r = await crewHook.create(trimmed);
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		} else {
			setNote(
				r.reason === "already_in_crew"
					? "You're already in a Sounder."
					: "That name didn't stick — try another, short and muddy."
			);
		}
	};

	return (
		<View>
			<Text style={styles.stepSub}>
				Five snouts, one banner. Give yours a name the bog will remember.
			</Text>

			{/* A friend already wants you — joining beats founding. */}
			{invites.map((inv) => (
				<View key={inv.id} style={styles.inviteRow}>
					<Glyph name="friends" size={18} />
					<Text style={styles.inviteText} numberOfLines={2}>
						{inv.inviter_name ?? "A friend"} wants you in {inv.crew_name}
					</Text>
					<Pressable
						onPress={() => crewHook.accept(inv.id)}
						style={styles.joinBtn}
						hitSlop={6}
					>
						<Text style={styles.joinBtnText}>Join</Text>
					</Pressable>
					<Pressable onPress={() => crewHook.decline(inv.id)} hitSlop={8}>
						<Text style={styles.declineText}>decline</Text>
					</Pressable>
				</View>
			))}

			<TextInput
				value={name}
				onChangeText={setName}
				placeholder="The Mud Maulers"
				placeholderTextColor={WHIMSY.muteSoft}
				maxLength={24}
				style={styles.nameInput}
				returnKeyType="done"
				onSubmitEditing={found}
			/>
			<Button size="md" variant="primary" full onPress={found} disabled={busy || !name.trim()}>
				{busy ? "Founding…" : "Found it"}
			</Button>
			{!!note && <Text style={styles.note}>{note}</Text>}
		</View>
	);
}

// ── Step 2 — rally friends into the roster ───────────────────────────
function InviteStep({ crewHook }: { crewHook: UseCrew }) {
	const { members, invitesOut } = crewHook.crew;
	return (
		<View>
			<Text style={styles.stepSub}>
				Wars count with {QUORUM}+ pigs slinging. Invite the friends you'd share
				a trough with.
			</Text>
			<View style={styles.pipsRow}>
				{Array.from({ length: CREW_CAP }).map((_, i) => (
					<View key={i} style={[styles.pip, i < members.length && styles.pipLit]} />
				))}
				<Text style={styles.pipLabel}>
					{members.length} of {CREW_CAP}
				</Text>
			</View>
			{invitesOut.length > 0 && (
				<Text style={styles.waiting}>
					{invitesOut.length === 1
						? `Waiting on ${invitesOut[0].invitee_name ?? "one pig"}…`
						: `Waiting on ${invitesOut.length} pigs…`}
				</Text>
			)}
			<Button
				size="md"
				variant="primary"
				full
				onPress={() => router.push("/(tabs)/friends?seg=sounder" as Href)}
			>
				Invite friends
			</Button>
			<Pressable onPress={() => router.push("/mud-war" as Href)} hitSlop={8}>
				<Text style={styles.aloneLink}>
					or march alone against The Mudlarks ›
				</Text>
			</Pressable>
		</View>
	);
}

// ── Step 3 — to the bog ──────────────────────────────────────────────
function MarchStep() {
	return (
		<View>
			<Text style={styles.stepSub}>
				Your Sounder stands ready. Challenge a rival — every war pries tickles
				off the Hungerer.
			</Text>
			<Button
				size="md"
				variant="primary"
				full
				onPress={() => router.push("/mud-war" as Href)}
			>
				March on the bog
			</Button>
		</View>
	);
}

// ── Live war — the compact strip that replaces the stepper ───────────
function WarStrip({
	war,
	crewName,
}: {
	war: WarState | null;
	crewName: string | null;
}) {
	const totalDays = war?.frontsEnabled ? WAR_LENGTH_DAYS_FRONTS : WAR_LENGTH_DAYS;
	const day = warDay(war?.endsAt ?? null, totalDays);
	return (
		<Sticker color="sun" rotate={-0.7} radius={RADII.lg} style={styles.warStrip}>
			<View style={styles.warHead}>
				<Glyph name="flame" size={20} />
				<Text style={styles.warTitle} numberOfLines={1}>
					{crewName ?? "Your Sounder"} is at war
				</Text>
				<Text style={styles.warDay}>
					Day {day} of {totalDays}
				</Text>
			</View>
			<Text style={styles.warLean}>
				{war
					? `${ropeLeanLine(war.ropeNorm)} ${
							war.them.crew?.name ? `Facing ${war.them.crew.name}.` : ""
						}`
					: "The rope is drawn and the mud is flying."}
			</Text>
			<Button size="md" variant="primary" full onPress={() => router.push("/mud-war" as Href)}>
				To the bog
			</Button>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.sm },
	stepRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
	stamp: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 2,
		...SHADOW_SM,
	},
	stampDone: { backgroundColor: WHIMSY.sage },
	stampCurrent: { backgroundColor: WHIMSY.sun },
	stampNum: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	currentCard: { flex: 1, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
	collapsed: { flex: 1, justifyContent: "center", minHeight: 40 },
	collapsedText: { ...TYPE.body, fontFamily: FONTS.body },
	collapsedDone: { color: WHIMSY.ink },
	collapsedFuture: { color: WHIMSY.muteSoft },
	stepTitle: {
		...TYPE.cardTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		marginBottom: SPACE.xs,
	},
	stepSub: {
		...TYPE.bodySm,
		fontFamily: FONTS.body,
		color: WHIMSY.mute,
		marginBottom: SPACE.md,
	},
	inviteRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		marginBottom: SPACE.md,
	},
	inviteText: { flex: 1, ...TYPE.bodySm, fontFamily: FONTS.body, color: WHIMSY.ink },
	joinBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: 5,
		minHeight: 32,
		justifyContent: "center",
	},
	joinBtnText: { fontFamily: FONTS.whimsy, fontSize: 13, color: WHIMSY.ink },
	declineText: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
	nameInput: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.cream,
		paddingHorizontal: SPACE.md,
		paddingVertical: 10,
		fontFamily: FONTS.body,
		fontSize: 15,
		color: WHIMSY.ink,
		marginBottom: SPACE.sm,
	},
	note: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	pipsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		marginBottom: SPACE.sm,
	},
	pip: {
		width: 14,
		height: 14,
		borderRadius: 7,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
	},
	pipLit: { backgroundColor: WHIMSY.sun },
	pipLabel: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		marginLeft: 4,
	},
	waiting: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		marginBottom: SPACE.sm,
	},
	aloneLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textAlign: "center",
		marginTop: SPACE.sm,
		textDecorationLine: "underline",
	},
	warStrip: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
	warHead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	warTitle: {
		flex: 1,
		...TYPE.cardTitle,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	warDay: { ...TYPE.label, fontFamily: FONTS.bodyExtra, color: WHIMSY.mute },
	warLean: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		marginTop: SPACE.xs,
		marginBottom: SPACE.md,
	},
});
