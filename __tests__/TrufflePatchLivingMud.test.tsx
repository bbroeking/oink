import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockLoadDigProgress = jest.fn();
const mockSaveDigProgress = jest.fn();
const mockClearDigProgress = jest.fn();

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(async () => {}),
}));

jest.mock("@/utils/digSubmission", () => ({
  loadDigProgress: (...args: unknown[]) => mockLoadDigProgress(...args),
  saveDigProgress: (...args: unknown[]) => mockSaveDigProgress(...args),
  clearDigProgress: (...args: unknown[]) => mockClearDigProgress(...args),
}));
jest.mock("@/utils/sound", () => ({
  preload: jest.fn(),
  play: jest.fn(),
  startAmbience: jest.fn(),
  stopAmbience: jest.fn(),
}));
jest.mock("@/utils/fieldGuide", () => ({ observeFieldGuide: jest.fn() }));
jest.mock("@/hooks/useMotionPolicy", () => ({
  useMotionPolicy: () => ({ allowDecorativeMotion: false, reduceMotion: true }),
}));
jest.mock("@/components/mudwar/ReclaimSlam", () => {
  const ReactModule = require("react");
  return { ReclaimSlam: ReactModule.forwardRef(() => null) };
});
jest.mock("@/components/mudwar/LivingMudSurface", () => {
  const ReactModule = require("react");
  return {
    LivingMudSurface: (props: any) =>
      ReactModule.createElement("MudSurface", props),
  };
});
jest.mock("@/components/mudwar/LivingMudScene", () => {
  const ReactModule = require("react");
  const { View } = require("react-native");
  return {
    LivingMudScene: ({ children, ...props }: any) =>
      ReactModule.createElement(View, props, children),
    LivingMudPouch: () => null,
    livingMudStyles: { paper: {}, inset: {}, footer: {} },
  };
});
jest.mock("@/components/mudwar/LivingMudReceipt", () => {
  const ReactModule = require("react");
  return {
    LivingMudReceipt: (props: any) =>
      ReactModule.createElement("MudReceipt", props),
    LivingMudRecovery: (props: any) =>
      ReactModule.createElement("MudRecovery", props),
  };
});
jest.mock("@/components/ui", () => {
  const ReactModule = require("react");
  const { Pressable, Text, View } = require("react-native");
  const passthrough = ({ children, ...props }: any) =>
    ReactModule.createElement(View, props, children);
  return {
    T: ({ children, ...props }: any) =>
      ReactModule.createElement(Text, props, children),
    Button: ({ children, onPress, disabled, ...props }: any) =>
      ReactModule.createElement(
        Pressable,
        { ...props, onPress, disabled },
        children,
      ),
    AdaptiveModalScaffold: passthrough,
    CardTitle: passthrough,
    Glyph: passthrough,
    Hand: passthrough,
    Icon: passthrough,
    IconButton: passthrough,
    Kicker: passthrough,
    Label: passthrough,
    ListRow: passthrough,
    Tag: passthrough,
  };
});
jest.mock("@/components/season1/GuardedCtaExtras", () => ({
  NotifyChip: () => null,
}));
jest.mock("@/components/mudwar/DigPostcardComposer", () => ({
  DigPostcardComposer: () => null,
}));

import { Text } from "react-native";
import { TrufflePatch } from "@/components/mudwar/TrufflePatch";
import { generateBoard } from "@/utils/rooting";
import type { RootingSession } from "@/hooks/useRooting";

const session = (overrides: Partial<RootingSession> = {}): RootingSession => ({
  userId: "pig-a",
  seed: 42,
  windowIndex: 123,
  windowEndsAtMs: Date.now() + 60_000,
  practice: false,
  coop: false,
  blessed: false,
  crewDug: [],
  uniqueId: null,
  carry: null,
  ...overrides,
});

const textOf = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .flatMap((node) => node.props.children)
    .filter((part) => typeof part === "string")
    .join(" ");

