import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthForms } from '@/components/AuthForms';
import { profileNeedsVerification } from '@/lib/verification';
import { getVerifiedUser } from '@/lib/supabase/auth-utils';
import { getUserById } from '@/lib/supabase/profile-service';

export default async function AuthGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();

  const user = await getVerifiedUser(supabase, 'auth-gate');

  if (!user) {
    return <AuthForms initialMode="signIn" />;
  }

  const { data: profile, error: profileError } = await getUserById(
    supabase,
    user.id
  );

  if (profileError) {
    console.error('[auth-gate] Failed to load profile', profileError);
    redirect('/verify');
  }

  if (profileNeedsVerification(profile)) {
    redirect('/verify');
  }

  return <>{children}</>;
}
