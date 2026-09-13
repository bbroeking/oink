import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Alert } from "react-native";
import { BarnCollection } from "@/app/barn-collection";
import { HabitatItemPreviewModal } from "@/components/habitat/HabitatItemPreviewModal";
import { showPurchaseToast } from "@/components/PurchaseToast";
import {
  HABITAT_CATALOG,
  HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import { HABITAT_EXPANSION_COLLECTIONS } from "@/constants/habitatExpansion";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui/PopupQueue";
import type { HabitatCatalogItem } from "@/utils/habitat";

jest.mock("@/components/habitat/HabitatItemPreviewModal", () => ({
  HabitatItemPreviewModal: () => null,
}));

const mockParams: { position?: string } = {};
jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { dismissTo: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock("@/hooks/useHabitatJournal", () => ({
  useHabitatJournal: () => ({
    acquisitions: [],
    wishlist: [],
    newItemIds: new Set(),
    loading: false,
    error: null,
    supported: true,
    refresh: jest.fn(),
    markPresented: jest.fn(),
    markSeen: jest.fn(),
    setWishlisted: jest.fn(),
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock("@/components/ui/PageHeader", () => ({ PageHeader: () => null }));
jest.mock("@/components/habitat/HabitatScene", () => ({
  HabitatScene: () => null,
}));
jest.mock("@/components/PurchaseToast", () => ({
  showPurchaseToast: jest.fn(),
}));
jest.mock("@/utils/interactionAnalytics", () => ({
  trackInteraction: jest.fn(),
}));
jest.mock("@/hooks/useMotionPolicy", () => ({
  useMotionPolicy: () => ({ reduceMotion: true }),
}));
const item = HABITAT_CATALOG.find((i) => i.id === "dried_herb_garland")!;
const byId = Object.fromEntries(HABITAT_CATALOG.map((i) => [i.id, i]));
const mockBuy = jest.fn();
const mockHabitat = {
  data: {
    snapshot: {
      ownerId: "a",
      revision: 1,
      positions: Object.fromEntries(
        Object.entries(HABITAT_STARTER_POSITIONS).map(([p, id]) => [
          p,
          id ? byId[id] : null,
        ]),
      ),
    },
    catalog: [...HABITAT_CATALOG],
    owned: [] as HabitatCatalogItem[],
    currentSnouts: 100,
  },
  loading: false,
  saving: false,
  error: null,
  buy: mockBuy,
  refresh: jest.fn().mockResolvedValue(undefined),
};
jest.mock("@/hooks/useHabitat", () => ({ useHabitat: () => mockHabitat }));

describe("BarnCollection confirmed purchase feedback", () => {
  let tree: TestRenderer.ReactTestRenderer;
  let announce: jest.SpyInstance;
  let systemAlert: jest.SpyInstance;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockParams.position = "ceiling";
    mockHabitat.data.catalog = [...HABITAT_CATALOG];
    mockHabitat.data.owned = [];
    mockHabitat.data.currentSnouts = 100;
    mockBuy.mockResolvedValue({
      ok: true,
      item,
      receipt: { snoutCost: 50, balanceAfterPurchase: 50 },
      currentSnouts: 50,
      newlyOwned: true,
      replayed: false,
    });
    systemAlert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    announce = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
  });
  afterEach(() => {
    act(() => tree?.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  const press = (label: string) =>
    act(() => {
      const target = tree.root.findAll(
        (n) =>
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel === label,
      )[0];
      if (!target) throw new Error(JSON.stringify(tree.toJSON()));
      target.props.onPress();
    });
  const sheet = () => tree.root.findByType(HabitatItemPreviewModal);
  it("shows rank gifts and filters them while respecting the decorating position", async () => {
    await act(async () => {
      tree = TestRenderer.create(<BarnCollection accountId="a" progressBackend={jest.fn().mockResolvedValue({ ok: true, collections: [] })} />);
    });
    press("Filter by Wallow gifts");
    expect(tree.root.findAllByProps({ accessibilityLabel: "Preview Dried Herb Garland in your room" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Preview Firefly Lantern in your room" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ accessibilityLabel: "Preview Reading Chair in your room" })).toHaveLength(0);
    expect(mockBuy).not.toHaveBeenCalled();
  });
  it("keeps the Wallow roadmap compact until explicitly expanded", async () => {
    await act(async () => {
      tree = TestRenderer.create(<BarnCollection accountId="a" progressBackend={jest.fn().mockResolvedValue({ ok: true, collections: [] })} />);
    });
    const roadmapRows = () => tree.root.findAllByType(require("react-native").Text)
      .filter((node) => typeof node.props.children === "string" && node.props.children.startsWith("Rank "));
    expect(roadmapRows()).toHaveLength(0);
    press("See Wallow gifts");
    expect(roadmapRows().length).toBeGreaterThan(0);
  });
  it("does not advertise gifts before the server supports prestige rewards", async () => {
    mockHabitat.data.catalog = HABITAT_CATALOG.map(({ prestigeRank, ...entry }) => entry);
    await act(async () => {
      tree = TestRenderer.create(<BarnCollection accountId="a" progressBackend={jest.fn().mockResolvedValue({ ok: true, collections: [] })} />);
    });
    expect(tree.root.findAllByProps({ accessibilityLabel: "Filter by Wallow gifts" })).toHaveLength(0);
  });
  it("describes exclusive Wallow keepsakes as rank gifts rather than starter items", async () => {
    mockParams.position = undefined;
    await act(async () => {
      tree = TestRenderer.create(<BarnCollection accountId="a" progressBackend={jest.fn().mockResolvedValue({ ok: true, collections: [] })} />);
    });
    press("Filter by Wallow gifts");
    expect(tree.root.findAllByProps({ children: "Included with your starter Barn." })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: "Free gift at Wallow Rank 10. Yours to keep." }).length).toBeGreaterThan(0);
  });
  it("returns owned items through the injected callback from the general collection", async () => {
    mockParams.position = undefined;
    const celestial = byId.wallow_keepsake_celestial;
    mockHabitat.data.owned = [celestial];
    const returned = jest.fn();
    await act(async () => {
      tree = TestRenderer.create(<BarnCollection accountId="a" onPurchased={returned} progressBackend={jest.fn().mockResolvedValue({ ok: true, collections: [] })} />);
    });
    press(`Place ${celestial.name} in my Barn`);
    expect(returned).toHaveBeenCalledWith("surface", celestial.id);
    expect(require("expo-router").router.dismissTo).not.toHaveBeenCalled();
  });
  it("returns purchases through the injected callback from the general collection", async () => {
    mockParams.position = undefined;
    const returned = jest.fn();
    await act(async () => {
      tree = TestRenderer.create(<BarnCollection accountId="a" onPurchased={returned} progressBackend={jest.fn().mockResolvedValue({ ok: true, collections: [] })} />);
    });
    press("Buy Dried Herb Garland for 50 Snouts");
    await confirm();
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(returned).toHaveBeenCalledWith("ceiling", item.id);
    expect(require("expo-router").router.dismissTo).not.toHaveBeenCalled();
  });
  const confirm = async () => {
    await act(async () => {
      sheet().props.onBuy();
    });
  };
  it("celebrates only the acknowledged purchase with the current balance and one announcement", async () => {
    const returned = jest.fn();
    act(() => {
      tree = TestRenderer.create(
        <BarnCollection
          progressBackend={jest
            .fn()
            .mockResolvedValue({ ok: true, collections: [] })}
          accountId="a"
          onPurchased={returned}
        />,
      );
    });
    press("Buy Dried Herb Garland for 50 Snouts");
    expect(showPurchaseToast).not.toHaveBeenCalled();
    await confirm();
    expect(returned).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(returned).toHaveBeenCalledWith("ceiling", item.id);
    expect(showPurchaseToast).toHaveBeenCalledWith({
      type: "success",
      title: item.name,
      text: "Added to your Barn. 50 Snouts available.",
      cost: 50,
    });
    expect(announce).toHaveBeenCalledTimes(1);
  });
  it("waits for the preview modal to dismiss before feedback and draft return", async () => {
    const returned = jest.fn();
    act(() => {
      tree = TestRenderer.create(
        <BarnCollection
          progressBackend={jest
            .fn()
            .mockResolvedValue({ ok: true, collections: [] })}
          accountId="a"
          onPurchased={returned}
        />,
      );
    });
    press("Preview Dried Herb Garland in your room");
    expect(sheet().props.showRoomPreview).toBe(true);
    await confirm();
    expect(returned).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(POPUP_HANDOFF_GAP_MS));
    expect(returned).toHaveBeenCalledTimes(1);
    expect(showPurchaseToast).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledTimes(1);
  });
  it("does not celebrate an uncertain response", async () => {
    mockBuy.mockResolvedValue({ ok: false, reason: "network" });
    act(() => {
      tree = TestRenderer.create(
        <BarnCollection
          progressBackend={jest
            .fn()
            .mockResolvedValue({ ok: true, collections: [] })}
          accountId="a"
        />,
      );
    });
    press("Buy Dried Herb Garland for 50 Snouts");
    await confirm();
    expect(showPurchaseToast).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
    expect(sheet().props.error).toContain("will not charge you twice");
    expect(systemAlert).not.toHaveBeenCalled();
  });
  it("opens and cancels the styled sheet without buying or using a system alert", async () => {
    await act(async () => {
      tree = TestRenderer.create(
        <BarnCollection
          accountId="a"
          progressBackend={jest
            .fn()
            .mockResolvedValue({ ok: true, collections: [] })}
        />,
      );
    });
    press("Buy Dried Herb Garland for 50 Snouts");
    expect(sheet().props.item.id).toBe(item.id);
    expect(sheet().props.showRoomPreview).toBe(false);
    expect(mockBuy).not.toHaveBeenCalled();
    expect(systemAlert).not.toHaveBeenCalled();
    act(() => sheet().props.onClose());
    expect(sheet().props.item).toBeNull();
    expect(mockBuy).not.toHaveBeenCalled();
  });
  it("ignores rapid Buy taps and keeps the sheet during an in-flight purchase", async () => {
    let resolve!: (value: any) => void;
    mockBuy.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await act(async () => {
      tree = TestRenderer.create(
        <BarnCollection
          accountId="a"
          progressBackend={jest
            .fn()
            .mockResolvedValue({ ok: true, collections: [] })}
        />,
      );
    });
    press("Buy Dried Herb Garland for 50 Snouts");
    await act(async () => {
      sheet().props.onBuy();
      sheet().props.onBuy();
      sheet().props.onClose();
    });
    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(sheet().props.item.id).toBe(item.id);
    expect(sheet().props.busy).toBe(true);
    await act(async () => resolve({ ok: false, reason: "network" }));
    expect(sheet().props.busy).toBe(false);
    expect(sheet().props.error).toContain("will not charge you twice");
  });
  it("drops feedback and navigation when its account leaves during a purchase", async () => {
    let resolve!: (value: any) => void;
    mockBuy.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const returned = jest.fn();
    act(() => {
      tree = TestRenderer.create(
        <BarnCollection
          progressBackend={jest
            .fn()
            .mockResolvedValue({ ok: true, collections: [] })}
          accountId="a"
          onPurchased={returned}
        />,
      );
    });
    press("Buy Dried Herb Garland for 50 Snouts");
    await confirm();
    act(() =>
      tree.update(
        <BarnCollection
          progressBackend={jest
            .fn()
            .mockResolvedValue({ ok: true, collections: [] })}
          accountId="b"
          onPurchased={returned}
        />,
      ),
    );
    await act(async () =>
      resolve({
        ok: true,
        item,
        receipt: { snoutCost: 50 },
        currentSnouts: 50,
        newlyOwned: true,
      }),
    );
    expect(sheet().props.item).toBeNull();
    expect(returned).not.toHaveBeenCalled();
    expect(showPurchaseToast).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });
  it("searches the complete 118-design catalog and explains collection rewards", async () => {
    mockParams.position = undefined;
    mockHabitat.data.catalog = [...HABITAT_CATALOG];
    const orchard = HABITAT_EXPANSION_COLLECTIONS[0];
    const secondCollection = HABITAT_EXPANSION_COLLECTIONS[1];
    await act(async () => {
      tree = TestRenderer.create(
        <BarnCollection
          accountId="a"
          progressBackend={jest.fn().mockResolvedValue({
            ok: true,
            collections: [
              {
                id: orchard.id,
                name: orchard.name,
                ownedPaidCount: 4,
                paidCount: 8,
                rewards: orchard.rewards.map((reward) => ({
                  ...reward,
                  earned: reward.threshold === 4,
                })),
              },
              {
                id: secondCollection.id,
                name: secondCollection.name,
                ownedPaidCount: 1,
                paidCount: 8,
                rewards: secondCollection.rewards.map((reward) => ({
                  ...reward,
                  earned: false,
                })),
              },
            ],
          })}
        />,
      );
    });
    expect(
      tree.root.findByProps({ accessibilityLabel: "Search Barn furnishings" }),
    ).toBeTruthy();
    expect(
      tree.root.find(
        (node) =>
          Array.isArray(node.props.children) &&
          node.props.children.join("") ===
            "4 of 8 purchasable designs owned. Bonus designs unlock automatically at 4 and 8.",
      ),
    ).toBeTruthy();
    act(() =>
      tree.root
        .findByProps({ accessibilityLabel: `Filter by ${orchard.name}` })
        .props.onPress(),
    );
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: `${orchard.name} collection progress`,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: `${secondCollection.name} collection progress`,
      }),
    ).toHaveLength(0);
    act(() =>
      tree.root
        .findByProps({ accessibilityLabel: "Search Barn furnishings" })
        .props.onChangeText("Pearwood"),
    );
    expect(tree.root.findByProps({ children: "Pearwood Rocker" })).toBeTruthy();
    expect(
      tree.root.findAllByProps({ children: "Dried Herb Garland" }),
    ).toHaveLength(0);
  });

  it("never shows reward progress returned for a previous account", async () => {
    mockParams.position = undefined;
    mockHabitat.data.catalog = [...HABITAT_CATALOG];
    const firstCollection = HABITAT_EXPANSION_COLLECTIONS[0];
    const secondCollection = HABITAT_EXPANSION_COLLECTIONS[1];
    let resolveFirst!: (value: any) => void;
    const progressBackend = jest
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        collections: [
          {
            id: secondCollection.id,
            name: secondCollection.name,
            ownedPaidCount: 2,
            paidCount: 8,
            rewards: secondCollection.rewards.map((reward) => ({
              ...reward,
              earned: false,
            })),
          },
        ],
      });
    await act(async () => {
      tree = TestRenderer.create(
        <BarnCollection accountId="a" progressBackend={progressBackend} />,
      );
    });
    await act(async () => {
      tree.update(
        <BarnCollection accountId="b" progressBackend={progressBackend} />,
      );
    });
    resolveFirst({
      ok: true,
      collections: [
        {
          id: firstCollection.id,
          name: firstCollection.name,
          ownedPaidCount: 8,
          paidCount: 8,
          rewards: firstCollection.rewards.map((reward) => ({
            ...reward,
            earned: true,
          })),
        },
      ],
    });
    await act(async () => {});
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: `${firstCollection.name} collection progress`,
      }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({
        accessibilityLabel: `${secondCollection.name} collection progress`,
      }).length,
    ).toBeGreaterThan(0);
  });
});
