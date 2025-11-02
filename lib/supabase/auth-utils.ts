import type { SupabaseClient, User } from '@supabase/supabase-js';

export function isAuthSessionMissingError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AuthSessionMissingError'
  );
}

export async function getVerifiedUser<T extends SupabaseClient>(
  supabase: T,
  context: string = 'auth'
): Promise<User | null> {
  try {
    const result = await supabase.auth.getUser();
    const { user } = result.data;
    const { error } = result;

    if (error && !isAuthSessionMissingError(error)) {
      console.error(`[auth:${context}] Failed to fetch authenticated user`, error);
    }

    return user ?? null;
  } catch (error) {
    if (!isAuthSessionMissingError(error)) {
      console.error(`[auth:${context}] Unexpected error while fetching authenticated user`, error);
    }
    return null;
  }
}
