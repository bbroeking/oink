// The errand ticket — the one confirm both entrances land on (the Pen card
// pig-first, the Friends row target-first): the target stub (the find coin,
// its name, who it is for), WHO GOES (every pig that may go; one already out
// is dashed "out"), back-by from the pig's trot, "one errand a day", the gold
// Send and the ghost Not now.
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, CardTitle, Hand, KickerPill, PigPortrait, Sticker, T } from "@/components/ui";
import { FindArt } from "@/components/satchel/FindArt";
import type { ErrandTuning } from "@/constants/errands";
import { satchelFind, type SatchelFindId } from "@/constants/satchel";
import { ART_SIZE, BORDER, OPACITY, PIG_ACCENT, RADII, SPACE, TILT, UI_COLORS } from "@/constants/theme";
import { backByLabel, errandDurationMs } from "@/utils/errands";
import { pigDefinition, type PigId } from "@/utils/pigs";

/** A picker medallion, the portrait in it, and the cell it sits in (the
 *  medallion plus its label's breathing room — art geometry, not spacing). */
const PICK = 52;
const PICK_PIG = 44;
const PICK_CELL_W = 60;

export interface ErrandTarget {
	find: SatchelFindId | null;
	forUserId: string | null;
	/** "Maya's Pickles" — who the find is for, when it is a friend's wish. */
	forLabel: string | null;
}

export interface TicketPig {
	id: PigId;
	name: string;
	/** May go now. */
	sendable: boolean;
	/** Already out looking (dashed, not pickable). */
	out: boolean;
}

interface Props {
	target: ErrandTarget;
	pigs: TicketPig[];
	pig: PigId | null;
	onPickPig: (pig: PigId) => void;
	tuning: ErrandTuning;
	busy: boolean;
	onSend: () => void;
	onBack: () => void;
}

export function ErrandTicket({ target, pigs, pig, onPickPig, tuning, busy, onSend, onBack }: Props) {
	const find = target.find ? satchelFind(target.find) : null;
	const chosen = pig ? pigDefinition(pig) : null;
	// The back-by clock is read once per pick, not per render.
	const backBy = useMemo(
		() => (pig ? backByLabel(new Date(Date.now() + errandDurationMs(pig, tuning)).toISOString()) : null),
		[pig, tuning],
	);
	return (
		<View style={styles.root} testID="errand-ticket">
			<Sticker color="cream" rotate={TILT.card} radius={RADII.md} shadow="sm" style={styles.stub}>
				<View style={styles.coin}>
					{find ? <FindArt id={find.id} size={ART_SIZE.badge * 0.62} /> : <T role="handDisplay">?</T>}
				</View>
				<View style={styles.stubText}>
					<KickerPill star={false}>{target.forLabel ? "a friend's wish" : target.find ? "your pig's wish" : "anything"}</KickerPill>
					<CardTitle>{find ? find.name : "whatever turns up"}</CardTitle>
					{target.forLabel ? <Hand tone="secondary">for {target.forLabel}</Hand> : null}
				</View>
			</Sticker>

			<Hand tone="secondary" style={styles.who}>
				who goes?
			</Hand>
			<View style={styles.picker} accessibilityRole="radiogroup">
				{pigs.map((p) => {
					const selected = p.id === pig;
					const pickable = p.sendable && !p.out;
					return (
						<View key={p.id} style={styles.pick}>
							<Sticker
								color={selected ? "cream" : PIG_ACCENT[p.id].tint}
								rotate={0}
								radius={RADII.pill}
								shadow={selected ? "sm" : "none"}
								border={selected ? BORDER.heavy : BORDER.thin}
								borderStyle={pickable ? "solid" : "dashed"}
								disabled={!pickable}
								onPress={() => onPickPig(p.id)}
								accessibilityRole="radio"
								accessibilityState={{ selected, disabled: !pickable }}
								accessibilityLabel={`${p.name}${p.out ? ", out" : pickable ? "" : ", can't go today"}`}
								testID={`ticket-pig-${p.id}`}
								style={[styles.medallion, pickable ? null : styles.dim]}
							>
								<PigPortrait pigId={p.id} size={PICK_PIG} />
							</Sticker>
							<T role="label" tone={pickable ? "primary" : "disabled"} numberOfLines={1}>
								{p.out ? "out" : p.name}
							</T>
						</View>
					);
				})}
			</View>

			<Hand tone="secondary" align="center" testID="ticket-back-by">
				{backBy ? `${backBy} · one errand a day` : "one errand a day"}
			</Hand>

			<Button
				variant="gold"
				size="md"
				full
				disabled={!chosen}
				loading={busy}
				loadingLabel="Off to look…"
				onPress={onSend}
				accessibilityLabel={chosen ? `Send ${chosen.name}` : "Pick a pig first"}
				accessibilityHint="The pig leaves now and comes back in a few hours"
				testID="ticket-send"
			>
				{chosen ? `Send ${chosen.name}` : "Send"}
			</Button>
			<Button variant="ghost" size="sm" full onPress={onBack} accessibilityLabel="Not now" accessibilityHint="Goes back to the list" testID="ticket-back">
				Not now
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { gap: SPACE.sm, paddingTop: SPACE.xs },
	stub: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.card },
	coin: {
		width: ART_SIZE.badge,
		height: ART_SIZE.badge,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		alignItems: "center",
		justifyContent: "center",
	},
	stubText: { flex: 1, gap: SPACE.xxs },
	who: { marginTop: SPACE.xs },
	picker: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	pick: { alignItems: "center", gap: SPACE.xxs, width: PICK_CELL_W },
	medallion: { width: PICK, height: PICK, alignItems: "center", justifyContent: "center", overflow: "hidden" },
	dim: { opacity: OPACITY.ghost },
});
