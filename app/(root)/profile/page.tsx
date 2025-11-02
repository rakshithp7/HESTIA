import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthForms } from '@/components/AuthForms';
import type { Profile } from '@/lib/supabase/types';
import ProfileClient from './profile-client';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <AuthForms initialMode="signIn" />;
  }

  let profile: Pick<Profile, 'first_name' | 'last_name'> | null = null;

  const { data, error } = await supabase
    .from('profiles')
    .select('first_name,last_name')
    .eq('id', session.user.id)
    .maybeSingle<Pick<Profile, 'first_name' | 'last_name'>>();

  if (!error && data) {
    profile = data;
  } else if (error) {
    console.error('[profile] Failed to load basic profile', error);
  }

  return (
    <ProfileClient
      email={session.user.email ?? ''}
      firstName={profile?.first_name ?? null}
      lastName={profile?.last_name ?? null}
    />
  );
}
