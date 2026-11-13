CREATE TABLE "lived_cities" (
	"user_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"is_current" boolean NOT NULL,
	"from_date" date,
	"from_precision" "visit_date_precision" DEFAULT 'none' NOT NULL,
	"to_date" date,
	"to_precision" "visit_date_precision" DEFAULT 'none' NOT NULL,
	CONSTRAINT "lived_cities_user_id_city_id_pk" PRIMARY KEY("user_id","city_id"),
	CONSTRAINT "lived_cities_from_matches_precision" CHECK (("lived_cities"."from_precision" = 'none') = ("lived_cities"."from_date" IS NULL)),
	CONSTRAINT "lived_cities_to_matches_precision" CHECK (("lived_cities"."to_precision" = 'none') = ("lived_cities"."to_date" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "lived_cities" ADD CONSTRAINT "lived_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lived_cities" ADD CONSTRAINT "lived_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lived_cities_one_current_idx" ON "lived_cities" USING btree ("user_id") WHERE "lived_cities"."is_current";