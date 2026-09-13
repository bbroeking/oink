import {
  runOptimisticHomeTickle,
  type HomeTickleStats,
} from "../utils/homeTickleConnection";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function stateHarness(initial: HomeTickleStats) {
  let state = initial;
  return {
    read: () => state,
    apply: (
      patch:
        | Partial<HomeTickleStats>
        | ((current: HomeTickleStats) => Partial<HomeTickleStats>),
    ) => {
      state = {
        ...state,
        ...(typeof patch === "function" ? patch(state) : patch),
      };
    },
  };
}

describe("home tickles on a poor connection", () => {
  test("updates the visible balance and base reward before a delayed response", async () => {
    const response = deferred<{
      balance: number;
      lucky_won: number | null;
      global_counter: number;
    }>();
    const state = stateHarness({
      itemCount: 5,
      cap: 25,
      counter: 100,
      ticklesEarned: 120,
    });
    let available = 5;

    const pending = runOptimisticHomeTickle({
      readAvailable: () => available,
      writeAvailable: (next) => {
        available = next;
      },
      applyOptimistic: state.apply,
      mutate: () => response.promise,
    });

    // No timer advance or network response: the tap is already visible.
    expect(state.read()).toMatchObject({
      itemCount: 4,
      counter: 101,
      ticklesEarned: 121,
    });
    expect(available).toBe(4);

    response.resolve({ balance: 4, lucky_won: null, global_counter: 101 });
    await expect(pending).resolves.toMatchObject({ status: "confirmed" });
    expect(state.read()).toMatchObject({
      itemCount: 4,
      counter: 101,
      ticklesEarned: 121,
    });
  });

  test("reserves synchronously so a delayed tap storm cannot overspend", async () => {
    const response = deferred<{
      balance: number;
      lucky_won: number | null;
      global_counter: number;
    }>();
    const state = stateHarness({
      itemCount: 1,
      cap: 25,
      counter: 100,
      ticklesEarned: 120,
    });
    let available = 1;
    const mutate = jest.fn(() => response.promise);
    const options = {
      readAvailable: () => available,
      writeAvailable: (next: number) => {
        available = next;
      },
      applyOptimistic: state.apply,
      mutate,
    };

    const first = runOptimisticHomeTickle(options);
    await expect(runOptimisticHomeTickle(options)).resolves.toEqual({
      status: "empty",
    });
    expect(mutate).toHaveBeenCalledTimes(1);

    response.resolve({ balance: 0, lucky_won: null, global_counter: 101 });
    await first;
  });

  test("rolls back a failed reservation so retry remains possible", async () => {
    const state = stateHarness({
      itemCount: 2,
      cap: 25,
      counter: 100,
      ticklesEarned: 120,
    });
    let available = 2;

    await expect(
      runOptimisticHomeTickle({
        readAvailable: () => available,
        writeAvailable: (next) => {
          available = next;
        },
        applyOptimistic: state.apply,
        mutate: async () => null,
      }),
    ).resolves.toEqual({ status: "failed" });

    expect(available).toBe(2);
    expect(state.read()).toMatchObject({
      itemCount: 2,
      counter: 100,
      ticklesEarned: 120,
    });
  });
});
