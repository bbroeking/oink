import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/utils/supabase";
import {
  fetchFriendHabitat,
  fetchMyHabitat,
  type HabitatCatalogItem,
  type HabitatPlacedItem,
  type HabitatSnapshot,
} from "@/utils/habitat";
import { trackInteraction } from "@/utils/interactionAnalytics";
import { useHabitatAccount } from "@/hooks/useHabitatAccount";
import { useHabitatJournal } from "@/hooks/useHabitatJournal";
import { HabitatScene, type HabitatSceneAnchor } from "./HabitatScene";
import { HabitatDoorTransition } from "./HabitatDoorTransition";
import { HabitatInspectionSheet } from "./HabitatInspectionSheet";
import { Body, LoadingBeat } from "@/components/ui";
import { SPACE, WHIMSY } from "@/constants/theme";

/** Authorizes every opening/foreground refresh; never caches a friend's room. */
export function HabitatFriendRoom({
  ownerId,
  hostPig,
  visitorPig,
  onUnavailable,
  leaving = false,
  onLeft,
  onOpenCollection,
  anchor = "center",
  overlay,
}: {
  ownerId: string;
  hostPig: ReactNode;
  visitorPig: ReactNode;
  onUnavailable: () => void;
  leaving?: boolean;
  onLeft?: () => void;
  onOpenCollection?: (itemId: string) => void;
  /** Alignment of the room's artwork within its viewport. */
  anchor?: HabitatSceneAnchor;
  /** Visit controls float over the room, below its modal inspection sheet. */
  overlay?: ReactNode;
}) {
  const { id: visitorAccountId } = useHabitatAccount();
  const journal = useHabitatJournal(visitorAccountId);
  const [snapshot, setSnapshot] = useState<HabitatSnapshot | null>(null);
  const [inspectedItem, setInspectedItem] = useState<HabitatPlacedItem | null>(null);
  const [catalogItem, setCatalogItem] = useState<HabitatCatalogItem | null>(null);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const inspectionGeneration = useRef(0);
  const visitorAccount = useRef(visitorAccountId);
  visitorAccount.current = visitorAccountId;
  const exit = useRef(onUnavailable);
  useEffect(() => {
    exit.current = onUnavailable;
  }, [onUnavailable]);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    // Clear render authorization while rechecking: stale friendship never displays.
    setSnapshot(null);
    setInspectedItem(null);
    setCatalogItem(null);
    try {
      const result = await fetchFriendHabitat(ownerId);
      if (request !== generation.current) return;
      // Bind the authorization response to the requested owner. This is both a
      // stale-request guard and defense against a malformed/misrouted RPC
      // response: a room may only render for the owner this opening requested.
      if (!result.ok || result.ownerId !== ownerId) {
        setSnapshot(null);
        exit.current();
        return;
      }
      setSnapshot(result);
      void trackInteraction({ eventName: "habitat_opened", surface: "visit" });
    } catch {
      if (request === generation.current) exit.current();
    }
  }, [ownerId]);
  useEffect(() => {
    void refresh();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
      else {
        ++generation.current;
        ++inspectionGeneration.current;
        setSnapshot(null);
        setInspectedItem(null);
        setCatalogItem(null);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        ++generation.current;
        ++inspectionGeneration.current;
        setSnapshot(null);
        setInspectedItem(null);
        setCatalogItem(null);
        exit.current();
      }
    });
    return () => {
      ++generation.current;
      ++inspectionGeneration.current;
      app.remove();
      data.subscription.unsubscribe();
    };
  }, [refresh]);
  useEffect(() => {
    ++inspectionGeneration.current;
    setInspectedItem(null);
    setCatalogItem(null);
  }, [ownerId, visitorAccountId]);
  useEffect(() => {
    if (leaving && !snapshot) onLeft?.();
  }, [leaving, onLeft, snapshot]);
  // Effects run after render, so an owner prop can change one render before the
  // refresh effect clears state. Never let that frame show the previous room.
  const authorizedSnapshot = snapshot?.ownerId === ownerId ? snapshot : null;
  if (!authorizedSnapshot)
    return (
      <View style={styles.root}>
        <View style={styles.loading}>
          <LoadingBeat label="opening the barn" />
          <Body>Opening your friend’s Barn…</Body>
        </View>
        {overlay}
      </View>
    );
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View
        style={styles.root}
        accessibilityElementsHidden={!!inspectedItem}
        importantForAccessibility={inspectedItem ? "no-hide-descendants" : "auto"}
      >
        <HabitatDoorTransition
          direction={leaving ? "exit" : "enter"}
          onClosed={onLeft}
        >
          <View style={styles.room}>
            <HabitatScene
              snapshot={authorizedSnapshot}
              anchor={anchor}
              hostPig={hostPig}
              visitorPig={visitorPig}
              onInspect={(item) => {
                const request = ++inspectionGeneration.current;
                setInspectedItem(item);
                setCatalogItem(null);
                void fetchMyHabitat().then((result) => {
                  if (request !== inspectionGeneration.current || !result.ok) return;
                  setCatalogItem(result.catalog.find((entry) => entry.id === item.id) ?? null);
                }).catch(() => {});
              }}
            />
          </View>
        </HabitatDoorTransition>
        {overlay}
      </View>
      <HabitatInspectionSheet
        item={inspectedItem}
        catalogItem={catalogItem}
        wishlisted={Boolean(inspectedItem && journal.wishlist.includes(inspectedItem.id))}
        wishlistBusy={wishlistBusy}
        onClose={() => {
          ++inspectionGeneration.current;
          setInspectedItem(null);
          setCatalogItem(null);
        }}
        onToggleWishlist={journal.supported && inspectedItem ? async () => {
          const itemId = inspectedItem.id;
          setWishlistBusy(true);
          await journal.setWishlisted(itemId, !journal.wishlist.includes(itemId));
          setWishlistBusy(false);
        } : undefined}
        onFindInCollection={inspectedItem ? () => {
          const itemId = inspectedItem.id;
          const request = ++inspectionGeneration.current;
          const account = visitorAccountId;
          setInspectedItem(null);
          setCatalogItem(null);
          if (onOpenCollection) onOpenCollection(itemId);
          else setTimeout(() => {
            if (inspectionGeneration.current === request && visitorAccount.current === account)
              router.push({ pathname: "/barn-collection", params: { itemId } });
          }, 0);
        } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHIMSY.cream },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", padding: SPACE.lg, gap: SPACE.sm },
  room: { flex: 1 },
});
