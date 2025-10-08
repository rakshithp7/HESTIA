import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env/public';

export function createSupabaseBrowserClient() {
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return createBrowserClient(supabaseUrl, supabaseKey);
}
