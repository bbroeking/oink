// useSwap — the visit's swap state machine, with no renderer around it.
//
// What is locked here is the wire contract's reason table
// (docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md §12) read
// from the client's side: which refusals redraw the tray, which one closes it,
// and what the nonce does across a retry vs. a fresh tray-tap.
jest.mock("@/utils/log", () => ({ log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));
jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { rpcAction } from "@/utils/rpc";
import { useSwap } from "@/hooks/useSwap";
import type { FriendWish, SatchelItem, SwapResult } from "@/utils/satchel";

const EXPIRES = "2030-01-01T00:00:00.000Z";
const ITEM: SatchelItem = { id: 7, find_id: "blue_feather" };

const wish = (extra: Partial<FriendWish> = {}): FriendWish => ({
	target_id: "friend",
	find_id: "blue_feather",
	wish_no: 3,
	expires_at: EXPIRES,
	fulfilled_by_me: false,
	options: ["old_key", "marble"],
	swapped_today: false,
	...extra,
});

const OK = {
	ok: true,
	replay: false,
	gave_find_id: "blue_feather",
	took_find_id: "old_key",
	tickles: 3,
	paid: true,
	giver_tickled: 10,
	host_tickled: 10,
	swaps_given: 1,
	keepsake: null,
	next_wish: { find_id: "marble", wish_no: 4, expires_at: EXPIRES },
	bag: [{ id: 9, find_id: "clover", source: "dig" }],
};

describe("useSwap", () => {
	const rpc = jest.mocked(rpcAction);
	let patches: Partial<FriendWish>[] = [];
	let swapped: SwapResult[] = [];
	let refusals: { copy: { title: string; text?: string }; reason: string }[] = [];

	// A live harness: the probe re-reads the hook every render, and the wish it
	// is handed is the one the patches have been folded into — the visit's own
	// arrangement, so `wish_no` drift is visible here too.
	const drive = (start: FriendWish | null = wish()) => {
		let api: ReturnType<typeof useSwap> | null = null;
		let current = start;
		function Probe() {
			const [w, setW] = React.useState(current);
			current = w;
			api = useSwap({
				hostId: "friend",
				hostName: "Maple",
				wish: w,
				onWishChange: (patch) => {
					patches.push(patch);
					setW((prev) => (prev ? { ...prev, ...patch } : prev));
				},
				onSwapped: (r) => swapped.push(r),
				onRefused: (copy, reason) => refusals.push({ copy, reason }),
			});
			return null;
		}
		let tree: TestRenderer.ReactTestRenderer;
		act(() => {
			tree = TestRenderer.create(React.createElement(Probe));
		});
		return {
			get api() {
				return api as ReturnType<typeof useSwap>;
			},
			get wish() {
				return current;
			},
			unmount: () => act(() => tree.unmount()),
		};
	};

	const sent = () => rpc.mock.calls.filter(([n]) => n === "swap_with_host");
	const nonceOf = (i: number) =>
		(sent()[i][1] as Record<string, unknown>).p_nonce as string;

	beforeEach(() => {
		rpc.mockReset();
		patches = [];
		swapped = [];
		refusals = [];
	});

	it("sends the host's live wish_no, the take and a nonce, then hands back the receipt", async () => {
		rpc.mockResolvedValue(OK as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		expect(h.api.offerFor).toEqual(ITEM);
		await act(async () => {
			await h.api.swap("old_key");
		});
		expect(sent()).toHaveLength(1);
		expect(sent()[0][1]).toEqual({
			p_host: "friend",
			p_item_id: 7,
			p_take_find: "old_key",
			p_wish_no: 3,
			p_nonce: expect.stringMatching(/^[0-9a-f-]{36}$/),
		});
		expect(swapped).toHaveLength(1);
		expect(swapped[0].took_find_id).toBe("old_key");
		expect(swapped[0].bag).toEqual([{ id: 9, find_id: "clover", source: "dig" }]);
		// The tray closes, and the visit's one swap is spent.
		expect(h.api.offerFor).toBeNull();
		act(() => h.api.openTray(ITEM));
		expect(h.api.offerFor).toBeNull();
		h.unmount();
	});

	it("'just give it' sends a null take", async () => {
		rpc.mockResolvedValue({ ...OK, took_find_id: null } as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap(null);
		});
		expect((sent()[0][1] as Record<string, unknown>).p_take_find).toBeNull();
		expect(swapped[0].took_find_id).toBeNull();
		h.unmount();
	});

	it("wish_changed installs the fresh wish AND options, and the tray stays open", async () => {
		rpc.mockResolvedValue({
			ok: false,
			reason: "wish_changed",
			wish: { find_id: "clover", wish_no: 4, expires_at: EXPIRES },
			options: ["pinecone"],
		} as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("old_key");
		});
		expect(h.api.offerFor).toEqual(ITEM);
		expect(h.wish?.find_id).toBe("clover");
		expect(h.wish?.wish_no).toBe(4);
		expect(h.wish?.options).toEqual(["pinecone"]);
		expect(refusals[0].copy.title).toBe("Their pig changed its mind");
		h.unmount();
	});

	it("option_gone redraws only the options; the tray does not move", async () => {
		rpc.mockResolvedValue({
			ok: false,
			reason: "option_gone",
			options: ["marble"],
		} as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("old_key");
		});
		expect(h.api.offerFor).toEqual(ITEM);
		expect(h.wish?.find_id).toBe("blue_feather");
		expect(h.wish?.wish_no).toBe(3);
		expect(h.wish?.options).toEqual(["marble"]);
		expect(refusals[0].copy.title).toBe("Maple's pig changed its mind about that one");
		h.unmount();
	});

	it("already_today marks the wish and closes the tray", async () => {
		rpc.mockResolvedValue({
			ok: false,
			reason: "already_today",
			wish: { find_id: "blue_feather", wish_no: 3, expires_at: EXPIRES },
		} as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("old_key");
		});
		expect(h.api.offerFor).toBeNull();
		expect(h.wish?.swapped_today).toBe(true);
		expect(refusals[0].copy.title).toBe("You two swapped today — come back tomorrow");
		h.unmount();
	});

	it("host_bag_full keeps the tray so the player can take something instead", async () => {
		rpc.mockResolvedValue({ ok: false, reason: "host_bag_full" } as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap(null);
		});
		expect(h.api.offerFor).toEqual(ITEM);
		expect(refusals[0].copy.title).toBe("Their Satchel is full — try the swap instead");
		h.unmount();
	});

	it("a terminal refusal closes the tray and is said once", async () => {
		rpc.mockResolvedValue({ ok: false, reason: "not_in_bag" } as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("old_key");
		});
		expect(h.api.offerFor).toBeNull();
		expect(refusals).toHaveLength(1);
		expect(refusals[0].reason).toBe("not_in_bag");
		h.unmount();
	});

	it("a transport failure keeps the tray up and RETRIES on the same nonce", async () => {
		rpc.mockResolvedValue({ ok: false, reason: "network" } as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("old_key");
		});
		// Nothing moved on the server, or we cannot know — so the decision is
		// still on screen and the retry carries the same idempotency key.
		expect(h.api.offerFor).toEqual(ITEM);
		await act(async () => {
			await h.api.swap("old_key");
		});
		expect(sent()).toHaveLength(2);
		expect(nonceOf(0)).toBe(nonceOf(1));
		h.unmount();
	});

	it("a NAMED refusal takes a fresh nonce, and so does every new tray-tap", async () => {
		rpc.mockResolvedValue({ ok: false, reason: "option_gone", options: ["marble"] } as never);
		const h = drive();
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("old_key");
		});
		await act(async () => {
			await h.api.swap("marble");
		});
		expect(nonceOf(0)).not.toBe(nonceOf(1));

		// A second tray-tap is a second decision: a third, different nonce.
		act(() => h.api.closeTray());
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("marble");
		});
		const all = new Set([nonceOf(0), nonceOf(1), nonceOf(2)]);
		expect(all.size).toBe(3);
		h.unmount();
	});

	it("does nothing without a wish, or while a call is in flight", async () => {
		rpc.mockResolvedValue(OK as never);
		const h = drive(null);
		act(() => h.api.openTray(ITEM));
		await act(async () => {
			await h.api.swap("old_key");
		});
		expect(sent()).toHaveLength(0);
		h.unmount();
	});
});
