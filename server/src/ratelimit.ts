// Rate limits, all driven by the injected clock so tests stay deterministic.

/** Classic token bucket: `capacity` burst, refilled at `perSecond`. */
export class TokenBucket {
	private tokens: number;
	private last: number;

	constructor(
		private readonly capacity: number,
		private readonly perSecond: number,
		private readonly now: () => number,
	) {
		this.tokens = capacity;
		this.last = now();
	}

	take(cost = 1): boolean {
		const t = this.now();
		this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond);
		this.last = t;
		if (this.tokens < cost) return false;
		this.tokens -= cost;
		return true;
	}
}

/** One token bucket per key (per IP for the public HTTP routes). Idle keys
 *  are swept so a crawler cannot grow the map without bound. */
export class KeyedLimiter {
	private readonly buckets = new Map<string, { bucket: TokenBucket; seen: number }>();

	constructor(
		private readonly capacity: number,
		private readonly perSecond: number,
		private readonly now: () => number,
		private readonly maxKeys = 10_000,
	) {}

	take(key: string): boolean {
		let entry = this.buckets.get(key);
		if (!entry) {
			if (this.buckets.size >= this.maxKeys) this.sweep();
			entry = { bucket: new TokenBucket(this.capacity, this.perSecond, this.now), seen: this.now() };
			this.buckets.set(key, entry);
		}
		entry.seen = this.now();
		return entry.bucket.take();
	}

	private sweep(): void {
		const cutoff = this.now() - 10 * 60_000;
		for (const [key, entry] of this.buckets) if (entry.seen < cutoff) this.buckets.delete(key);
		// Still full (a flood of fresh keys): drop the oldest half.
		if (this.buckets.size >= this.maxKeys) {
			const keys = [...this.buckets.keys()].slice(0, Math.floor(this.maxKeys / 2));
			for (const key of keys) this.buckets.delete(key);
		}
	}
}

/** At most `max` events per `windowMs` per key (invite creates). */
export class SlidingWindow {
	private readonly hits = new Map<string, number[]>();

	constructor(
		private readonly max: number,
		private readonly windowMs: number,
		private readonly now: () => number,
	) {}

	/** Records an event and returns true, or returns false (and records
	 *  nothing) when the key is already at its limit. */
	hit(key: string): boolean {
		const t = this.now();
		const recent = (this.hits.get(key) ?? []).filter((at) => t - at < this.windowMs);
		if (recent.length >= this.max) {
			this.hits.set(key, recent);
			return false;
		}
		recent.push(t);
		this.hits.set(key, recent);
		return true;
	}
}
