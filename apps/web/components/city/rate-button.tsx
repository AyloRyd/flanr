'use client';

import type { CityRating, Criterion } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RatingForm } from '@/components/city/rating-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RateButtonProps {
  cityId: number;
  cityName: string;
  criteria: Criterion[];
  rating: CityRating | null;
}

/**
 * Opens the rating form (FR-RATE-001). Shown only to a user who has visited or lived in the
 * city, because only they can rate it (BR-005).
 */
export function RateButton({ cityId, cityName, criteria, rating }: RateButtonProps) {
  const t = useTranslations('city');
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {rating ? t('changeRating') : t('rate')}
      </Button>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {saved && t('ratingSaved')}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('ratingForm.title', { city: cityName })}</DialogTitle>
            <DialogDescription>{t('ratingForm.description')}</DialogDescription>
          </DialogHeader>
          <RatingForm
            cityId={cityId}
            criteria={criteria}
            rating={rating}
            onSaved={() => {
              setOpen(false);
              setSaved(true);
            }}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
