// ActiveEffects — the receiver-side bless/curse status panel.
//
// Shows every blessing / curse currently ON the player
// (my_active_effects): its icon, what it does, and how long is left.
// The "consequential" half of the ritual loop, made legible — before
// this it only showed as a vague glow / miasma on the Barn.
//
// States it renders:
//   • blessed        — gold rows, each counting down
//   • cursed         — green rows + a Cleanse action
//   • both           — both, blessings first
//   • nothing active — renders null (no clutter)
//
// Lives at the top of the Inbox segment in the Friends hub.
//
// Audit A-10 ("one concept, three drawings"): the row this file used to
// hand-roll — Sticker + corner pill + RitualIconWell + sender avatar + a
// per-row Cleanse pill — is now the shared `EffectCard size="row"`. The Barn
// strip, this panel and the Hoofprints sheet draw the same object the same way;
// they differ only in the surface that carries them.
//
// Audit A-05: `cleanse_curses` is ONE charge that wipes every active curse, so
// the panel carries ONE Cleanse control (it used to repeat an identical pill on
// every curse row) and that control states its cost on its face, in its label,
// and its consequence in its hint.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "./ui/Button";
import { EffectCard } from "./ui/EffectCard";
import { SectionHeader } from "./ui/SectionHeader";
import { SnoutCoin } from "./ui/SnoutCoin";
import { showRitualBubble } from "./ui/RitualBubble";
import { showToast } from "./ui/Toast";
import { CleanseModal } from "./CleanseModal";
import { useActiveEffectsContext } from "../hooks/ActiveEffectsProvider";
import { useRitualCaster, type UseRitualCaster } from "@/hooks/useRitualCaster";
import { effectMeta, toEffectCardEffect, type Effect } from "../utils/activeEffects";
import { untilDailyReset } from "@/utils/rituals";
import { SPACE } from "@/constants/theme";

// What a cleanse costs. One number, spoken on the button's face and again in
// its accessibility label, so the price is never only in the fine print.
const CLEANSE_COST = 5;
// The coin riding the Cleanse button's label — the cap-height match for the
// small button's 13pt text (`DialogButtonRow` sizes its coin the same way).
const COIN_SIZE = 13;

// Bless back — the shortest path from "someone blessed you" to "I blessed them
// back". `my_active_effects` returns `sender_id`, so the Inbox already knows who
// to reach; before this the answer was Friends → row → sheet → segment → Cast.
// One door per blessing row, casting today's blessing through the shared caster.
function BlessBack({
	effect,
	caster,
}: {
	effect: Effect;
	caster: UseRitualCaster;
}) {
	const [busy, setBusy] = useState(false);
	const senderId = effect.sender_id;
	const { senderName } = effectMeta(effect);
	const usage = caster.usage("bless");
	const ritual = caster.today("bless");
	const outcome = senderId ? caster.outcomeFor("bless", senderId) : undefined;
	const capped = usage?.remaining === 0 || outcome?.kind === "capped";
	const settled = outcome?.kind === "sent" || outcome?.kind === "done";

	if (!senderId) return null;

	const press = async () => {
		if (busy) return;
		setBusy(true);
		const r = await caster.cast("bless", senderId, senderName);
		setBusy(false);
		if (r.kind === "sent") {
			// The cast moment is the ritual bubble, same as a friend-row door.
			showRitualBubble({
				mode: "bless",
				ritual: r.ritual,
				targetName: senderName,
				announcement: r.text,
			});
		} else if (r.kind === "done") {
			showToast({
				tone: "fail",
				title: `${senderName} already has today's blessing`,
				text: `Next blessing in ${untilDailyReset()} — one per friend a day.`,
			});
		} else if (r.kind === "capped") {
			showToast({
				tone: "fail",
				title: "Today's blessings are spent",
				text: `Your next is in ${untilDailyReset()}.`,
			});
		} else {
			showToast({ tone: "fail", title: r.text });
		}
	};

	const label = capped
		? usage
			? `All ${usage.cap} blessings used today`
			: "No blessings left today"
		: outcome?.kind === "sent"
			? `Blessed ${senderName} with ${ritual.name} today`
			: outcome?.kind === "done"
				? `${senderName} already has today's blessing; next in ${untilDailyReset()}`
				: `Bless ${senderName} back`;

	return (
		<Button
			variant="gold"
			size="sm"
			onPress={press}
			loading={busy}
			disabled={capped || settled}
			accessibilityLabel={label}
			accessibilityHint={
				capped || settled
					? undefined
					: `Sends today's blessing, ${ritual.name}, straight back — it can't be taken back.`
			}
			accessibilityState={{ disabled: busy || capped || settled }}
			testID={`bless-back-${senderId}`}
			style={styles.blessBack}
		>
			{settled ? "Blessed back" : `Bless ${senderName} back`}
		</Button>
	);
}

export function ActiveEffects() {
	const { effects, curses, cleanse } = useActiveEffectsContext();
	const caster = useRitualCaster();
	// The Cleanse control no longer fires the RPC directly — it opens the shared
	// CleanseModal so a stray tap doesn't instantly burn 5 snouts. The hook owns
	// the optimistic update + the RPC.
	const [cleanseOpen, setCleanseOpen] = useState(false);

	// Nothing active → render nothing (the empty state is just absence).
	if (effects.length === 0) return null;

	const cursed = curses.length > 0;

	return (
		<View>
			<SectionHeader kicker="left by your friends" title="Hoofprints on you" />
			<View style={styles.list}>
				{effects.map((e, i) => (
					<View key={`${e.source}-${e.kind}-${i}`}>
						<EffectCard effect={toEffectCardEffect(e)} size="row" index={i} />
						{e.source === "blessing" && <BlessBack effect={e} caster={caster} />}
					</View>
				))}
			</View>
			{cursed && (
				<Button
					variant="gold"
					size="sm"
					icon={<SnoutCoin size={COIN_SIZE} />}
					onPress={() => setCleanseOpen(true)}
					accessibilityLabel={`Cleanse, ${CLEANSE_COST} snouts`}
					accessibilityHint={
						curses.length === 1
							? "Opens the confirm step. Spends 5 snouts to lift the curse on you."
							: `Opens the confirm step. Spends 5 snouts to lift all ${curses.length} curses on you.`
					}
					accessibilityState={{ disabled: false }}
					testID="active-effects-cleanse"
					style={styles.cleanse}
				>
					{`Cleanse · ${CLEANSE_COST}`}
				</Button>
			)}
			{cleanseOpen && cursed && (
				<CleanseModal
					curses={curses}
					onDismiss={() => setCleanseOpen(false)}
					onConfirm={cleanse}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	list: {
		gap: SPACE.sm,
	},
	cleanse: {
		alignSelf: "flex-end",
		marginTop: SPACE.md,
	},
	// Tucked under the blessing it answers — close enough to read as part of
	// that row, not as a second action for the whole panel.
	blessBack: {
		alignSelf: "flex-end",
		marginTop: SPACE.xs,
	},
});
