import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

export type Installation = typeof installations.$inferSelect;
export type NewInstallation = typeof installations.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
