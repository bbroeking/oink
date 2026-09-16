// The Herd panel — your Sounder. Crewed: a sage sticker naming the herd (size
// and finds together, one hand sentence that never names a sleeper), the roster
// as 44pt rows — avatar, name, a hand sub, a check once they dug or a chevron
// door to a crewmate — and ONE gold "Oink at the herd" CTA. No per-pig nudge.
// Herdless: Rosie, one line, gold "Start one with a friend", and the open herds
// (the existing knock-to-join list). Mid-onboarding the owner hands in the
// SounderStepCard instead (`stepCard`) and this panel just frames it.

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
	Avatar,
	BodySm,
	Button,
	CrewPortrait,
	Hand,
	Icon,
	ListRow,
	LoadingBeat,
	PigPortrait,
	Sticker,
	T,
} from "@/components/ui";
import { FriendInvitePicker } from "@/components/FriendInvitePicker";
import { JoinableSounders } from "@/components/JoinableSounders";
import type { FeedingCta } from "@/components/mudwar/useFeedingCta";
import { useJoinableCrews, type UseCrew } from "@/hooks/useCrew";
import { CREW_CAP } from "@/constants/crews";
import {
	ART_SIZE,
	AVATAR_SIZE,
	BORDER,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
} from "@/constants/theme";
import { countWord } from "./almanacState";
import type { HerdFeeding } from "./useHerdFeeding";

// The sentence under the herd's name. Counts, never names; "full" is the cap.
export function herdSentence(dugCount: number, herdSize: number, open: boolean, cap: number = CREW_CAP): string {
	const when = open ? "so far" : "last time";
	const full = `${countWord(cap)} is a full herd`;
	if (herdSize > 0 && dugCount >= herdSize) {
		return herdSize >= cap ? `Every snout dug ${when} — a full herd.` : `Every snout dug ${when} — ${full}.`;
	}
	if (dugCount === 0) return `The patch is quiet ${when} — ${full}.`;
	const lead = countWord(dugCount);
	return `${lead.charAt(0).toUpperCase()}${lead.slice(1)} ${dugCount === 1 ? "snout" : "snouts"} dug ${when} — ${full}.`;
}

export interface HerdPanelProps {
	crewHook: UseCrew;
	cta: FeedingCta;
	herd: HerdFeeding;
	onOinkHerd: () => void;
	onOpenMember?: (userId: string) => void;
	/** The onboarding step card, while the funnel is still running. */
	stepCard?: React.ReactNode;
	testID?: string;
}

export function HerdPanel({
	crewHook,
	cta,
	herd,
	onOinkHerd,
	onOpenMember,
	stepCard,
	testID,
}: HerdPanelProps) {
	const crew = crewHook.crew.crew;
	if (stepCard) {
		return (
			<View style={styles.panel} testID={testID}>
				{stepCard}
			</View>
		);
	}
	if (!crew) {
		return <NoSounder crewHook={crewHook} testID={testID} />;
	}
	const members = herd.members;
	const open = cta.phaseOpen;
	const feedingLine = open ? `${cta.countdown} left` : `next feeding in ${cta.countdown}`;
	return (
		<View style={styles.panel} testID={testID}>
			<Sticker color="sage" rotate={TILT.card} radius={RADII.xl} style={styles.nameCard}>
				<View style={styles.nameRow}>
					<T role="sectionTitle" accessibilityRole="header" style={styles.name}>
						{crew.name}
					</T>
					<Hand tone="secondary" style={styles.meta}>
						{`${members.length} ${members.length === 1 ? "snout" : "snouts"} · ${crewHook.crew.lifetime_finds} finds together`}
					</Hand>
				</View>
				<Hand>{herdSentence(herd.dugCount, members.length, open)}</Hand>
			</Sticker>

			<Sticker
				color="paper"
				rotate={0}
				radius={RADII.xl}
				title={open ? "This feeding" : "Last feeding"}
				right={<Hand tone="secondary">who dug</Hand>}
				style={styles.roster}
			>
				{herd.loading && members.length === 0 ? (
					<LoadingBeat label="finding your herd" />
				) : (
					members.map((m, i) => {
						const p = herd.profiles.get(m.user_id);
						const door = !m.me && !!onOpenMember;
						const sub = m.dug
							? m.layerLine
								? `dug · ${m.layerLine}${door ? " · visit their Barn" : ""}`
								: m.finds != null
									? `dug ${m.finds} ${m.finds === 1 ? "find" : "finds"}`
									: "dug"
							: feedingLine;
						return (
							<View key={m.user_id} style={[styles.memberRow, i > 0 && styles.memberRule]}>
								<ListRow
									flat
									fill="paper"
									leading={
										<CrewPortrait
											size={AVATAR_SIZE[1]}
											hatId={p?.hatId ?? null}
											bowId={p?.bowId ?? null}
											prestigeLevel={p?.wallowCount ?? 0}
										/>
									}
									title={
										<T role="body">
											{m.me ? `${m.username} · you` : m.username}
										</T>
									}
									sub={sub}
									trailing={
										m.dug ? (
											<Icon name="check" size={ART_SIZE.glyphSm} color={UI_COLORS.textPrimary} strokeWidth={3} />
										) : door ? (
											<Icon name="chevronRight" size={ART_SIZE.glyphSm} color={UI_COLORS.textSecondary} />
										) : undefined
									}
									onPress={door ? () => onOpenMember?.(m.user_id) : undefined}
									accessibilityLabel={`${m.username}${m.me ? ", you" : ""}: ${sub}`}
									accessibilityHint={door ? "Opens their profile, with a door to their Barn" : undefined}
								/>
							</View>
						);
					})
				)}
				<Button
					variant="gold"
					size="lg"
					full
					onPress={onOinkHerd}
					accessibilityLabel={`Oink at the herd — ${feedingLine}`}
					accessibilityHint="Opens the Sounder Oink sheet"
					style={styles.oink}
				>
					{`Oink at the herd — ${feedingLine}`}
				</Button>
			</Sticker>
		</View>
	);
}

