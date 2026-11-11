CREATE TYPE "public"."capital_status" AS ENUM('national', 'regional', 'none');--> statement-breakpoint
CREATE TYPE "public"."osm_type" AS ENUM('node', 'way', 'relation');--> statement-breakpoint
CREATE TYPE "public"."settlement_type" AS ENUM('city', 'town', 'village', 'hamlet');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"osm_type" "osm_type" NOT NULL,
	"osm_id" bigint NOT NULL,
	"wikidata_id" text,
	"name_local" text NOT NULL,
	"name_en" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"region_1_id" integer NOT NULL,
	"region_2_id" integer,
	"settlement_type" "settlement_type" NOT NULL,
	"capital_status" "capital_status" DEFAULT 'none' NOT NULL,
	"centre" geometry(Point, 4326) NOT NULL,
	"boundary" geometry(MultiPolygon, 4326),
	"boundary_osm_type" "osm_type",
	"boundary_osm_id" bigint,
	"boundary_match" text,
	"population" integer,
	"population_year" smallint,
	"wikipedia_url" text,
	"in_source" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_names" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "city_names_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"city_id" integer NOT NULL,
	"name" text NOT NULL,
	"lang" text,
	"kind" text NOT NULL,
	CONSTRAINT "city_names_uq" UNIQUE NULLS NOT DISTINCT("city_id","name","kind","lang")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"osm_id" bigint,
	"name_local" text NOT NULL,
	"name_en" text NOT NULL,
	"boundary" geometry(MultiPolygon, 4326),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"osm_type" "osm_type" NOT NULL,
	"osm_id" bigint NOT NULL,
	"wikidata_id" text,
	"country_code" char(2) NOT NULL,
	"level" smallint NOT NULL,
	"iso_code" text,
	"name_local" text NOT NULL,
	"name_en" text NOT NULL,
	"boundary" geometry(MultiPolygon, 4326) NOT NULL,
	"in_source" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regions_level_ck" CHECK ("regions"."level" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"licence" text NOT NULL,
	"licence_url" text NOT NULL,
	"attribution" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_id" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"source_timestamp" timestamp with time zone,
	"status" "import_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_1_id_regions_id_fk" FOREIGN KEY ("region_1_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_2_id_regions_id_fk" FOREIGN KEY ("region_2_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_names" ADD CONSTRAINT "city_names_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regions" ADD CONSTRAINT "regions_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cities_osm_uq" ON "cities" USING btree ("osm_type","osm_id");--> statement-breakpoint
CREATE INDEX "cities_country_idx" ON "cities" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "cities_region_1_idx" ON "cities" USING btree ("region_1_id");--> statement-breakpoint
CREATE INDEX "cities_centre_gix" ON "cities" USING gist ("centre");--> statement-breakpoint
CREATE INDEX "cities_boundary_gix" ON "cities" USING gist ("boundary");--> statement-breakpoint
CREATE INDEX "city_names_city_idx" ON "city_names" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_osm_uq" ON "regions" USING btree ("osm_type","osm_id");--> statement-breakpoint
CREATE INDEX "regions_boundary_gix" ON "regions" USING gist ("boundary");