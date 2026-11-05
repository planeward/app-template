import { and, eq } from "drizzle-orm";

import { db, firstPosts } from "@/db";

import type { FirstPostStore } from "./first-post-badge";

/** `FirstPostStore` backed by the `first_posts` table. */
export const firstPostStore: FirstPostStore = {
  async recordFirstPost(post) {
    await db.insert(firstPosts).values(post).onConflictDoNothing();
    const [row] = await db
      .select({
        messageId: firstPosts.messageId,
        badgeAwardedAt: firstPosts.badgeAwardedAt,
      })
      .from(firstPosts)
      .where(
        and(
          eq(firstPosts.installationId, post.installationId),
          eq(firstPosts.memberId, post.memberId)
        )
      )
      .limit(1);
    if (!row) throw new Error("first_posts row missing after insert");
    return row;
  },
  async markBadgeAwarded(installationId, memberId) {
    await db
      .update(firstPosts)
      .set({ badgeAwardedAt: new Date() })
      .where(
        and(
          eq(firstPosts.installationId, installationId),
          eq(firstPosts.memberId, memberId)
        )
      );
  },
};
