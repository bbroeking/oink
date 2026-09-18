// The send sheet — "What should {pig} look for?" The picker, in R4's order:
// friends' wishes → your own pig's wish → anything. A pick turns the sheet
// into the ticket (ErrandTicket): who goes, back by, Send. Two entrances,
// one confirm: the Pen card comes in pig-first (the pig is preset), the
// Friends row comes in target-first (the friend's wish is preset and the
// sheet opens straight on the ticket).
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar, EmptyState, Hand, ListRow, LoadingBeat, PigPortrait, SectionHeader, Sheet, Tag } from "@/components/ui";
import { FindArt } from "@/components/satchel/FindArt";
import type { ErrandTuning } from "@/constants/errands";
import { satchelFind, type SatchelFindId } from "@/constants/satchel";
import { ART_SIZE, AVATAR_SIZE, SPACE } from "@/constants/theme";
import type { FriendWishTarget, WishTargets } from "@/hooks/useFriendWishTargets";
import type { SendOutcome } from "@/utils/errands";
import { wishHoursLeft } from "@/utils/satchel";
import { pigDefinition, type PigId } from "@/utils/pigs";
import { ErrandTicket, type ErrandTarget, type TicketPig } from "./ErrandTicket";

export interface SendSheetProps {
	open: boolean;
	onClose: () => void;
	/** Pig-first: the pig the card was about. */
	initialPig: PigId | null;
	/** Target-first: a friend whose wish is preset (the Friends row's door). */
	initialFor: string | null;
	/** The player's own pig at Home — the face on the "your pig" row. */
	ownPig: PigId;
	targets: WishTargets;
	targetsLoading: boolean;
	targetsLoaded: boolean;
	loadTargets: () => Promise<WishTargets>;
	pigs: TicketPig[];
	tuning: ErrandTuning;
	busy: boolean;
	onSend: (pig: PigId, target: SatchelFindId | null, forUserId: string | null) => Promise<SendOutcome>;
}

function friendTarget(f: FriendWishTarget): ErrandTarget {
	return {
		find: f.wish.find_id,
		forUserId: f.friendId,
		forLabel: `${f.name}'s ${pigDefinition(f.pigId).name}`,
	};
}

function ageLine(expiresAt: string): string {
	const h = wishHoursLeft({ find_id: "river_pebble", wish_no: 0, expires_at: expiresAt });
	if (h <= 0) return "hoping";
	if (h < 24) return `${h}h left on the wish`;
	return `${Math.round(h / 24)}d left on the wish`;
}

