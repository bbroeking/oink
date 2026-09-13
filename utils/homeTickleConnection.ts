// Poor-connection boundary for the Barn's core tap. A local reservation makes
// the known base result visible before the mutation crosses the network, while
// the mutation response remains authoritative for the spendable balance and
// daily-lucky bonus. The caller schedules a full home_stats reconciliation
// after both success and failure.

export interface HomeTickleStats {
  itemCount: number;
  cap: number;
  counter: number;
  ticklesEarned: number;
}

export interface HomeTickleMutationResult {
  balance: number;
  lucky_won: number | null;
  global_counter: number;
}

type HomeTicklePatch =
  | Partial<HomeTickleStats>
  | ((current: HomeTickleStats) => Partial<HomeTickleStats>);

export interface RunOptimisticHomeTickleOptions {
  readAvailable: () => number;
  writeAvailable: (next: number) => void;
  applyOptimistic: (patch: HomeTicklePatch) => void;
  mutate: () => Promise<HomeTickleMutationResult | null>;
}

export type HomeTickleRunResult =
  | { status: "empty" }
  | { status: "failed"; error?: unknown }
  | { status: "confirmed"; result: HomeTickleMutationResult };

function rollbackReservation(options: RunOptimisticHomeTickleOptions): void {
  options.writeAvailable(options.readAvailable() + 1);
  options.applyOptimistic((current) => ({
    itemCount: current.itemCount + 1,
    counter: Math.max(0, current.counter - 1),
    ticklesEarned: Math.max(0, current.ticklesEarned - 1),
  }));
}

export async function runOptimisticHomeTickle(
  options: RunOptimisticHomeTickleOptions,
): Promise<HomeTickleRunResult> {
  const available = options.readAvailable();
  if (available <= 0) return { status: "empty" };

  // This block runs synchronously before mutate() reaches its first await.
  // The ref reservation also closes the stale-render window: a rapid tap burst
  // cannot start more mutations than the last authoritative balance allowed.
  options.writeAvailable(available - 1);
  options.applyOptimistic((current) => ({
    itemCount: Math.max(0, current.itemCount - 1),
    counter: current.counter + 1,
    ticklesEarned: current.ticklesEarned + 1,
  }));

  try {
    const result = await options.mutate();
    if (result == null) {
      rollbackReservation(options);
      return { status: "failed" };
    }

    options.writeAvailable(Math.min(options.readAvailable(), result.balance));
    options.applyOptimistic((current) => {
      const luckyBonus = result.lucky_won == null ? 0 : 5;
      return {
        itemCount: Math.min(current.itemCount, result.balance),
        counter: current.counter + luckyBonus,
        ticklesEarned: current.ticklesEarned + luckyBonus,
      };
    });
    return { status: "confirmed", result };
  } catch (error) {
    rollbackReservation(options);
    return { status: "failed", error };
  }
}
