import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  PLANEWARD_DELIVERY_HEADER,
  PLANEWARD_SIGNATURE_HEADER,
  type AppWebhookEnvelope,
} from "@planeward/sdk/server";

import {
  applyInstalled,
  applyUninstalled,
  processPlanewardWebhook,
  type HandlePlanewardWebhookOptions,
  type InstallationRecord,
  type WebhookStore,
} from "./webhook";

const SECRET = "whsec_test";

function createFakeStore() {
  const deliveries = new Map<string, { event: string }>();
  const rows = new Map<string, InstallationRecord>();
  const store: WebhookStore = {
    async claimDelivery({ deliveryId, event }) {
      if (deliveries.has(deliveryId)) return false;
      deliveries.set(deliveryId, { event });
      return true;
    },
    async releaseDelivery(deliveryId) {
      deliveries.delete(deliveryId);
    },
    async updateInstallation(id, apply) {
      rows.set(id, apply(rows.get(id) ?? null));
    },
  };
  return { store, deliveries, rows };
}

const installed = (installedAt = "2026-10-01T10:00:00.000Z") => ({
  event: "app.installed",
  data: {
    installationId: "inst_1",
    workspaceId: "ws_1",
    workspaceName: "Harbor",
    grantedPermissions: ["COMMUNITY_MEMBERS_READ"],
    installedAt,
  },
  timestamp: installedAt,
  installationId: "inst_1",
  workspaceId: "ws_1",
});

const uninstalled = (uninstalledAt = "2026-10-02T10:00:00.000Z") => ({
  event: "app.uninstalled",
  data: { installationId: "inst_1", workspaceId: "ws_1", uninstalledAt },
  timestamp: uninstalledAt,
  installationId: "inst_1",
  workspaceId: "ws_1",
});

