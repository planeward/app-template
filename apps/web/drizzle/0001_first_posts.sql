CREATE TABLE "first_posts" (
	"installation_id" text NOT NULL,
	"member_id" text NOT NULL,
	"message_id" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"badge_awarded_at" timestamp with time zone,
	CONSTRAINT "first_posts_installation_id_member_id_pk" PRIMARY KEY("installation_id","member_id")
);
