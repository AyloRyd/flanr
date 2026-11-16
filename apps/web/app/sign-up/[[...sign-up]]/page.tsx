import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signUpTitle') };
}

/** Clerk verifies the email address before the account exists (FR-AUTH-003). */
export default function SignUpPage() {
  return (
    <div className="flex justify-center px-4 py-12">
      <SignUp />
    </div>
  );
}
