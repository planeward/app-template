"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  createPlanewardApp,
  type AppContext,
  type AppTheme,
} from "@planeward/sdk";

import {
  assertSameOrigin,
  createPlanewardStore,
  INITIAL_PLANEWARD_STATE,
  withViewerToken,
  type PlanewardStatus,
  type PlanewardStore,
} from "./store";

export type { PlanewardStatus } from "./store";

// One handshake per page lifetime: module scope survives StrictMode's double
// mount and Provider remounts. Created lazily so the server never builds one.
let browserStore: PlanewardStore | null = null;

function getBrowserStore(): PlanewardStore {
  browserStore ??= createPlanewardStore({
    isFramed: () => window.parent !== window,
    createApp: () => createPlanewardApp(),
  });
  return browserStore;
}

const getServerSnapshot = () => INITIAL_PLANEWARD_STATE;

const PlanewardStoreContext = createContext<PlanewardStore | null>(null);

export function PlanewardProvider({ children }: { children: ReactNode }) {
  const store = typeof window === "undefined" ? null : getBrowserStore();
  return (
    <PlanewardStoreContext.Provider value={store}>
      {children}
    </PlanewardStoreContext.Provider>
  );
}

const noopSubscribe = () => () => undefined;
const rejectOnServer = () =>
  Promise.reject(new Error("Viewer tokens are only available in the browser."));

export function usePlaneward(): {
  status: PlanewardStatus;
  error: string | null;
  context: AppContext | null;
  theme: AppTheme;
  getToken: () => Promise<string>;
} {
  const store = useContext(PlanewardStoreContext);
  const state = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? getServerSnapshot,
    getServerSnapshot
  );
  return {
    status: state.status,
    error: state.error,
    context: state.context,
    theme: state.theme,
    getToken: store?.getToken ?? rejectOnServer,
  };
}

/**
 * `fetch` for this app's own API with `Authorization: Bearer <viewer token>`.
 * Other headers in `init` are kept. Cross-origin URLs are refused so the
 * token never leaves the app's backend.
 */
export function useViewerFetch(): (
  input: string,
  init?: RequestInit
) => Promise<Response> {
  const { getToken } = usePlaneward();
  return useCallback(
    async (input: string, init?: RequestInit) => {
      assertSameOrigin(input, window.location.origin);
      const token = await getToken();
      return fetch(input, withViewerToken(init, token));
    },
    [getToken]
  );
}

/** Mirrors the host theme onto `<html data-theme>` and `color-scheme`. */
export function PlanewardThemeSync(): null {
  const { theme } = usePlaneward();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }, [theme]);
  return null;
}
