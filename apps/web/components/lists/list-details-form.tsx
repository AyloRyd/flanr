'use client';

import { maxListDescriptionLength, maxListTitleLength, type Visibility } from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface ListDetails {
  title: string;
  description: string | null;
  visibility: Visibility;
}

interface ListDetailsFormProps {
  initial: ListDetails;
  submitLabel: string;
  /** Saves the details; resolves to false when that failed. */
  onSubmit: (details: ListDetails) => Promise<boolean>;
  onCancel: () => void;
}

/** The title, description and visibility of a custom list (FR-LIST-003, FR-LIST-005). */
export function ListDetailsForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ListDetailsFormProps) {
  const t = useTranslations('lists.form');
  const id = useId();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [problem, setProblem] = useState<'title_required' | 'failed' | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setProblem('title_required');
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const saved = await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        visibility,
      });
      if (!saved) setProblem('failed');
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>{t('title')}</Label>
        <Input
          id={`${id}-title`}
          value={title}
          maxLength={maxListTitleLength}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={problem === 'title_required' || undefined}
          aria-describedby={`${id}-problem`}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-description`}>{t('description')}</Label>
        <textarea
          id={`${id}-description`}
          value={description}
          maxLength={maxListDescriptionLength}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </div>
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

      <p id={`${id}-problem`} role="alert" className="text-sm text-destructive empty:hidden">
        {problem && t(`problem.${problem}`)}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
