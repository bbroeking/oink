// The pig card — the one card the Pen shows, about whichever medallion is
// selected. Nameplate, coat, the hand line (how the pig looks and how long
// it takes), the JOB SEGMENT (At home · In the Pen · Out looking — the first
// two are the roster's activate toggle; the third is a readout), and ONE
// action by state: join / recruit / send / call home / see what it found /
// back tomorrow / resting.
import { StyleSheet, View } from "react-native";
import { Button, Hand, PigPortrait, SegmentedControl, Sticker, T, Tag, type SegmentOption } from "@/components/ui";
import { FindArt } from "@/components/satchel/FindArt";
import type { ErrandTuning } from "@/constants/errands";
import { ART_SIZE, BORDER, PIG_ACCENT, RADII, SPACE, TILT, UI_COLORS } from "@/constants/theme";
import { backByLabel, errandDurationLabel, targetLabel, type ErrandFriend } from "@/utils/errands";
import { pigPronouns, type PigId } from "@/utils/pigs";
import type { PigCardState } from "./penState";

/** The card's art window and the portrait inside it. */
const CARD_ART_H = 120;
const CARD_PIG = 116;
/** The nameplate — wide enough for the longest name. */
const NAMEPLATE_MIN_W = 104;

type Job = "home" | "pen" | "out";

interface Props {
	state: PigCardState;
	tuning: ErrandTuning;
	/** Who the pig's current errand is for, when it is out. */
	friendFor: (userId: string | null) => ErrandFriend | null;
	busy: boolean;
	onJob: (pig: PigId, job: "home" | "pen") => void;
	onJoin: (pig: PigId) => void;
	onRecruit: (pig: PigId) => void;
	onSend: (pig: PigId) => void;
	onRecall: (pig: PigId) => void;
	onOpenReturn: (pig: PigId) => void;
	/** DEV ONLY: bring the pig home now (server-gated on is_test). */
	onSummon?: (pig: PigId) => void;
}

