// Bullion's Market — the receipt cards. A trade lands as a paper card at the
// top of the market with Bullion's reaction (the gavel for a sale at his
// counter, the cheer when a pig beats it, the shrug for a refusal); a "moment"
// (the first price you move, ever) wears sun. Up to three at a time, each
// leaving on its own after a few seconds or on its ×. In-screen, not the app
// toast: the bull is part of the receipt.
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MARKET_KEPT_RECEIPTS_KEY } from "@/constants/market";
import { ART_SIZE, BORDER, PAGE_PAD, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { CardTitle, Hand, IconButton, Ribbon, Sticker } from "../ui";
import { BullionArt } from "./MarketArt";
import type { BullionPose, MarketReceipt } from "./marketCopy";

const MAX_SHOWN = 3;
const LIFE_MS = 7000;
const MOMENT_LIFE_MS = 9000;
const CARD_TILT = -0.8;

interface Shown extends MarketReceipt {
	id: number;
	/** Kept on the device until shown (a notice the server handed over once). */
	keep?: string;
	/** Runs once, the first time the card is actually on screen. */
	onShow?: () => void;
}

export interface PushOpts {
	/** The player's own action (a trade, a refusal) goes to the front;
	 *  notices from the server wait their turn. */
	urgent?: boolean;
	/** A key for a receipt that must survive leaving the market before it
	 *  shows (`<uid>:<notice id>`). Pushing the same key twice is a no-op. */
	keep?: string;
	onShow?: () => void;
}

// ── Kept receipts (on the device until shown) ────────────────────────────────
// One JSON list under MARKET_KEPT_RECEIPTS_KEY. Every edit is a
// read-modify-write on one serial chain, so two screens (or a late read after
// the screen has gone) never overwrite each other. A kept receipt older than a
// fortnight is news nobody needs, and the list never grows past a page.

export interface KeptReceipt {
	key: string;
	at: number;
	receipt: MarketReceipt;
}

const KEPT_MAX = 30;
const KEPT_TTL_MS = 14 * 24 * 3_600_000;
const POSES: readonly BullionPose[] = ["stand", "counter", "gavel", "cheer", "shrug"];
const TONES: readonly MarketReceipt["tone"][] = ["plain", "moment", "meh"];

function toKept(raw: unknown): KeptReceipt | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const r = (o.receipt ?? null) as Record<string, unknown> | null;
	if (typeof o.key !== "string" || typeof o.at !== "number" || !r || typeof r !== "object") return null;
	if (typeof r.title !== "string" || !POSES.includes(r.pose as BullionPose) || !TONES.includes(r.tone as MarketReceipt["tone"])) return null;
	return {
		key: o.key,
		at: o.at,
		receipt: {
			pose: r.pose as BullionPose,
			title: r.title,
			tone: r.tone as MarketReceipt["tone"],
			...(typeof r.line === "string" ? { line: r.line } : {}),
			...(typeof r.ribbon === "string" ? { ribbon: r.ribbon } : {}),
		},
	};
}

export function parseKept(json: string | null, nowMs = Date.now()): KeptReceipt[] {
	if (!json) return [];
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch {
		return [];
	}
	if (!Array.isArray(raw)) return [];
	return raw
		.map(toKept)
		.filter((x): x is KeptReceipt => x != null && nowMs - x.at < KEPT_TTL_MS)
		.slice(-KEPT_MAX);
}

let keptChain: Promise<unknown> = Promise.resolve();

function editKept(fn: (xs: KeptReceipt[]) => KeptReceipt[]): Promise<KeptReceipt[]> {
	const next = keptChain.then(async () => {
		let xs: KeptReceipt[] = [];
		try {
			xs = parseKept(await AsyncStorage.getItem(MARKET_KEPT_RECEIPTS_KEY));
		} catch {
			xs = [];
		}
		const out = fn(xs).slice(-KEPT_MAX);
		try {
			await AsyncStorage.setItem(MARKET_KEPT_RECEIPTS_KEY, JSON.stringify(out));
		} catch {
			// A failed write keeps nothing new: the card still shows this visit.
		}
		return out;
	});
	keptChain = next.catch(() => undefined);
	return next;
}

