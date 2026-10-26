import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, posts } from "@/db";
import { jsonError } from "@/lib/api";
import { requireViewer } from "@/lib/planeward";

const createPostSchema = z.object({
  body: z.string().trim().min(1, "Write something first.").max(500),
});

/** Latest posts in the viewer's channel, scoped by verified claims only. */
export async function GET(request: Request) {
  const auth = await requireViewer(request);
  if (!auth.ok) return auth.response;
  const { viewer } = auth;

  if (!viewer.channelId) {
    return jsonError(400, "The board is only available in a channel.");
  }

  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.installationId, viewer.installationId),
        eq(posts.channelId, viewer.channelId)
      )
    )
    .orderBy(desc(posts.createdAt))
    .limit(50);

  return Response.json({ data: rows });
}

export async function POST(request: Request) {
  const auth = await requireViewer(request);
  if (!auth.ok) return auth.response;
  const { viewer } = auth;

  if (!viewer.channelId) {
    return jsonError(400, "The board is only available in a channel.");
  }

  const parsed = createPostSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid post.");
  }

  // Installation, channel and author come from the verified token, never the body.
  const [post] = await db
    .insert(posts)
    .values({
      installationId: viewer.installationId,
      channelId: viewer.channelId,
      authorId: viewer.sub,
      authorName: viewer.name,
      body: parsed.data.body,
    })
    .returning();

  return Response.json({ data: post }, { status: 201 });
}
