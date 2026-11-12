CREATE TYPE "public"."visit_date_precision" AS ENUM('day', 'month', 'year', 'none');--> statement-breakpoint
CREATE TABLE "visits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "visits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"date" date,
	"date_precision" "visit_date_precision" NOT NULL,
	"before_registration" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visits_date_matches_precision" CHECK (("visits"."date_precision" = 'none') = ("visits"."date" IS NULL)),
	CONSTRAINT "visits_undated_before_registration" CHECK ("visits"."date_precision" <> 'none' OR "visits"."before_registration")
);
--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visits_user_city_idx" ON "visits" USING btree ("user_id","city_id");