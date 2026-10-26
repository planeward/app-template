import type { AppContext, AppTheme, PlanewardApp } from "@planeward/sdk";

export type PlanewardStatus = "connecting" | "ready" | "not-framed" | "error";

export type PlanewardState = {
  status: PlanewardStatus;
  error: string | null;
  context: AppContext | null;
  theme: AppTheme;
};

export type PlanewardEvent =
  | { type: "not-framed" }
  | { type: "ready"; context: AppContext }
  | { type: "error"; message: string }
  | { type: "theme"; theme: AppTheme };

export const NOT_FRAMED_ERROR =
  "Not running inside a Planeward community. Open this app from a community channel or dashboard.";

/** Also the server-render snapshot. */
export const INITIAL_PLANEWARD_STATE: PlanewardState = Object.freeze({
  status: "connecting",
  error: null,
  context: null,
  theme: "light",
});

export function reducePlanewardState(
  state: PlanewardState,
  event: PlanewardEvent
): PlanewardState {
  switch (event.type) {
    case "not-framed":
      return { ...state, status: "not-framed", error: NOT_FRAMED_ERROR };
    case "ready":
      return {
        status: "ready",
        error: null,
        context: event.context,
        theme: event.context.theme,
      };
    case "error":
      // A late failure never downgrades a connected app.
      if (state.status === "ready") return state;
      return { ...state, status: "error", error: event.message };
    case "theme":
      if (state.theme === event.theme) return state;
      return {
        ...state,
        theme: event.theme,
        context: state.context && { ...state.context, theme: event.theme },
      };
  }
}

export type PlanewardStoreDeps = {
  /** False when the page is not inside an iframe. */
  isFramed: () => boolean;
  createApp: () => PlanewardApp;
};

export type PlanewardStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => PlanewardState;
  getToken: () => Promise<string>;
};

/**
 * Owns at most one handshake for its lifetime. The handshake starts lazily on
 * the first `subscribe` or `getToken`, so creating the store never touches
 * `window` (SSR-safe) and a StrictMode re-subscribe reuses it.
 */
export function createPlanewardStore(deps: PlanewardStoreDeps): PlanewardStore {
  let state = INITIAL_PLANEWARD_STATE;
  let app: PlanewardApp | null = null;
  let started = false;
  const listeners = new Set<() => void>();

  function dispatch(event: PlanewardEvent) {
    const next = reducePlanewardState(state, event);
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  }

  function start() {
    if (started) return;
    started = true;
    if (!deps.isFramed()) {
      dispatch({ type: "not-framed" });
      return;
    }
    const current = deps.createApp();
    app = current;
    current.onThemeChange((theme) => dispatch({ type: "theme", theme }));
    current.ready.then(
      (context) => dispatch({ type: "ready", context }),
      (error: unknown) =>
        dispatch({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        })
    );
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    getToken() {
      start();
      if (!app) return Promise.reject(new Error(NOT_FRAMED_ERROR));
      return app.getToken();
    },
  };
}

/** `init` with `Authorization: Bearer <token>`, keeping every other header. */
export function withViewerToken(
  init: RequestInit | undefined,
  token: string
): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Viewer tokens are bearer credentials for this app's backend; only attach
 * them to same-origin requests.
 */
export function assertSameOrigin(input: string, origin: string): void {
  if (new URL(input, origin).origin !== origin) {
    throw new Error(
      "useViewerFetch only sends the viewer token to this app's own origin."
    );
  }
}
