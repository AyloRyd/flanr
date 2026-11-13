-- The initial rating criteria (FR-RATE-002). Later ones are added by administrators (FR-RATE-006).
INSERT INTO "criteria" ("key", "name", "sort_order") VALUES
  ('architecture', 'Architecture', 10),
  ('urbanism', 'Urbanism', 20),
  ('greenery', 'Greenery', 30),
  ('public_transport', 'Public transport', 40),
  ('safety', 'Safety', 50),
  ('cleanliness', 'Cleanliness', 60)
ON CONFLICT ("key") DO NOTHING;
