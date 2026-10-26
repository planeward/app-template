import { eq, sql } from "drizzle-orm";

import { createPlanewardServer } from "@repo/planeward/server";

import { db, installations, webhookDeliveries } from "@/db";

export { planewardForViewer } from "@repo/planeward/server";

/** `requireViewer` and `handlePlanewardWebhook`, backed by this app's database. */
export const { requireViewer, handlePlanewardWebhook } = createPlanewardServer({
  async isUninstalled(installationId) {
    const [installation] = await db
      .select({ uninstalledAt: installations.uninstalledAt })
      .from(installations)
      .where(eq(installations.id, installationId))
      .limit(1);
    return Boolean(installation?.uninstalledAt);
  },
  async claimDelivery(delivery) {
    const inserted = await db
      .insert(webhookDeliveries)
      .values(delivery)
      .onConflictDoNothing()
      .returning({ deliveryId: webhookDeliveries.deliveryId });
    return inserted.length > 0;
  },
  async releaseDelivery(deliveryId) {
    await db
      .delete(webhookDeliveries)
      .where(eq(webhookDeliveries.deliveryId, deliveryId));
  },
  async updateInstallation(installationId, apply) {
    await db.transaction(async (tx) => {
      // Serializes concurrent deliveries for one installation, including
      // the first ones, when there is no row yet to lock FOR UPDATE.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${installationId}, 0))`
      );
      const [existing] = await tx
        .select()
        .from(installations)
        .where(eq(installations.id, installationId))
        .limit(1);
      const { id, ...next } = apply(existing ?? null);
      await tx
        .insert(installations)
        .values({ id, ...next })
        .onConflictDoUpdate({ target: installations.id, set: next });
    });
  },
});
