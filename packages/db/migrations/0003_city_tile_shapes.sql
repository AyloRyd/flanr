CREATE TABLE "city_tile_shapes" (
	"city_id" integer NOT NULL,
	"min_zoom" smallint NOT NULL,
	"max_zoom" smallint NOT NULL,
	"geom" geometry(MultiPolygon, 3857) NOT NULL,
	CONSTRAINT "city_tile_shapes_city_id_min_zoom_pk" PRIMARY KEY("city_id","min_zoom")
);
--> statement-breakpoint
ALTER TABLE "city_tile_shapes" ADD CONSTRAINT "city_tile_shapes_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_tile_shapes_geom_gix" ON "city_tile_shapes" USING gist ("geom");