import {
  applyHedgeChoice, compareHedgeRuns, createEventTrail, createHedgeRun, getRunTotals, HEDGE_EVENTS,
  HEDGE_RUN_KIT, replayHedgeRun, restoreHedgeRun, scoreHedgeRun, viewHedgeChallenge,
  type HedgeChoice, type HedgeRunState,
} from "@/features/cards/domain/hedgeRun";

function finishWithLegalPlays(seed: string): HedgeRunState {
  let run = createHedgeRun(seed, "legend_rosie");
  while (run.status === "active") run = applyHedgeChoice(run, { cardId: run.hand[0], mode: "play" });
  return run;
}

describe("Hedge Run rules", () => {
  it("gives equal seeds the exact same borrowed deck and valid trail", () => {
    const first = createHedgeRun("same-seed", "legend_rosie");
    const second = createHedgeRun("same-seed", "legend_copper");
    expect(first.deckOrder).toEqual(second.deckOrder);
    expect(first.trail).toEqual(second.trail);
    expect(first.deckOrder).toHaveLength(12);
    expect(new Set(first.deckOrder)).toEqual(new Set(HEDGE_RUN_KIT.map((card) => card.cardId)));
    const events = createEventTrail("same-seed").map((id) => HEDGE_EVENTS.find((event) => event.id === id)!);
    expect(new Set(events.map((event) => event.id)).size).toBe(6);
    expect(events.some((event) => event.danger >= 5)).toBe(true);
    expect(events.filter((event) => event.danger >= 5).length).toBeLessThanOrEqual(2);
    expect(events.some((event) => event.searchTarget >= 5)).toBe(true);
  });

  it("replays six choices to the identical locked state", () => {
    const completed = finishWithLegalPlays("replay-me");
    expect(completed.choices).toHaveLength(6);
    expect(replayHedgeRun("replay-me", "legend_rosie", completed.choices)).toEqual(completed);
    expect(() => applyHedgeChoice(completed, completed.choices[0])).toThrow("already locked");
    expect(restoreHedgeRun(completed)).toEqual(completed);
    expect(restoreHedgeRun({ ...completed, choices: [{ cardId: "bogus", mode: "play" }] })).toBeNull();
    expect(restoreHedgeRun({ ...completed, rulesVersion: "future" })).toBeNull();
  });

  it("applies danger before discovery at the zero-Cheer boundary", () => {
    const base = createHedgeRun("boundary", "legend_rosie");
    const final: HedgeRunState = {
      ...base, round: 6, cheer: 1, hand: ["golden_truffle"], drawIndex: 12,
      trail: [...base.trail.slice(0, 5), "hungerer_reaches"],
      slots: { head: "ticket_takers_cap", held: "toy_sword", aura: "firefly_aura", critter: "truffle_mole" },
      trainingIds: ["bog_frog"], discoveries: ["Earlier Find"],
    };
    expect(getRunTotals(final)).toEqual({ guard: 5, search: 7 });
    const result = applyHedgeChoice(final, { cardId: "golden_truffle", mode: "train" });
    expect(result).toMatchObject({ cheer: 0, status: "escaped", discoveries: ["Earlier Find"] });
    expect(result.resolvedRounds.at(-1)).toMatchObject({ damage: 1, search: 8, foundDiscovery: false });
  });

  it("rejects illegal cards and a third Training card", () => {
    const run = createHedgeRun("legal-boundary", "legend_rosie");
    expect(() => applyHedgeChoice(run, { cardId: "not-a-card", mode: "play" })).toThrow("not in hand");
    const fullTraining = { ...run, trainingIds: ["bog_frog", "toy_sword"] };
    expect(() => applyHedgeChoice(fullTraining, { cardId: run.hand[0], mode: "train" })).toThrow("Training spaces");
  });

  it("conceals the friend's score until both runs finish", () => {
    const creator = finishWithLegalPlays("shared");
    let friend = createHedgeRun("shared", "legend_copper");
    const challenge = { id: "c1", seed: "shared", creatorId: "alice", friendId: "bob", runs: { creator, friend } };
    expect(viewHedgeChallenge(challenge, "alice")).toEqual({ ownRun: creator, friendStatus: "in-progress" });
    friend = replayHedgeRun("shared", "legend_copper", creator.choices as readonly HedgeChoice[]);
    const revealed = viewHedgeChallenge({ ...challenge, runs: { creator, friend } }, "alice");
    expect(revealed.friendScore).toEqual(scoreHedgeRun(friend));
    expect(revealed.result).toBe("draw");
  });

  it("refuses to compare runs from unequal pinned setups", () => {
    const left = finishWithLegalPlays("left-seed");
    const right = finishWithLegalPlays("right-seed");
    expect(() => compareHedgeRuns(left, right)).toThrow("same pinned seed");
    expect(() => compareHedgeRuns(left, { ...left, trail: [...left.trail].reverse() })).toThrow("same pinned seed");
  });
});
