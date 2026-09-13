import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env/public';

/**
 * The browser client, created once.
 *
 * This used to return a new client on every call, which matters because several
 * components call it during render and then list the result in a hook's
 * dependency array - `Navbar`, `useVerificationStatus`, `useRTCSession`,
 * `useSignaling` and `useMatchQueue`. A fresh object each render makes that
 * dependency change every render, so those effects tear down and re-run
 * constantly: re-subscribing to auth changes, re-opening realtime channels and
 * re-running queries that were only ever meant to run on mount.
 *
 * One instance also means one auth state and one set of realtime connections,
 * which is what `@supabase/ssr` expects on the client.
 */
let browserClient: SupabaseClient | undefined;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }

  return browserClient;
}
