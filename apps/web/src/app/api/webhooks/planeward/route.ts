import { handlePlanewardWebhook } from "@/lib/planeward";

/**
 * Signed webhooks from Planeward. The handler verifies the signature, dedupes
 * on `x-planeward-delivery`, and stores `app.installed` / `app.uninstalled`.
 */
export function POST(request: Request) {
  return handlePlanewardWebhook(request);
}

// React to other events with `onEvent`, e.g. membership changes (sent only to
// installations granted COMMUNITY_MEMBERS_READ):
//
// export function POST(request: Request) {
//   return handlePlanewardWebhook(request, {
//     async onEvent(envelope) {
//       if (envelope.event.startsWith("community.membership.")) {
//         // envelope.installationId, envelope.data …
//       }
//     },
//   });
// }
