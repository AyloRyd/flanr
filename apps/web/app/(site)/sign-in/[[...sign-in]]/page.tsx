import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signInTitle') };
}

/** Email and password, email code and Google, as set up in Clerk (FR-AUTH-003…005). */
export default function SignInPage() {
  return (
    <div className="flex justify-center px-4 py-12">
      <SignIn />
    </div>
  );
}
