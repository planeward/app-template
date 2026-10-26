CREATE TABLE "installations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text NOT NULL,
	"granted_permissions" text[] DEFAULT '{}' NOT NULL,
	"installed_at" timestamp with time zone NOT NULL,
	"uninstalled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installation_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"delivery_id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"installation_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "posts_installation_channel_created_idx" ON "posts" USING btree ("installation_id","channel_id","created_at");