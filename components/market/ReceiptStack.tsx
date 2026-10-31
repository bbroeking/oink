// Bullion's Market — the receipt cards. A trade lands as a paper card at the
// top of the market with Bullion's reaction (the gavel for a sale at his
// counter, the cheer when a pig beats it, the shrug for a refusal); a "moment"
// (the first price you move, ever) wears sun. Up to three at a time, each
// leaving on its own after a few seconds or on its ×. In-screen, not the app
// toast: the bull is part of the receipt.
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { ART_SIZE, BORDER, PAGE_PAD, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { CardTitle, Hand, IconButton, Ribbon, Sticker } from "../ui";
import { BullionArt } from "./MarketArt";
import type { MarketReceipt } from "./marketCopy";

const MAX_SHOWN = 3;
const LIFE_MS = 7000;
const MOMENT_LIFE_MS = 9000;
const CARD_TILT = -0.8;

interface Shown extends MarketReceipt {
	id: number;
}

/**
 * A queue, not a stack: the server hands each notice over ONCE, so nothing is
 * dropped. Up to three cards show at a time; the rest wait their turn. While
 * `held` (a sheet is open over the screen) nothing shows and no clock runs, so
 * a notice that lands under a sheet waits until the sheet closes.
 */
export function useReceipts(held: boolean) {
	const [queue, setQueue] = useState<Shown[]>([]);
	const seq = useRef(1);
	const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
	const announced = useRef(new Set<number>());

	const dismiss = useCallback((id: number) => {
		setQueue((xs) => xs.filter((x) => x.id !== id));
		const t = timers.current.get(id);
		if (t) clearTimeout(t);
		timers.current.delete(id);
	}, []);

	/** `urgent`: the player's own action (a trade, a refusal) goes to the front;
	 *  notices from the server wait their turn. */
	const push = useCallback((r: MarketReceipt, opts?: { urgent?: boolean }) => {
		const id = seq.current++;
		setQueue((xs) => (opts?.urgent ? [{ ...r, id }, ...xs] : [...xs, { ...r, id }]));
	}, []);

	const shown = held ? [] : queue.slice(0, MAX_SHOWN);

	// A card's clock runs only while it is on screen: covering the screen with
	// a sheet stops every clock, and uncovering it starts them afresh.
	const shownKey = shown.map((r) => r.id).join(",");
	useEffect(() => {
		const live = new Set(shown.map((r) => r.id));
		for (const [id, t] of timers.current) {
			if (!live.has(id)) {
				clearTimeout(t);
				timers.current.delete(id);
			}
		}
		for (const r of shown) {
			if (timers.current.has(r.id)) continue;
			timers.current.set(r.id, setTimeout(() => dismiss(r.id), r.tone === "moment" ? MOMENT_LIFE_MS : LIFE_MS));
			if (!announced.current.has(r.id)) {
				announced.current.add(r.id);
				AccessibilityInfo.announceForAccessibility(r.line ? `${r.title}. ${r.line}` : r.title);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the shown ids
	}, [shownKey, dismiss]);

	useEffect(() => {
		const all = timers.current;
		return () => all.forEach((t) => clearTimeout(t));
	}, []);

	return { shown, push, dismiss };
}

export function ReceiptStack({ shown, onDismiss, top }: { shown: Shown[]; onDismiss: (id: number) => void; top: number }) {
	if (shown.length === 0) return null;
	return (
		<View style={[styles.layer, { top }]} pointerEvents="box-none">
			{shown.map((r) => (
				<Sticker
					key={r.id}
					color={r.tone === "moment" ? WHIMSY.sun : r.tone === "meh" ? WHIMSY.cream : WHIMSY.paper}
					rotate={CARD_TILT}
					radius={RADII.lg}
					style={styles.card}
				>
					{r.ribbon ? <Ribbon label={r.ribbon} tone="sun" style={styles.ribbon} /> : null}
					<View style={styles.row}>
						<BullionArt pose={r.pose} size={ART_SIZE.badge} />
						<View style={styles.text}>
							<CardTitle>{r.title}</CardTitle>
							{r.line ? <Hand>{r.line}</Hand> : null}
						</View>
						<IconButton name="x" label="Dismiss" onPress={() => onDismiss(r.id)} />
					</View>
				</Sticker>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	layer: { position: "absolute", left: PAGE_PAD, right: PAGE_PAD, gap: SPACE.sm, zIndex: 10 },
	card: { padding: SPACE.md, borderWidth: BORDER.ink },
	row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	text: { flex: 1, minWidth: 0 },
	ribbon: { alignSelf: "flex-start", marginBottom: SPACE.xs },
});
