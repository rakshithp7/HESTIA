import { getSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Matching cohort for a member.
 *
 *   'adult' - 18 or over
 *   'minor' - 16 or 17
 *   null    - under 16, or no date of birth on file
 *
 * The two bands never match with each other; that rule lives inside
 * `find_match` and `suggested_match_for`, which are the only ways into the
 * queue. This helper exists so the API routes reject an ineligible member with
 * a clear error instead of letting them queue and silently never match.
 *
 * Delegates to the `caller_age_band` RPC so the API and the matching functions
 * cannot drift apart on what a band means. The RPC reads
 * `profiles.date_of_birth`, which members hold no UPDATE grant on, so the band
 * cannot be forged.
 *
 * Called with the service client because `caller_age_band` is granted to
 * `service_role` only - it takes a caller uuid, so leaving it reachable with
 * the browser key would let anyone probe any member's age.
 */
export type AgeBand = 'adult' | 'minor';

export async function fetchAgeBand(userId: string): Promise<AgeBand | null> {
  const service = getSupabaseServiceClient();
  const { data, error } = await service.rpc('caller_age_band', {
    p_caller: userId,
  });

  if (error) {
    console.error('[verification] Age band lookup failed', error);
    throw error;
  }

  return data === 'adult' || data === 'minor' ? data : null;
}

/** Whether the member is old enough to use Hestia at all. */
export async function fetchMeetsMinimumAge(userId: string): Promise<boolean> {
  return (await fetchAgeBand(userId)) !== null;
}
