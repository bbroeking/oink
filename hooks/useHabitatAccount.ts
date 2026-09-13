import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

/** Auth changes invalidate the route before any old-account state can be used. */
export function useHabitatAccount() {
  const [identity, setIdentity] = useState<{
    id: string | null;
    loaded: boolean;
  }>({ id: null, loaded: false });
  useEffect(() => {
    let live = true;
    let changed = false;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (live) setIdentity({ id: session?.user.id ?? null, loaded: true });
    });
    void supabase.auth
      .getSession()
      .then(({ data: sessionData }) => {
        if (live && !changed)
          setIdentity({
            id: sessionData.session?.user.id ?? null,
            loaded: true,
          });
      })
      .catch(() => {
        if (live && !changed) setIdentity({ id: null, loaded: true });
      });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return identity;
}
