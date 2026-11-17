'use client';

import type { CitySummary, CurrentUser, Visibility } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { updateProfile } from '@/lib/fresh-actions';

interface PrivacySettingsFormProps {
  user: CurrentUser;
  homeCity: CitySummary | null;
}

/**
 * The visibility of the profile, the only privacy setting (FR-PRIV-001), and whether others see
 * the home location (FR-PROF-003).
 */
export function PrivacySettingsForm({ user, homeCity }: PrivacySettingsFormProps) {
  const t = useTranslations('settings.privacy');
  const [visibility, setVisibility] = useState<Visibility>(user.profileVisibility);
  const [homeVisible, setHomeVisible] = useState(user.homeCityVisible);
  const [state, setState] = useState<'saved' | 'failed' | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState(null);
    startTransition(async () => {
      const result = await updateProfile({
        profileVisibility: visibility,
        homeCityVisible: homeVisible,
      });
      setState(result.ok ? 'saved' : 'failed');
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
      <RadioGroup
        aria-label={t('visibility')}
        value={visibility}
        onValueChange={(value) => setVisibility(value as Visibility)}
      >
        <Label className="flex items-start gap-2 font-normal">
          <RadioGroupItem value="public" className="mt-0.5" />
          <span>
            {t('public')}
            <span className="block text-sm text-muted-foreground">{t('publicNote')}</span>
          </span>
        </Label>
        <Label className="flex items-start gap-2 font-normal">
          <RadioGroupItem value="private" className="mt-0.5" />
          <span>
            {t('private')}
            <span className="block text-sm text-muted-foreground">{t('privateNote')}</span>
          </span>
        </Label>
      </RadioGroup>

      <div className="flex flex-col gap-1">
        <Label className="flex items-start gap-2 font-normal">
          <Checkbox
            checked={homeVisible}
            onCheckedChange={(checked) => setHomeVisible(checked === true)}
            className="mt-0.5"
          />
          {t('homeVisible')}
        </Label>
        <p className="text-sm text-muted-foreground">
          {homeCity ? t('homeCity', { city: homeCity.name }) : t('noHomeCity')}
        </p>
      </div>

      {state === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {t('failed')}
        </p>
      )}
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {state === 'saved' && t('saved')}
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
