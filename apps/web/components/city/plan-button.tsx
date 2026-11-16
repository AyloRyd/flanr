'use client';

import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useOptimistic, useState, useTransition } from 'react';
import { setPlanned } from '@/app/cities/[cityId]/actions';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Button } from '@/components/ui/button';

interface PlanButtonProps {
  cityId: number;
  /** False for a guest, who is asked to sign in instead (FR-AUTH-002). */
  signedIn: boolean;
  planned: boolean;
}

/**
 * Saves the city to the Planned list or removes it (FR-LIST-002). Not shown for a visited city,
 * which is in the Visited list (BR-004). The button shows the new state at once and goes back if
 * the API refuses.
 */
export function PlanButton({ cityId, signedIn, planned }: PlanButtonProps) {
  const t = useTranslations('city');
  const [shownPlanned, setShownPlanned] = useOptimistic(planned);
  const [pending, startTransition] = useTransition();
  const [promptOpen, setPromptOpen] = useState(false);
  const [problem, setProblem] = useState<'visited' | 'failed' | null>(null);

  function toggle() {
    if (!signedIn) {
      setPromptOpen(true);
      return;
    }
    const next = !shownPlanned;
    setProblem(null);
    startTransition(async () => {
      setShownPlanned(next);
      const result = await setPlanned(cityId, next);
      if (!result.ok) setProblem(result.problem);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={shownPlanned ? 'secondary' : 'default'}
        size="lg"
        className="rounded-full"
        onClick={toggle}
        disabled={pending}
        aria-pressed={shownPlanned}
        title={shownPlanned ? t('unplan') : undefined}
      >
        {shownPlanned ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
        {shownPlanned ? t('planned') : t('plan')}
      </Button>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem === 'visited' ? t('planVisited') : t('planFailed')}
        </p>
      )}
      <SignInPrompt open={promptOpen} onOpenChange={setPromptOpen} />
    </div>
  );
}
