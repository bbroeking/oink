// The dig entry's two lanes. `useDigEntry` is the one place that decides what
// "pull up the digging" means, so this pins both answers: a crewed player opens
// the patch WITHOUT leaving the screen, an uncrewed player is shown the door to
// the Season tab — and each control says which it is to a screen reader.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { router } from "expo-router";
import {
  useDigEntry,
  DIG_HINT_CREWED,
  DIG_HINT_UNCREWED,
  type DigEntry,
} from "@/hooks/useDigEntry";
import { useSounderPath } from "@/hooks/useSounderPath";
import { useFeedingCta } from "@/components/mudwar/useFeedingCta";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));
// world_boss (Season 1) is on; snout_deep is a per-test switch — off by
// default so the uncrewed lane below is the door it has always been.
let mockSnoutDeepOn = false;
jest.mock("@/hooks/useFeatureFlags", () => ({
  useFeatureFlag: (key: string) =>
    key === "snout_deep" ? mockSnoutDeepOn : true,
}));
// The crew read the retired chip used — the only thing separating the lanes.
jest.mock("@/hooks/useSounderPath", () => ({ useSounderPath: jest.fn() }));
jest.mock("@/components/mudwar/useFeedingCta", () => ({
  useFeedingCta: jest.fn(),
}));

const push = router.push as unknown as jest.Mock;
const sounderPath = useSounderPath as unknown as jest.Mock;
const feedingCta = useFeedingCta as unknown as jest.Mock;

const MODAL = <Text>patch</Text>;

function mockCta(over: Partial<ReturnType<typeof useFeedingCta>> = {}) {
  const start = jest.fn(() => Promise.resolve());
  feedingCta.mockReturnValue({
    dugThisWindow: false,
    noCrew: false,
    phaseOpen: true,
    countdown: "1h 12m",
    note: null,
    start,
    openPractice: jest.fn(),
    modal: MODAL,
    ...over,
  });
  return start;
}

function mount(step: string | null) {
  sounderPath.mockReturnValue({
    step,
    sessionsOnStep: 1,
    stalled: false,
    leaver: false,
    refresh: jest.fn(),
  });
  let entry!: DigEntry;
  function Probe() {
    entry = useDigEntry();
    return null;
  }
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Probe />);
  });
  return {
    get: () => entry,
    rerender: () => act(() => tree.update(<Probe />)),
    unmount: () => act(() => tree.unmount()),
  };
}

describe("useDigEntry", () => {
  beforeEach(() => {
    push.mockClear();
    feedingCta.mockReset();
    sounderPath.mockReset();
    mockSnoutDeepOn = false;
  });

  describe("crewed — the dig opens in place", () => {
    it("starts the patch instead of navigating", () => {
      const start = mockCta();
      const probe = mount("done");
      expect(probe.get().crewed).toBe(true);
      act(() => probe.get().openDig());
      expect(start).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
      probe.unmount();
    });

    it("carries the patch modal and the in-place hint", () => {
      mockCta();
      const probe = mount("first_dig");
      expect(probe.get().hint).toBe(DIG_HINT_CREWED);
      expect(probe.get().modal).toBe(MODAL);
      expect(probe.get().open).toBe(true);
      expect(probe.get().title).toBe("Dig for Golden Truffles");
      probe.unmount();
    });

    it("stays honest when the window is shut or already dug", () => {
      mockCta({ phaseOpen: false });
      const shut = mount("done");
      expect(shut.get().open).toBe(false);
      expect(shut.get().title).toBe("Dig opens in 1h 12m");
      shut.unmount();

      mockCta({ dugThisWindow: true });
      const dug = mount("done");
      expect(dug.get().open).toBe(false);
      expect(dug.get().visible).toBe(false);
      expect(dug.get().title).toBe("Dug this feeding");
      expect(dug.get().detail).toBe("20 Pass XP banked · back next feeding");
      dug.unmount();
    });

    it("brings the primary action back when the next feeding reconciles", () => {
      mockCta({ dugThisWindow: true });
      const probe = mount("done");
      expect(probe.get().visible).toBe(false);

      mockCta({ dugThisWindow: false, phaseOpen: false, countdown: "2h 5m" });
      probe.rerender();
      expect(probe.get().visible).toBe(true);
      expect(probe.get().title).toBe("Dig opens in 2h 5m");
      probe.unmount();
    });

    it("passes a refusal through as a note rather than swallowing it", () => {
      mockCta({ note: "You rooted this feeding — he gorges again soon." });
      const probe = mount("done");
      expect(probe.get().note).toBe(
        "You rooted this feeding — he gorges again soon.",
      );
      probe.unmount();
    });
  });

  describe("uncrewed with Snout Deep on — the dig opens in place", () => {
    it.each(["taste", "join", "hook"])(
      "starts the same dig for %s instead of navigating",
      (step) => {
        mockSnoutDeepOn = true;
        const start = mockCta();
        const probe = mount(step);
        expect(probe.get().crewed).toBe(false);
        expect(probe.get().hint).toBe(DIG_HINT_CREWED);
        expect(probe.get().open).toBe(true);
        expect(probe.get().title).toBe("Dig the Truffle Patch");
        act(() => probe.get().openDig());
        expect(start).toHaveBeenCalledTimes(1);
        expect(push).not.toHaveBeenCalled();
        probe.unmount();
      },
    );

    it("retires the control once the uncrewed dig has landed", () => {
      mockSnoutDeepOn = true;
      mockCta({ dugThisWindow: true });
      const probe = mount("join");
      expect(probe.get().open).toBe(false);
      expect(probe.get().visible).toBe(false);
      expect(probe.get().title).toBe("Dug this feeding");
      probe.unmount();
    });

    it("names the shut patch honestly for an uncrewed digger", () => {
      mockSnoutDeepOn = true;
      mockCta({ phaseOpen: false, countdown: "3h 1m" });
      const probe = mount("join");
      expect(probe.get().title).toBe("Dig opens in 3h 1m");
      expect(probe.get().detail).toBe("finds + 20 Pass XP · truffles are for herds");
      probe.unmount();
    });
  });

  describe("uncrewed — the control is a door", () => {
    it.each(["taste", "join", "hook", null])(
      "routes %s to the Season tab and says so",
      (step) => {
        const start = mockCta();
        const probe = mount(step);
        expect(probe.get().crewed).toBe(false);
        expect(probe.get().hint).toBe(DIG_HINT_UNCREWED);
        expect(probe.get().open).toBe(false);
        expect(probe.get().visible).toBe(true);
        act(() => probe.get().openDig());
        expect(start).not.toHaveBeenCalled();
        expect(push).toHaveBeenCalledWith("/(tabs)/season");
        probe.unmount();
      },
    );
  });
});
