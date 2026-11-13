ALTER TABLE "city_names" ADD COLUMN "search_name" text GENERATED ALWAYS AS (search_text(name)) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "cities_search_rank_idx" ON "cities" USING btree ("id","population") WHERE in_source;--> statement-breakpoint
CREATE INDEX "city_names_search_exact_idx" ON "city_names" USING btree ("search_name" text_pattern_ops,"city_id");--> statement-breakpoint
CREATE INDEX "city_names_search_prefix_idx" ON "city_names" USING btree ("search_name" text_pattern_ops,"city_id") WHERE kind in ('name', 'int_name', 'wikidata_label');--> statement-breakpoint
CREATE INDEX "city_names_search_trgm_idx" ON "city_names" USING gin ("search_name" gin_trgm_ops) WHERE kind in ('name', 'int_name', 'wikidata_label');