import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MoteMachineRiveViewModel } from "@/components/mote-machine/moteMachineRiveContract";
import type { MoteGameState } from "@/utils/moteGame";
import databaseVectors from "@/__tests__/fixtures/mote-game-db-receipts.json";

let mockRiveProps: MoteMachineRiveViewModel;
let mockRuntimeVersion: "mote-animation-v3" | "mote-animation-v4" | null = "mote-animation-v4";
let mockAcceptanceAccount = "account-a"; let mockAcceptanceSession = "session-a";
let mockAcceptanceEnabled = true; let mockAuthCallback: ((event: string, session: { user: { id: string } } | null) => void) | null = null;
const mockGetSession = jest.fn();
const mockPlay = jest.fn(); const mockLookup = jest.fn(); const mockHistory = jest.fn(); const mockFetchState = jest.fn(); const mockSensoryPlay = jest.fn(); const mockStop = jest.fn();
const mockState: MoteGameState = {
  modes: ["reveal", "wager"], allowed_stakes: { reveal: [1], wager: [1, 3, 5] },
  rules_versions: { reveal: "reveal-v1", wager: "wager-v1" },
  paytables: { reveal: [], wager: [] }, wallet: { motes: 10, revision: 2 }, inventory: [],
  required_presentation_version: "mote-animation-v4", wager_enabled: true,
};
jest.mock("@/utils/log", () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("expo-router", () => ({ Stack: { Screen: () => null }, router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ acceptance: mockAcceptanceEnabled ? "wager-matrix" : undefined, acceptanceSession: mockAcceptanceSession }) }));
jest.mock("expo-router/react-navigation", () => ({ useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("@/hooks/useMotionPolicy", () => ({ useMotionPolicy: () => ({ reduceMotion: false }) }));
jest.mock("@/components/mote-machine/MoteRosieStage", () => ({ MoteRosieStage: () => null }));
jest.mock("@/components/mote-machine/useMoteMachineSensory", () => ({ useMoteMachineSensory: () => ({ settings: { sound: true, haptics: true }, hydrated: true, setSound: jest.fn(), setHaptics: jest.fn(), playPresentation: mockSensoryPlay, stop: mockStop, cue: jest.fn() }) }));
jest.mock("@/components/mote-machine/MoteMachineRive", () => ({ MoteMachineRive: (props: MoteMachineRiveViewModel) => { mockRiveProps = props; require("react").useEffect(() => { if (mockRuntimeVersion) props.onRuntimeReady?.(mockRuntimeVersion); }, []); return null; } }));
jest.mock("@/utils/moteGameAcceptance", () => ({ createMoteGameAcceptanceClient: (scenario?: string) => { if (!scenario) return null; const accountId = mockAcceptanceAccount; return { accountId, fetchState: (...args: unknown[]) => mockFetchState(...args), play: (...args: unknown[]) => mockPlay(...args), lookup: (...args: unknown[]) => mockLookup(...args), history: (...args: unknown[]) => mockHistory(...args) }; } }));
jest.mock("@/utils/supabase", () => ({ supabase: { auth: { getSession: (...args: unknown[]) => mockGetSession(...args), onAuthStateChange: (callback: typeof mockAuthCallback) => { mockAuthCallback = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; } } } }));
jest.mock("@/utils/moteGame", () => { const actual = jest.requireActual("@/utils/moteGame"); return { ...actual, fetchMoteGameState: (...args: unknown[]) => mockFetchState(...args), playMoteGame: (...args: unknown[]) => mockPlay(...args), lookupMotePlayReceipt: (...args: unknown[]) => mockLookup(...args), fetchMotePlayHistory: (...args: unknown[]) => mockHistory(...args) }; });
jest.mock("@/utils/moteMachine", () => ({ fetchMoteMachineState: jest.fn() }));
jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
import { MoteWageringScreen } from "@/components/mote-machine/MoteWageringScreen";

describe("Mote wagering screen command boundary", () => {
  beforeEach(async () => { jest.clearAllMocks(); mockPlay.mockReset(); mockLookup.mockReset(); mockFetchState.mockReset(); mockHistory.mockReset(); mockGetSession.mockReset(); await AsyncStorage.clear(); mockRuntimeVersion = "mote-animation-v4"; mockAcceptanceEnabled = true; mockAcceptanceAccount = "account-a"; mockAcceptanceSession = "session-a"; mockAuthCallback = null; mockFetchState.mockResolvedValue({ ok: true, ...mockState }); mockHistory.mockResolvedValue({ ok: true, plays: [], next_cursor: null, wallet: mockState.wallet }); });
  it("persists the complete frozen command before the authored lever dispatches", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); });
    const modes = renderer.root.findAll((node) => node.props.accessibilityRole === "radio" && typeof node.props.onPress === "function");
    await act(async () => modes[1].props.onPress());
    let resolvePlay!: (value: unknown) => void;
    mockPlay.mockImplementationOnce(() => new Promise((resolve) => { resolvePlay = resolve; }));
    await act(async () => { mockRiveProps.onRequestPlay(); await Promise.resolve(); });
    expect(mockPlay).toHaveBeenCalledTimes(1);
    const command = mockPlay.mock.calls[0][0];
    expect(command).toMatchObject({ protocolVersion: 2, accountId: "account-a", mode: "wager", stakeMotes: 1, expectedRulesVersion: "wager-v1" });
    expect(JSON.parse((await AsyncStorage.getItem("mote_game_pending_v2:account-a"))!)).toEqual(command);
    await act(async () => resolvePlay({ ok: false, reason: "network" }));
    act(() => renderer.unmount());
  });

  it("refuses an authored Wager callback when only V3 loaded", async () => {
    mockRuntimeVersion = "mote-animation-v3";
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); });
    const modes = renderer.root.findAll((node) => node.props.accessibilityRole === "radio" && typeof node.props.onPress === "function");
    await act(async () => modes[1].props.onPress());
    await act(async () => mockRiveProps.onRequestPlay());
    expect(mockPlay).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem("mote_game_pending_v2:account-a")).toBeNull();
    act(() => renderer.unmount());
  });

  it("does not spend a Reveal before a compatible runtime loads", async () => {
    mockRuntimeVersion = null;
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); });
    await act(async () => mockRiveProps.onRequestPlay());
    expect(mockPlay).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem("mote_game_pending_v2:account-a")).toBeNull();
    act(() => renderer.unmount());
  });

  it("renders a verified protocol-1 receipt in private history without treating it as a wager", async () => {
    mockHistory.mockResolvedValueOnce({ ok: true, next_cursor: null, wallet: mockState.wallet, plays: [{
      protocol_version: 1, spin_id: "old-spin", request_id: "legacy-tickle-history", mode: "reveal",
      stake_motes: 1, outcome: "legacy_resource", motes_returned: 0, net_motes: -1, motes_remaining: 7,
      wallet_revision: null, contraption_id: null, resource_id: null, resource_amount: null,
      resource_balance: null, newly_unlocked: false, reel_stops: null, reel_value: null,
      reward_tickles: 3, tickles_balance: 12, paytable_version: null,
      presentation_version: "mote-animation-v3", created_at: "2026-01-01T00:00:00Z",
    }] });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); });
    const historyText = renderer.root.find((node) => node.children.join("") === "History");
    let historyButton = historyText.parent;
    while (historyButton && typeof historyButton.props.onPress !== "function") historyButton = historyButton.parent;
    await act(async () => historyButton!.props.onPress());
    expect(renderer.root.findAllByType("Text" as React.ElementType).some((node) => String(node.children.join(" ")).includes("Legacy Reveal"))).toBe(true);
    act(() => renderer.unmount());
  });

  it("discards delayed history after the acceptance account changes", async () => {
    let resolveHistory!: (value: unknown) => void;
    mockHistory.mockImplementationOnce(() => new Promise((resolve) => { resolveHistory = resolve; }));
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); });
    const historyText = renderer.root.find((node) => node.children.join("") === "History");
    let historyButton = historyText.parent;
    while (historyButton && typeof historyButton.props.onPress !== "function") historyButton = historyButton.parent;
    act(() => { void historyButton!.props.onPress(); });
    mockAcceptanceAccount = "account-b"; mockAcceptanceSession = "session-b";
    await act(async () => { renderer.update(<MoteWageringScreen />); });
    await act(async () => resolveHistory({ ok: true, plays: databaseVectors.legacy_receipts.slice(0, 1), next_cursor: null, wallet: { motes: 99, revision: 99 } }));
    expect(renderer.root.findAll((node) => node.children.join("") === "PLAY HISTORY")).toHaveLength(0);
    expect(mockRiveProps.motes).toBe(10);
    act(() => renderer.unmount());
  });

  it("does not let a delayed session lookup replace a newer signed-in account", async () => {
    mockAcceptanceEnabled = false;
    let resolveOldSession!: (value: unknown) => void;
    mockGetSession.mockImplementationOnce(() => new Promise((resolve) => { resolveOldSession = resolve; }))
      .mockResolvedValue({ data: { session: { user: { id: "account-b" } } } });
    mockPlay.mockResolvedValue({ ok: false, reason: "no_motes" });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); await Promise.resolve(); });
    await act(async () => { mockAuthCallback?.("SIGNED_IN", { user: { id: "account-b" } }); await Promise.resolve(); });
    await act(async () => resolveOldSession({ data: { session: { user: { id: "account-a" } } } }));
    await act(async () => mockRiveProps.onRequestPlay());
    expect(mockPlay.mock.calls[0][0]).toMatchObject({ accountId: "account-b" });
    act(() => renderer.unmount());
  });

  it("refreshes a stale wallet after another device spends the selected stake", async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); });
    const modes = renderer.root.findAll((node) => node.props.accessibilityRole === "radio" && typeof node.props.onPress === "function");
    await act(async () => modes[1].props.onPress());
    mockPlay.mockResolvedValueOnce({ ok: false, reason: "insufficient_motes", motes: 0 });
    mockFetchState.mockResolvedValueOnce({ ok: true, ...mockState, wallet: { motes: 0, revision: 3 } });
    await act(async () => mockRiveProps.onRequestPlay());
    expect(mockFetchState).toHaveBeenCalledTimes(2);
    expect(mockRiveProps.motes).toBe(0);
    expect(mockRiveProps.canPlay).toBe(false);
    expect(mockRiveProps.statusLabel).toContain("another device");
    expect(await AsyncStorage.getItem("mote_game_pending_v2:account-a")).toBeNull();
    act(() => renderer.unmount());
  });

  it("uses the accepted V3 schedule and suppresses a full spin for recovered Reveal", async () => {
    mockRuntimeVersion = "mote-animation-v3";
    const receipt = databaseVectors.receipts[0].receipt;
    const command = { protocolVersion: 2, requestId: receipt.request_id, accountId: "account-a",
      mode: "reveal", stakeMotes: 1, expectedRulesVersion: "reveal-v1", createdAt: receipt.created_at };
    await AsyncStorage.setItem("mote_game_pending_v2:account-a", JSON.stringify(command));
    mockLookup.mockResolvedValueOnce({ ok: true, receipt, wallet: databaseVectors.receipts[0].wallet });
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<MoteWageringScreen />); });
    await act(async () => mockRiveProps.onRequestPlay());
    expect(mockSensoryPlay).toHaveBeenCalledWith(expect.objectContaining({ recovered: true, presentationVersion: "mote-animation-v3" }));
    expect(mockRiveProps.spinToken).toBe(0);
    expect(await AsyncStorage.getItem("mote_game_pending_v2:account-a")).toBeNull();
    act(() => renderer.unmount());
  });
});
