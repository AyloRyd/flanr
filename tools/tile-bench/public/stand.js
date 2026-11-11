// Map stand: draws the city layer from one of three sources, chosen with ?source=mvt|pmtiles|geojson.
import * as maplibregl from '/vendor/maplibre-gl/maplibre-gl.mjs';

const config = await (await fetch('/config.json')).json();
const params = new URLSearchParams(location.search);
const source = params.get('source') ?? 'mvt';
const started = performance.now();

window.__bench = { source, firstIdleMs: null };

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// Each entry gives the map sources and how the two layers refer to them.
const sources = {
  mvt: () => ({
    sources: {
      cities: {
        type: 'vector',
        tiles: [`${config.apiUrl}/tiles/cities/{z}/{x}/{y}.mvt`],
        maxzoom: config.maxZoom,
        attribution: config.attribution,
      },
    },
    points: { source: 'cities', 'source-layer': config.layers.points },
    boundaries: { source: 'cities', 'source-layer': config.layers.boundaries },
  }),
  pmtiles: () => ({
    sources: {
      cities: {
        type: 'vector',
        url: `pmtiles://${location.origin}/data/cities.pmtiles`,
        attribution: config.attribution,
      },
    },
    points: { source: 'cities', 'source-layer': config.layers.points },
    boundaries: { source: 'cities', 'source-layer': config.layers.boundaries },
  }),
  geojson: () => ({
    sources: {
      points: { type: 'geojson', data: '/data/city-points.geojson', promoteId: 'id' },
      boundaries: { type: 'geojson', data: '/data/city-boundaries.geojson', promoteId: 'id' },
    },
    points: { source: 'points' },
    boundaries: { source: 'boundaries' },
  }),
};

const chosen = (sources[source] ?? sources.mvt)();
const byType = (city, town, village, hamlet) => [
  'match',
  ['get', 'type'],
  'city',
  city,
  'town',
  town,
  'village',
  village,
  hamlet,
];

const map = new maplibregl.Map({
  container: 'map',
  center: [Number(params.get('lng') ?? 10.4), Number(params.get('lat') ?? 51.2)],
  zoom: Number(params.get('zoom') ?? 5.5),
  style: {
    version: 8,
    sources: chosen.sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f4f1ea' } },
      {
        id: 'boundary-fill',
        type: 'fill',
        ...chosen.boundaries,
        paint: {
          'fill-color': '#5f3a74',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.45, 0.12],
        },
      },
      {
        id: 'boundary-line',
        type: 'line',
        ...chosen.boundaries,
        paint: { 'line-color': '#5f3a74', 'line-width': 0.6, 'line-opacity': 0.7 },
      },
      {
        id: 'points',
        type: 'circle',
        ...chosen.points,
        paint: {
          'circle-radius': byType(5, 3.5, 2.5, 1.8),
          'circle-color': byType('#e9493a', '#f9951f', '#3a7d5f', '#6b7280'),
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 0.8,
        },
      },
    ],
  },
});

map.once('idle', () => {
  window.__bench.firstIdleMs = Math.round(performance.now() - started);
});

// Highlight through feature-state, the same mechanism the product map will use for user data.
let hovered = null;
const setHover = (feature, on) =>
  map.setFeatureState({ ...chosen.boundaries, id: feature.id }, { hover: on });

map.on('mousemove', 'boundary-fill', (event) => {
  const feature = event.features?.[0];
  if (!feature || feature.id === hovered?.id) return;
  if (hovered) setHover(hovered, false);
  hovered = feature;
  setHover(hovered, true);
});
map.on('mouseleave', 'boundary-fill', () => {
  if (hovered) setHover(hovered, false);
  hovered = null;
});

const info = document.getElementById('info');
map.on('click', 'points', (event) => {
  const feature = event.features?.[0];
  if (!feature) return;
  const { name, name_en: nameEn, type, population } = feature.properties;
  info.textContent = [
    `${name}${nameEn && nameEn !== name ? ` (${nameEn})` : ''}`,
    `${type}, id ${feature.id}`,
    population ? `population ${Number(population).toLocaleString('en')}` : 'population unknown',
  ].join('\n');
});
map.on('move', () => {
  document.title = `z${map.getZoom().toFixed(1)} · ${source}`;
});

const links = document.getElementById('sources');
for (const name of Object.keys(sources)) {
  const link = document.createElement('a');
  link.textContent = name;
  link.href = `?source=${name}`;
  if (name === source) link.className = 'active';
  links.append(link);
}
