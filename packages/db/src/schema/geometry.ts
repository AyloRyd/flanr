import { customType } from 'drizzle-orm/pg-core';

// Geometries are read and written as GeoJSON strings in SQL (ST_AsGeoJSON / ST_GeomFromGeoJSON).
// The column types only declare the PostGIS type, so migrations and indexes are generated correctly.

export const point = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(Point, 4326)',
});

export const multiPolygon = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(MultiPolygon, 4326)',
});
