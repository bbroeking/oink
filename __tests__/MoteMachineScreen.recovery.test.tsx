import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MoteMachineRiveViewModel } from "@/components/mote-machine/moteMachineRiveContract";

const mockFetch = jest.fn();
const mockSpin = jest.fn();
const mockLookup = jest.fn();
const mockToast = jest.fn();
let mockRuntimeFailed = false;
let mockMachine: MoteMachineRiveViewModel;
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  Redirect: () => null,
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock("expo-router/react-navigation", () => ({
  useFocusEffect: (effect: () => void) =>
    require("react").useEffect(effect, [effect]),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/constants/featureFlags", () => ({ MOTE_MACHINE_VISIBLE: true }));
jest.mock("@/utils/log", () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/hooks/useMotionPolicy", () => ({
  useMotionPolicy: () => ({ reduceMotion: false }),
}));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/Button", () => ({
  Button: (props: unknown) => require("react").createElement("Button", props),
}));
jest.mock("@/components/ui/Toast", () => ({
  showToast: (...args: unknown[]) => mockToast(...args),
  ToastHost: () => null,
}));
jest.mock("expo-haptics", () => ({
  impactAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@/utils/moteMachine", () => ({
  ...jest.requireActual("@/utils/moteMachine"),
  fetchMoteMachineState: () => mockFetch(),
  spinMoteMachine: (...args: unknown[]) => mockSpin(...args),
  newMoteSpinRequestId: () => "new-request-123",
}));
jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
jest.mock("@/utils/moteGame", () => ({
  ...jest.requireActual("@/utils/moteGame"),
  lookupMotePlayReceipt: (...args: unknown[]) => mockLookup(...args),
}));
jest.mock("@/components/mote-machine/MoteMachineRive", () => ({
  MoteMachineRive: (props: MoteMachineRiveViewModel) => {
    mockMachine = props;
    require("react").useEffect(() => {
      if (mockRuntimeFailed) props.onRuntimeError?.();
      else props.onRuntimeReady?.();
    }, []);
    return null;
  },
}));
import MoteMachineRoute, { LegacyMoteMachineScreen } from "@/app/mote-machine";

const pendingKey = "mote_machine_pending_request_v3";
const receipt = {
  ok: true,
  spin_id: "receipt-123",
  contraption_id: "auto_tickler",
  contraption_name: "Auto-Tickler",
  resource_id: "clockwork_acorn",
  resource_name: "Clockwork Acorn",
  resource_icon: "acorn",
  resource_amount: 1,
  resource_balance: 1,
  reel_value: 3,
  newly_unlocked: true,
  motes_remaining: 0,
  replayed: false,
};
let renderer: TestRenderer.ReactTestRenderer;
async function mount() {
  await act(async () => {
    renderer = TestRenderer.create(<LegacyMoteMachineScreen />);
  });
}
async function press(label: string) {
  const button = renderer.root.findByType("Button" as React.ElementType);
  expect(button.props.accessibilityLabel).toBe(label);
  await act(async () => {
    button.props.onPress();
  });
}

