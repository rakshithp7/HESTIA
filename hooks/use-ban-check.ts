import { useState, useEffect, useCallback } from 'react';
import type { ActiveUserBan } from '@/lib/supabase/types';

export function useBanCheck(userId: string | null) {
  const [activeBan, setActiveBan] = useState<ActiveUserBan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveBan = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch('/api/me/ban');
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to check ban status');
        }
        const payload = (await response.json()) as {
          ban: ActiveUserBan | null;
        };
        setActiveBan(payload.ban ?? null);
      } catch (err) {
        console.error('[useBanCheck] Failed to load ban status', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!userId) {
      // If no user yet, likely loading profile or not auth, so maybe keep loading or wait?
      // Logic in original file:
      // React.useEffect(() => { if (!userId) return; void fetchActiveBan(); }, [fetchActiveBan, userId]);
      // So we just return.
      return;
    }
    void fetchActiveBan();
  }, [fetchActiveBan, userId]);

  const handleBanRetry = useCallback(() => {
    void fetchActiveBan();
  }, [fetchActiveBan]);

  return {
    activeBan,
    loading,
    error,
    refetch: handleBanRetry,
  };
}
