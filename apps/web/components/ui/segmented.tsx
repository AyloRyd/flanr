'use client';

import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  /** The accessible name of the group. */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** The visible name of an option. */
  optionLabel: (option: T) => string;
  className?: string | undefined;
}

/** A choice of one among a few options, as buttons side by side. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid grid-flow-col rounded-lg bg-muted p-0.5 text-xs font-medium', className)}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-md px-2.5 py-1.5',
            value === option
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {optionLabel(option)}
        </button>
      ))}
    </div>
  );
}
