// Detached async work (a timer firing a room step, a push, a deferred write)
// runs through one tracker: failures are logged instead of becoming unhandled
// rejections, and tests and shutdown can wait for everything in flight.

import type { Logger } from "./log";

export class Tasks {
	private readonly pending = new Set<Promise<unknown>>();

	constructor(private readonly log: Logger) {}

	spawn(label: string, work: () => Promise<unknown> | unknown): void {
		const run = (async () => {
			try {
				await work();
			} catch (err) {
				this.log.error("task failed", { task: label, err });
			}
		})();
		this.pending.add(run);
		void run.finally(() => this.pending.delete(run));
	}

	get size(): number {
		return this.pending.size;
	}

	/** Resolves once nothing is in flight, including work started by work. */
	async settled(): Promise<void> {
		while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
	}
}
