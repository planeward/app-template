import { z } from "zod";

import {
  parsePlanewardWebhook,
  PLANEWARD_DELIVERY_HEADER,
  PLANEWARD_SIGNATURE_HEADER,
  verifyPlanewardWebhook,
  type AppWebhookEnvelope,
} from "@planeward/sdk/server";

import { jsonError } from "./viewer";

export type InstallationRecord = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  grantedPermissions: string[];
  installedAt: Date;
  uninstalledAt: Date | null;
};

/** Storage the webhook handler needs. The app backs it with its database. */
export type WebhookStore = {
  /** Insert the delivery row; false when it already exists (a retry we've handled). */
  claimDelivery: (delivery: {
    deliveryId: string;
    event: string;
    installationId: string;
  }) => Promise<boolean>;
  /** Delete the delivery row so Planeward's retry is processed again. */
  releaseDelivery: (deliveryId: string) => Promise<void>;
  /**
   * Read-modify-write one installation row atomically (serialized per id).
   * `apply` receives the stored row, or null, and returns the row to store.
   */
  updateInstallation: (
    installationId: string,
    apply: (existing: InstallationRecord | null) => InstallationRecord
  ) => Promise<void>;
};

export type HandlePlanewardWebhookOptions = {
  /** Runs after the built-in persistence. Throwing makes Planeward retry. */
  onEvent?: (envelope: AppWebhookEnvelope) => Promise<void>;
};

export type WebhookDeps = {
  secret: string;
  store: WebhookStore;
};

/** Planeward webhook bodies are small; refuse anything larger before reading it. */
export const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;

const isoDate = z.iso.datetime({ offset: true });

const installedData = z.object({
  installationId: z.string().min(1),
  workspaceId: z.string().min(1),
  workspaceName: z.string(),
  grantedPermissions: z.array(z.string()),
  installedAt: isoDate,
});

const uninstalledData = z.object({
  installationId: z.string().min(1),
  workspaceId: z.string().min(1),
  uninstalledAt: isoDate,
});

export type AppInstalledData = z.infer<typeof installedData>;
export type AppUninstalledData = z.infer<typeof uninstalledData>;

/**
 * Next row for `app.installed`. A stored uninstall at or after this install
 * wins, so a late or replayed `app.installed` never resurrects an uninstalled
 * installation, and an install older than the stored one never overwrites its
 * details. The uninstall-first placeholder (`workspaceName: ""`) is always
 * filled in.
 */
export function applyInstalled(
  existing: InstallationRecord | null,
  data: AppInstalledData
): InstallationRecord {
  const installedAt = new Date(data.installedAt);
  const uninstalledAt =
    existing?.uninstalledAt && existing.uninstalledAt >= installedAt
      ? existing.uninstalledAt
      : null;
  const stale =
    existing !== null &&
    existing.workspaceName !== "" &&
    existing.installedAt > installedAt;
  if (stale) {
    return { ...existing, uninstalledAt };
  }
  return {
    id: data.installationId,
    workspaceId: data.workspaceId,
    workspaceName: data.workspaceName,
    grantedPermissions: data.grantedPermissions,
    installedAt,
    uninstalledAt,
  };
}

/**
 * Next row for `app.uninstalled`. With no row yet (uninstall delivered before
 * install) it stores a tombstone so the later `app.installed` stays uninstalled.
 */
export function applyUninstalled(
  existing: InstallationRecord | null,
  data: AppUninstalledData
): InstallationRecord {
  const uninstalledAt = new Date(data.uninstalledAt);
  if (!existing) {
    return {
      id: data.installationId,
      workspaceId: data.workspaceId,
      workspaceName: "",
      grantedPermissions: [],
      // Placeholder until `app.installed` arrives with the real time.
      installedAt: uninstalledAt,
      uninstalledAt,
    };
  }
  return {
    ...existing,
    uninstalledAt:
      existing.uninstalledAt && existing.uninstalledAt > uninstalledAt
        ? existing.uninstalledAt
        : uninstalledAt,
  };
}

type Persist = (store: WebhookStore) => Promise<void>;

/** Validate built-in event data up front; null means "malformed". */
function planPersistence(envelope: AppWebhookEnvelope): Persist | null {
  const matchesEnvelope = (data: {
    installationId: string;
    workspaceId: string;
  }) =>
    data.installationId === envelope.installationId &&
    data.workspaceId === envelope.workspaceId;

  switch (envelope.event) {
    case "app.installed": {
      const parsed = installedData.safeParse(envelope.data);
      if (!parsed.success || !matchesEnvelope(parsed.data)) return null;
      return (store) =>
        store.updateInstallation(parsed.data.installationId, (existing) =>
          applyInstalled(existing, parsed.data)
        );
    }
    case "app.uninstalled": {
      const parsed = uninstalledData.safeParse(envelope.data);
      if (!parsed.success || !matchesEnvelope(parsed.data)) return null;
      return (store) =>
        store.updateInstallation(parsed.data.installationId, (existing) =>
          applyUninstalled(existing, parsed.data)
        );
    }
    default:
      return async () => undefined;
  }
}

/**
 * Verify, dedupe, persist and dispatch one Planeward webhook delivery.
 * Nothing in the body is trusted until the HMAC over the raw bytes checks out.
 */
export async function processPlanewardWebhook(
  request: Request,
  options: HandlePlanewardWebhookOptions,
  deps: WebhookDeps
): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    return jsonError(413, "Payload too large");
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return jsonError(413, "Payload too large");
  }

  const signatureValid = await verifyPlanewardWebhook({
    rawBody,
    signature: request.headers.get(PLANEWARD_SIGNATURE_HEADER),
    secret: deps.secret,
  });
  if (!signatureValid) return jsonError(401, "Invalid signature");

  // Signed from here on.
  const deliveryId = request.headers.get(PLANEWARD_DELIVERY_HEADER)?.trim();
  if (!deliveryId) {
    return jsonError(400, `Missing ${PLANEWARD_DELIVERY_HEADER} header`);
  }

  let envelope: AppWebhookEnvelope;
  try {
    envelope = parsePlanewardWebhook(rawBody);
  } catch {
    return jsonError(400, "Invalid webhook payload");
  }

  const persist = planPersistence(envelope);
  if (!persist) return jsonError(400, `Invalid ${envelope.event} payload`);

  const claimed = await deps.store.claimDelivery({
    deliveryId,
    event: envelope.event,
    installationId: envelope.installationId,
  });
  if (!claimed) {
    return Response.json({ duplicate: true }, { status: 200 });
  }

  try {
    await persist(deps.store);
    await options.onEvent?.(envelope);
  } catch (error) {
    console.error(
      `[planeward] webhook ${envelope.event} (${deliveryId}) failed:`,
      error
    );
    try {
      await deps.store.releaseDelivery(deliveryId);
    } catch (releaseError) {
      console.error(
        `[planeward] could not release delivery ${deliveryId}; its retry will be skipped:`,
        releaseError
      );
    }
    return jsonError(500, "Webhook handling failed");
  }

  return new Response(null, { status: 204 });
}
