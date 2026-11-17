import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** The next page of a list of a profile, at the same address with the cursor of the API. */
export function MoreLink({ path, cursor }: { path: string; cursor: string | null }) {
  const t = useTranslations('profile');
  if (!cursor) return null;
  return (
    <Link
      href={`${path}?${new URLSearchParams({ cursor }).toString()}`}
      className="mt-4 inline-block font-medium underline-offset-4 hover:underline"
    >
      {t('more')}
    </Link>
  );
}
