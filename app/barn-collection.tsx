import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { POPUP_HANDOFF_GAP_MS } from "@/components/ui/PopupQueue";
import { showPurchaseToast } from "@/components/PurchaseToast";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Chip, Tag } from "@/components/ui/Chip";
import { EmptyState, LoadingBeat } from "@/components/ui/EmptyState";
import { Sticker } from "@/components/ui/Sticker";
import { TextField } from "@/components/ui/TextField";
import { Body, CardTitle, Label } from "@/components/ui/Text";
import { HabitatScene } from "@/components/habitat/HabitatScene";
import { HabitatItemPreviewModal } from "@/components/habitat/HabitatItemPreviewModal";
import { habitatAcquisitionPaths } from "@/components/habitat/HabitatInspectionSheet";
import { useHabitat, type HabitatBackend } from "@/hooks/useHabitat";
import {
  useHabitatJournal,
  type HabitatJournalBackend,
} from "@/hooks/useHabitatJournal";
import { useHabitatAccount } from "@/hooks/useHabitatAccount";
import { SafeAreaView } from "react-native-safe-area-context";
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
  RADII,
  ROW_TILTS,
  SPACE,
  TAB_SAFE,
  TILT,
  UI_COLORS,
  WHIMSY,
} from "@/constants/theme";

