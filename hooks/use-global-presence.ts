'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type UserPresenceState = {
  status: 'idle' | 'active';
  topic?: string;
  online_at: string;
};

type GlobalPresenceStats = {
  peersOnline: number;
  activeTopicCount: number;
};

export function useGlobalPresence(
  userState: Omit<UserPresenceState, 'online_at'>
): GlobalPresenceStats {
  const [stats, setStats] = useState<GlobalPresenceStats>({
    peersOnline: 0,
    activeTopicCount: 0,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel('global-presence');

    const updateStats = (state: Record<string, any>) => {
      const presences = Object.values(state).flat() as UserPresenceState[];
      const totalPeers = presences.length;

      const activeTopics = new Set(
        presences
          .filter((p) => p.status === 'active' && p.topic)
          .map((p) => p.topic)
      );

      setStats({
        peersOnline: totalPeers,
        activeTopicCount: activeTopics.size,
      });
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        updateStats(channel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            ...userState,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [JSON.stringify(userState)]); // Re-subscribe if user state changes (e.g., active -> idle)

  return stats;
}
