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

// One shared channel, owned here rather than by a component. `/connect` and
// `/connect/session` are both mounted during a navigation and Supabase returns
// the same channel for a topic, so a component-owned one gets closed under the
// page that is still using it.
const CHANNEL_TOPIC = 'global-presence';

let channel: RealtimeChannel | null = null;
let subscribers = 0;
let latest: GlobalPresenceStats = { peersOnline: 0, activeTopicCount: 0 };
const listeners = new Set<(stats: GlobalPresenceStats) => void>();

function publish(state: Record<string, unknown>) {
  const presences = Object.values(state).flat() as UserPresenceState[];
  const activeTopics = new Set(
    presences.filter((p) => p.status === 'active' && p.topic).map((p) => p.topic)
  );

  latest = {
    peersOnline: presences.length,
    activeTopicCount: activeTopics.size,
  };
  listeners.forEach((notify) => notify(latest));
}

export function useGlobalPresence(
  userState: Omit<UserPresenceState, 'online_at'>
): GlobalPresenceStats {
  const [stats, setStats] = useState<GlobalPresenceStats>(latest);
  const stateKey = JSON.stringify(userState);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    subscribers += 1;
    listeners.add(setStats);
    setStats(latest);

    const track = () =>
      channel?.track({ ...userState, online_at: new Date().toISOString() });

    if (!channel) {
      channel = supabase.channel(CHANNEL_TOPIC);
      channel
        .on('presence', { event: 'sync' }, () =>
          publish(channel!.presenceState())
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void track();
        });
    } else {
      void track();
    }

    return () => {
      listeners.delete(setStats);
      subscribers -= 1;
      // Left open on purpose. removeChannel is async and channels are matched
      // by topic, so a remount mid-teardown gets handed the leaving channel and
      // never syncs again. Untracking is enough.
      if (subscribers === 0) void channel?.untrack();
    };
  }, [stateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return stats;
}
