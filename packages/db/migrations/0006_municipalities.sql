CREATE TABLE "municipalities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "municipalities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"osm_type" "osm_type" NOT NULL,
	"osm_id" bigint NOT NULL,
	"wikidata_id" text,
	"country_code" char(2) NOT NULL,
	"name_local" text NOT NULL,
	"name_en" text NOT NULL,
	"boundary" geometry(MultiPolygon, 4326) NOT NULL,
	"in_source" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "municipality_id" integer;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "represents_municipality" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_osm_uq" ON "municipalities" USING btree ("osm_type","osm_id");--> statement-breakpoint
CREATE INDEX "municipalities_boundary_gix" ON "municipalities" USING gist ("boundary");--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cities_municipality_idx" ON "cities" USING btree ("municipality_id");