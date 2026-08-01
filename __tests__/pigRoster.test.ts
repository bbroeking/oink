import fs from "fs";
import path from "path";

const mockRpc = jest.fn();
const mockRpcAction = jest.fn();

jest.mock("../utils/rpc", () => ({
  rpc: (...args: unknown[]) => mockRpc(...args),
  rpcAction: (...args: unknown[]) => mockRpcAction(...args),
}));

import {
  DEFAULT_PIG_ROSTER,
  activatePig,
  fetchPigRoster,
  parsePigRoster,
  pigRosterActionMessage,
  recruitPig,
} from "../utils/pigRoster";

describe("parsePigRoster", () => {
  test("falls back to Rosie when the roster RPC is unavailable", () => {
    expect(parsePigRoster(null)).toEqual(DEFAULT_PIG_ROSTER);
  });

  test("keeps catalog order and marks the server-selected owned pig", () => {
    const roster = parsePigRoster({
      is_member: true,
      active_pig_id: "copper",
      recruited_pig_id: "copper",
      pigs: [
        {
          id: "copper",
          name: "Copper",
          coat: "Rusty red",
          owned: true,
          selected: true,
        },
        { id: "rosie", name: "Rosie", coat: "Classic pink", owned: true },
      ],
    });
    expect(roster.activePigId).toBe("copper");
    expect(roster.pigs.map((pig) => pig.id)).toEqual([
      "rosie",
      "copper",
      "pepper",
      "bandit",
      "pickles",
      "biscuit",
    ]);
    expect(roster.pigs.find((pig) => pig.id === "copper")).toMatchObject({
      owned: true,
      selected: true,
    });
  });

  test("forces Rosie as effective active pig when membership is inactive", () => {
    const roster = parsePigRoster({
      is_member: false,
      active_pig_id: "pepper",
      recruited_pig_id: "pepper",
      pigs: [{ id: "pepper", owned: true }],
    });
    expect(roster.activePigId).toBe("rosie");
    expect(roster.recruitedPigId).toBe("pepper");
    expect(roster.pigs.find((pig) => pig.id === "pepper")?.owned).toBe(true);
  });

  test("locks every other recruit once the companion choice is made", () => {
    const roster = parsePigRoster({
      is_member: true,
      active_pig_id: "bandit",
      recruited_pig_id: "bandit",
      pigs: [
        { id: "bandit", owned: true, selected: true },
        { id: "pickles", owned: false, recruitable: true },
      ],
    });

    expect(roster.pigs.find((pig) => pig.id === "pickles")?.recruitable).toBe(
      false,
    );
  });
});

describe("pig roster RPC wrappers", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpcAction.mockReset();
  });

  test("fetches the roster through the typed RPC", async () => {
    mockRpc.mockResolvedValue({ is_member: false });
    await fetchPigRoster();
    expect(mockRpc).toHaveBeenCalledWith("pig_roster");
  });

  test("recruits and activates using the expected parameter", async () => {
    mockRpcAction.mockResolvedValue({ ok: true, pig_id: "copper" });
    await recruitPig("copper");
    await activatePig("copper");
    expect(mockRpcAction).toHaveBeenNthCalledWith(1, "recruit_pig", {
      target_pig_id: "copper",
    });
    expect(mockRpcAction).toHaveBeenNthCalledWith(2, "activate_pig", {
      target_pig_id: "copper",
    });
  });
});

describe("pigRosterActionMessage", () => {
  test("explains the membership gate", () => {
    expect(
      pigRosterActionMessage({ ok: false, reason: "membership_required" }),
    ).toContain("Slop Club");
  });

  test("confirms success", () => {
    expect(pigRosterActionMessage({ ok: true, pig_id: "pickles" })).toContain(
      "ready at home",
    );
  });

  test("explains that a completed companion choice is locked", () => {
    expect(pigRosterActionMessage({ ok: false, reason: "roster_full" })).toContain(
      "locked",
    );
  });
});

describe("player-facing roster wiring", () => {
  test("the Barn renders the active pig without exposing a switcher", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "components", "Barn.tsx"),
      "utf8",
    );

    expect(source).not.toContain("<PigRosterPicker");
    expect(source).not.toContain("switch pig");
    expect(source).toContain("pigId={pigRoster.roster.activePigId}");
  });

  test("Barn visits render both players' effective active pigs", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "components", "BarnVisitModal.tsx"),
      "utf8",
    );

    expect(source).toContain("pigId={myPigId}");
    expect(source).toContain("pigId={hostPigId}");
    expect(source).toContain("d.is_vip && isPigId(d.active_pig_id)");
    expect(source).toContain("m.is_vip && isPigId(m.active_pig_id)");
  });

  test("the database enforces one non-Rosie companion without replacement", () => {
    const source = fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "supabase",
        "migrations",
        "20260791000000_lock_member_pig_choice.sql",
      ),
      "utf8",
    );

    expect(source).toContain("user_pigs_one_companion_idx");
    expect(source).toContain("WHERE pig_id <> 'rosie'");
    expect(source).toContain("'reason', 'roster_full'");
    expect(source).not.toContain("DELETE FROM public.user_pigs");
  });

  test("player-facing roster surfaces describe the long-term locked choice", () => {
    const pen = fs.readFileSync(
      path.join(__dirname, "..", "components", "PigPenView.tsx"),
      "utf8",
    );
    const picker = fs.readFileSync(
      path.join(__dirname, "..", "components", "PigRosterPicker.tsx"),
      "utf8",
    );

    expect(pen).toContain("one long-term companion choice");
    expect(picker).toContain("one long-term friend");
    expect(`${pen}\n${picker}`).not.toContain("change friends again later");
    expect(`${pen}\n${picker}`).not.toContain("swap that friend later");
  });
});
