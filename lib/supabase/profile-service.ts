import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '@/lib/supabase/types';

/**
 * Shared helper to fetch a profile row by user id.
 * Consumers can pass a column list (defaults to all columns).
 */
export function getUserById<T = Profile>(supabase: SupabaseClient, userId: string, columns: string = '*') {
  return supabase.from('profiles').select(columns).eq('id', userId).maybeSingle<T>();
}