async function mount(
  props: Partial<React.ComponentProps<typeof TrufflePatch>> = {},
) {
  const onSubmit = jest.fn(async () => ({
    outcome: null,
    failReason: "uncertain",
  }));
  const onClose = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <TrufflePatch
        session={session()}
        onSubmit={onSubmit}
        onClose={onClose}
        {...props}
      />,
    );
  });
  return { tree, onSubmit, onClose };
}

describe("TrufflePatch living progress", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-12T12:00:00Z"));
    mockLoadDigProgress.mockReset().mockResolvedValue(null);
    mockSaveDigProgress.mockReset().mockResolvedValue(undefined);
    mockClearDigProgress.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("restores a validated board before enabling interaction", async () => {
    const board = generateBoard(42);
    const layers = [...board.layers];
    layers[0] = Math.max(0, layers[0] - 1);
    mockLoadDigProgress.mockResolvedValue({
      uid: "pig-a",
      windowIndex: 123,
      seed: 42,
      layers,
      collected: [],
      actions: 3,
      dugOrder: [],
      streak: 1,
      freeNext: true,
      savedAt: "now",
    });
    const { tree } = await mount();
    const surface = tree.root.findByType("MudSurface" as any);
    expect(surface.props.layers).toEqual(layers);
    expect(surface.props.disabled).toBe(false);
    expect(textOf(tree)).toContain("Free rub ready");
  });

  test("a failed close save keeps the board open and explains the failure", async () => {
    let leave: (() => Promise<void>) | null = null;
    const { tree, onClose } = await mount({
      registerLeave: (value) => {
        leave = value;
      },
    });
    mockSaveDigProgress.mockRejectedValueOnce(new Error("disk full"));
    await act(async () => {
      await leave?.();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain("couldn't be saved");
  });

  test("an expired restored board blocks brush actions and submits no new action", async () => {
    const expired = session({ windowEndsAtMs: Date.now() - 1 });
    const { tree, onSubmit } = await mount({ session: expired });
    const surface = tree.root.findByType("MudSurface" as any);
    expect(surface.props.disabled).toBe(true);
    act(() => surface.props.onAction({ kind: "rub", index: 0 }));
    const pack = tree.root
      .findAll((node) => typeof node.props.onPress === "function")
      .at(-1);
    expect(pack).toBeDefined();
    await act(async () => {
      await pack?.props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledWith([], 0, []);
    expect(tree.root.findByType("MudRecovery" as any).props.reason).toBe(
      "uncertain",
    );
  });

  test.each([
    { label: "solo", coop: false, restoredActions: 19, budget: 20 },
    { label: "co-op", coop: true, restoredActions: 24, budget: 25 },
  ])(
    "$label rejects a last-action shove but accepts a budget-exact rub",
    async ({ coop, restoredActions, budget }) => {
      const board = generateBoard(42);
      const buriedIndex = board.layers.findIndex((depth) => depth > 0);
      const layers = [...board.layers];
      mockLoadDigProgress.mockResolvedValue({
        uid: "pig-a",
        windowIndex: 123,
        seed: 42,
        layers,
        collected: [],
        actions: restoredActions,
        dugOrder: [],
        streak: 0,
        freeNext: false,
        savedAt: "now",
      });
      const { tree, onSubmit } = await mount({ session: session({ coop }) });
      let surface = tree.root.findByType("MudSurface" as any);

      act(() => surface.props.onAction({ kind: "shove", index: buriedIndex }));
      surface = tree.root.findByType("MudSurface" as any);
      expect(surface.props.layers).toEqual(layers);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(textOf(tree)).toContain("Try a gentle rub");

      await act(async () => {
        surface.props.onAction({ kind: "rub", index: buriedIndex });
        await Promise.resolve();
      });
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.calls[0][1]).toBe(budget);
      expect(onSubmit.mock.calls[0][1]).toBeLessThanOrEqual(budget);
    },
  );
});
