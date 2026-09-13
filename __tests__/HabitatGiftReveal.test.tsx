import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { HabitatGiftReveal } from "@/components/habitat/HabitatGiftReveal";
import type { HabitatCatalogItem } from "@/utils/habitat";

const mockRelease = jest.fn();
let mockJournal: any;
jest.mock("@/hooks/useHabitatJournal", () => ({
  useHabitatJournal: () => mockJournal,
}));
jest.mock("@/constants/habitat", () => ({ habitatItemAsset: () => 1 }));
// The component reaches everything through the barrel now (spec §2: the only
// sanctioned import path), so the popup-queue stand-ins live here too.
jest.mock("@/components/ui", () => {
  const mockReact = require("react");
  const {
    Pressable: MockPressable,
    Text: MockText,
    View: MockView,
  } = require("react-native");
  return {
    POPUP_HANDOFF_GAP_MS: 700,
    POPUP_TEARDOWN_MS: 500,
    usePopupSlot: (_id: string, want: boolean) => ({
      visible: want,
      release: mockRelease,
    }),
    AdaptiveModalScaffold: ({ visible, children }: any) =>
      visible
        ? mockReact.createElement(MockView, { testID: "gift-reveal" }, children)
        : null,
    Button: ({ children, onPress, accessibilityLabel, disabled }: any) =>
      mockReact.createElement(
        MockPressable,
        {
          accessibilityRole: "button",
          accessibilityLabel,
          disabled,
          onPress,
        },
        mockReact.createElement(MockText, null, children),
      ),
    // The reveal is a ceremony on the primitives now: a Sticker per gift and
    // every word through a text role. Stand them in as the host nodes the
    // assertions below walk.
    Sticker: ({ children, accessibilityRole, testID }: any) =>
      mockReact.createElement(MockView, { accessibilityRole, testID }, children),
    SectionTitle: ({ children, accessibilityRole }: any) =>
      mockReact.createElement(MockText, { accessibilityRole }, children),
    CardTitle: ({ children }: any) =>
      mockReact.createElement(MockText, null, children),
    Body: ({ children, accessibilityRole }: any) =>
      mockReact.createElement(MockText, { accessibilityRole }, children),
  };
});

