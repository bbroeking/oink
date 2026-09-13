import { router } from "expo-router";
import { supabase } from "@/utils/supabase";

/** The visit's native modal must dismiss before opening the viewer's collection. */
export function openOwnHabitatCollection(itemId: string, viewerId: string, dismiss: () => void) {
  let cancelled = false;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== viewerId) cancelled = true;
  });
  dismiss();
  setTimeout(() => {
    void supabase.auth.getUser().then(({ data: auth }) => {
      if (!cancelled && auth.user?.id === viewerId)
        router.push({ pathname: "/barn-collection", params: { itemId } });
    }).catch(() => {}).finally(() => data.subscription.unsubscribe());
  }, 350);
}
