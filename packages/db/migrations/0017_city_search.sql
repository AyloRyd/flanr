-- City search (FR-SRCH-001): names are compared in lower case and without diacritics,
-- and close spellings are found through trigrams.
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- unaccent() is only STABLE, because its dictionary can be changed, so it cannot be used in a
-- generated column or an index. This wrapper names the dictionary and may therefore be
-- IMMUTABLE. If the unaccent rules are ever changed, city_names.search_name has to be rebuilt.
CREATE FUNCTION search_text(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  RETURN lower(public.unaccent('public.unaccent'::regdictionary, $1));
