import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AppContext, AppTheme, PlanewardApp } from "@planeward/sdk";

import {
  assertSameOrigin,
  createPlanewardStore,
  INITIAL_PLANEWARD_STATE,
  NOT_FRAMED_ERROR,
  reducePlanewardState,
  withViewerToken,
} from "./store";

const context: AppContext = {
  view: "experience",
  channelId: "chan_1",
  theme: "dark",
};

function createFakeApp() {
  let resolveReady!: (context: AppContext) => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<AppContext>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  ready.catch(() => undefined);
  const themeListeners = new Set<(theme: AppTheme) => void>();
  const app: PlanewardApp = {
    ready,
    context: null,
    getToken: async () => "token-1",
    onThemeChange(callback) {
      themeListeners.add(callback);
      return () => themeListeners.delete(callback);
    },
    destroy: () => undefined,
  };
  const emitTheme = (theme: AppTheme) => {
    for (const listener of themeListeners) listener(theme);
  };
  return { app, resolveReady, rejectReady, emitTheme };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("reducePlanewardState", () => {
  it("starts connecting with the light theme", () => {
    assert.equal(INITIAL_PLANEWARD_STATE.status, "connecting");
    assert.equal(INITIAL_PLANEWARD_STATE.theme, "light");
    assert.equal(INITIAL_PLANEWARD_STATE.context, null);
  });

  it("takes the theme from the context once ready", () => {
    const state = reducePlanewardState(INITIAL_PLANEWARD_STATE, {
      type: "ready",
      context,
    });
    assert.equal(state.status, "ready");
    assert.equal(state.theme, "dark");
    assert.deepEqual(state.context, context);
  });

  it("keeps context.theme in step with theme changes", () => {
    const ready = reducePlanewardState(INITIAL_PLANEWARD_STATE, {
      type: "ready",
      context,
    });
    const next = reducePlanewardState(ready, { type: "theme", theme: "light" });
    assert.equal(next.theme, "light");
    assert.equal(next.context?.theme, "light");
    assert.equal(
      reducePlanewardState(next, { type: "theme", theme: "light" }),
      next
    );
  });

  it("does not let a late error downgrade a ready app", () => {
    const ready = reducePlanewardState(INITIAL_PLANEWARD_STATE, {
      type: "ready",
      context,
    });
    assert.equal(
      reducePlanewardState(ready, { type: "error", message: "x" }),
      ready
    );
  });
});

describe("createPlanewardStore", () => {
  it("is not-framed without creating a handshake", async () => {
    let created = 0;
    const store = createPlanewardStore({
      isFramed: () => false,
      createApp: () => {
        created += 1;
        return createFakeApp().app;
      },
    });
    store.subscribe(() => undefined);
    assert.equal(store.getSnapshot().status, "not-framed");
    assert.equal(store.getSnapshot().error, NOT_FRAMED_ERROR);
    await assert.rejects(store.getToken(), { message: NOT_FRAMED_ERROR });
    assert.equal(created, 0);
  });

  it("creates one handshake across repeated subscribes (StrictMode)", async () => {
    let created = 0;
    const fake = createFakeApp();
    const store = createPlanewardStore({
      isFramed: () => true,
      createApp: () => {
        created += 1;
        return fake.app;
      },
    });
    const unsubscribe = store.subscribe(() => undefined);
    unsubscribe();
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    assert.equal(created, 1);
    assert.equal(store.getSnapshot().status, "connecting");

    fake.resolveReady(context);
    await flush();
    assert.equal(store.getSnapshot().status, "ready");
    assert.equal(store.getSnapshot().theme, "dark");
    assert.equal(notified, 1);

    fake.emitTheme("light");
    assert.equal(store.getSnapshot().theme, "light");
    assert.equal(notified, 2);
    assert.equal(await store.getToken(), "token-1");
  });

  it("reports handshake failures as error", async () => {
    const fake = createFakeApp();
    const store = createPlanewardStore({
      isFramed: () => true,
      createApp: () => fake.app,
    });
    store.subscribe(() => undefined);
    fake.rejectReady(new Error("no host"));
    await flush();
    assert.equal(store.getSnapshot().status, "error");
    assert.equal(store.getSnapshot().error, "no host");
  });

  it("keeps a stable snapshot between changes", () => {
    const store = createPlanewardStore({
      isFramed: () => true,
      createApp: () => createFakeApp().app,
    });
    store.subscribe(() => undefined);
    assert.equal(store.getSnapshot(), store.getSnapshot());
  });
});

describe("viewer fetch helpers", () => {
  it("adds the bearer token without dropping other headers", () => {
    const init = withViewerToken(
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Trace": "1" },
        body: "{}",
      },
      "tok"
    );
    const headers = new Headers(init.headers);
    assert.equal(headers.get("authorization"), "Bearer tok");
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("x-trace"), "1");
    assert.equal(init.method, "POST");
    assert.equal(init.body, "{}");
  });

  it("works without init and replaces a caller-supplied Authorization", () => {
    assert.equal(
      new Headers(withViewerToken(undefined, "tok").headers).get(
        "authorization"
      ),
      "Bearer tok"
    );
    assert.equal(
      new Headers(
        withViewerToken({ headers: [["Authorization", "Basic x"]] }, "tok")
          .headers
      ).get("authorization"),
      "Bearer tok"
    );
  });

  it("only allows same-origin URLs", () => {
    const origin = "https://app.example";
    assert.doesNotThrow(() => assertSameOrigin("/api/posts", origin));
    assert.doesNotThrow(() =>
      assertSameOrigin("https://app.example/api/posts", origin)
    );
    assert.throws(() => assertSameOrigin("https://evil.example/x", origin));
    assert.throws(() => assertSameOrigin("//evil.example/x", origin));
  });
});
