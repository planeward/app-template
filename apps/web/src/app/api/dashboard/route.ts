import { desc, eq } from "drizzle-orm";

import { db, installations, webhookDeliveries } from "@/db";
import { requireViewer } from "@/lib/planeward";

/** Staff only: this installation's record and its recent webhook deliveries. */
export async function GET(request: Request) {
  const auth = await requireViewer(request, { role: "admin" });
  if (!auth.ok) return auth.response;
  const { installationId } = auth.viewer;

  const [[installation], deliveries] = await Promise.all([
    db
      .select()
      .from(installations)
      .where(eq(installations.id, installationId))
      .limit(1),
    db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.installationId, installationId))
      .orderBy(desc(webhookDeliveries.receivedAt))
      .limit(20),
  ]);

  return Response.json({
    data: { installation: installation ?? null, deliveries },
  });
}