function webhookRequest(
  body: unknown,
  {
    deliveryId = "dlv_1",
    secret = SECRET,
    signature,
  }: { deliveryId?: string | null; secret?: string; signature?: string } = {}
) {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  headers.set(
    PLANEWARD_SIGNATURE_HEADER,
    signature ??
      `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`
  );
  if (deliveryId) headers.set(PLANEWARD_DELIVERY_HEADER, deliveryId);
  return new Request("http://app.test/api/webhooks/planeward", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function send(
  store: WebhookStore,
  request: Request,
  options: HandlePlanewardWebhookOptions = {}
) {
  return processPlanewardWebhook(request, options, { secret: SECRET, store });
}

describe("processPlanewardWebhook", () => {
  it("401s a bad signature without touching the store or handler", async () => {
    const fake = createFakeStore();
    let called = false;
    const onEvent = async () => {
      called = true;
    };
    for (const request of [
      webhookRequest(installed(), { secret: "wrong" }),
      webhookRequest(installed(), { signature: "sha256=00" }),
      webhookRequest(installed(), { signature: "" }),
    ]) {
      const response = await send(fake.store, request, { onEvent });
      assert.equal(response.status, 401);
    }
    assert.equal(fake.deliveries.size, 0);
    assert.equal(fake.rows.size, 0);
    assert.equal(called, false);
  });

  it("401s a body changed after signing", async () => {
    const fake = createFakeStore();
    const good = webhookRequest(installed());
    const tampered = new Request(good.url, {
      method: "POST",
      headers: good.headers,
      body: JSON.stringify({
        ...installed(),
        data: { ...installed().data, workspaceName: "Evil" },
      }),
    });
    assert.equal((await send(fake.store, tampered)).status, 401);
  });

  it("400s a signed delivery without the delivery header", async () => {
    const fake = createFakeStore();
    const response = await send(
      fake.store,
      webhookRequest(installed(), { deliveryId: null })
    );
    assert.equal(response.status, 400);
    assert.equal(fake.deliveries.size, 0);
  });

  it("400s signed but malformed payloads before claiming the delivery", async () => {
    const fake = createFakeStore();
    for (const body of [
      "not json",
      { event: "app.installed" },
      { ...installed(), data: { installationId: "inst_1" } },
      // data must match the envelope it is signed with
      { ...installed(), installationId: "inst_other" },
    ]) {
      const response = await send(fake.store, webhookRequest(body));
      assert.equal(response.status, 400);
    }
    assert.equal(fake.deliveries.size, 0);
    assert.equal(fake.rows.size, 0);
  });

  it("204s the first delivery, upserts the installation, then calls onEvent", async () => {
    const fake = createFakeStore();
    const seen: AppWebhookEnvelope[] = [];
    const response = await send(fake.store, webhookRequest(installed()), {
      onEvent: async (envelope) => {
        // Persistence runs before the app's handler.
        assert.ok(fake.rows.has("inst_1"));
        seen.push(envelope);
      },
    });
    assert.equal(response.status, 204);
    assert.deepEqual(fake.rows.get("inst_1"), {
      id: "inst_1",
      workspaceId: "ws_1",
      workspaceName: "Harbor",
      grantedPermissions: ["COMMUNITY_MEMBERS_READ"],
      installedAt: new Date("2026-10-01T10:00:00.000Z"),
      uninstalledAt: null,
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.event, "app.installed");
    assert.ok(fake.deliveries.has("dlv_1"));
  });

  it("200s a duplicate delivery without re-running the handler", async () => {
    const fake = createFakeStore();
    let calls = 0;
    const onEvent = async () => {
      calls += 1;
    };
    await send(fake.store, webhookRequest(installed()), { onEvent });
    const response = await send(fake.store, webhookRequest(installed()), {
      onEvent,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { duplicate: true });
    assert.equal(calls, 1);
  });

  it("sets uninstalledAt on app.uninstalled", async () => {
    const fake = createFakeStore();
    await send(fake.store, webhookRequest(installed()));
    const response = await send(
      fake.store,
      webhookRequest(uninstalled(), { deliveryId: "dlv_2" })
    );
    assert.equal(response.status, 204);
    assert.deepEqual(
      fake.rows.get("inst_1")?.uninstalledAt,
      new Date("2026-10-02T10:00:00.000Z")
    );
  });

  it("does not resurrect: app.installed delivered after app.uninstalled", async () => {
    const fake = createFakeStore();
    assert.equal(
      (
        await send(
          fake.store,
          webhookRequest(uninstalled(), { deliveryId: "dlv_2" })
        )
      ).status,
      204
    );
    assert.equal(
      (
        await send(
          fake.store,
          webhookRequest(installed(), { deliveryId: "dlv_1" })
        )
      ).status,
      204
    );
    const row = fake.rows.get("inst_1");
    assert.deepEqual(row?.uninstalledAt, new Date("2026-10-02T10:00:00.000Z"));
    // The late install still fills in the real details.
    assert.equal(row?.workspaceName, "Harbor");
    assert.deepEqual(row?.installedAt, new Date("2026-10-01T10:00:00.000Z"));
  });

  it("does not resurrect: replayed app.installed under a new delivery id", async () => {
    const fake = createFakeStore();
    await send(fake.store, webhookRequest(installed(), { deliveryId: "a" }));
    await send(fake.store, webhookRequest(uninstalled(), { deliveryId: "b" }));
    await send(fake.store, webhookRequest(installed(), { deliveryId: "c" }));
    assert.notEqual(fake.rows.get("inst_1")?.uninstalledAt, null);
  });

  it("releases the delivery and 500s when onEvent throws, so the retry runs", async () => {
    const fake = createFakeStore();
    let attempts = 0;
    const onEvent = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("boom");
    };
    const first = await send(fake.store, webhookRequest(installed()), {
      onEvent,
    });
    assert.equal(first.status, 500);
    assert.deepEqual(await first.json(), { error: "Webhook handling failed" });
    assert.equal(fake.deliveries.has("dlv_1"), false);

    const retry = await send(fake.store, webhookRequest(installed()), {
      onEvent,
    });
    assert.equal(retry.status, 204);
    assert.equal(attempts, 2);
  });

  it("releases the delivery and 500s when persistence throws", async () => {
    const fake = createFakeStore();
    const store: WebhookStore = {
      ...fake.store,
      updateInstallation: async () => {
        throw new Error("db down");
      },
    };
    const response = await send(store, webhookRequest(installed()));
    assert.equal(response.status, 500);
    assert.equal(fake.deliveries.size, 0);
  });

  it("claims and dispatches events it does not persist", async () => {
    const fake = createFakeStore();
    const seen: string[] = [];
    const response = await send(
      fake.store,
      webhookRequest({
        event: "community.membership.created",
        data: { id: "cm_1" },
        timestamp: "2026-10-01T10:00:00.000Z",
        installationId: "inst_1",
        workspaceId: "ws_1",
      }),
      { onEvent: async (envelope) => void seen.push(envelope.event) }
    );
    assert.equal(response.status, 204);
    assert.deepEqual(seen, ["community.membership.created"]);
    assert.equal(fake.rows.size, 0);
  });
});

describe("installation merge rules", () => {
  const base: InstallationRecord = {
    id: "inst_1",
    workspaceId: "ws_1",
    workspaceName: "Harbor",
    grantedPermissions: [],
    installedAt: new Date("2026-10-01T10:00:00.000Z"),
    uninstalledAt: null,
  };

  it("an install newer than the stored uninstall clears it", () => {
    const next = applyInstalled(
      { ...base, uninstalledAt: new Date("2026-10-01T09:00:00.000Z") },
      installed("2026-10-01T10:00:00.000Z").data
    );
    assert.equal(next.uninstalledAt, null);
  });

  it("an install older than the stored one keeps the stored details", () => {
    const next = applyInstalled(
      { ...base, workspaceName: "Harbor Studio", grantedPermissions: ["A"] },
      { ...installed("2026-10-01T09:00:00.000Z").data, workspaceName: "Old" }
    );
    assert.equal(next.workspaceName, "Harbor Studio");
    assert.deepEqual(next.grantedPermissions, ["A"]);
    assert.deepEqual(next.installedAt, base.installedAt);
  });

  it("a late install fills in the uninstall-first placeholder", () => {
    const placeholder = applyUninstalled(
      null,
      uninstalled("2026-10-02T10:00:00.000Z").data
    );
    const next = applyInstalled(placeholder, installed().data);
    assert.notEqual(next.workspaceName, "");
    assert.deepEqual(next.uninstalledAt, placeholder.uninstalledAt);
  });

  it("an uninstall never moves uninstalledAt backwards", () => {
    const later = new Date("2026-10-03T00:00:00.000Z");
    const next = applyUninstalled(
      { ...base, uninstalledAt: later },
      uninstalled("2026-10-02T00:00:00.000Z").data
    );
    assert.deepEqual(next.uninstalledAt, later);
  });
});
