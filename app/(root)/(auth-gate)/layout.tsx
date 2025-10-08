import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthForms } from '@/components/AuthForms';
import type { Profile } from '@/lib/supabase/types';
import { profileNeedsVerification } from '@/lib/verification';

export default async function AuthGateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <AuthForms initialMode="signIn" />;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single<Profile>();

  if (profileError) {
    console.error('[auth-gate] Failed to load profile', profileError);
    redirect('/verify');
  }

  if (profileNeedsVerification(profile)) {
    redirect('/verify');
  }

  return <>{children}</>;
}
