import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui/PopupQueue";
import { showPurchaseToast } from "@/components/PurchaseToast";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Chip, Ribbon, Tag } from "@/components/ui/Chip";
import { EmptyState, LoadingBeat } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ProgressTrack } from "@/components/ui/ProgressTrack";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SnoutCoin } from "@/components/ui/SnoutCoin";
import {
  STACK_SCROLL_EDGES,
  StackPage,
  useStackScrollPad,
} from "@/components/ui/StackPage";
import {
  SCROLL_EDGE_EPSILON,
  ScrollEdge,
  useScrollEdge,
} from "@/components/ui/ScrollEdge";
import { Sticker } from "@/components/ui/Sticker";
import { TextField } from "@/components/ui/TextField";
import { Body, Hand, Label, Numeral, T } from "@/components/ui/Text";
import { HabitatScene } from "@/components/habitat/HabitatScene";
import { HabitatItemPreviewModal } from "@/components/habitat/HabitatItemPreviewModal";
import { habitatAcquisitionPaths } from "@/components/habitat/HabitatInspectionSheet";
import { useHabitat, type HabitatBackend } from "@/hooks/useHabitat";
import {
  useHabitatJournal,
  type HabitatJournalBackend,
} from "@/hooks/useHabitatJournal";
import { useHabitatAccount } from "@/hooks/useHabitatAccount";
import { trackInteraction } from "@/utils/interactionAnalytics";
import {
  HABITAT_POSITION_META,
  HABITAT_STARTER_ITEM_IDS,
  habitatItemAsset,
} from "@/constants/habitat";
import {
  HABITAT_EXPANSION_CATALOG_BY_ID,
  HABITAT_EXPANSION_COLLECTIONS,
} from "@/constants/habitatExpansion";
import type {
  HabitatCatalogItem,
  HabitatCollectionProgress,
  HabitatPosition,
} from "@/utils/habitat";
import {
  createHabitatDraft,
  draftSnapshot,
  fetchHabitatCollectionProgress,
  habitatDraftPlace,
} from "@/utils/habitat";
import {
  BORDER,
  CHROME_TYPE_CAP,
  PAGE_PAD,
  RADII,
  RARITY_BG_SOLID,
  RARITY_STRIPE,
  ROW_TILTS,
  SHADOW_SM,
  SPACE,
  TILE_TYPE_CAP,
  TILT,
  UI_COLORS,
  WHIMSY,
} from "@/constants/theme";

// The collection is a sticker book: two tiles to a row, each a compact
// Sticker with a square art well on the rarity fill, the name, one state
// capsule and (where there is one) the action. Everything else about the
// design — its description, how to earn it, the wishlist — lives in the item
// sheet a tap opens, so the page stays a page you can flip through. The tile
// grammar is the Shop's (rarity dot, sage owned check, corner ribbon) so the
// two Collect surfaces read as one hand. (2026-09-13)
const GRID_COLUMNS = 2;
// The rarity dot and the owned check are corner badges on the art well — art
// sizes, not spacing steps; matched to the Shop's card so the two rhyme.
const RARITY_DOT = 12;
const OWNED_BADGE = 24;
const CHECK_MARK = 14;
// The balance rides the crown's right slot as the Shop crown's own pill — the
// same coin, the same lean — so the furnishings shop and the Shop read as one
// hand, and the crown loses the stats line it used to spend on "N Snouts
// available." (polish 2026-10-04).
const BALANCE_COIN = 20;
const BALANCE_TILT = 2;

type OwnershipFilter = "all" | "owned" | "new" | "wishlist";
const OWNERSHIP_OPTIONS = [
  {
    value: "all",
    label: "All",
    accessibilityLabel: "Show all Barn furnishings",
    accessibilityHint: "Filters the collection",
  },
  {
    value: "owned",
    label: "Owned",
    accessibilityLabel: "Show owned Barn furnishings",
    accessibilityHint: "Filters the collection",
  },
  {
    value: "new",
    label: "New",
    accessibilityLabel: "Show new Barn furnishings",
    accessibilityHint: "Filters the collection",
  },
  {
    value: "wishlist",
    label: "Wishlist",
    accessibilityLabel: "Show wishlisted Barn furnishings",
    accessibilityHint: "Filters the collection",
  },
] as const satisfies readonly {
  value: OwnershipFilter;
  label: string;
  accessibilityLabel: string;
  accessibilityHint: string;
}[];

// The one empty shelf per filter, each saying what fills it. A search miss
// keeps the generic line because the fix is the player's word, not a purchase.
const EMPTY_COPY: Record<
  OwnershipFilter,
  { glyph: "gift" | "sparkles" | "heart"; title: string; sub: string }
> = {
  all: {
    glyph: "gift",
    title: "Nothing to show yet.",
    sub: "Try another filter.",
  },
  owned: {
    glyph: "gift",
    title: "Nothing in your collection yet.",
    sub: "Buy a design or earn a gift and it lands here.",
  },
  new: {
    glyph: "sparkles",
    title: "Nothing new right now.",
    sub: "New designs show up here the moment they arrive.",
  },
  wishlist: {
    glyph: "heart",
    title: "No wishes yet.",
    sub: "Open a design and tap Wishlist to keep it here.",
  },
};

