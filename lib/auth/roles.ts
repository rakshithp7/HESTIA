import type { Profile } from '@/lib/supabase/types';

export const ADMIN_ROLE: Profile['role'] = 'admin';

export function isAdmin(
  profile: Pick<Profile, 'role'> | null | undefined
): boolean {
  return profile?.role === ADMIN_ROLE;
}
