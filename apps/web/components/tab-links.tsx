import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface TabLink {
  key: string;
  href: string;
  label: string;
}

/** Navigation between the parts of a page that each have their own URL. */
export function TabLinks({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: TabLink[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap',
            tab.key === current
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
