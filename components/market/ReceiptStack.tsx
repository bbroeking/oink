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

export function useReceipts() {
	const [shown, setShown] = useState<Shown[]>([]);
	const seq = useRef(1);
	const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

	const dismiss = useCallback((id: number) => {
		setShown((xs) => xs.filter((x) => x.id !== id));
		const t = timers.current.get(id);
		if (t) clearTimeout(t);
		timers.current.delete(id);
	}, []);

	const push = useCallback(
		(r: MarketReceipt) => {
			const id = seq.current++;
			setShown((xs) => [{ ...r, id }, ...xs].slice(0, MAX_SHOWN));
			timers.current.set(id, setTimeout(() => dismiss(id), r.tone === "moment" ? MOMENT_LIFE_MS : LIFE_MS));
			AccessibilityInfo.announceForAccessibility(r.line ? `${r.title}. ${r.line}` : r.title);
		},
		[dismiss],
	);

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
