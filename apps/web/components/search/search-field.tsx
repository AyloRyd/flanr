import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** The search text and the button that sends the form it is in. */
export function SearchField({ defaultValue, label }: { defaultValue: string; label: string }) {
  const t = useTranslations('search');

  return (
    <div className="flex gap-2">
      <Input
        type="search"
        name="q"
        aria-label={label}
        placeholder={label}
        defaultValue={defaultValue}
        className="h-10"
      />
      <Button type="submit" size="lg" className="h-10">
        <Search aria-hidden />
        {t('submit')}
      </Button>
    </div>
  );
}
