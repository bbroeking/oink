// Pushes: the Expo Push API, called straight from the play server (the
// Supabase pg_net sender is for database-born events; a game invite is born
// here). Never throws: a push is a nudge, and a failed nudge must not fail
// the invite or the move that caused it.
//
// Facts this leans on (docs/multiplayer/research/platform-notes.md §3):
// batches of at most 100; `ttl` (seconds) bounds redelivery and wins over
// `expiration`; `collapseId` replaces an already-shown notification on iOS
// (64 bytes max); a ticket "ok" only means Expo took it, so receipts are
// fetched about 15 minutes later and DeviceNotRegistered is logged.

import type { Clock, Timer } from "./clock";
import type { Logger } from "./log";
import { tail } from "./log";
import type { Store } from "./store/types";
import type { Tasks } from "./tasks";

export interface PushMessage {
	to: string;
	title: string;
	body: string;
	data: Record<string, unknown>;
	sound?: "default" | null;
	priority?: "default" | "normal" | "high";
	/** Seconds the message may wait for redelivery. */
	ttl?: number;
	threadId?: string;
	categoryId?: string;
	collapseId?: string;
}

export type PushContent = Omit<PushMessage, "to">;

export interface PushSender {
	send(messages: PushMessage[]): Promise<void>;
	stop?(): void;
}

export const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const SEND_BATCH = 100;
const RECEIPT_BATCH = 1_000;
const EXPO_TOKEN_RE = /^Expo(?:nent)?PushToken\[[^\]]+\]$/;

interface Ticket {
	status: "ok" | "error";
	id?: string;
	message?: string;
	details?: { error?: string };
}

function chunks<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

export interface ExpoPushOptions {
	accessToken?: string | null;
	fetch?: typeof fetch;
	clock: Clock;
	log: Logger;
	tasks: Tasks;
	/** Wait before asking for receipts (Expo: about 15 minutes). */
	receiptDelayMs?: number;
	/** Backoff before each retry of a 429 or 5xx (empty: no retries). */
	retryDelaysMs?: number[];
}

export class ExpoPushSender implements PushSender {
	private readonly fetch: typeof fetch;
	private readonly receiptDelayMs: number;
	private readonly retryDelaysMs: number[];
	private receipts: { id: string; to: string; at: number }[] = [];
	private receiptTimer: Timer | null = null;
	private stopped = false;

	constructor(private readonly opts: ExpoPushOptions) {
		this.fetch = opts.fetch ?? fetch;
		this.receiptDelayMs = opts.receiptDelayMs ?? 15 * 60_000;
		this.retryDelaysMs = opts.retryDelaysMs ?? [1_000, 4_000];
	}

	async send(messages: PushMessage[]): Promise<void> {
		const valid = messages.filter((m) => EXPO_TOKEN_RE.test(m.to));
		if (valid.length < messages.length) {
			this.opts.log.warn("skipped pushes to malformed tokens", { count: messages.length - valid.length });
		}
		for (const batch of chunks(valid, SEND_BATCH)) await this.post(batch);
	}

	stop(): void {
		this.stopped = true;
		this.receiptTimer?.cancel();
		this.receiptTimer = null;
	}

	/** Asks Expo about every ticket old enough to have a receipt. */
	async checkReceipts(): Promise<void> {
		const now = this.opts.clock.now();
		const due = this.receipts.filter((r) => now - r.at >= this.receiptDelayMs);
		this.receipts = this.receipts.filter((r) => now - r.at < this.receiptDelayMs);
		for (const batch of chunks(due, RECEIPT_BATCH)) {
			const res = await this.request(EXPO_RECEIPTS_URL, { ids: batch.map((r) => r.id) });
			if (!res) continue;
			const body = (await res.json().catch(() => ({}))) as { data?: Record<string, Ticket> };
			for (const r of batch) {
				const receipt = body.data?.[r.id];
				if (!receipt || receipt.status === "ok") continue;
				const error = receipt.details?.error;
				// The token is dead (app deleted, push turned off). The app
				// re-registers on its next launch; nothing to delete here.
				if (error === "DeviceNotRegistered") this.opts.log.info("push token no longer registered", { to: tail(r.to) });
				else this.opts.log.warn("push receipt error", { error, message: receipt.message, to: tail(r.to) });
			}
		}
		this.armReceipts();
	}

