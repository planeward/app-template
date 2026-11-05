import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** One row per Planeward installation, keyed by installationId. */
export const installations = pgTable("installations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  workspaceName: text("workspace_name").notNull(),
  grantedPermissions: text("granted_permissions").array().notNull().default([]),
  installedAt: timestamp("installed_at", { withTimezone: true }).notNull(),
  uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
});

/** Webhook delivery log; the primary key dedupes `x-planeward-delivery`. */
export const webhookDeliveries = pgTable("webhook_deliveries", {
  deliveryId: text("delivery_id").primaryKey(),
  event: text("event").notNull(),
  installationId: text("installation_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Example feature. Always scope queries by installationId + channelId from verified claims. */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installationId: text("installation_id").notNull(),
    channelId: text("channel_id").notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("posts_installation_channel_created_idx").on(
      table.installationId,
      table.channelId,
      table.createdAt
    ),
  ]
);

/**
 * Badge example: each member's first community message per installation, from
 * `community.message.created`. `badgeAwardedAt` is set once the "First post"
 * badge is awarded, so a retried delivery finishes the award without
 * re-running it.
 */
export const firstPosts = pgTable(
  "first_posts",
  {
    installationId: text("installation_id").notNull(),
    memberId: text("member_id").notNull(),
    messageId: text("message_id").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    badgeAwardedAt: timestamp("badge_awarded_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.installationId, table.memberId] })]
);

export type Installation = typeof installations.$inferSelect;
export type NewInstallation = typeof installations.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type FirstPost = typeof firstPosts.$inferSelect;
