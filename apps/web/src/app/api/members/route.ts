import { PlanewardApiError } from "@planeward/sdk/server";

import { jsonError } from "@/lib/api";
import { planewardForViewer, requireViewer } from "@/lib/planeward";

/** Staff only: community members via the Planeward API (COMMUNITY_MEMBERS_READ). */
export async function GET(request: Request) {
  const auth = await requireViewer(request, { role: "admin" });
  if (!auth.ok) return auth.response;

  try {
    const members = await planewardForViewer(
      auth.viewer
    ).community.members.list({ limit: 50 });
    return Response.json(members);
  } catch (error) {
    if (error instanceof PlanewardApiError) {
      return jsonError(error.status, error.message);
    }
    throw error;
  }
}
