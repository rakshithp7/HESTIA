import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAuthSessionMissingError } from '@/lib/supabase/auth-utils';

type UserGuardSuccess = {
  supabase: SupabaseClient;
  user: User;
};

type UserGuardFailure = {
  response: NextResponse;
};

/**
 * Route guard for endpoints that require any signed-in member.
 *
 * Mirrors `requireAdminUser` so route handlers share one shape. It exists
 * mainly to get the anonymous case right: `auth.getUser()` raises
 * `AuthSessionMissingError` when there is no session, which is a 401, not the
 * 500 that a naive `if (error)` check produces.
 */
export async function requireUser(
  context = 'auth'
): Promise<UserGuardSuccess | UserGuardFailure> {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error && !isAuthSessionMissingError(error)) {
      console.error(`[${context}] Supabase user error`, error);
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

    return { supabase, user };
  } catch (error) {
    if (isAuthSessionMissingError(error)) {
      return {
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    console.error(`[${context}] Unexpected error verifying session`, error);
    return {
      response: NextResponse.json(
        { error: 'Unable to verify session' },
        { status: 500 }
      ),
    };
  }
}
