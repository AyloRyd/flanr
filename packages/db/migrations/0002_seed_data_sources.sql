-- Attribution data for external sources (NFR-LIC-001…003).
INSERT INTO "data_sources" ("id", "name", "url", "licence", "licence_url", "attribution") VALUES
  ('openstreetmap', 'OpenStreetMap', 'https://www.openstreetmap.org', 'ODbL 1.0', 'https://opendatacommons.org/licenses/odbl/1-0/', '© OpenStreetMap contributors'),
  ('wikidata', 'Wikidata', 'https://www.wikidata.org', 'CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/', 'Wikidata'),
  ('wikimedia-commons', 'Wikimedia Commons', 'https://commons.wikimedia.org', 'Per file', 'https://commons.wikimedia.org/wiki/Commons:Licensing', 'Author and licence are shown with each file')
ON CONFLICT ("id") DO NOTHING;
