ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "visited_visibility" "list_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "planned_visibility" "list_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
-- Added by hand: generated usernames used a hyphen, which FR-PROF-001 does not allow.
UPDATE "users" SET "username" = replace("username", '-', '_') WHERE "username" ~ '^user-[0-9a-f]{10}$';--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));