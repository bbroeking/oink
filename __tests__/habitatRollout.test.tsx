import React, { useLayoutEffect } from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  FeatureFlagsProvider,
  useFeatureFlag,
  useFeatureFlagState,
} from "@/hooks/useFeatureFlags";
import { rpc } from "@/utils/rpc";

jest.mock("@/utils/rpc", () => ({ rpc: jest.fn() }));
jest.mock("@/utils/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

describe("Barn housing release in the next binary", () => {
  let observed: {
    housing: boolean;
    housingState: ReturnType<typeof useFeatureFlagState>;
    other: ReturnType<typeof useFeatureFlagState>;
  };
  let tree: TestRenderer.ReactTestRenderer;
  function Probe() {
    const housing = useFeatureFlag("habitat");
    const housingState = useFeatureFlagState("habitat");
    const other = useFeatureFlagState("coop_dig");
    useLayoutEffect(() => { observed = { housing, housingState, other }; });
    return null;
  }
  afterEach(() => act(() => tree?.unmount()));

  it("opens housing while remote flags load, without opening other features", async () => {
    jest.mocked(rpc).mockReturnValue(new Promise(() => {}));
    await act(async () => {
      tree = TestRenderer.create(<FeatureFlagsProvider><Probe /></FeatureFlagsProvider>);
    });
    expect(observed.housing).toBe(true);
    expect(observed.housingState).toEqual({ visible: true, loaded: true });
    expect(observed.other).toEqual({ visible: false, loaded: false });
  });

  it.each([null, { habitat: false, coop_dig: false }, { habitat: false, coop_dig: true }])(
    "keeps housing open when legacy flags resolve to %p",
    async (flags) => {
      jest.mocked(rpc).mockResolvedValue(flags);
      await act(async () => {
        tree = TestRenderer.create(<FeatureFlagsProvider><Probe /></FeatureFlagsProvider>);
      });
      expect(observed.housing).toBe(true);
      expect(observed.housingState).toEqual({ visible: true, loaded: true });
      expect(observed.other).toEqual({ visible: !!flags?.coop_dig, loaded: true });
    },
  );
});
