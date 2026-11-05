import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PlanewardApiError,
  type AppWebhookEnvelope,
  type CommunityBadge,
  type CommunityMemberBadge,
  type CommunityMessageCreatedData,
} from "@planeward/sdk/server";

import {
  awardFirstPostBadge,
  FIRST_POST_BADGE,
  type BadgeApi,
  type FirstPostRecord,
  type FirstPostStore,
} from "./first-post-badge";

const NOW = "2026-11-05T10:00:00.000Z";

function createFakeStore() {
  const rows = new Map<string, FirstPostRecord>();
  const store: FirstPostStore = {
    async recordFirstPost({ installationId, memberId, messageId }) {
      const key = `${installationId}:${memberId}`;
      const existing = rows.get(key);
      if (existing) return { ...existing };
      const row = { messageId, badgeAwardedAt: null };
      rows.set(key, row);
      return { ...row };
    },
    async markBadgeAwarded(installationId, memberId) {
      const row = rows.get(`${installationId}:${memberId}`);
      if (row) row.badgeAwardedAt = new Date(NOW);
    },
  };
  return { store, rows };
}

function createFakeApi({ failAward = 0, missingScope = false } = {}) {
  const calls = { upserts: 0, awards: [] as string[] };
  let awardFailures = failAward;
  const badge: CommunityBadge = {
    id: "badge_1",
    appId: "app_1",
    key: FIRST_POST_BADGE.key,
    name: FIRST_POST_BADGE.name,
    description: FIRST_POST_BADGE.description ?? "",
    color: FIRST_POST_BADGE.color,
    iconUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const api: BadgeApi = {
    community: {
      badges: {
        async upsert(input) {
          calls.upserts += 1;
          if (missingScope) {
            throw new PlanewardApiError(
              403,
              "Missing scope",
              "COMMUNITY_BADGES_WRITE"
            );
          }
          assert.equal(input.key, "first-post");
          return { data: badge };
        },
      },
      members: {
        badges: {
          async award(memberId, badgeId) {
            if (awardFailures > 0) {
              awardFailures -= 1;
              throw new PlanewardApiError(503, "Unavailable");
            }
            calls.awards.push(`${memberId}:${badgeId}`);
            const awarded: CommunityMemberBadge = {
              ...badge,
              awardedAt: NOW,
            };
            return { data: awarded };
          },
        },
      },
    },
  };
  return { api, calls };
}

function messageCreated(
  data: Partial<CommunityMessageCreatedData> = {}
): AppWebhookEnvelope<"community.message.created"> {
  return {
    event: "community.message.created",
    data: {
      id: "msg_1",
      communityId: "com_1",
      channelId: "chan_1",
      replyToId: null,
      authorKind: "member",
      memberId: "cm_1",
      appInstallationId: null,
      authorName: "Ada",
      body: "Hello!",
      createdAt: NOW,
      ...data,
    },
    timestamp: NOW,
    installationId: "inst_1",
    workspaceId: "ws_1",
  };
}

describe("awardFirstPostBadge", () => {
  it("awards the badge on a member's first message, once", async () => {
    const fake = createFakeStore();
    const { api, calls } = createFakeApi();
    const deps = { store: fake.store, planeward: () => api };

    await awardFirstPostBadge(messageCreated(), deps);
    await awardFirstPostBadge(messageCreated({ id: "msg_2" }), deps);
    // Same message redelivered under a new delivery id.
    await awardFirstPostBadge(messageCreated(), deps);

    assert.deepEqual(calls.awards, ["cm_1:badge_1"]);
    assert.equal(calls.upserts, 1);
    assert.deepEqual(
      fake.rows.get("inst_1:cm_1")?.badgeAwardedAt,
      new Date(NOW)
    );
  });

  it("tracks first posts per installation and member", async () => {
    const fake = createFakeStore();
    const { api, calls } = createFakeApi();
    const deps = { store: fake.store, planeward: () => api };

    await awardFirstPostBadge(messageCreated(), deps);
    await awardFirstPostBadge(
      messageCreated({ id: "msg_2", memberId: "cm_2" }),
      deps
    );
    await awardFirstPostBadge(
      { ...messageCreated({ id: "msg_3" }), installationId: "inst_2" },
      deps
    );

    assert.deepEqual(calls.awards, [
      "cm_1:badge_1",
      "cm_2:badge_1",
      "cm_1:badge_1",
    ]);
  });

  it("ignores staff and app messages and other events", async () => {
    const fake = createFakeStore();
    const { api, calls } = createFakeApi();
    const deps = { store: fake.store, planeward: () => api };

    await awardFirstPostBadge(
      messageCreated({ authorKind: "staff", memberId: null }),
      deps
    );
    await awardFirstPostBadge(
      messageCreated({
        authorKind: "app",
        memberId: null,
        appInstallationId: "inst_1",
      }),
      deps
    );
    await awardFirstPostBadge(
      {
        event: "community.message.deleted",
        data: {
          id: "msg_1",
          communityId: "com_1",
          channelId: "chan_1",
          memberId: "cm_1",
          timestamp: NOW,
        },
        timestamp: NOW,
        installationId: "inst_1",
        workspaceId: "ws_1",
      },
      deps
    );

    assert.equal(fake.rows.size, 0);
    assert.equal(calls.upserts, 0);
  });

  it("throws on an API failure and finishes the award on retry", async () => {
    const fake = createFakeStore();
    const { api, calls } = createFakeApi({ failAward: 1 });
    const deps = { store: fake.store, planeward: () => api };

    await assert.rejects(awardFirstPostBadge(messageCreated(), deps), {
      status: 503,
    });
    assert.equal(fake.rows.get("inst_1:cm_1")?.badgeAwardedAt, null);

    await awardFirstPostBadge(messageCreated(), deps);
    assert.deepEqual(calls.awards, ["cm_1:badge_1"]);
    assert.notEqual(fake.rows.get("inst_1:cm_1")?.badgeAwardedAt, null);
  });

  it("does not throw (no retry) when the scope was not granted", async () => {
    const fake = createFakeStore();
    const { api, calls } = createFakeApi({ missingScope: true });
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      await awardFirstPostBadge(messageCreated(), {
        store: fake.store,
        planeward: () => api,
      });
    } finally {
      console.warn = warn;
    }
    assert.equal(calls.awards.length, 0);
  });
});
