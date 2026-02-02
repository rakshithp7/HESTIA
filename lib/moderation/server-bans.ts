import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { ActiveUserBan } from '@/lib/supabase/types';

export async function fetchActiveBan(
  userId: string
): Promise<ActiveUserBan | null> {
  const service = getSupabaseServiceClient();
  const { data, error } = await service
    .from('active_user_bans')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<ActiveUserBan>();

  if (error && error.code !== 'PGRST116') {
    console.error('[moderation] Failed to load active ban', error);
    throw error;
  }

  return data ?? null;
}