// The furnishing portrait on a collection card — a picture of the item, sized
// to the art rather than to the spacing scale. (2026-09-11)
const CARD_ART_H = 150;

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
  const [ownershipFilter, setOwnershipFilter] = useState<
    "all" | "owned" | "new" | "wishlist"
  >("all");
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
  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeader
        kicker="always available"
        title="Barn Collection"
        onBack={
          onBack ??
          (() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)/shop"))
        }
        below={
          <Body tone="secondary">
            {position
              ? `Showing designs for ${HABITAT_POSITION_META[position].label}. `
              : ""}
            {h.data ? `${h.data.currentSnouts} Snouts available.` : ""}
          </Body>
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
        <ScrollView contentContainerStyle={styles.grid}>
          {prestigeRewards.length > 0 ? (
            <Sticker
              color="sky"
              rotate={TILT.card}
              radius={RADII.md}
              shadow="sm"
              pad
              title="Wallow gifts"
              style={styles.progress}
            >
              <Body tone="secondary">
                {h.data?.wallowRank !== undefined
                  ? `Wallow Rank ${h.data.wallowRank} · `
                  : ""}
                {
                  prestigeRewards.filter((reward) =>
                    h.data?.owned.some((owned) => owned.id === reward.id),
                  ).length
                }
                {` of ${prestigeRewards.length} gifts owned.`}
              </Body>
              <Body tone="secondary">
                Wallow ranks unlock lasting Barn gifts automatically.
              </Body>
              {nextPrestigeReward ? (
                <Body tone="secondary">{`Next: Rank ${nextPrestigeReward.prestigeRank} · ${nextPrestigeReward.name}`}</Body>
              ) : null}
              <Button
                variant="link"
                size="sm"
                accessibilityState={{ expanded: wallowExpanded }}
                accessibilityLabel={
                  wallowExpanded ? "Hide Wallow gifts" : "See Wallow gifts"
                }
                accessibilityHint="Lists every Wallow rank gift and whether you own it"
                onPress={() => setWallowExpanded((expanded) => !expanded)}
              >
                {wallowExpanded ? "Hide Wallow gifts" : "See Wallow gifts"}
              </Button>
              {wallowExpanded
                ? prestigeRewards.map((reward) => (
                    <Label key={reward.id} tone="secondary">
                      {`Rank ${reward.prestigeRank} · ${reward.name} · ${ownedIds.has(reward.id) ? "Owned" : "Unlocks at this rank"}`}
                    </Label>
                  ))
                : null}
            </Sticker>
          ) : null}
          <TextField
            label="Search Barn furnishings"
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${h.data?.catalog.length ?? ""} designs`}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {(["all", "owned", "new", "wishlist"] as const).map((filter) => (
              <Chip
                key={filter}
                selected={ownershipFilter === filter}
                accessibilityLabel={`Show ${filter} Barn furnishings`}
                accessibilityHint="Filters the collection"
                onPress={() => setOwnershipFilter(filter)}
                label={
                  filter === "all"
                    ? "All"
                    : filter[0].toUpperCase() + filter.slice(1)
                }
              />
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
                accessibilityHint="Shows only the designs Wallow ranks award"
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
          </ScrollView>
          {scopedProgressError ? (
            <Sticker
              color={UI_COLORS.warningSurface}
              rotate={0}
              radius={RADII.md}
              shadow="sm"
              pad
              accessibilityLabel="Retry collection reward progress"
              accessibilityHint="Reloads how close each collection is to its bonus designs"
              onPress={() => void refreshProgress()}
              style={styles.strip}
            >
              <Body tone="secondary">
                Reward progress unavailable. Tap to retry.
              </Body>
            </Sticker>
          ) : null}
          {[...groupedItems.entries()].map(([groupId, groupItems]) => {
            const collectionProgress = scopedProgress.find(
              (collection) => collection.id === groupId,
            );
            return (
              <View key={groupId} style={styles.section}>
                <SectionHeader
                  title={
                    groupId === "classic"
                      ? "Starter & classic designs"
                      : (HABITAT_EXPANSION_COLLECTIONS.find(
                          (collection) => collection.id === groupId,
                        )?.name ?? groupId)
                  }
                />
                {collectionProgress ? (
                  <Sticker
                    color="sky"
                    rotate={TILT.card}
                    radius={RADII.md}
                    shadow="sm"
                    pad
                    accessibilityRole="summary"
                    accessibilityLabel={`${collectionProgress.name} collection progress`}
                    style={styles.progress}
                  >
                    <Body tone="secondary">
                      {collectionProgress.ownedPaidCount} of{" "}
                      {collectionProgress.paidCount} purchasable designs owned.
                      Bonus designs unlock automatically at 4 and 8.
                    </Body>
                    <Label tone="secondary">
                      {collectionProgress.rewards
                        .map(
                          (reward) =>
                            `${reward.threshold}: ${reward.earned ? "earned" : "not earned"}`,
                        )
                        .join(" · ")}
                    </Label>
                  </Sticker>
                ) : null}
                {groupId !== "classic" && !collectionFilter && !query.trim() ? (
                  <Button
                    variant="ghost"
                    full
                    accessibilityLabel={`View ${groupItems.length} designs in ${HABITAT_EXPANSION_COLLECTIONS.find((collection) => collection.id === groupId)?.name ?? groupId}`}
                    accessibilityHint="Filters the collection down to this set"
                    onPress={() => setCollectionFilter(groupId)}
                  >
                    {`View ${groupItems.length} designs`}
                  </Button>
                ) : (
                  groupItems.map((item, index) => {
                    const owned = ownedIds.has(item.id);
                    const affordable =
                      (h.data?.currentSnouts ?? 0) >= item.snoutCost;
                    return (
                      <Sticker
                        key={item.id}
                        color="paper"
                        rotate={ROW_TILTS[index % ROW_TILTS.length]}
                        pad
                        style={styles.card}
                      >
                        <Image
                          source={habitatItemAsset(item.assetKey)}
                          style={styles.image}
                          resizeMode="contain"
                          accessible
                          accessibilityLabel={item.description}
                        />
                        <CardTitle>{item.name}</CardTitle>
                        {journal.newItemIds.has(item.id) ? (
                          <Tag label="New" tone="sun" style={styles.newBadge} />
                        ) : null}
                        <Body tone="secondary">{item.description}</Body>
                        <Label tone="secondary">
                          {item.rarity} ·{" "}
                          {item.isForSale
                            ? `${item.snoutCost} Snouts`
                            : itemEarnCopy(item)}
                        </Label>
                        {item.prestigeRank !== undefined ? (
                          <Label tone="secondary">
                            {`Free gift at Wallow Rank ${item.prestigeRank}. Yours to keep.`}
                          </Label>
                        ) : null}
                        {owned ? (
                          <Label tone="secondary">
                            {acquisitionPathsFor(item).find((path) =>
                              path.startsWith("Yours ·"),
                            ) ?? "Yours"}
                          </Label>
                        ) : null}
                        <Button
                          variant="link"
                          size="sm"
                          accessibilityLabel={`Preview ${item.name} in your room`}
                          accessibilityHint="Shows a temporary preview. Your saved room stays the same."
                          onPress={() => openItem(item, true)}
                        >
                          Preview in room
                        </Button>
                        <Button
                          variant="gold"
                          full
                          accessibilityLabel={
                            owned
                              ? `Place ${item.name} in my Barn`
                              : item.isForSale
                                ? `Buy ${item.name} for ${item.snoutCost} Snouts`
                                : `${item.name}, earned reward`
                          }
                          accessibilityHint={
                            owned
                              ? "Places this furnishing into an unsaved Barn draft."
                              : item.isForSale
                                ? "Opens purchase confirmation. Placement and saving are separate."
                                : itemEarnCopy(item)
                          }
                          accessibilityState={{
                            disabled:
                              !owned &&
                              (!item.active ||
                                !item.isForSale ||
                                !affordable ||
                                h.saving),
                          }}
                          disabled={
                            !owned &&
                            (!item.active ||
                              !item.isForSale ||
                              !affordable ||
                              h.saving)
                          }
                          onPress={() =>
                            owned ? placeItem(item) : openItem(item)
                          }
                          style={styles.buy}
                        >
                          {owned
                            ? "Place"
                            : !item.isForSale
                              ? "Earned reward"
                              : affordable
                                ? `Buy for ${item.snoutCost}`
                                : "Not enough Snouts"}
                        </Button>
                      </Sticker>
                    );
                  })
                )}
              </View>
            );
          })}
          {items.length === 0 ? (
            <EmptyState
              glyph="pigface"
              title="Nothing matches that."
              sub="Try another word, or clear the filters."
            />
          ) : null}
        </ScrollView>
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
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHIMSY.cream,
  },
  root: { flex: 1, backgroundColor: WHIMSY.cream },
  grid: { padding: SPACE.md, paddingBottom: TAB_SAFE, gap: SPACE.md },
  filters: { gap: SPACE.sm, paddingVertical: SPACE.sm },
  progress: { gap: SPACE.xs },
  section: { gap: SPACE.md },
  card: { gap: SPACE.xs },
  image: {
    width: "100%",
    height: CARD_ART_H,
    backgroundColor: WHIMSY.cream,
    borderRadius: RADII.sm,
  },
  newBadge: { alignSelf: "flex-start" },
  buy: { marginTop: SPACE.sm },
  strip: { marginHorizontal: SPACE.md, marginBottom: SPACE.sm },
});
