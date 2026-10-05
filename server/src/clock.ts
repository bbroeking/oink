// Time, injected. Every deadline, grace window, countdown and heartbeat in the
// server goes through a Clock, so tests can move time by hand (ManualClock)
// and never sleep, while production uses the system clock.

import { clearTimeout as nodeClearTimeout, setTimeout as nodeSetTimeout } from "node:timers";
import { setImmediate as nodeSetImmediate } from "node:timers";

export interface Timer {
	cancel(): void;
}

export interface Clock {
	/** Server time, epoch ms. */
	now(): number;
	/** Run `fn` once, `ms` from now. Timers never keep the process alive. */
	after(ms: number, fn: () => void): Timer;
}

// setTimeout caps at 2^31-1 ms (about 24.8 days); an async open seat waits
// up to three days, so longer waits are chained rather than overflowing to 1.
const MAX_TIMEOUT_MS = 2_147_483_647;

export const systemClock: Clock = {
	now: () => Date.now(),
	after(ms, fn) {
		let handle: ReturnType<typeof nodeSetTimeout> | null = null;
		let cancelled = false;
		const arm = (remaining: number) => {
			const step = Math.min(Math.max(0, remaining), MAX_TIMEOUT_MS);
			handle = nodeSetTimeout(() => {
				if (cancelled) return;
				if (remaining > MAX_TIMEOUT_MS) arm(remaining - MAX_TIMEOUT_MS);
				else fn();
			}, step);
			handle.unref();
		};
		arm(ms);
		return {
			cancel: () => {
				cancelled = true;
				if (handle) nodeClearTimeout(handle);
			},
		};
	},
};

/** Waits one turn of the event loop, so I/O callbacks and promise chains
 *  started by a timer get to run before the next timer fires. */
export function nextTurn(): Promise<void> {
	return new Promise((resolve) => nodeSetImmediate(resolve));
}

interface ManualTimer {
	at: number;
	seq: number;
	fn: () => void;
}

/** A clock that only moves when told to. Timers fire in time order (ties in
 *  the order they were set) and the event loop gets a turn between them. */
export class ManualClock implements Clock {
	private t: number;
	private seq = 0;
	private readonly timers = new Map<number, ManualTimer>();

	constructor(start = 1_700_000_000_000) {
		this.t = start;
	}

	now(): number {
		return this.t;
	}

	after(ms: number, fn: () => void): Timer {
		const id = ++this.seq;
		this.timers.set(id, { at: this.t + Math.max(0, ms), seq: id, fn });
		return { cancel: () => void this.timers.delete(id) };
	}

	/** Pending timer count (for assertions). */
	get pending(): number {
		return this.timers.size;
	}

	/** Move time forward by `ms`, firing everything that falls due. `settle`
	 *  runs after each timer (the server's `settled()`, typically). */
	async advance(ms: number, settle?: () => Promise<void>): Promise<void> {
		const target = this.t + ms;
		for (;;) {
			let nextId: number | null = null;
			let next: ManualTimer | null = null;
			for (const [id, timer] of this.timers) {
				if (timer.at > target) continue;
				if (!next || timer.at < next.at || (timer.at === next.at && timer.seq < next.seq)) {
					next = timer;
					nextId = id;
				}
			}
			if (!next || nextId === null) break;
			this.timers.delete(nextId);
			this.t = Math.max(this.t, next.at);
			next.fn();
			await nextTurn();
			if (settle) await settle();
		}
		this.t = target;
		await nextTurn();
		if (settle) await settle();
	}
}
