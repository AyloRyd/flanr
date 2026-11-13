CREATE TABLE "planned_cities" (
	"user_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planned_cities_user_id_city_id_pk" PRIMARY KEY("user_id","city_id")
);
--> statement-breakpoint
ALTER TABLE "planned_cities" ADD CONSTRAINT "planned_cities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_cities" ADD CONSTRAINT "planned_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;