import { z } from "zod";

import { PlanewardApiError } from "@planeward/sdk/server";

import { jsonError } from "@/lib/api";
import { planewardForViewer, requireViewer } from "@/lib/planeward";

const announceSchema = z.object({
  channelId: z.string().trim().min(1, "Enter a channel id."),
  body: z.string().trim().min(1, "Write a message.").max(4000),
});

/** Staff only: post a message as the app (COMMUNITY_MESSAGES_WRITE). */
export async function POST(request: Request) {
  const auth = await requireViewer(request, { role: "admin" });
  if (!auth.ok) return auth.response;

  const parsed = announceSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid message."
    );
  }

  try {
    const message = await planewardForViewer(
      auth.viewer
    ).community.messages.create(parsed.data.channelId, {
      body: parsed.data.body,
    });
    return Response.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof PlanewardApiError) {
      return jsonError(error.status, error.message);
    }
    throw error;
  }
}
