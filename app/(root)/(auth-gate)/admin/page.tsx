import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/auth-utils';
import { getUserById } from '@/lib/supabase/profile-service';
import type { Profile } from '@/lib/supabase/types';
import { AdminClient } from '@/components/admin/AdminClient';

type AdminPageProps = {
  searchParams: Promise<{
    section?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerClient();
  const user = await getVerifiedUser(supabase, 'admin');

  if (!user) {
    redirect('/connect');
  }

  const { data: profile, error } = await getUserById<
    Pick<Profile, 'first_name' | 'last_name' | 'role'>
  >(supabase, user.id, 'first_name,last_name,role');

  if (error || !profile) {
    console.error('[admin] Failed to load profile', error);
    redirect('/profile');
  }

  if (profile.role !== 'admin') {
    redirect('/profile');
  }

  const displayName =
    [profile.first_name, profile.last_name]
      .filter((part) => (part ?? '').trim().length > 0)
      .join(' ') ||
    user.email ||
    'Admin';

  return (
    <AdminClient
      displayName={displayName}
      initialSection={resolvedSearchParams?.section}
    />
  );
}
