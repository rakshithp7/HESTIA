import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ProfileRole } from '@/lib/supabase/types';

type AdminGuardSuccess = {
  supabase: SupabaseClient;
  user: User;
};

type AdminGuardFailure = {
  response: NextResponse;
};

export async function requireAdminUser(): Promise<
  AdminGuardSuccess | AdminGuardFailure
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[admin] Supabase user error', userError);
    return {
      response: NextResponse.json(
        { error: 'Unable to verify session' },
        { status: 500 }
      ),
    };
  }

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: ProfileRole }>();

  if (profileError) {
    console.error('[admin] Failed to load profile', profileError);
    return {
      response: NextResponse.json(
        { error: 'Unable to load profile' },
        { status: 500 }
      ),
    };
  }

  if (profile?.role !== 'admin') {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { supabase, user };
}