export function SendSheet({
	open,
	onClose,
	initialPig,
	initialFor,
	ownPig,
	targets,
	targetsLoading,
	targetsLoaded,
	loadTargets,
	pigs,
	tuning,
	busy,
	onSend,
}: SendSheetProps) {
	const [target, setTarget] = useState<ErrandTarget | null>(null);
	const [pig, setPig] = useState<PigId | null>(null);

	// On open: reset to the entrance's preset, and (re)read the wishes. The
	// reset rides the read's callback so the effect body itself sets nothing.
	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		const firstPig = initialPig ?? pigs.find((p) => p.sendable && !p.out)?.id ?? null;
		void Promise.resolve().then(() => {
			if (cancelled) return;
			setTarget(null);
			setPig(firstPig);
		});
		void loadTargets().then((t) => {
			if (cancelled || !initialFor) return;
			const f = t.friends.find((x) => x.friendId === initialFor);
			if (f) setTarget(friendTarget(f));
		});
		return () => {
			cancelled = true;
		};
	}, [open, initialPig, initialFor, loadTargets]); // eslint-disable-line react-hooks/exhaustive-deps

	const send = useCallback(async () => {
		if (!target || !pig) return;
		const r = await onSend(pig, target.find, target.forUserId);
		if (r.ok) onClose();
	}, [target, pig, onSend, onClose]);

	const pigName = initialPig ? pigDefinition(initialPig).name : "a pig";
	const haveIds = new Set(targets.bag.map((it) => it.find_id));
	const mine = targets.mine;

	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker={target ? "the ticket" : "the pen"}
			title={target ? "Who goes?" : `What should ${pigName} look for?`}
			subtitle={target ? undefined : "usually the thing a friend's pig is hoping for"}
			testID="send-sheet"
		>
			{target ? (
				<ErrandTicket
					target={target}
					pigs={pigs}
					pig={pig}
					onPickPig={setPig}
					tuning={tuning}
					busy={busy}
					onSend={() => void send()}
					onBack={() => setTarget(null)}
				/>
			) : (
				<View style={styles.list}>
					<SectionHeader title="friends' wishes" />
					{targetsLoading && !targetsLoaded ? <LoadingBeat label="asking around" /> : null}
					{targetsLoaded && targets.friends.length === 0 ? (
						<EmptyState kind="empty" title="No wishes to chase" sub="Your friends' pigs are content just now. Send a pig for anything instead." />
					) : null}
					{targets.friends.map((f, i) => {
						const find = satchelFind(f.wish.find_id);
						const have = haveIds.has(f.wish.find_id);
						return (
							<ListRow
								key={f.friendId}
								index={i}
								leading={
									<Avatar size={AVATAR_SIZE[1]} fill="rose" label={`${f.name}'s ${pigDefinition(f.pigId).name}`}>
										<PigPortrait pigId={f.pigId} size={AVATAR_SIZE[1]} />
									</Avatar>
								}
								title={`${f.name}'s ${pigDefinition(f.pigId).name}`}
								sub={`hoping for ${find?.withArticle ?? "a find"} · ${ageLine(f.wish.expires_at)}`}
								trailing={
									<View style={styles.trailing}>
										{have ? <Tag tone="sage" label="you have it" /> : null}
										<FindArt id={f.wish.find_id} size={ART_SIZE.glyphMd} />
									</View>
								}
								onPress={() => setTarget(friendTarget(f))}
								accessibilityLabel={`${f.name}'s pig is hoping for ${find?.withArticle ?? "a find"}`}
								accessibilityHint="Sends a pig to look for it"
								testID={`wish-${f.friendId}`}
							/>
						);
					})}

					<SectionHeader title="your pig" />
					{mine ? (
						<ListRow
							index={targets.friends.length}
							leading={
								<Avatar size={AVATAR_SIZE[1]} fill="rose" label="your pig">
									<PigPortrait pigId={ownPig} size={AVATAR_SIZE[1]} />
								</Avatar>
							}
							title="Your pig"
							sub={`hoping for ${satchelFind(mine.find_id)?.withArticle ?? "a find"}${haveIds.has(mine.find_id) ? " · you have one" : ""}`}
							trailing={<FindArt id={mine.find_id} size={ART_SIZE.glyphMd} />}
							onPress={() => setTarget({ find: mine.find_id, forUserId: null, forLabel: null })}
							accessibilityLabel={`Your pig is hoping for ${satchelFind(mine.find_id)?.withArticle ?? "a find"}`}
							accessibilityHint="Sends a pig to look for it"
							testID="wish-mine"
						/>
					) : targetsLoaded ? (
						<Hand tone="secondary" style={styles.note}>
							your pig isn't wishing for anything just now
						</Hand>
					) : null}

					<SectionHeader title="or" />
					<ListRow
						index={targets.friends.length + 1}
						leading={<Avatar size={AVATAR_SIZE[1]} fill="sky" glyph="search" label="anything" />}
						title="Anything"
						sub="whatever turns up in the hedge"
						onPress={() => setTarget({ find: null, forUserId: null, forLabel: null })}
						accessibilityLabel="Anything"
						accessibilityHint="Sends a pig to look for whatever it finds"
						testID="wish-anything"
					/>
				</View>
			)}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	list: { gap: SPACE.xs, paddingBottom: SPACE.lg },
	trailing: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	note: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs },
});
