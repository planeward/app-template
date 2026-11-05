import { awardFirstPostBadge } from "@/lib/first-post-badge";
import { firstPostStore } from "@/lib/first-posts";
import {
  handlePlanewardWebhook,
  planewardForInstallation,
} from "@/lib/planeward";

/**
 * Signed webhooks from Planeward. The handler verifies the signature, dedupes
 * on `x-planeward-delivery`, and stores `app.installed` / `app.uninstalled`,
 * then runs `onEvent`. Throwing from `onEvent` releases the delivery so
 * Planeward's retry runs it again.
 *
 * Example: award a "First post" badge on a member's first message
 * (`community.message.created`, needs COMMUNITY_MESSAGES_READ and
 * COMMUNITY_BADGES_WRITE). `envelope.event` narrows `envelope.data`, so add
 * cases for other events, e.g. `community.membership.granted`.
 */
export function POST(request: Request) {
  return handlePlanewardWebhook(request, {
    onEvent: (envelope) =>
      awardFirstPostBadge(envelope, {
        store: firstPostStore,
        planeward: planewardForInstallation,
      }),
  });
}
