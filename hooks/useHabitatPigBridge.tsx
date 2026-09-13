import type { ReactNode } from "react";
import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { supabase } from "@/utils/supabase";

type BridgeState = {
  controllers: number;
  consumers: number;
  presentation: ReactNode | null;
  version: number;
};

const EMPTY: BridgeState = {
  controllers: 0,
  consumers: 0,
  presentation: null,
  version: 0,
};
const states = new Map<string, BridgeState>();
const listeners = new Map<string, Set<() => void>>();

function read(accountId: string | null): BridgeState {
  return accountId ? (states.get(accountId) ?? EMPTY) : EMPTY;
}
function update(accountId: string, change: (state: BridgeState) => BridgeState) {
  const next = change(read(accountId));
  if (!next.controllers && !next.consumers && next.presentation == null)
    states.delete(accountId);
  else states.set(accountId, next);
  listeners.get(accountId)?.forEach((listener) => listener());
}
function subscribe(accountId: string | null, listener: () => void) {
  if (!accountId) return () => {};
  const bucket = listeners.get(accountId) ?? new Set();
  bucket.add(listener);
  listeners.set(accountId, bucket);
  return () => {
    bucket.delete(listener);
    if (!bucket.size) listeners.delete(accountId);
  };
}

export function registerHabitatPigController(accountId: string) {
  update(accountId, (state) => ({
    ...state,
    controllers: state.controllers + 1,
    version: state.version + 1,
  }));
  return () =>
    update(accountId, (state) => ({
      ...state,
      controllers: Math.max(0, state.controllers - 1),
      presentation: state.controllers <= 1 ? null : state.presentation,
      version: state.version + 1,
    }));
}
export function publishHabitatPigPresentation(
  accountId: string,
  presentation: ReactNode,
) {
  update(accountId, (state) => ({
    ...state,
    presentation,
    version: state.version + 1,
  }));
}
export function registerHabitatPigConsumer(accountId: string) {
  update(accountId, (state) => ({
    ...state,
    consumers: state.consumers + 1,
    version: state.version + 1,
  }));
  return () =>
    update(accountId, (state) => ({
      ...state,
      consumers: Math.max(0, state.consumers - 1),
      version: state.version + 1,
    }));
}
export function habitatPigBridgeSnapshot(accountId: string) {
  return read(accountId);
}
export function resetHabitatPigBridgeForTests() {
  states.clear();
  listeners.clear();
}

function useHabitatBridgeAccount() {
  const [state, setState] = useState<{
    accountId: string | null;
    loaded: boolean;
  }>({ accountId: null, loaded: false });
  useEffect(() => {
    let current = true;
    let authRevision = 0;
    const sessionRevision = authRevision;
    void supabase.auth.getSession().then(({ data }) => {
      if (current && authRevision === sessionRevision)
        setState({ accountId: data.session?.user.id ?? null, loaded: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision++;
      if (current)
        setState({ accountId: session?.user.id ?? null, loaded: true });
    });
    return () => {
      current = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}

export function useHomeHabitatPigPublisher(
  presentation: ReactNode,
  enabled = true,
) {
  const { accountId } = useHabitatBridgeAccount();
  useLayoutEffect(() => {
    if (!accountId || !enabled) return;
    return registerHabitatPigController(accountId);
  }, [accountId, enabled]);
  useLayoutEffect(() => {
    if (accountId && enabled)
      publishHabitatPigPresentation(accountId, presentation);
  }, [accountId, enabled, presentation]);
  return useSyncExternalStore(
    (listener) => subscribe(accountId, listener),
    () => Boolean(enabled && read(accountId).consumers > 0),
    () => false,
  );
}

export function useHabitatPigConsumer() {
  const account = useHabitatBridgeAccount();
  useEffect(() => {
    if (!account.accountId) return;
    return registerHabitatPigConsumer(account.accountId);
  }, [account.accountId]);
  const state = useSyncExternalStore(
    (listener) => subscribe(account.accountId, listener),
    () => read(account.accountId),
    () => EMPTY,
  );
  return { ...account, ...state };
}
