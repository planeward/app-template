import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import { installations, posts, webhookDeliveries } from "./schema";

function columnNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table)
    .columns.map((column) => column.name)
    .sort();
}

function primaryKeyColumns(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table)
    .columns.filter((column) => column.primary)
    .map((column) => column.name);
}

describe("installations", () => {
  const config = getTableConfig(installations);

  it("uses snake_case names", () => {
    assert.equal(config.name, "installations");
    assert.deepEqual(columnNames(installations), [
      "granted_permissions",
      "id",
      "installed_at",
      "uninstalled_at",
      "workspace_id",
      "workspace_name",
    ]);
  });

  it("is keyed by installation id", () => {
    assert.deepEqual(primaryKeyColumns(installations), ["id"]);
  });

  it("defaults grantedPermissions to an empty text array", () => {
    const column = config.columns.find((c) => c.name === "granted_permissions");
    assert.ok(column);
    assert.equal(column.getSQLType(), "text[]");
    assert.equal(column.notNull, true);
    assert.equal(column.hasDefault, true);
    assert.deepEqual(column.default, []);
  });

  it("allows a null uninstalledAt and uses timestamptz", () => {
    const uninstalledAt = config.columns.find(
      (c) => c.name === "uninstalled_at"
    );
    assert.equal(uninstalledAt?.notNull, false);
    assert.equal(uninstalledAt?.getSQLType(), "timestamp with time zone");
  });
});

describe("webhook_deliveries", () => {
  it("uses snake_case names and dedupes on delivery_id", () => {
    const config = getTableConfig(webhookDeliveries);
    assert.equal(config.name, "webhook_deliveries");
    assert.deepEqual(columnNames(webhookDeliveries), [
      "delivery_id",
      "event",
      "installation_id",
      "received_at",
    ]);
    assert.deepEqual(primaryKeyColumns(webhookDeliveries), ["delivery_id"]);
    const receivedAt = config.columns.find((c) => c.name === "received_at");
    assert.equal(receivedAt?.hasDefault, true);
  });
});

describe("posts", () => {
  const config = getTableConfig(posts);

  it("uses snake_case names and a random uuid key", () => {
    assert.equal(config.name, "posts");
    assert.deepEqual(columnNames(posts), [
      "author_id",
      "author_name",
      "body",
      "channel_id",
      "created_at",
      "id",
      "installation_id",
    ]);
    assert.deepEqual(primaryKeyColumns(posts), ["id"]);
    const id = config.columns.find((c) => c.name === "id");
    assert.equal(id?.getSQLType(), "uuid");
    assert.equal(id?.hasDefault, true);
  });

  it("indexes (installation_id, channel_id, created_at)", () => {
    assert.equal(config.indexes.length, 1);
    const [index] = config.indexes;
    assert.deepEqual(
      index?.config.columns.map((column) =>
        "name" in column ? column.name : null
      ),
      ["installation_id", "channel_id", "created_at"]
    );
  });
});