const collectionName = (id: string) =>
  HABITAT_EXPANSION_COLLECTIONS.find((collection) => collection.id === id)
    ?.name ?? id;

const chunk = <T,>(list: readonly T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
};

export default function BarnCollectionRoute() {
  const { id, loaded } = useHabitatAccount();
  if (!loaded)
    return (
      <View style={styles.loading}>
        <LoadingBeat label="opening the collection" />
      </View>
    );
  if (!id) return <Redirect href="/(tabs)" />;
  return <BarnCollection key={id} accountId={id} />;
}
export function BarnCollection({
  accountId,
  backend,
  onPurchased,
  onBack,
  progressBackend = fetchHabitatCollectionProgress,
  journalBackend,
}: {
  accountId: string | null;
  backend?: HabitatBackend;
  onPurchased?: (position: HabitatPosition, itemId: string) => void;
  onBack?: () => void;
  progressBackend?: typeof fetchHabitatCollectionProgress;
  journalBackend?: HabitatJournalBackend;
}) {
  const { position: rawPosition, itemId: requestedItemId } =
    useLocalSearchParams<{
      position?: string;
      itemId?: string;
    }>();
  const position =
    rawPosition && Object.hasOwn(HABITAT_POSITION_META, rawPosition)
      ? (rawPosition as HabitatPosition)
      : undefined;
  const h = useHabitat(accountId, backend);
  const journal = useHabitatJournal(
    backend && !journalBackend ? null : accountId,
    journalBackend,
  );
  const [previewItem, setPreviewItem] = useState<HabitatCatalogItem | null>(
    null,
  );
  const [previewAccountId, setPreviewAccountId] = useState<string | null>(null);
  const [showRoomPreview, setShowRoomPreview] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const purchaseBusy = useRef(false);
  const openItem = (item: HabitatCatalogItem, inRoom = false) => {
    if (purchaseBusy.current || navigationTimer.current) return;
    setPreviewAccountId(accountId);
    setPreviewItem(item);
    setShowRoomPreview(inRoom);
    setPurchaseError(null);
    if (journal.newItemIds.has(item.id)) void journal.markSeen([item.id]);
  };
  const closeItem = () => {
    if (purchaseBusy.current) return;
    setPreviewItem(null);
    setPurchaseError(null);
  };
  useEffect(() => {
    setPreviewItem(null);
    setPurchaseError(null);
    setPurchasing(false);
    purchaseBusy.current = false;
  }, [accountId]);
  const [query, setQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>("all");
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [wallowExpanded, setWallowExpanded] = useState(false);
  const [progress, setProgress] = useState<HabitatCollectionProgress[]>([]);
  const [progressError, setProgressError] = useState(false);
  const [progressAccountId, setProgressAccountId] = useState<string | null>(
    null,
  );
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAccount = useRef(accountId);
  activeAccount.current = accountId;
  // THE SCROLL EDGE sits under whatever is pinned at the top of the list: the
  // crown while the shop's head (the Wallow card, the search, the filters)
  // scrolls under it, then the set header that has pinned once tiles run
  // under it — so the tiles never vanish at a bare straight cut (005/006).
  // Each set header reports where it starts in the content; the scroll says
  // which one is pinned. (polish 2026-10-04)
  const scrollPad = useStackScrollPad();
  const setHeaderTops = useRef(new Map<string, number>());
  const [pinnedSet, setPinnedSet] = useState<string | null>(null);
  const trackPinnedSet = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      let next: string | null = null;
      let nextTop = -Infinity;
      for (const [id, top] of setHeaderTops.current) {
        if (y > top + SCROLL_EDGE_EPSILON && top > nextTop) {
          next = id;
          nextTop = top;
        }
      }
      setPinnedSet((current) => (current === next ? current : next));
    },
    [],
  );
  const edge = useScrollEdge({ onScroll: trackPinnedSet });
  const refreshProgress = useCallback(async () => {
    const expected = accountId;
    if (!expected) return null;
    try {
      const result = await progressBackend();
      if (activeAccount.current !== expected) return null;
      if (result.ok) {
        setProgress(result.collections);
        setProgressError(false);
        setProgressAccountId(expected);
        return result.collections;
      }
      setProgressError(true);
      setProgressAccountId(expected);
    } catch {
      if (activeAccount.current === expected) {
        setProgressError(true);
        setProgressAccountId(expected);
      }
    }
    return null;
  }, [accountId, progressBackend]);
  useEffect(() => {
    if (h.data) void refreshProgress();
  }, [accountId, Boolean(h.data), refreshProgress]);
  useEffect(() => {
    activeAccount.current = accountId;
    return () => {
      activeAccount.current = null;
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
      navigationTimer.current = null;
    };
  }, [accountId]);
  const scopedProgress = progressAccountId === accountId ? progress : [];
  const scopedProgressError = progressAccountId === accountId && progressError;
  const prestigeRewards = useMemo(
    () =>
      h.data?.catalog
        .filter(
          (item): item is HabitatCatalogItem & { prestigeRank: number } =>
            item.prestigeRank !== undefined,
        )
        .sort((a, b) => a.prestigeRank - b.prestigeRank) ?? [],
    [h.data],
  );
  const ownedIds = useMemo(
    () => new Set(h.data?.owned.map((item) => item.id) ?? []),
    [h.data?.owned],
  );
  // What is in the room right now — the unsaved draft when the Barn is mid-edit,
  // the saved snapshot otherwise. The tile says "In room" from this, never from
  // ownership alone: a stored design and a placed one are different states.
  const draftPositions = h.draft?.positions;
  const savedPositions = h.data?.snapshot.positions;
  const placedIds = useMemo(() => {
    const ids = draftPositions
      ? Object.values(draftPositions)
      : Object.values(savedPositions ?? {}).map((placed) => placed?.id ?? null);
    return new Set(ids.filter((id): id is string => Boolean(id)));
  }, [draftPositions, savedPositions]);
  const wallowRank = h.data?.wallowRank;
  const nextPrestigeReward =
    wallowRank !== undefined
      ? prestigeRewards.find(
          (reward) =>
            reward.prestigeRank > wallowRank && !ownedIds.has(reward.id),
        )
      : prestigeRewards.find((reward) => !ownedIds.has(reward.id));
  const items = useMemo(
    () =>
      h.data?.catalog
        .filter(
          (i) =>
            (i.active || h.data?.owned.some((owned) => owned.id === i.id)) &&
            (!position ||
              i.category === HABITAT_POSITION_META[position].category) &&
            (ownershipFilter === "all" ||
              (ownershipFilter === "owned" && ownedIds.has(i.id)) ||
              (ownershipFilter === "new" && journal.newItemIds.has(i.id)) ||
              (ownershipFilter === "wishlist" &&
                journal.wishlist.includes(i.id))) &&
            (!collectionFilter ||
              (collectionFilter === "prestige"
                ? i.prestigeRank !== undefined
                : i.collectionId === collectionFilter)) &&
            (!query.trim() ||
              `${i.name} ${i.description}`
                .toLocaleLowerCase()
                .includes(query.trim().toLocaleLowerCase())),
        )
        .sort((a, b) =>
          collectionFilter === "prestige"
            ? (a.prestigeRank ?? 0) - (b.prestigeRank ?? 0)
            : a.displayOrder - b.displayOrder,
        ) ?? [],
    [
      h.data,
      position,
      collectionFilter,
      ownershipFilter,
      ownedIds,
      journal.newItemIds,
      journal.wishlist,
      query,
    ],
  );
  const groupedItems = useMemo(() => {
    const groups = new Map<string, HabitatCatalogItem[]>();
    for (const item of items) {
      const key = item.collectionId ?? "classic";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return groups;
  }, [items]);
  const compatiblePositionFor = (item: HabitatCatalogItem) => {
    if (position && HABITAT_POSITION_META[position].category === item.category)
      return position;
    const compatible = Object.entries(HABITAT_POSITION_META)
      .filter(([, meta]) => meta.category === item.category)
      .map(([candidate]) => candidate as HabitatPosition);
    const draftPositions = h.draft?.positions;
    const empty = compatible.find((candidate) =>
      draftPositions
        ? draftPositions[candidate] === null
        : h.data?.snapshot.positions[candidate] === null,
    );
    return empty ?? compatible[0];
  };
  // Hand the item back to the Barn: the embedded sheet places it in-draft via
  // onPurchased; the standalone route dismisses to the interior with the slot
  // (when one fits) and the item pre-selected.
  const handOffToBarn = (item: HabitatCatalogItem) => {
    const compatible = compatiblePositionFor(item);
    if (onPurchased && compatible) onPurchased(compatible, item.id);
    else
      router.dismissTo({
        pathname: "/barn-interior",
        params: {
          ...(compatible ? { position: compatible } : {}),
          purchasedItemId: item.id,
          entry: "shop",
        },
      });
  };
  const confirmPurchase = async () => {
    const item = previewItem;
    if (
      !item ||
      !accountId ||
      previewAccountId !== accountId ||
      purchaseBusy.current ||
      h.saving ||
      h.offline ||
      !item.active ||
      !item.isForSale ||
      h.data?.owned.some((owned) => owned.id === item.id) ||
      (h.data?.currentSnouts ?? 0) < item.snoutCost
    )
      return;
    purchaseBusy.current = true;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const result = await h.buy(item);
      if (activeAccount.current !== accountId) return;
      if (!result.ok) {
        setPurchaseError(
          [
            "network",
            "unknown",
            "no_data",
            "invalid_response",
            "pending_command",
            "storage",
          ].includes(result.reason)
            ? "Your purchase may have finished. Close this sheet and use Retry in the collection to confirm it. The same purchase will not charge you twice."
            : result.reason === "insufficient_snouts"
              ? "You don’t have enough Snouts for this design yet."
              : "This design could not be purchased. Close this sheet, refresh the collection, and try again.",
        );
        return;
      }
      if (!backend)
        void trackInteraction({
          eventName: "habitat_item_acquired",
          surface: "shop",
          contentId: item.id,
          properties: { source: "cta", item_kind: "habitat" },
        });
      const [, nextProgress] = await Promise.all([
        h.refresh(),
        refreshProgress(),
      ]);
      if (activeAccount.current !== accountId) return;
      const previouslyEarned = new Set(
        scopedProgress.flatMap((collection) =>
          collection.rewards.flatMap((reward) =>
            reward.earned ? [reward.itemId] : [],
          ),
        ),
      );
      const newlyEarned =
        nextProgress
          ?.flatMap((collection) =>
            collection.rewards.flatMap((reward) =>
              reward.earned && !previouslyEarned.has(reward.itemId)
                ? [HABITAT_EXPANSION_CATALOG_BY_ID[reward.itemId]?.name]
                : [],
            ),
          )
          .filter((name): name is string => Boolean(name)) ?? [];
      const returnToDraft = () => {
        if (activeAccount.current !== accountId) return;
        handOffToBarn(item);
        showPurchaseToast({
          type: "success",
          title: item.name,
          text: `Added to your Barn. ${result.currentSnouts} Snouts available.${newlyEarned.length ? ` Bonus earned: ${newlyEarned.join(", ")}.` : ""}`,
          cost: result.newlyOwned ? result.receipt.snoutCost : undefined,
        });
        AccessibilityInfo.announceForAccessibility(
          `${item.name} added to your Barn. ${result.currentSnouts} Snouts available.${newlyEarned.length ? ` Bonus earned: ${newlyEarned.join(", ")}.` : ""}`,
        );
      };

      setPreviewItem(null);
      // One item sheet owns both preview and purchase; dismiss it before routing.
      navigationTimer.current = setTimeout(() => {
        navigationTimer.current = null;
        returnToDraft();
      }, POPUP_HANDOFF_GAP_MS);
    } catch {
      if (activeAccount.current === accountId)
        setPurchaseError(
          "Could not confirm your purchase. Close this sheet and use Retry in the collection; an interrupted purchase will not charge you twice.",
        );
    } finally {
      if (activeAccount.current === accountId) {
        purchaseBusy.current = false;
        setPurchasing(false);
      }
    }
  };
  const earnCopy = (id: string) =>
    (
      ({
        firefly_lantern: "Fill all six decorating spots and save your Barn.",
        apple_basket: "Save your first custom arrangement.",
        // The guestbook was retired 2026-09-12; owners keep the keepsake, nobody
        // new earns it.
        guestbook_keepsake: "A keepsake from the guestbook days. No longer given out.",
      }) as Record<string, string | undefined>
    )[id];
  const itemEarnCopy = (item: HabitatCatalogItem) => {
    if (item.prestigeRank !== undefined)
      return `Free gift at Wallow Rank ${item.prestigeRank}. Yours to keep.`;
    const original = earnCopy(item.id);
    if (original) return original;
    if (item.rewardThreshold && item.collectionId) {
      const collection = HABITAT_EXPANSION_COLLECTIONS.find(
        (candidate) => candidate.id === item.collectionId,
      );
      return `Own ${item.rewardThreshold} purchasable designs from ${collection?.name ?? "this collection"}. Awarded automatically.`;
    }
    if (
      HABITAT_STARTER_ITEM_IDS.includes(
        item.id as (typeof HABITAT_STARTER_ITEM_IDS)[number],
      )
    )
      return "Included with your starter Barn.";
    return "Earned through your Barn journey.";
  };
  const acquisitionPathsFor = (item: HabitatCatalogItem) => {
    const sourceLabels: Record<string, string> = {
      habitat_purchase: "Bought from the Barn Collection",
      habitat_prestige: "Wallow rank gift",
      habitat_collection: "Collection gift",
      habitat_milestone: "Barn journey gift",
      habitat_starter: "Starter Barn",
    };
    const acquired = journal.acquisitions
      .filter((entry) => entry.itemId === item.id)
      .map((entry) => sourceLabels[entry.source] ?? "Barn gift");
    return [
      ...new Set([
        ...acquired.map((label) => `Yours · ${label}`),
        ...habitatAcquisitionPaths(item),
      ]),
    ];
  };
  const roomPreview = useMemo(() => {
    if (!previewItem || !h.data) return null;
    const compatible = (
      position &&
      HABITAT_POSITION_META[position].category === previewItem.category
        ? position
        : Object.entries(HABITAT_POSITION_META).find(
            ([, m]) => m.category === previewItem.category,
          )?.[0]
    ) as HabitatPosition | undefined;
    if (!compatible) return h.preview ?? h.data.snapshot;
    const draft = habitatDraftPlace(
      h.draft ?? createHabitatDraft(h.data.snapshot),
      compatible,
      previewItem,
    );
    return draftSnapshot(draft, h.data.snapshot, h.data.catalog);
  }, [previewItem, h.data, h.draft, h.preview, position]);
  useEffect(() => {
    if (!backend)
      void trackInteraction({
        eventName: "habitat_shop_opened",
        surface: "shop",
        properties: { variant: position ?? "all" },
      });
  }, [backend, position]);
  useEffect(() => {
    if (!requestedItemId || !h.data) return;
    const requested = h.data.catalog.find(
      (item) => item.id === requestedItemId,
    );
    if (requested) openItem(requested);
    // The route request is an opening instruction; do not reopen after dismissal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedItemId, Boolean(h.data)]);
  const placeItem = (item: HabitatCatalogItem) => {
    setPreviewItem(null);
    handOffToBarn(item);
  };
  // One line per tile that says how the design is, or would be, yours — the
  // spoken half of the tile (its hint) and the face of the gift capsule.
  const stateCopy = (item: HabitatCatalogItem, owned: boolean) =>
    owned
      ? (acquisitionPathsFor(item).find((path) => path.startsWith("Yours ·")) ??
        "Yours")
      : item.isForSale
        ? `${item.snoutCost} Snouts`
        : itemEarnCopy(item);
  const giftLabel = (item: HabitatCatalogItem) =>
    item.prestigeRank !== undefined
      ? `Rank ${item.prestigeRank} gift`
      : item.rewardThreshold
        ? `Gift at ${item.rewardThreshold} owned`
        : HABITAT_STARTER_ITEM_IDS.includes(
              item.id as (typeof HABITAT_STARTER_ITEM_IDS)[number],
            )
          ? "Starter Barn"
          : "Barn gift";
  const renderTile = (item: HabitatCatalogItem, index: number) => {
    const owned = ownedIds.has(item.id);
    const placed = placedIds.has(item.id);
    const isNew = journal.newItemIds.has(item.id);
    const affordable = (h.data?.currentSnouts ?? 0) >= item.snoutCost;
    const actionLocked =
      !owned && (!item.active || !item.isForSale || !affordable || h.saving);
    return (
      <Sticker
        key={item.id}
        color="paper"
        rotate={ROW_TILTS[index % ROW_TILTS.length]}
        radius={RADII.xl}
        accessibilityLabel={`Preview ${item.name} in your room`}
        accessibilityHint={`${item.rarity}, ${stateCopy(item, owned)}. Shows a temporary preview. Your saved room stays the same.`}
        onPress={() => openItem(item, true)}
        style={styles.tile}
      >
        <View
          style={[styles.well, { backgroundColor: RARITY_BG_SOLID[item.rarity] }]}
        >
          <View
            style={[styles.rarityDot, { backgroundColor: RARITY_STRIPE[item.rarity] }]}
          />
          {owned || placed ? (
            <View style={styles.ownedBadge}>
              <Icon
                name="check"
                size={CHECK_MARK}
                color={UI_COLORS.textPrimary}
                strokeWidth={2.6}
              />
            </View>
          ) : isNew ? (
            <Ribbon tone="sun" label="New" clipRadius={RADII.xl} />
          ) : null}
          <Image
            source={habitatItemAsset(item.assetKey)}
            style={styles.art}
            resizeMode="contain"
            accessible={false}
          />
        </View>
        <View style={styles.tileFoot}>
          {/* A name that matters never ends in "…": it wraps whole, three
              lines at most ("Cocoa / Marshmallow Mug" needed three on a 375pt
              SE, and the old two-line limit cut it). It states the 2-up tile's
              ceiling, TILE_TYPE_CAP, at which the catalogue's longest word
              ("Cloudspotter’s") still fits half a 375pt phone — uncapped, five
              names broke mid-word at large text. (polish 2026-10-04) */}
          <T role="cardTitleSm" maxFontSizeMultiplier={TILE_TYPE_CAP}>
            {item.name}
          </T>
          {placed ? (
            <Tag
              tone="sage"
              icon="check"
              label="In room"
              maxFontSizeMultiplier={CHROME_TYPE_CAP}
              style={styles.stateTag}
            />
          ) : owned ? (
            <Tag
              tone="sage"
              label="Owned"
              maxFontSizeMultiplier={CHROME_TYPE_CAP}
              style={styles.stateTag}
            />
          ) : !item.isForSale || item.prestigeRank !== undefined ? (
            // A gift says so even when it can also be bought — the player
            // may rather wait for the rank.
            <Tag
              tone="muted"
              glyph="gift"
              label={giftLabel(item)}
              accessibilityLabel={itemEarnCopy(item)}
              maxFontSizeMultiplier={CHROME_TYPE_CAP}
              style={styles.stateTag}
            />
          ) : null}
          {/* One action, and only one that does something. A design already
              in the room offers none — "Place" on it re-placed it into its own
              spot (or quietly moved a chair to the other floor spot); its
              capsule says "In room" and the tile's tap still previews it. The
              action stands on the tile's floor (`marginTop: auto`), so a row's
              two buttons line up — on a gradient Button that style used to
              land inside the Pressable and never reach the layout. */}
          {!placed && (owned || item.isForSale) ? (
            <Button
              variant={owned ? "primary" : "gold"}
              size="sm"
              full
              style={styles.action}
              maxFontSizeMultiplier={CHROME_TYPE_CAP}
              accessibilityLabel={
                owned
                  ? `Place ${item.name} in my Barn`
                  : `Buy ${item.name} for ${item.snoutCost} Snouts`
              }
              accessibilityHint={
                owned
                  ? "Places this furnishing into an unsaved Barn draft."
                  : affordable
                    ? "Opens purchase confirmation. Placement and saving are separate."
                    : `Not enough Snouts yet. You need ${item.snoutCost - (h.data?.currentSnouts ?? 0)} more.`
              }
              accessibilityState={{ disabled: actionLocked }}
              disabled={actionLocked}
              onPress={() => (owned ? placeItem(item) : openItem(item))}
            >
              {/* The price is the action's face; a price you can't meet
                  wears the locked chrome rather than a second sentence. */}
              {owned ? "Place" : `Buy for ${item.snoutCost}`}
            </Button>
          ) : null}
        </View>
      </Sticker>
    );
  };
  // The scroll's children, flattened so each section header can be told to
  // stick: ScrollView only pins direct children.
  const stickyIndices: number[] = [];
  const scrollChildren: React.ReactNode[] = [];
  // The Wallow gifts section — and the filter chip below — are the keepsake
  // shelf now: since 2026-09-22 only the inscribed keepsakes carry a
  // `prestigeRank`, so `prestigeRewards` is exactly the keepsakes and the
  // "n of m" counts them. Decor is bought, never ranked.
  if (prestigeRewards.length > 0)
    scrollChildren.push(
      <Sticker
        key="wallow"
        color="sky"
        rotate={TILT.card}
        radius={RADII.md}
        shadow="sm"
        pad
        title="Wallow gifts"
        right={
          <Label tone="secondary">
            {`${prestigeRewards.filter((reward) => ownedIds.has(reward.id)).length} of ${prestigeRewards.length}`}
          </Label>
        }
        style={styles.progress}
      >
        <Body tone="secondary">
          Wallow ranks earn inscribed keepsakes for your shelf.
        </Body>
        {h.data?.wallowRank !== undefined || nextPrestigeReward ? (
          <Body tone="secondary">
            {[
              h.data?.wallowRank !== undefined
                ? `You're at Rank ${h.data.wallowRank}.`
                : null,
              nextPrestigeReward
                ? `Next: Rank ${nextPrestigeReward.prestigeRank} · ${nextPrestigeReward.name}`
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </Body>
        ) : null}
        {/* The toggle starts on the copy's left edge: a link is text that
            happens to be tappable, so it drops the pill padding it has no
            pill to fill (its 44pt frame stays). */}
        <Button
          variant="link"
          size="sm"
          style={styles.wallowToggle}
          accessibilityState={{ expanded: wallowExpanded }}
          accessibilityLabel={
            wallowExpanded ? "Hide Wallow gifts" : "See Wallow gifts"
          }
          accessibilityHint="Lists every Wallow rank gift and whether you own it"
          onPress={() => setWallowExpanded((expanded) => !expanded)}
        >
          {wallowExpanded ? "Hide Wallow gifts" : "See Wallow gifts"}
        </Button>
        {/* One row per gift: its name, and one capsule that says its rank
            and its state in the collection's own gift grammar — muted with
            the gift mark until it is yours, sage with the check after. The
            rows used to repeat "Unlocks at this rank" nine times and wrap an
            orphan "rank" (polish 2026-10-04, 068). Each row is one element
            to a screen reader, because the state is a colour and a mark. */}
        {wallowExpanded ? (
          <View style={styles.wallowList}>
            {prestigeRewards.map((reward) => {
              const mine = ownedIds.has(reward.id);
              return (
                <View
                  key={reward.id}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Rank ${reward.prestigeRank}, ${reward.name}, ${mine ? "yours" : "not yet yours"}`}
                  testID="wallow-gift-row"
                  style={styles.wallowRow}
                >
                  <Body style={styles.wallowName}>{reward.name}</Body>
                  <Tag
                    tone={mine ? "sage" : "muted"}
                    icon={mine ? "check" : undefined}
                    glyph={mine ? undefined : "gift"}
                    label={`Rank ${reward.prestigeRank}`}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </Sticker>,
    );
  scrollChildren.push(
    <TextField
      key="search"
      label="Search Barn furnishings"
      value={query}
      onChangeText={setQuery}
      placeholder={`Search ${h.data?.catalog.length ?? ""} designs`}
    />,
    <SegmentedControl
      key="ownership"
      label="Show which Barn furnishings"
      options={OWNERSHIP_OPTIONS}
      value={ownershipFilter}
      onChange={setOwnershipFilter}
    />,
    <ScrollView
      key="collections"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterRail}
      contentContainerStyle={styles.filters}
    >
      <Chip
        selected={collectionFilter === null}
        accessibilityLabel="Filter by all designs"
        accessibilityHint="Shows every design in the collection"
        onPress={() => setCollectionFilter(null)}
        label="All designs"
      />
      {prestigeRewards.length > 0 ? (
        <Chip
          accessibilityLabel="Filter by Wallow gifts"
          accessibilityHint="Shows only the inscribed keepsakes Wallow ranks award"
          selected={collectionFilter === "prestige"}
          onPress={() => setCollectionFilter("prestige")}
          label="Wallow gifts"
        />
      ) : null}
      {HABITAT_EXPANSION_COLLECTIONS.map((collection) => (
        <Chip
          key={collection.id}
          accessibilityLabel={`Filter by ${collection.name}`}
          accessibilityHint="Shows only the designs in this collection"
          selected={collectionFilter === collection.id}
          onPress={() => setCollectionFilter(collection.id)}
          label={collection.name}
        />
      ))}
    </ScrollView>,
  );
  if (scopedProgressError)
    scrollChildren.push(
      <Sticker
        key="progress-error"
        color={UI_COLORS.warningSurface}
        rotate={0}
        radius={RADII.md}
        shadow="sm"
        pad
        accessibilityLabel="Retry collection reward progress"
        accessibilityHint="Reloads how close each collection is to its bonus designs"
        onPress={() => void refreshProgress()}
      >
        <Body tone="secondary">Reward progress unavailable. Tap to retry.</Body>
      </Sticker>,
    );
  for (const [groupId, groupItems] of groupedItems) {
    const collectionProgress = scopedProgress.find(
      (collection) => collection.id === groupId,
    );
    const ownedInGroup = groupItems.filter((item) =>
      ownedIds.has(item.id),
    ).length;
    stickyIndices.push(scrollChildren.length);
    scrollChildren.push(
      <View
        key={`${groupId}-header`}
        style={styles.sectionPin}
        onLayout={(e) => setHeaderTops.current.set(groupId, e.nativeEvent.layout.y)}
      >
        <SectionHeader
          title={
            groupId === "classic" ? "Starter & classics" : collectionName(groupId)
          }
          right={`${ownedInGroup} of ${groupItems.length} owned`}
          style={styles.sectionHeader}
        />
        {/* The pinned header owns its bottom edge while tiles run under it. */}
        <ScrollEdge visible={pinnedSet === groupId} overlay="bottom" />
      </View>,
    );
    if (collectionProgress)
      scrollChildren.push(
        <View
          key={`${groupId}-progress`}
          accessibilityRole="summary"
          accessibilityLabel={`${collectionProgress.name} collection progress`}
          style={styles.progress}
        >
          <ProgressTrack
            tone="sage"
            height="sm"
            value={collectionProgress.ownedPaidCount}
            max={collectionProgress.paidCount}
          />
          {/* The count, once. The thresholds are the gift capsules under it
              — the line used to say "Bonus designs unlock automatically at 4
              and 8" right above two tags saying the same. */}
          <Hand tone="secondary">
            {`${collectionProgress.ownedPaidCount} of ${collectionProgress.paidCount} purchasable designs owned`}
          </Hand>
          <View style={styles.rewardRow}>
            {collectionProgress.rewards.map((reward) => (
              <Tag
                key={reward.itemId}
                tone={reward.earned ? "sage" : "muted"}
                icon={reward.earned ? "check" : undefined}
                glyph={reward.earned ? undefined : "gift"}
                label={`Gift at ${reward.threshold}`}
                accessibilityLabel={`Gift at ${reward.threshold} designs, ${reward.earned ? "earned" : "not yet"}`}
              />
            ))}
          </View>
        </View>,
      );
    chunk(groupItems, GRID_COLUMNS).forEach((row, rowIndex) =>
      scrollChildren.push(
        <View key={`${groupId}-row-${rowIndex}`} style={styles.row}>
          {row.map((item, column) =>
            renderTile(item, rowIndex * GRID_COLUMNS + column),
          )}
          {row.length < GRID_COLUMNS ? (
            <View style={styles.tileSpacer} pointerEvents="none" />
          ) : null}
        </View>,
      ),
    );
  }
  if (items.length === 0)
    scrollChildren.push(
      query.trim() ? (
        <EmptyState
          key="empty"
          glyph="search"
          title="Nothing matches that."
          sub="Try another word, or clear the filters."
        />
      ) : (
        <EmptyState
          key="empty"
          glyph={EMPTY_COPY[ownershipFilter].glyph}
          title={EMPTY_COPY[ownershipFilter].title}
          sub={EMPTY_COPY[ownershipFilter].sub}
        />
      ),
    );
  return (
    // The list runs to the screen's foot: the page pads top and sides only,
    // and the scroller ends on the one stack padding (a loose step plus the
    // home indicator) instead of the tab bar's TAB_SAFE — a stack screen has
    // no tab bar, and the two together clipped the grid 34pt above the edge
    // and left ~108pt of dead paper after the last set (004/007).
    <StackPage edges={STACK_SCROLL_EDGES}>
      <PageHeader
        kicker="always available"
        title="Barn Collection"
        onBack={
          onBack ??
          (() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/shop"))
        }
        right={
          h.data ? (
            // A picture of the balance, spoken with the word the coin stands
            // for (a labelled Sticker is one element).
            <Sticker
              color="sun"
              radius={RADII.md}
              rotate={BALANCE_TILT}
              accessibilityRole="text"
              accessibilityLabel={`${h.data.currentSnouts.toLocaleString()} Snouts available`}
              style={styles.balance}
            >
              <SnoutCoin size={BALANCE_COIN} />
              <Numeral>{h.data.currentSnouts.toLocaleString()}</Numeral>
            </Sticker>
          ) : undefined
        }
        below={
          position ? (
            <Body tone="secondary">
              {`Showing designs for ${HABITAT_POSITION_META[position].label}.`}
            </Body>
          ) : undefined
        }
      />
      {h.error ? (
        <Sticker
          color={UI_COLORS.warningSurface}
          rotate={0}
          radius={RADII.md}
          shadow="sm"
          pad
          accessibilityLabel="Retry Barn collection and pending purchase"
          accessibilityHint="Reconnects and confirms any interrupted purchase without charging twice."
          onPress={() => void Promise.all([h.refresh(), refreshProgress()])}
          style={styles.strip}
        >
          <Body tone="secondary">
            The collection could not reconnect. Tap to retry your pending
            change.
          </Body>
        </Sticker>
      ) : null}
      {h.loading ? (
        <LoadingBeat label="opening the collection" />
      ) : (
        <>
          {/* The crown's edge: shown while the head scrolls under it and no
              set header has pinned (a pinned header carries its own). */}
          <ScrollEdge visible={edge.edgeVisible && pinnedSet === null} />
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
            stickyHeaderIndices={stickyIndices}
            onScroll={edge.onScroll}
            scrollEventThrottle={edge.scrollEventThrottle}
          >
            {scrollChildren}
          </ScrollView>
        </>
      )}
      <HabitatItemPreviewModal
        item={previewAccountId === accountId ? previewItem : null}
        owned={Boolean(
          previewItem &&
          h.data?.owned.some((item) => item.id === previewItem.id),
        )}
        balance={h.data?.currentSnouts ?? 0}
        busy={purchasing || h.saving}
        error={purchaseError}
        canPurchase={!h.offline}
        onClose={closeItem}
        onBuy={() => void confirmPurchase()}
        acquisitionPaths={
          previewItem ? acquisitionPathsFor(previewItem) : undefined
        }
        wishlisted={Boolean(
          previewItem && journal.wishlist.includes(previewItem.id),
        )}
        wishlistBusy={wishlistBusy}
        onPlace={
          previewItem && ownedIds.has(previewItem.id)
            ? () => placeItem(previewItem)
            : undefined
        }
        onToggleWishlist={
          journal.supported && previewItem
            ? async () => {
                const itemId = previewItem.id;
                setWishlistBusy(true);
                await journal.setWishlisted(
                  itemId,
                  !journal.wishlist.includes(itemId),
                );
                setWishlistBusy(false);
              }
            : undefined
        }
        showRoomPreview={showRoomPreview}
        onToggleRoomPreview={() => setShowRoomPreview((current) => !current)}
        roomPreview={
          roomPreview ? <HabitatScene snapshot={roomPreview} /> : undefined
        }
      />
    </StackPage>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.cream,
  },
  scroll: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: SPACE.sm,
    gap: SPACE.md,
  },
  // The chip rail bleeds to the screen edge so the last chip can peek in from
  // the right — the cue that the row scrolls.
  filterRail: { marginHorizontal: -PAGE_PAD },
  filters: { gap: SPACE.sm, paddingHorizontal: PAGE_PAD },
  progress: { gap: SPACE.xs },
  rewardRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  wallowToggle: { alignSelf: "flex-start", paddingHorizontal: 0 },
  wallowList: { gap: SPACE.sm },
  wallowRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  // The name takes the row and wraps as a whole; the capsule never shrinks.
  wallowName: { flex: 1, minWidth: 0 },
  // Pinned headers paint the page's own cream, bled to the screen edge so a
  // tilted tile's corner never peeks out beside them as it slides under.
  // The pinned set header: the page's own cream, bled to the screen edge so a
  // tilted tile's corner never peeks out beside it as it slides under, and the
  // scroll edge's rule spans the phone.
  sectionPin: {
    backgroundColor: WHIMSY.cream,
    marginHorizontal: -PAGE_PAD,
    paddingHorizontal: PAGE_PAD,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xs,
  },
  // The header's own bottom margin goes: the scroll's gap already separates it
  // from the tiles, and a margin inside a pinned header is cream that pins
  // too (12pt of the ~270 the fixed chrome used to take).
  sectionHeader: { marginBottom: 0 },
  row: { flexDirection: "row", gap: SPACE.md },
  // No `overflow: hidden`: on iOS it clipped the sticker's own hard shadow, so
  // the tiles sat flat on the page. The well clips itself to the tile's top
  // corners instead, and the New ribbon clips itself (clipRadius).
  tile: { flex: 1 },
  tileSpacer: { flex: 1 },
  // A square well: aspectRatio is safe on a View, and the art inside gets
  // explicit insets rather than a percentage size (the Yoga-quirk cure).
  well: {
    aspectRatio: 1,
    borderBottomWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    overflow: "hidden",
  },
  art: {
    position: "absolute",
    top: SPACE.md,
    left: SPACE.md,
    right: SPACE.md,
    bottom: SPACE.md,
    width: undefined,
    height: undefined,
  },
  rarityDot: {
    position: "absolute",
    top: SPACE.sm,
    left: SPACE.sm,
    width: RARITY_DOT,
    height: RARITY_DOT,
    borderRadius: RADII.pill,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    zIndex: 2,
    ...SHADOW_SM,
  },
  ownedBadge: {
    position: "absolute",
    top: SPACE.sm,
    right: SPACE.sm,
    width: OWNED_BADGE,
    height: OWNED_BADGE,
    borderRadius: RADII.pill,
    backgroundColor: WHIMSY.sage,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    ...SHADOW_SM,
  },
  // The foot fills the tile so the action sits on the floor and a row's two
  // buttons line up whatever the names above them do. Its side inset matches
  // the rarity dot's above it (SPACE.sm), which is also what lets the longest
  // words — "Dreamcatcher", "Constellation" — keep a line to themselves at the
  // chrome ceiling on a 375pt phone.
  tileFoot: { flex: 1, padding: SPACE.sm, gap: SPACE.sm },
  stateTag: { alignSelf: "flex-start" },
  // The tile's one action stands on its floor (the Button now hands placement
  // keys like this to its Pressable, so `marginTop: auto` reaches the layout).
  action: { marginTop: "auto" },
  strip: { marginHorizontal: PAGE_PAD, marginBottom: SPACE.sm },
});