export function keepReceipt(key: string, receipt: MarketReceipt, nowMs = Date.now()): Promise<KeptReceipt[]> {
	return editKept((xs) => (xs.some((x) => x.key === key) ? xs : [...xs, { key, at: nowMs, receipt }]));
}

export function forgetReceipt(key: string): Promise<KeptReceipt[]> {
	return editKept((xs) => xs.filter((x) => x.key !== key));
}

/** The kept receipts whose key starts with `prefix` (one pig's), oldest first. */
export async function keptReceipts(prefix: string): Promise<KeptReceipt[]> {
	await keptChain;
	try {
		return parseKept(await AsyncStorage.getItem(MARKET_KEPT_RECEIPTS_KEY)).filter((x) => x.key.startsWith(prefix));
	} catch {
		return [];
	}
}

/**
 * A queue, not a stack: the server hands each notice over ONCE, so nothing is
 * dropped. Up to three cards show at a time; the rest wait their turn. While
 * `held` (a sheet is open over the screen) nothing shows and no clock runs, so
 * a notice that lands under a sheet waits until the sheet closes. A receipt
 * pushed with `keep` is also kept on the device until it has been on screen,
 * so leaving the market with it still queued brings it back next visit
 * (`restore`).
 */
export function useReceipts(held: boolean) {
	const [queue, setQueue] = useState<Shown[]>([]);
	const seq = useRef(1);
	const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
	// Cards that have been on screen (announced, their onShow run).
	const seen = useRef(new Set<number>());
	// Kept keys queued this visit, so a restore never doubles one.
	const keys = useRef(new Set<string>());

	const dismiss = useCallback((id: number) => {
		setQueue((xs) => xs.filter((x) => x.id !== id));
		const t = timers.current.get(id);
		if (t) clearTimeout(t);
		timers.current.delete(id);
	}, []);

	/** Returns the card's id, or null when a kept key is already queued. */
	const push = useCallback((r: MarketReceipt, opts?: PushOpts): number | null => {
		if (opts?.keep) {
			if (keys.current.has(opts.keep)) return null;
			keys.current.add(opts.keep);
			void keepReceipt(opts.keep, r);
		}
		const id = seq.current++;
		const card: Shown = { ...r, id, keep: opts?.keep, onShow: opts?.onShow };
		setQueue((xs) => (opts?.urgent ? [card, ...xs] : [...xs, card]));
		return id;
	}, []);

	/** Take back a card that has not been on screen yet; false once it has. */
	const withdraw = useCallback(
		(id: number): boolean => {
			if (seen.current.has(id)) return false;
			dismiss(id);
			return true;
		},
		[dismiss],
	);

	/** Bring back this pig's kept receipts (`prefix`: "<uid>:"), behind the queue. */
	const restore = useCallback(async (prefix: string) => {
		const kept = await keptReceipts(prefix);
		const fresh = kept.filter((k) => !keys.current.has(k.key));
		if (fresh.length === 0) return;
		const cards: Shown[] = fresh.map((k) => {
			keys.current.add(k.key);
			return { ...k.receipt, id: seq.current++, keep: k.key };
		});
		setQueue((xs) => [...xs, ...cards]);
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
			if (!seen.current.has(r.id)) {
				seen.current.add(r.id);
				AccessibilityInfo.announceForAccessibility(r.line ? `${r.title}. ${r.line}` : r.title);
				r.onShow?.();
				if (r.keep) void forgetReceipt(r.keep);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the shown ids
	}, [shownKey, dismiss]);

	useEffect(() => {
		const all = timers.current;
		return () => all.forEach((t) => clearTimeout(t));
	}, []);

	return { shown, push, dismiss, withdraw, restore };
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
