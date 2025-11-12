import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthForms } from '@/components/AuthForms';
import type { Profile } from '@/lib/supabase/types';
import ProfileClient from './profile-client';
import { getVerifiedUser } from '@/lib/supabase/auth-utils';
import { getUserById } from '@/lib/supabase/profile-service';

type ProfilePageProps = {
  searchParams?: {
    section?: string;
  };
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerClient();

  const user = await getVerifiedUser(supabase, 'profile');

  if (!user) {
    return <AuthForms initialMode="signIn" />;
  }

  let profile: Pick<Profile, 'first_name' | 'last_name'> | null = null;

  const { data, error } = await getUserById<Pick<Profile, 'first_name' | 'last_name'>>(
    supabase,
    user.id,
    'first_name,last_name'
  );

  if (!error && data) {
    profile = data;
  } else if (error) {
    console.error('[profile] Failed to load basic profile', error);
  }

  return (
    <ProfileClient
      email={user.email ?? ''}
      firstName={profile?.first_name ?? null}
      lastName={profile?.last_name ?? null}
      initialSection={(resolvedSearchParams?.section as string | undefined) ?? undefined}
    />
  );
}