// ── Herdless ─────────────────────────────────────────────────────────────────
function NoSounder({ crewHook, testID }: { crewHook: UseCrew; testID?: string }) {
	const joinable = useJoinableCrews();
	const invites = crewHook.crew.invitesIn;
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [inviteOpen, setInviteOpen] = useState(false);

	const start = async () => {
		if (busy) return;
		setBusy(true);
		setNote(null);
		const r = await crewHook.create();
		setBusy(false);
		if (r.ok) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
			setInviteOpen(true);
		} else {
			setNote(
				r.reason === "already_in_crew"
					? "You're already in a Sounder."
					: "Couldn't raise the banner — give it another tap."
			);
		}
	};

	return (
		<View style={styles.panel} testID={testID}>
			<Sticker color="cream" rotate={TILT.card} radius={RADII.xl} style={styles.noHerd}>
				<PigPortrait pigId="rosie" size={ART_SIZE.portrait} />
				<T role="pageTitle" align="center" accessibilityRole="header">
					Rosie digs with a herd.
				</T>
				<Hand tone="secondary" align="center">
					A Sounder is a few friends whose finds count together.
				</Hand>
				<Button
					variant="gold"
					size="lg"
					full
					onPress={start}
					loading={busy}
					loadingLabel="Raising the banner…"
					accessibilityLabel="Start one with a friend"
					accessibilityHint="Founds your Sounder, then opens your friends to invite"
				>
					Start one with a friend
				</Button>
				{!!note && (
					<Hand tone="accent" align="center">
						{note}
					</Hand>
				)}
			</Sticker>

			{invites.map((inv) => (
				<ListRow
					key={inv.id}
					tilt={false}
					fill="cream2"
					leading={
						<Avatar size={AVATAR_SIZE[0]} fill="paper" glyph="friends" label="Sounder invite" />
					}
					title={
						<BodySm>
							{inv.inviter_name ?? "A friend"} wants you in {inv.crew_name}
						</BodySm>
					}
					trailing={
						<View style={styles.inviteActions}>
							<Button
								size="sm"
								variant="gold"
								onPress={() => crewHook.accept(inv.id)}
								accessibilityLabel={`Join ${inv.crew_name}`}
								accessibilityHint="Puts you in this Sounder for the season"
							>
								Join
							</Button>
							<Button
								size="sm"
								variant="handLink"
								onPress={() => crewHook.decline(inv.id)}
								accessibilityLabel={`Decline the invite to ${inv.crew_name}`}
							>
								decline
							</Button>
						</View>
					}
				/>
			))}

			{(joinable.loading || joinable.crews.length > 0) && (
				<Sticker
					color="paper"
					rotate={0}
					radius={RADII.xl}
					title="Herds with a seat open"
					right={<Hand tone="secondary">or join one</Hand>}
					style={styles.roster}
				>
					{joinable.loading ? (
						<LoadingBeat label="looking for open herds" />
					) : (
						<JoinableSounders
							crews={joinable.crews}
							crewHook={crewHook}
							onStale={joinable.refresh}
						/>
					)}
				</Sticker>
			)}

			<FriendInvitePicker
				visible={inviteOpen}
				onDismiss={() => setInviteOpen(false)}
				crewHook={crewHook}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: { gap: SPACE.md },
	nameCard: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.md,
		gap: SPACE.xs,
	},
	nameRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	name: { flexShrink: 1 },
	meta: { flexShrink: 0 },
	roster: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.card,
	},
	memberRow: {},
	memberRule: {
		borderTopWidth: BORDER.thin,
		borderTopColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	oink: { marginTop: SPACE.md },
	noHerd: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.lg,
		alignItems: "center",
		gap: SPACE.sm,
	},
	inviteActions: { alignItems: "center", gap: SPACE.xxs },
});
