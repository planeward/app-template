import type { Installation, Post, WebhookDelivery } from "@/db";

/** A row after `Response.json`: dates arrive as ISO strings. */
export type Json<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K];
};

export type PostJson = Json<Post>;
export type InstallationJson = Json<Installation>;
export type WebhookDeliveryJson = Json<WebhookDelivery>;