export function PigCard({ state, tuning, friendFor, busy, onJob, onJoin, onRecruit, onSend, onRecall, onOpenReturn, onSummon }: Props) {
	const { pig, action } = state;
	const p = pigPronouns(pig.id);
	const jobOptions: readonly SegmentOption<Job>[] = [
		{ value: "home", label: "At home", disabled: !state.jobEditable },
		{ value: "pen", label: "In the Pen", disabled: !state.jobEditable },
		{ value: "out", label: "Out looking", disabled: true },
	];

	const handLine = (() => {
		switch (action.kind) {
			case "out": {
				const friend = friendFor(action.row.for_user_id);
				return `${targetLabel(action.row, friend)} · ${backByLabel(action.row.ends_at)}`;
			}
			case "back":
				return `${p.subject} is back — see what ${p.subject} found`;
			case "used_today":
				return `${p.subject} has been out today · back tomorrow`;
			case "board_full":
				return "resting until you look at the board";
			case "resting":
				return "resting until Slop Club resumes";
			case "join":
				return `${pig.coat} · Slop Club members choose one companion`;
			case "recruit":
				return `${pig.coat} · one long-term choice`;
			case "choice_locked":
				return `${pig.coat} · your companion choice is locked for now`;
			case "none":
				return pig.coat;
			default:
				return `looks anywhere · back in ${errandDurationLabel(pig.id, tuning)}`;
		}
	})();

	return (
		<Sticker color="paper" rotate={TILT.card} radius={RADII.md} shadow="sticker" style={styles.card} testID={`pig-card-${pig.id}`}>
			<View style={[styles.art, { backgroundColor: PIG_ACCENT[pig.id].tint }]}>
				<PigPortrait pigId={pig.id} size={CARD_PIG} />
				{action.kind === "out" && action.row.target_find_id ? (
					<View style={styles.target} accessible={false}>
						<FindArt id={action.row.target_find_id} size={ART_SIZE.glyphSm} />
					</View>
				) : null}
			</View>
			<Sticker color={PIG_ACCENT[pig.id].solid} rotate={0} radius={RADII.sm} shadow="none" border={BORDER.thin} style={styles.nameplate}>
				<T role="handDisplay">{pig.name}</T>
			</Sticker>
			{action.kind === "out" || action.kind === "back" || action.kind === "send" || action.kind === "used_today" || action.kind === "board_full" ? (
				<T role="label" tone="secondary" align="center">
					{pig.coat}
				</T>
			) : null}
			<Hand tone="secondary" align="center" style={styles.hand} testID={`pig-card-${pig.id}-line`}>
				{handLine}
			</Hand>

			{pig.owned ? (
				<SegmentedControl<Job>
					options={jobOptions}
					value={state.job}
					onChange={(job) => {
						if (job === "out" || job === state.job || !state.jobEditable) return;
						onJob(pig.id, job);
					}}
					label={`${pig.name}'s job`}
					style={styles.segment}
				/>
			) : null}

			<View style={styles.actions}>
				{action.kind === "join" ? (
					<Button
						variant="gold"
						size="md"
						full
						loading={busy}
						onPress={() => onJoin(pig.id)}
						accessibilityLabel={`Join Slop Club — ${pig.name} moves in`}
						accessibilityHint="Opens the Slop Club purchase, then puts this pig in the Pen"
					>
						Join Slop Club — {pig.name} moves in
					</Button>
				) : null}
				{action.kind === "recruit" ? (
					<Button
						variant="lilac"
						size="md"
						full
						loading={busy}
						onPress={() => onRecruit(pig.id)}
						accessibilityLabel={`Recruit ${pig.name}`}
						accessibilityHint={`Asks you to confirm ${pig.name} as Rosie's one companion`}
					>
						Recruit {pig.name}
					</Button>
				) : null}
				{action.kind === "choice_locked" ? (
					<Tag tone="muted" icon="lock" label="Choice locked" style={styles.tag} />
				) : null}
				{action.kind === "send" ? (
					<Button
						variant="lilac"
						size="md"
						full
						loading={busy}
						onPress={() => onSend(pig.id)}
						accessibilityLabel={`Send ${pig.name} to look for something`}
						accessibilityHint="Opens the list of things a pig can look for"
						testID={`send-${pig.id}`}
					>
						Send {pig.name} to look for…
					</Button>
				) : null}
				{action.kind === "out" ? (
					<>
						<Tag tone="sun" glyph="search" label="out looking" style={styles.tag} />
						<Button
							variant="ghost"
							size="sm"
							full
							disabled={busy}
							onPress={() => onRecall(pig.id)}
							accessibilityLabel={`Call ${p.object} home`}
							accessibilityHint="Asks you to confirm; the pig comes back now, empty-handed"
							testID={`recall-${pig.id}`}
						>
							Call {p.object} home
						</Button>
						{__DEV__ && onSummon ? (
							<Button
								variant="ghost"
								size="sm"
								full
								disabled={busy}
								onPress={() => onSummon(pig.id)}
								accessibilityLabel={`Summon ${pig.name} home now (dev)`}
								accessibilityHint="Dev only: the pig is home now, with whatever it found"
								testID={`summon-${pig.id}`}
							>
								Summon {p.object} now (dev)
							</Button>
						) : null}
					</>
				) : null}
				{action.kind === "back" ? (
					<Button
						variant="lilac"
						size="md"
						full
						disabled={busy}
						onPress={() => onOpenReturn(pig.id)}
						accessibilityLabel={`See what ${pig.name} found`}
						accessibilityHint="Opens the homecoming"
						testID={`open-return-${pig.id}`}
					>
						See what {p.subject} found
					</Button>
				) : null}
				{action.kind === "used_today" ? (
					<Tag tone="muted" glyph="zzz" label="back tomorrow" style={styles.tag} />
				) : null}
				{action.kind === "board_full" ? (
					<Tag tone="muted" glyph="zzz" label="resting until you look" style={styles.tag} />
				) : null}
				{action.kind === "resting" ? (
					<Tag tone="muted" glyph="zzz" label="resting" style={styles.tag} />
				) : null}
			</View>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	card: { alignItems: "center", padding: SPACE.card, marginTop: SPACE.md, gap: SPACE.xs },
	art: {
		width: "100%",
		height: CARD_ART_H,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderRadius: RADII.sm,
	},
	target: {
		position: "absolute",
		top: SPACE.xs,
		right: SPACE.xs,
		padding: SPACE.xxs,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.surface,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	nameplate: {
		minWidth: NAMEPLATE_MIN_W,
		alignItems: "center",
		marginTop: -SPACE.xs,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
	},
	hand: { minHeight: SPACE.xl },
	segment: { alignSelf: "stretch", marginTop: SPACE.xs },
	actions: { alignSelf: "stretch", marginTop: SPACE.sm, gap: SPACE.xs, alignItems: "center" },
	tag: { alignSelf: "center" },
});
