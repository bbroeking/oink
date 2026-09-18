// The Pen — the errand board (Build 1 of the scavenging pigs, 2026-09-18).
//
// The paddock with the pigs that are home, the fence row of medallions, the
// corkboard when a return waits, and ONE card about the selected pig: its job
// (At home · In the Pen · Out looking) and its one action — send it to look
// for a Find, call it home, see what it found, or the roster's join / recruit
// actions for a pig that is not yet here. The homecoming rides on
// RewardReturn. Everything the server decides (who is out, when they are
// back, what they found) comes from pig_errands(); the view never rolls,
// never guesses a return, never draws a pin from local state.
//
// Kept from the old Pen: the LoadingBeat ("gathering the pigs"), the error
// EmptyState ("Couldn't round up your pigs"), the join / recruit / home-toggle
// actions and the recruit ConfirmDialog.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Button, ConfirmDialog, EmptyState, LoadingBeat } from "./ui";
import { showPurchaseToast } from "./PurchaseToast";
import { Paddock } from "./pen/Paddock";
import { FenceRow } from "./pen/FenceRow";
import { Corkboard } from "./pen/Corkboard";
import { PigCard } from "./pen/PigCard";
import { SendSheet } from "./pen/SendSheet";
import { Homecoming } from "./pen/Homecoming";
import { paddockNote, pigCardState } from "./pen/penState";
import type { ErrandRow } from "@/constants/errands";
import type { SatchelFindId } from "@/constants/satchel";
import { PAGE_PAD, SPACE, TAB_SAFE } from "@/constants/theme";
import type { UsePigErrands } from "@/hooks/usePigErrands";
import type { WishTargets } from "@/hooks/useFriendWishTargets";
import { errandRefusalCopy, errandTuning, type ErrandFriend } from "@/utils/errands";
import { observeFieldGuide } from "@/utils/fieldGuide";
import { pigRosterActionMessage, type PigRoster } from "@/utils/pigRoster";
import { pigDefinition, pigPronouns, type PigId } from "@/utils/pigs";
import type { RpcResult } from "@/utils/rpc";

interface Props {
	roster: PigRoster;
	loading: boolean;
	/**
	 * The roster read never came back. The Pen keeps its scene but must not draw
	 * a shelf of "Recruit" buttons off a roster it doesn't have. `null` is
	 * unknown, not empty. [B-02, B-14] (2026-09-11, wave 4)
	 */
	error?: boolean;
	/** Re-asks for the roster from the error state (`usePigRoster().refresh`). */
	onRetry?: () => void;
	busyPigId: PigId | null;
	onJoinSlopClub: (pigId: PigId) => Promise<void>;
	onRecruit: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	onActivate: (pigId: PigId) => Promise<RpcResult<{ pig_id: PigId }>>;
	errands: UsePigErrands;
	targets: WishTargets;
	targetsLoading: boolean;
	targetsLoaded: boolean;
	loadTargets: () => Promise<WishTargets>;
	/** The Friends row's door: open the ticket with this friend's wish preset. */
	sendFor?: string | null;
	onSendForConsumed?: () => void;
}

/** The `back` rows whose homecoming has already played this session. */
const AUTO_OPENED = new Set<number>();

