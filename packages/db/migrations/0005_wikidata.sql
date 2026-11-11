CREATE TABLE "wikidata_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"label_en" text,
	"aliases" jsonb NOT NULL,
	"population" integer,
	"population_year" smallint,
	"area_km2" real,
	"elevation_m" integer,
	"website" text,
	"founded" smallint,
	"wikipedia_urls" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "population_source" text;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "area_km2" real;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "elevation_m" integer;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "founded" smallint;