// Dev preview for the Pen's errand board (components/PigPenView.tsx): the
// canvas's boards (docs/design/claude-design/errand-2026-09-17/) as fixture
// states, so every one can be seen on the sim before the migration is on the
// server. Fake hook, fake targets, a fake claim — nothing here reaches
// pig_errands. Route: /pen-preview?state=<main|out|back|corkboard|empty|
// full|lapsed|yard|off> (dev only). (2026-09-18)
import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { PigPenView } from "@/components/PigPenView";
import { EmptyYard } from "@/components/pen/EmptyYard";
import { Button, Hand, PageHeader } from "@/components/ui";
import type { ErrandRow } from "@/constants/errands";
import { PAGE_PAD, SPACE, WHIMSY } from "@/constants/theme";
import type { WishTargets } from "@/hooks/useFriendWishTargets";
import type { UsePigErrands } from "@/hooks/usePigErrands";
import { EMPTY_ERRANDS, type ClaimOutcome, type ErrandState, type SendOutcome } from "@/utils/errands";
import { DEFAULT_PIG_ROSTER, type PigRoster } from "@/utils/pigRoster";
import type { PigId } from "@/utils/pigs";

type State = "main" | "out" | "back" | "corkboard" | "empty" | "full" | "lapsed" | "yard" | "off";
const STATES: State[] = ["main", "out", "back", "corkboard", "empty", "full", "lapsed", "yard", "off"];

const MAYA = "00000000-0000-0000-0000-00000000f001";
const JEN = "00000000-0000-0000-0000-00000000f002";
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const row = (over: Partial<ErrandRow>): ErrandRow => ({
	id: 1,
	pig_id: "bandit",
	target_find_id: "blue_feather",
	for_user_id: MAYA,
	for_wish_no: 3,
	started_at: ago(1),
	ends_at: inHours(3),
	status: "out",
	result_find_ids: [],
	...over,
});

const member: PigRoster = {
	isMember: true,
	activePigId: "rosie",
	recruitedPigId: "bandit",
	pigs: DEFAULT_PIG_ROSTER.pigs.map((p) => ({ ...p, owned: p.id === "rosie" || p.id === "bandit" })),
};

function errandsFor(state: State): ErrandState {
	const on = { ...EMPTY_ERRANDS, enabled: true };
	switch (state) {
		case "out":
			return { ...on, out: [row({})] };
		case "yard":
			return { ...on, away: "rosie", out: [row({ pig_id: "rosie", ends_at: inHours(2.3) })] };
		case "back":
			return { ...on, board: [row({ status: "back", result_find_ids: ["blue_feather"], ends_at: ago(0.1) })] };
		case "corkboard":
			return {
				...on,
				today: { bandit: true, rosie: true },
				board: [
					row({ id: 3, status: "back", result_find_ids: ["blue_feather"], ends_at: ago(0.2) }),
					row({ id: 2, pig_id: "rosie", target_find_id: null, for_user_id: null, status: "back", result_find_ids: ["old_key"], ends_at: ago(2) }),
				],
			};
		case "empty":
			return { ...on, board: [row({ status: "back", result_find_ids: [], ends_at: ago(0.1) })] };
		case "full":
			return {
				...on,
				today: { bandit: true },
				board: [
					row({ id: 3, status: "back", result_find_ids: ["blue_feather"], ends_at: ago(0.2) }),
					row({ id: 2, pig_id: "rosie", target_find_id: null, for_user_id: null, status: "back", result_find_ids: ["old_key"], ends_at: ago(2) }),
					row({ id: 1, pig_id: "rosie", for_user_id: JEN, status: "back", result_find_ids: [], ends_at: ago(5) }),
				],
			};
		case "off":
			return EMPTY_ERRANDS;
		default:
			return on;
	}
}

const targets: WishTargets = {
	friends: [
		{
			friendId: MAYA,
			name: "Maya",
			pigId: "pickles",
			wish: { target_id: MAYA, find_id: "blue_feather", wish_no: 3, expires_at: inHours(31), fulfilled_by_me: false, options: [], swapped_today: false },
		},
		{
			friendId: JEN,
			name: "Jen",
			pigId: "rosie",
			wish: { target_id: JEN, find_id: "old_key", wish_no: 8, expires_at: inHours(6), fulfilled_by_me: false, options: [], swapped_today: false },
		},
	],
	names: new Map([
		[MAYA, { name: "Maya", pigId: "pickles" }],
		[JEN, { name: "Jen", pigId: "rosie" }],
	]),
	mine: { find_id: "honeycomb", wish_no: 2, expires_at: inHours(20) },
	bag: [
		{ id: 1, find_id: "river_pebble" },
		{ id: 2, find_id: "old_key" },
		{ id: 3, find_id: "clover" },
		{ id: 4, find_id: "river_pebble" },
	],
};

