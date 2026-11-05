import {
  PlanewardApiError,
  type AppWebhookEnvelope,
  type CommunityBadgeWrite,
  type PlanewardClient,
} from "@planeward/sdk/server";

export const FIRST_POST_BADGE: CommunityBadgeWrite = {
  key: "first-post",
  name: "First post",
  color: "#f59e0b",
  description: "Posted their first message in the community.",
};

export type FirstPostRecord = {
  messageId: string;
  badgeAwardedAt: Date | null;
};

/** Storage for the example. The app backs it with its own database. */
export type FirstPostStore = {
  /**
   * Record `messageId` as the member's first post unless one is already
   * recorded, then return the stored row (this message's, or the earlier one).
   */
  recordFirstPost: (post: {
    installationId: string;
    memberId: string;
    messageId: string;
    postedAt: Date;
  }) => Promise<FirstPostRecord>;
  markBadgeAwarded: (installationId: string, memberId: string) => Promise<void>;
};

/** The two API calls the example needs (`COMMUNITY_BADGES_WRITE`). */
export type BadgeApi = {
  community: {
    badges: Pick<PlanewardClient["community"]["badges"], "upsert">;
    members: {
      badges: Pick<PlanewardClient["community"]["members"]["badges"], "award">;
    };
  };
};

export type FirstPostBadgeDeps = {
  store: FirstPostStore;
  /** Client for the webhook's (signed) installation. */
  planeward: (installationId: string) => BadgeApi;
};

/**
 * `onEvent` handler: award the "First post" badge on a member's first message.
 * Needs `COMMUNITY_MESSAGES_READ` (to receive `community.message.created`) and
 * `COMMUNITY_BADGES_WRITE`. Retry-safe: the delivery is deduped upstream, the
 * badge upsert and award are idempotent, and `badgeAwardedAt` is only set
 * after the award succeeds, so a failed attempt is finished on retry.
 */
export async function awardFirstPostBadge(
  envelope: AppWebhookEnvelope,
  { store, planeward }: FirstPostBadgeDeps
): Promise<void> {
  if (envelope.event !== "community.message.created") return;
  const { data } = envelope;
  if (data.authorKind !== "member" || !data.memberId) return;

  const { installationId } = envelope;
  const memberId = data.memberId;
  const first = await store.recordFirstPost({
    installationId,
    memberId,
    messageId: data.id,
    postedAt: new Date(data.createdAt),
  });
  // Not this member's first message, or already awarded.
  if (first.messageId !== data.id || first.badgeAwardedAt) return;

  const pw = planeward(installationId);
  try {
    const { data: badge } = await pw.community.badges.upsert(FIRST_POST_BADGE);
    await pw.community.members.badges.award(memberId, badge.id);
  } catch (error) {
    if (error instanceof PlanewardApiError && error.missingScope) {
      // A retry can't fix a missing scope; don't make Planeward retry.
      console.warn(
        `[first-post] installation ${installationId} did not grant ${error.missingScope}; skipping the badge.`
      );
      return;
    }
    throw error;
  }
  await store.markBadgeAwarded(installationId, memberId);
}
