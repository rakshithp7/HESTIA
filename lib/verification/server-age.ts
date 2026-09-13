import { getSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Whether the member is 18 or older.
 *
 * Delegates to the `caller_is_adult` RPC so the API and the matching functions
 * cannot drift apart on what "adult" means. The RPC reads
 * `profiles.date_of_birth`, which members hold no UPDATE grant on, and treats a
 * null DOB as not an adult.
 *
 * Called with the service client because `caller_is_adult` is granted to
 * `service_role` only - it takes a caller uuid, so leaving it reachable with the
 * anon key would let anyone probe any member's age.
 */
export async function fetchIsAdult(userId: string): Promise<boolean> {
  const service = getSupabaseServiceClient();
  const { data, error } = await service.rpc('caller_is_adult', {
    p_caller: userId,
  });

  if (error) {
    console.error('[verification] Age check failed', error);
    throw error;
  }

  return data === true;
}
