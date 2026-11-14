DROP INDEX "cities_search_rank_idx";--> statement-breakpoint
CREATE INDEX "cities_by_population_idx" ON "cities" USING btree ("population" DESC NULLS LAST,"id") WHERE in_source;--> statement-breakpoint
CREATE INDEX "cities_by_name_idx" ON "cities" USING btree ("name_local","id") WHERE in_source;--> statement-breakpoint
CREATE INDEX "cities_search_rank_idx" ON "cities" USING btree ("id","population","country_code","settlement_type","region_1_id","region_2_id") WHERE in_source;