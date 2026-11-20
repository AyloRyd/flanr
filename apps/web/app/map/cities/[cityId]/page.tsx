import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CityPanel } from '@/components/workspace/city-panel';
import { loadCity, loadOwnData } from '@/lib/city-page';

interface CityPanelPageProps {
  params: Promise<{ cityId: string }>;
}

/**
 * Not indexed: the city page is the one page of a city that search engines see
 * (NFR-SEO-003).
 */
export async function generateMetadata({ params }: CityPanelPageProps): Promise<Metadata> {
  const loaded = await loadCity((await params).cityId);
  if (!loaded) return {};
  return {
    title: loaded.city.name,
    robots: { index: false },
    alternates: { canonical: `/cities/${loaded.city.id}` },
  };
}

/** The map with the city panel of one city open (FR-MAP-004). */
export default async function CityPanelPage({ params }: CityPanelPageProps) {
  const loaded = await loadCity((await params).cityId);
  if (!loaded) notFound();
  const own = await loadOwnData(loaded.city.id);
  return <CityPanel city={loaded.city} rating={loaded.rating} own={own} />;
}