describe("Mote Machine durable receipt recovery", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockRuntimeFailed = false;
    mockFetch.mockResolvedValue({
      ok: true,
      motes: 1,
      inventory: [],
      reward_family: {},
    });
    mockSpin.mockResolvedValue(receipt);
    mockLookup.mockResolvedValue({ ok: true, receipt: null, wallet: { motes: 1, revision: 1 } });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    jest.useRealTimers();
  });

  it("coalesces the native button and authored lever before spending and reveals once", async () => {
    await mount();
    await act(async () => {
      mockMachine.onRequestPlay();
      mockMachine.onRequestPlay();
    });
    expect(mockSpin).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      pendingKey,
      JSON.stringify({ requestId: "new-request-123" }),
    );
    expect(mockMachine.resultValue).toBe(3);
    expect(mockMachine.spinToken).toBe(1);
    expect(mockMachine.busy).toBe(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4_350);
    });
    expect(mockMachine.busy).toBe(false);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it("does not spend when the durable request cannot be written", async () => {
    await mount();
    jest
      .mocked(AsyncStorage.setItem)
      .mockRejectedValueOnce(new Error("disk full"));
    await press("Pull the lever");
    expect(mockSpin).not.toHaveBeenCalled();
    expect(mockMachine.statusLabel).toContain("Your Mote was not spent");
    expect(mockMachine.busy).toBe(false);
  });

  it("blocks a new play when history cannot be read, then recovers through Try again", async () => {
    jest
      .mocked(AsyncStorage.getItem)
      .mockRejectedValueOnce(new Error("storage locked"));
    await mount();
    expect(mockMachine.canPlay).toBe(false);
    expect(mockMachine.statusLabel).toContain("Couldn't check your last play");
    expect(mockSpin).not.toHaveBeenCalled();
    await press("Try again");
    expect(mockMachine.canPlay).toBe(true);
    expect(mockSpin).not.toHaveBeenCalled();
  });

  it("replays the persisted request with no Motes and a failed renderer", async () => {
    await AsyncStorage.setItem(
      pendingKey,
      JSON.stringify({ requestId: "previous-request-123" }),
    );
    mockFetch.mockResolvedValue({
      ok: true,
      motes: 0,
      inventory: [],
      reward_family: {},
    });
    mockRuntimeFailed = true;
    await mount();
    expect(mockMachine.actionLabel).toBe("Check last play");
    expect(mockMachine.canPlay).toBe(true);
    await press("Check last play");
    expect(mockSpin).toHaveBeenCalledWith("previous-request-123");
    expect(mockSpin).toHaveBeenCalledTimes(1);
  });

  it("retains the same request after a thrown transport failure", async () => {
    mockSpin.mockRejectedValueOnce(new Error("connection closed"));
    await mount();
    await press("Pull the lever");
    expect(mockMachine.actionLabel).toBe("Check last play");
    let resolveRecovery!: (value: unknown) => void;
    mockSpin.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRecovery = resolve;
        }),
    );
    await press("Check last play");
    expect(mockMachine.actionLabel).toBe("Checking last play…");
    expect(mockMachine.statusLabel).toContain("No extra Mote is used");
    await act(async () => resolveRecovery(receipt));
    expect(mockSpin.mock.calls).toEqual([
      ["new-request-123"],
      ["new-request-123"],
    ]);
  });

  it("checks an unscoped protocol-1 request read-only and never retries it for the current account", async () => {
    await AsyncStorage.setItem(pendingKey, JSON.stringify({ requestId: "ambiguous-request-123" }));
    await act(async () => { renderer = TestRenderer.create(<MoteMachineRoute />); });
    expect(mockLookup).toHaveBeenCalledWith("ambiguous-request-123");
    expect(mockSpin).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType("Text" as React.ElementType).some((node) =>
      String(node.children.join(" ")).includes("It was not retried"))).toBe(true);
    expect(await AsyncStorage.getItem(pendingKey)).not.toBeNull();
  });

  it("clears only the matching global request after the original owner recovers a validated v1 receipt", async () => {
    await AsyncStorage.setItem(pendingKey, JSON.stringify({ requestId: "owned-request-123" }));
    mockLookup.mockResolvedValueOnce({ ok: true, wallet: { motes: 7, revision: 12 }, receipt: {
      protocol_version: 1, spin_id: "old-spin", request_id: "owned-request-123", mode: "reveal",
      stake_motes: 1, outcome: "legacy_resource", motes_returned: 0, net_motes: -1,
      motes_remaining: 7, wallet_revision: 12, contraption_id: "auto_tickler",
      resource_id: "clockwork_acorn", resource_amount: 1, resource_balance: null,
      newly_unlocked: false, reel_stops: [3, 3, 3], reel_value: 3,
      reward_tickles: null, tickles_balance: 0, paytable_version: null,
      presentation_version: "mote-animation-v3", created_at: "2026-09-06T12:00:00Z",
    } });
    await act(async () => { renderer = TestRenderer.create(<MoteMachineRoute />); });
    expect(mockLookup).toHaveBeenCalledWith("owned-request-123");
    expect(mockSpin).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(pendingKey)).toBeNull();
    expect(renderer.root.findAllByType("Text" as React.ElementType).some((node) =>
      String(node.children.join(" ")).includes("Recovered older Reveal"))).toBe(true);
    const button = renderer.root.findByType("Button" as React.ElementType);
    expect(button.props.children).toBe("Continue");
  });
});