export default function PenPreview() {
	const params = useLocalSearchParams<{ state?: string }>();
	const initial = (STATES as string[]).includes(params.state ?? "") ? (params.state as State) : "main";
	const [state, setState] = useState<State>(initial);
	const [errands, setErrands] = useState<ErrandState>(() => errandsFor(initial));
	const [log, setLog] = useState<string[]>([]);
	const say = (line: string) => setLog((l) => [line, ...l].slice(0, 4));

	const pick = (s: State) => {
		setState(s);
		setErrands(errandsFor(s));
	};

	const roster = state === "lapsed" ? { ...member, isMember: false } : member;

	const hook: UsePigErrands = useMemo(
		() => ({
			state: errands,
			available: true,
			loading: false,
			error: false,
			busyId: null,
			busyPig: null,
			refresh: async () => errands,
			send: async (pig: PigId, target, forUserId): Promise<SendOutcome> => {
				say(`send ${pig} → ${target ?? "anything"}${forUserId ? " for a friend" : ""}`);
				const r = row({ id: Date.now(), pig_id: pig, target_find_id: target, for_user_id: forUserId, ends_at: inHours(4) });
				setErrands((e) => ({ ...e, out: [...e.out, r], today: { ...e.today, [pig]: true }, away: pig === "rosie" ? "rosie" : e.away }));
				return { ok: true, replay: false, errand: r };
			},
			claim: async (id, action): Promise<ClaimOutcome> => {
				say(`claim ${id} ${action}`);
				await new Promise((r) => setTimeout(r, 600));
				setErrands((e) => ({ ...e, board: e.board.filter((r) => r.id !== id) }));
				return { ok: true, replay: false, action, status: action === "give" ? "given" : "kept", tickles: action === "give" ? 3 : 0, bagCount: 5 };
			},
			recall: async (id) => {
				say(`recall ${id}`);
				setErrands((e) => ({ ...e, out: e.out.filter((r) => r.id !== id), away: null }));
				return { ok: true, errand: row({ id, status: "recalled" }) };
			},
			summon: async (id) => {
				say(`summon ${id}`);
				setErrands((e) => {
					const r = e.out.find((x) => x.id === id);
					if (!r) return e;
					return { ...e, out: e.out.filter((x) => x.id !== id), away: null, board: [{ ...r, status: "back", result_find_ids: r.target_find_id ? [r.target_find_id] : ["clover"] }, ...e.board] };
				});
				return true;
			},
		}),
		[errands],
	);

	return (
		<SafeAreaView style={styles.page}>
			<PageHeader kicker="dev" title="The Pen (fixtures)" backLabel="back" onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerBar} contentContainerStyle={styles.picker}>
				{STATES.map((s) => (
					<Button key={s} variant={s === state ? "lilac" : "ghost"} size="xs" onPress={() => pick(s)} accessibilityLabel={`state ${s}`} testID={`pen-preview-${s}`}>
						{s}
					</Button>
				))}
			</ScrollView>
			{log.length ? (
				<Hand tone="secondary" style={styles.log}>
					{log.join(" · ")}
				</Hand>
			) : null}
			{state === "yard" ? (
				<View style={styles.yard}>
					<EmptyYard pig="rosie" endsAt={inHours(2.3)} onOpen={() => say("→ /pen")} />
				</View>
			) : (
				<PigPenView
					roster={roster}
					loading={false}
					busyPigId={null}
					onJoinSlopClub={async () => say("join")}
					onRecruit={async (pig) => {
						say(`recruit ${pig}`);
						return { ok: true, pig_id: pig };
					}}
					onActivate={async (pig) => {
						say(`activate ${pig}`);
						return { ok: true, pig_id: pig };
					}}
					errands={hook}
					targets={targets}
					targetsLoading={false}
					targetsLoaded
					loadTargets={async () => targets}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	page: { flex: 1, backgroundColor: WHIMSY.cream },
	pickerBar: { flexGrow: 0 },
	picker: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, paddingHorizontal: PAGE_PAD, paddingVertical: SPACE.xs },
	log: { paddingHorizontal: PAGE_PAD },
	yard: { flex: 1, alignItems: "center", justifyContent: "center" },
});