	private async post(batch: PushMessage[]): Promise<void> {
		const res = await this.request(EXPO_SEND_URL, batch);
		if (!res) return;
		const body = (await res.json().catch(() => ({}))) as { data?: Ticket[]; errors?: unknown[] };
		if (body.errors) this.opts.log.warn("push request errors", { errors: body.errors });
		const now = this.opts.clock.now();
		(body.data ?? []).forEach((ticket, i) => {
			const to = batch[i]?.to ?? "";
			if (ticket.status === "ok" && ticket.id) this.receipts.push({ id: ticket.id, to, at: now });
			else if (ticket.status === "error") {
				this.opts.log.warn("push ticket error", { error: ticket.details?.error, message: ticket.message, to: tail(to) });
			}
		});
		this.armReceipts();
	}

	/** POSTs JSON with retries on 429 / 5xx. Null when it never succeeded. */
	private async request(url: string, payload: unknown): Promise<Response | null> {
		const headers: Record<string, string> = {
			Accept: "application/json",
			"Accept-Encoding": "gzip, deflate",
			"Content-Type": "application/json",
		};
		if (this.opts.accessToken) headers.Authorization = `Bearer ${this.opts.accessToken}`;
		for (let attempt = 0; ; attempt++) {
			let res: Response | null = null;
			let failure: unknown = null;
			try {
				res = await this.fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
			} catch (err) {
				failure = err;
			}
			if (res && res.ok) return res;
			const retryable = !res || res.status === 429 || res.status >= 500;
			const delay = this.retryDelaysMs[attempt];
			if (!retryable || delay === undefined || this.stopped) {
				this.opts.log.error("push request failed", { url, status: res?.status, err: failure, attempts: attempt + 1 });
				return null;
			}
			await new Promise<void>((resolve) => this.opts.clock.after(delay, resolve));
		}
	}

	private armReceipts(): void {
		if (this.stopped || this.receiptTimer || this.receipts.length === 0) return;
		const oldest = Math.min(...this.receipts.map((r) => r.at));
		const wait = Math.max(0, oldest + this.receiptDelayMs - this.opts.clock.now());
		this.receiptTimer = this.opts.clock.after(wait, () => {
			this.receiptTimer = null;
			this.opts.tasks.spawn("push receipts", () => this.checkReceipts());
		});
	}
}

/** PUSH_MODE=log: what would have been sent, one line per push. */
export class LogPushSender implements PushSender {
	constructor(private readonly log: Logger) {}

	async send(messages: PushMessage[]): Promise<void> {
		for (const m of messages) {
			this.log.info("push (log mode)", {
				to: tail(m.to),
				title: m.title,
				body: m.body,
				data: m.data,
				ttl: m.ttl,
				collapseId: m.collapseId,
				threadId: m.threadId,
				categoryId: m.categoryId,
			});
		}
	}
}

/** Turns "push these pigs" into token lookups and one batched send. */
export class Notifier {
	constructor(
		private readonly deps: { store: Store; sender: PushSender; log: Logger; tasks: Tasks },
	) {}

	notify(userIds: string[], content: PushContent): void {
		const ids = [...new Set(userIds)];
		if (ids.length === 0) return;
		this.deps.tasks.spawn("push", async () => {
			const tokens = await this.deps.store.getPushTokens(ids);
			const messages = ids.flatMap((id) => {
				const to = tokens.get(id);
				return to ? [{ ...content, to }] : [];
			});
			if (messages.length > 0) await this.deps.sender.send(messages);
		});
	}
}
