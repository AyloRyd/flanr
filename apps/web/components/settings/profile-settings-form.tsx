'use client';

import {
  checkUsername,
  maxBioLength,
  maxDisplayNameLength,
  maxUsernameLength,
  type CurrentUser,
} from '@flanr/shared';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import type { ProfileProblem } from '@/app/settings/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfile } from '@/lib/fresh-actions';

type FormProblem =
  | ProfileProblem
  | 'username_length'
  | 'username_characters'
  | 'username_reserved'
  | 'display_name_required';

/** The username, display name and bio (FR-PROF-001, FR-PROF-002). */
export function ProfileSettingsForm({ user }: { user: CurrentUser }) {
  const t = useTranslations('settings.profile');
  const id = useId();
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const usernameProblem = checkUsername(username.trim());
    if (usernameProblem) return setProblem(`username_${usernameProblem}`);
    if (!displayName.trim()) return setProblem('display_name_required');
    setProblem(null);
    startTransition(async () => {
      const result = await updateProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim() || null,
      });
      if (result.ok) setSaved(true);
      else setProblem(result.problem);
    });
  }

  const usernameInvalid = problem?.startsWith('username') ?? false;

  return (
    <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-username`}>{t('username')}</Label>
        <Input
          id={`${id}-username`}
          value={username}
          maxLength={maxUsernameLength}
          autoComplete="username"
          onChange={(event) => setUsername(event.target.value)}
          aria-invalid={usernameInvalid || undefined}
          aria-describedby={`${id}-username-hint ${id}-problem`}
        />
        <p id={`${id}-username-hint`} className="text-sm text-muted-foreground">
          {t('usernameHint')}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-display-name`}>{t('displayName')}</Label>
        <Input
          id={`${id}-display-name`}
          value={displayName}
          maxLength={maxDisplayNameLength}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={problem === 'display_name_required' || undefined}
          aria-describedby={`${id}-problem`}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-bio`}>{t('bio')}</Label>
        <textarea
          id={`${id}-bio`}
          value={bio}
          maxLength={maxBioLength}
          rows={3}
          onChange={(event) => setBio(event.target.value)}
          className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
      </div>
      <p className="text-sm text-muted-foreground">{t('avatarNote')}</p>
      <p id={`${id}-problem`} role="alert" className="text-sm text-destructive empty:hidden">
        {problem && t(`problem.${problem}`)}
      </p>
      <p role="status" className="text-sm text-muted-foreground empty:hidden">
        {saved && t('saved')}
      </p>
      <div>
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
