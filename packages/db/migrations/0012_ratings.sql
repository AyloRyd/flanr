CREATE TABLE "city_ratings" (
	"user_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"subjective" numeric(3, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_ratings_user_id_city_id_pk" PRIMARY KEY("user_id","city_id"),
	CONSTRAINT "city_ratings_subjective_on_scale" CHECK ("city_ratings"."subjective" BETWEEN 1 AND 10 AND "city_ratings"."subjective" * 2 = trunc("city_ratings"."subjective" * 2))
);
--> statement-breakpoint
CREATE TABLE "criteria" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "criteria_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "criteria_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "criterion_ratings" (
	"user_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"value" numeric(3, 1) NOT NULL,
	CONSTRAINT "criterion_ratings_user_id_city_id_criterion_id_pk" PRIMARY KEY("user_id","city_id","criterion_id"),
	CONSTRAINT "criterion_ratings_value_on_scale" CHECK ("criterion_ratings"."value" BETWEEN 1 AND 10 AND "criterion_ratings"."value" * 2 = trunc("criterion_ratings"."value" * 2))
);
--> statement-breakpoint
ALTER TABLE "city_ratings" ADD CONSTRAINT "city_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_ratings" ADD CONSTRAINT "city_ratings_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_ratings" ADD CONSTRAINT "criterion_ratings_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_ratings" ADD CONSTRAINT "criterion_ratings_city_rating_fk" FOREIGN KEY ("user_id","city_id") REFERENCES "public"."city_ratings"("user_id","city_id") ON DELETE cascade ON UPDATE no action;