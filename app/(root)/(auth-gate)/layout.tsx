import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthForms } from '@/components/AuthForms';

export default async function AuthGateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <AuthForms initialMode="signIn" />;
  }

  return <>{children}</>;
}