const item: HabitatCatalogItem = {
  id: "wallow_keepsake_bronze",
  name: "Bronze Wallow Keepsake",
  description: "A bronze keepsake.",
  category: "surface_decor",
  rarity: "uncommon",
  assetKey: "wallow_keepsake_bronze",
  snoutCost: 0,
  isForSale: false,
  active: true,
  displayOrder: 3000,
  prestigeRank: 1,
  prestigeKeepsake: true,
};
const gift = {
  id: "a".repeat(64),
  itemId: item.id,
  source: "habitat_prestige",
  grantedAt: "2026-09-10T12:00:00.000Z",
  newlyOwned: true,
  seen: false,
  presented: false,
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("HabitatGiftReveal", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockJournal = {
      acquisitions: [gift],
      markPresented: jest.fn(async () => true),
      markSeen: jest.fn(async () => true),
    };
  });
  afterEach(() => jest.useRealTimers());

  it("treats Later as presented but not seen and releases before teardown", async () => {
    const onDone = jest.fn();
    const tree = TestRenderer.create(
      <HabitatGiftReveal
        accountId="a"
        catalog={[item]}
        onPreview={jest.fn()}
        onDone={onDone}
      />,
    );
    await settle();
    const later = tree.root
      .findAllByProps({ accessibilityRole: "button" })
      .filter((node) => typeof node.props.onPress === "function")
      .at(-1)!;
    await act(async () => later.props.onPress());
    expect(mockJournal.markPresented).toHaveBeenCalledWith([gift.id]);
    expect(mockJournal.markSeen).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(500));
    expect(onDone).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it("blocks double taps and durably marks a previewed gift seen", async () => {
    const pending = deferred<boolean>();
    mockJournal.markPresented = jest.fn(() => pending.promise);
    const onPreview = jest.fn();
    const tree = TestRenderer.create(
      <HabitatGiftReveal
        accountId="a"
        catalog={[item]}
        onPreview={onPreview}
      />,
    );
    await settle();
    const preview = tree.root.findByProps({
      accessibilityLabel: `Preview ${item.name} in my Barn`,
    });
    act(() => {
      preview.props.onPress();
      preview.props.onPress();
    });
    expect(mockJournal.markPresented).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(true);
      await pending.promise;
    });
    expect(mockJournal.markSeen).toHaveBeenCalledWith([gift.id]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(onPreview).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(700));
    expect(onPreview).toHaveBeenCalledWith(item);
    act(() => tree.unmount());
  });

  it("allows consecutive gift batches for the same account", async () => {
    const secondGift = { ...gift, id: "b".repeat(64) };
    const tree = TestRenderer.create(
      <HabitatGiftReveal
        accountId="a"
        catalog={[item]}
        onPreview={jest.fn()}
      />,
    );
    await settle();

    const later = () =>
      tree.root
        .findAllByProps({ accessibilityRole: "button" })
        .filter((node) => typeof node.props.onPress === "function")
        .at(-1)!;
    await act(async () => later().props.onPress());
    expect(mockJournal.markPresented).toHaveBeenLastCalledWith([gift.id]);

    mockJournal.acquisitions = [{ ...gift, presented: true }];
    act(() => {
      tree.update(
        <HabitatGiftReveal
          accountId="a"
          catalog={[item]}
          onPreview={jest.fn()}
        />,
      );
      jest.advanceTimersByTime(500);
    });
    await settle();

    mockJournal.acquisitions = [
      { ...gift, presented: true },
      secondGift,
    ];
    act(() => {
      tree.update(
        <HabitatGiftReveal
          accountId="a"
          catalog={[item]}
          onPreview={jest.fn()}
        />,
      );
    });
    await settle();
    await act(async () => later().props.onPress());

    expect(mockJournal.markPresented).toHaveBeenCalledTimes(2);
    expect(mockJournal.markPresented).toHaveBeenLastCalledWith([secondGift.id]);
    act(() => tree.unmount());
  });

  it("drops stale completions and cancels delayed preview when disabled", async () => {
    const pending = deferred<boolean>();
    mockJournal.markPresented = jest.fn(() => pending.promise);
    const onPreview = jest.fn();
    const onDone = jest.fn();
    const tree = TestRenderer.create(
      <HabitatGiftReveal
        accountId="a"
        catalog={[item]}
        onPreview={onPreview}
        onDone={onDone}
      />,
    );
    await settle();
    const preview = tree.root.findByProps({
      accessibilityLabel: `Preview ${item.name} in my Barn`,
    });
    act(() => preview.props.onPress());
    act(() => {
      tree.update(
        <HabitatGiftReveal
          accountId="b"
          catalog={[item]}
          onPreview={onPreview}
          onDone={onDone}
        />,
      );
    });
    await act(async () => {
      pending.resolve(true);
      await pending.promise;
    });
    expect(mockRelease).not.toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();

    mockJournal.markPresented = jest.fn(async () => true);
    const tree2 = TestRenderer.create(
      <HabitatGiftReveal
        accountId="c"
        catalog={[item]}
        onPreview={onPreview}
        onDone={onDone}
      />,
    );
    await settle();
    await act(async () =>
      tree2.root
        .findByProps({ accessibilityLabel: `Preview ${item.name} in my Barn` })
        .props.onPress(),
    );
    act(() => {
      tree2.update(
        <HabitatGiftReveal
          accountId="c"
          catalog={[item]}
          enabled={false}
          onPreview={onPreview}
          onDone={onDone}
        />,
      );
    });
    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(onPreview).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      tree.unmount();
      tree2.unmount();
    });
  });
});
