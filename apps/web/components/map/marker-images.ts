import type { Map as MapboxMap } from 'mapbox-gl';
import { textColorOn, type MarkerImage } from '@/lib/map/markers';

/** Images are drawn at twice their size, so that they stay sharp when the map scales them. */
const pixelRatio = 2;

const fontFamily = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * A marker as one image: the circle with the value or the sign inside (FR-MAP-005). Drawing
 * the value into the image, and not as text above the circles, lets a larger marker cover a
 * smaller one with its value.
 */
export function drawMarker(marker: MarkerImage): ImageData {
  const { color, radius, strokeWidth } = marker;
  const size = Math.ceil((radius + strokeWidth) * 2 * pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser cannot draw the map markers');
  context.scale(pixelRatio, pixelRatio);

  const centre = size / pixelRatio / 2;
  const ink = textColorOn(color);
  const light = ink !== '#ffffff';
  context.beginPath();
  context.arc(centre, centre, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = strokeWidth;
  // A white ring sets dark markers apart; light markers need a dark one.
  context.strokeStyle = light ? 'rgba(17, 24, 39, 0.45)' : '#ffffff';
  context.stroke();

  context.fillStyle = ink;
  if (marker.symbol === 'house') drawHouse(context, centre, radius * 0.95, color);
  else if (marker.value) drawValue(context, marker.value, centre, radius);

  return context.getImageData(0, 0, size, size);
}

/** The value, as large as fits the circle. */
function drawValue(
  context: CanvasRenderingContext2D,
  value: string,
  centre: number,
  radius: number,
) {
  let fontSize = Math.min(radius * 0.8, 13);
  context.font = `600 ${fontSize}px ${fontFamily}`;
  const room = radius * 1.7;
  const width = context.measureText(value).width;
  if (width > room) {
    fontSize *= room / width;
    context.font = `600 ${fontSize}px ${fontFamily}`;
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  // Most fonts sit a little high on the middle baseline.
  context.fillText(value, centre, centre + fontSize * 0.06);
}

/** A house of the given width, centred: a roof over a body with a door of the marker's colour. */
function drawHouse(
  context: CanvasRenderingContext2D,
  centre: number,
  width: number,
  background: string,
) {
  const half = width / 2;
  const top = centre - half * 0.85;
  const eaves = centre - half * 0.05;
  const bottom = centre + half * 0.75;
  const wall = half * 0.7;
  context.beginPath();
  context.moveTo(centre, top);
  context.lineTo(centre + half, eaves);
  context.lineTo(centre + wall, eaves);
  context.lineTo(centre + wall, bottom);
  context.lineTo(centre - wall, bottom);
  context.lineTo(centre - wall, eaves);
  context.lineTo(centre - half, eaves);
  context.closePath();
  context.fill();
  const door = half * 0.22;
  context.fillStyle = background;
  context.fillRect(centre - door, bottom - half * 0.55, door * 2, half * 0.55);
}

/** Adds the images that the markers need and the map does not have yet. */
export function addMarkerImages(
  map: MapboxMap,
  markers: Iterable<MarkerImage & { image: string }>,
) {
  for (const marker of markers) {
    if (map.hasImage(marker.image)) continue;
    map.addImage(marker.image, drawMarker(marker), { pixelRatio });
  }
}

/** The ID of the dot that a city's name stands beside (FR-MAP-003). */
export const cityDotImage = 'flanr-city-dot';

/**
 * Adds the dot beside the city names: a signed distance field, so that the map gives it the
 * theme's colour and an outline. The alpha falls from 0.75 at the dot's edge, as Mapbox
 * expects of such images.
 */
export function addCityDot(map: MapboxMap) {
  if (map.hasImage(cityDotImage)) return;
  const size = 24;
  const radius = 3.5 * pixelRatio;
  const spread = 4 * pixelRatio;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) - radius;
      const alpha = Math.min(1, Math.max(0, 0.75 - (distance / spread) * 0.75));
      data.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4);
    }
  }
  map.addImage(cityDotImage, { width: size, height: size, data }, { pixelRatio, sdf: true });
}
