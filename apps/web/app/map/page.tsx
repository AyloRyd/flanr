import { MapSelection } from '@/components/workspace/map-selection';

/** The map without a city panel; it clears a selection left from a closed panel. */
export default function MapPage() {
  return <MapSelection city={null} />;
}