export function PigPenView({
	roster,
	loading,
	error = false,
	onRetry,
	busyPigId,
	onJoinSlopClub,
	onRecruit,
	onActivate,
	errands,
	targets,
	targetsLoading,
	targetsLoaded,
	loadTargets,
	sendFor = null,
	onSendForConsumed,
}: Props) {
	const tuning = errands.state.tuning ?? errandTuning();
	const [selectedPig, setSelectedPig] = useState<PigId>("rosie");
	const [joining, setJoining] = useState(false);
	const [pendingRecruitId, setPendingRecruitId] = useState<PigId | null>(null);
	const [pendingRecallId, setPendingRecallId] = useState<PigId | null>(null);
	const [sendOpen, setSendOpen] = useState(false);
	const [sendPig, setSendPig] = useState<PigId | null>(null);
	const [sendForId, setSendForId] = useState<string | null>(null);
	const [homecoming, setHomecoming] = useState<ErrandRow | null>(null);
	// Each `back` row opens its homecoming ONCE on its own: the first time the
	// board shows it this session. After that it waits on the corkboard for a
	// tap. (Module-level, so leaving and re-entering the Pen never replays it.)
	const [autoOpened, setAutoOpened] = useState<Set<number>>(AUTO_OPENED);

	// The names behind the pins and the out lines.
	useEffect(() => {
		if (!targetsLoaded && !targetsLoading) void loadTargets();
	}, [targetsLoaded, targetsLoading, loadTargets]);

	const friendFor = useCallback(
		(userId: string | null): ErrandFriend | null => {
			if (!userId) return null;
			const f = targets.names.get(userId);
			return f ? { name: f.name, pigName: pigDefinition(f.pigId).name } : null;
		},
		[targets.names],
	);

	// The Friends row's door: the ticket, target-first.
	useEffect(() => {
		if (!sendFor || !errands.available || !errands.state.enabled) return;
		setSendPig(null);
		setSendForId(sendFor);
		setSendOpen(true);
		onSendForConsumed?.();
	}, [sendFor, errands.available, errands.state.enabled, onSendForConsumed]);

	// A return that has just landed opens itself once.
	useEffect(() => {
		if (homecoming || sendOpen) return;
		const fresh = errands.state.board.find((r) => !autoOpened.has(r.id));
		if (!fresh) return;
		AUTO_OPENED.add(fresh.id);
		setAutoOpened(new Set(AUTO_OPENED));
		setHomecoming(fresh);
	}, [errands.state.board, autoOpened, homecoming, sendOpen]);

	const cards = useMemo(
		() => roster.pigs.map((p) => pigCardState(roster, errands.state, tuning, p.id)),
		[roster, errands.state, tuning],
	);
	const selected = cards.find((c) => c.pig.id === selectedPig) ?? cards[0];
	const companion = roster.pigs.find((p) => p.owned && p.id !== "rosie") ?? null;
	const previewFriend = !companion && selectedPig !== "rosie" ? selectedPig : null;
	const outIds = errands.state.out.map((r) => r.pig_id);

	const runRoster = async (pigId: PigId, action: "recruit" | "activate") => {
		Haptics.selectionAsync().catch(() => {});
		const result = action === "recruit" ? await onRecruit(pigId) : await onActivate(pigId);
		// Outcomes are toasts, like the rest of the Shop. [D-16] (2026-09-11)
		showPurchaseToast({ type: result.ok ? "success" : "fail", title: pigRosterActionMessage(result) });
		if (result.ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
	};

	const join = async (pigId: PigId) => {
		if (joining) return;
		setJoining(true);
		Haptics.selectionAsync().catch(() => {});
		try {
			await onJoinSlopClub(pigId);
		} finally {
			setJoining(false);
		}
	};

	const send = useCallback(
		async (pig: PigId, target: SatchelFindId | null, forUserId: string | null) => {
			Haptics.selectionAsync().catch(() => {});
			const r = await errands.send(pig, target, forUserId);
			if (!r.ok) {
				// The pig turns round at the gate; the day is not spent.
				const c = errandRefusalCopy(r.reason, friendFor(forUserId)?.name);
				showPurchaseToast({ type: "fail", title: c.title, text: c.text });
			} else {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
				showPurchaseToast({ type: "success", title: `${pigDefinition(pig).name} is off to look` });
				// The Field Guide's Pen page lifts its silhouette on the first send.
				if (!r.replay) observeFieldGuide("pen");
			}
			return r;
		},
		[errands, friendFor],
	);

	const recall = async (pigId: PigId) => {
		const row = errands.state.out.find((r) => r.pig_id === pigId);
		setPendingRecallId(null);
		if (!row) return;
		const r = await errands.recall(row.id);
		if (!r.ok) {
			const c = errandRefusalCopy(r.reason);
			showPurchaseToast({ type: "fail", title: c.title, text: c.text });
		}
	};

	const summon = async (pigId: PigId) => {
		const row = errands.state.out.find((r) => r.pig_id === pigId);
		if (!row) return;
		const ok = await errands.summon(row.id);
		if (!ok) showPurchaseToast({ type: "fail", title: "No summoning", text: "The server refused — not a test account, or not pushed yet" });
	};

	const pendingRecruitPig = pendingRecruitId ? pigDefinition(pendingRecruitId) : null;
	const pendingRecallPig = pendingRecallId ? pigDefinition(pendingRecallId) : null;
	const recallP = pigPronouns(pendingRecallId);

	const ticketPigs = cards
		.filter((c) => c.pig.owned)
		.map((c) => ({ id: c.pig.id, name: c.pig.name, sendable: c.action.kind === "send", out: !!c.outRow }));

	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
			{/* The crown is the route's (app/pen.tsx); the view draws the room. */}
			<Paddock
				pigs={["rosie", companion?.id ?? previewFriend ?? null]}
				out={outIds}
				note={paddockNote(roster, errands.state, previewFriend ? pigDefinition(previewFriend).name : null)}
				accessibilityLabel={
					outIds.length
						? `The Pen; ${outIds.map((id) => pigDefinition(id).name).join(" and ")} out looking`
						: companion
							? `Rosie and ${companion.name} in the Pen`
							: previewFriend
								? `Rosie in the Pen, previewing ${pigDefinition(previewFriend).name}`
								: "Rosie in the Pen"
				}
			/>

			{/* A failed roster read replaces the board rather than decorating it:
			    the owned / recruitable / locked states are exactly what we don't
			    know, and a permanent choice must never be offered off a guess. */}
			{error ? (
				<EmptyState
					kind="error"
					title="Couldn't round up your pigs"
					sub="They're out in the field somewhere. Give it another go."
					action={
						onRetry ? (
							<Button variant="ghost" size="sm" onPress={onRetry} accessibilityLabel="Try again" accessibilityHint="Asks for your pigs again">
								Try again
							</Button>
						) : undefined
					}
				/>
			) : (
				<>
					<FenceRow
						pigs={cards.map((c) => ({ id: c.pig.id, name: c.pig.name, state: c.medallion }))}
						selected={selected.pig.id}
						onSelect={(id) => {
							Haptics.selectionAsync().catch(() => {});
							setSelectedPig(id);
						}}
					/>
					{errands.state.enabled ? (
						<Corkboard board={errands.state.board} cap={tuning.boardCap} friendFor={friendFor} onOpen={setHomecoming} />
					) : null}
					<PigCard
						state={selected}
						tuning={tuning}
						friendFor={friendFor}
						busy={busyPigId === selected.pig.id || errands.busyPig === selected.pig.id || joining}
						onJob={(pig, job) => {
							// "In the Pen" for the active pig means the OTHER pig comes home.
							if (job === "home") void runRoster(pig, "activate");
							else {
								const other = roster.pigs.find((p) => p.owned && p.id !== pig);
								if (other) void runRoster(other.id, "activate");
							}
						}}
						onJoin={(pig) => void join(pig)}
						onRecruit={(pig) => {
							if (!roster.recruitedPigId) setPendingRecruitId(pig);
						}}
						onSend={(pig) => {
							setSendPig(pig);
							setSendForId(null);
							setSendOpen(true);
						}}
						onRecall={setPendingRecallId}
						onOpenReturn={(pig) => {
							const row = errands.state.board.find((r) => r.pig_id === pig);
							if (row) setHomecoming(row);
						}}
						onSummon={__DEV__ ? (pig) => void summon(pig) : undefined}
					/>
				</>
			)}

			{loading && busyPigId == null ? <LoadingBeat label="gathering the pigs" /> : null}

			<ConfirmDialog
				open={pendingRecruitPig != null}
				title={`Choose ${pendingRecruitPig?.name ?? "this pig"} as Rosie’s friend?`}
				body="This is your one long-term companion choice. You can’t change it right now."
				confirmLabel={`Choose ${pendingRecruitPig?.name ?? "pig"}`}
				confirmHint="Puts this pig in the Pen for good — the choice can't be changed right now"
				cancelLabel="Keep looking"
				cancelHint="Closes this without choosing"
				onCancel={() => setPendingRecruitId(null)}
				onConfirm={() => {
					const pigId = pendingRecruitId;
					setPendingRecruitId(null);
					if (pigId) void runRoster(pigId, "recruit");
				}}
			/>

			{/* A recall is a decision (the day is spent either way), so it is a
			    ConfirmDialog, never a bare tap. */}
			<ConfirmDialog
				open={pendingRecallPig != null}
				title={`Call ${pendingRecallPig?.name ?? "the pig"} home?`}
				body={`${recallP.Subject}'ll come back now, empty-handed. Today's errand is spent either way.`}
				confirmLabel={`Call ${recallP.object} home`}
				confirmHint="The pig comes back now with nothing; today's errand stays used"
				cancelLabel={`Let ${recallP.object} look`}
				cancelHint="Leaves the pig out looking"
				tone="destructive"
				onCancel={() => setPendingRecallId(null)}
				onConfirm={() => {
					const pigId = pendingRecallId;
					if (pigId) void recall(pigId);
				}}
			/>

			<SendSheet
				open={sendOpen}
				onClose={() => setSendOpen(false)}
				initialPig={sendPig}
				initialFor={sendForId}
				ownPig={roster.activePigId}
				targets={targets}
				targetsLoading={targetsLoading}
				targetsLoaded={targetsLoaded}
				loadTargets={loadTargets}
				pigs={ticketPigs}
				tuning={tuning}
				busy={errands.busyPig != null}
				onSend={send}
			/>

			<Homecoming
				row={homecoming}
				friendFor={friendFor}
				bagCount={targets.bag.length}
				claim={errands.claim}
				onDone={() => {
					setHomecoming(null);
					void loadTargets();
				}}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	content: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.lg,
		paddingBottom: TAB_SAFE,
		gap: SPACE.xs,
	},
});
