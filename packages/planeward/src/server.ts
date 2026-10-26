import {
  createPlanewardClient,
  type PlanewardClient,
} from "@planeward/sdk/server";

import { env } from "./env";
import {
  authenticateViewer,
  unauthorized,
  type RequireViewerOptions,
  type RequireViewerResult,
  type Viewer,
} from "./viewer";
import {
  processPlanewardWebhook,
  type HandlePlanewardWebhookOptions,
  type WebhookStore,
} from "./webhook";

export type { PlanewardClient } from "@planeward/sdk/server";
export type {
  RequireViewerOptions,
  RequireViewerResult,
  Viewer,
} from "./viewer";
export type {
  HandlePlanewardWebhookOptions,
  InstallationRecord,
  WebhookStore,
} from "./webhook";

/**
 * Planeward API client acting on the viewer's installation. The installation
 * id comes from the verified token only, never from request input.
 */
export function planewardForViewer(viewer: Viewer): PlanewardClient {
  return createPlanewardClient({
    secret: env.PLANEWARD_APP_SECRET,
    installationId: viewer.installationId,
    baseUrl: env.PLANEWARD_BASE_URL,
  });
}

/** Storage the server helpers need. Each app backs it with its own database. */
export type PlanewardServerStore = WebhookStore & {
  /** True once an `app.uninstalled` has been recorded for the installation. */
  isUninstalled: (installationId: string) => Promise<boolean>;
};

/**
 * Binds `requireViewer` and `handlePlanewardWebhook` to the app's storage.
 * Call it once per app (see `apps/web/src/lib/planeward.ts`).
 */
export function createPlanewardServer(store: PlanewardServerStore) {
  return {
    /**
     * Verify `Authorization: Bearer <viewer token>` against this deployment's
     * `PLANEWARD_APP_ID`. Returns the verified viewer, or a ready-made JSON
     * `Response` (401 missing/invalid token or uninstalled installation, 403
     * when `role: "admin"` is required).
     */
    async requireViewer(
      request: Request,
      options: RequireViewerOptions = {}
    ): Promise<RequireViewerResult> {
      const result = await authenticateViewer(request, options, {
        appId: env.PLANEWARD_APP_ID,
        baseUrl: env.PLANEWARD_BASE_URL,
      });
      if (!result.ok) {
        return result;
      }
      // Viewer tokens live 5 minutes; a recorded `app.uninstalled` cuts them
      // off right away. Installs we never heard about (no webhook yet) stay
      // allowed.
      if (await store.isUninstalled(result.viewer.installationId)) {
        return {
          ok: false,
          response: unauthorized(
            "This app was uninstalled from the community."
          ),
        };
      }
      return result;
    },

    /**
     * Route handler body for `POST /api/webhooks/planeward`:
     * - 401 bad signature, 400 missing `x-planeward-delivery` or bad payload;
     * - 200 `{ duplicate: true }` for a delivery already handled;
     * - persists `app.installed` / `app.uninstalled`, then calls `onEvent`; 204;
     * - 500 if either throws (the delivery is released so the retry runs again).
     */
    handlePlanewardWebhook(
      request: Request,
      options: HandlePlanewardWebhookOptions = {}
    ): Promise<Response> {
      return processPlanewardWebhook(request, options, {
        secret: env.PLANEWARD_WEBHOOK_SECRET,
        store,
      });
    },
  };
}
