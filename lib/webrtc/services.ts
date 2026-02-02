import { DEFAULT_RTC_CONFIG } from './types';

export const fetchIceServers = async (): Promise<RTCConfiguration> => {
  try {
    const response = await fetch('/api/turn');
    if (!response.ok) throw new Error('Failed to fetch ICE servers');
    const turnServers = await response.json();
    return {
      ...DEFAULT_RTC_CONFIG,
      iceServers: [...(DEFAULT_RTC_CONFIG.iceServers || []), ...turnServers],
    };
  } catch (error) {
    console.warn('Failed to load TURN servers, falling back to STUN', error);
    return DEFAULT_RTC_CONFIG;
  }
};

export const fetchBlockedUsers = async (): Promise<{
  blockedUsers: string[];
  blockedByUsers: string[];
}> => {
  try {
    const response = await fetch('/api/blocked');
    if (!response.ok) {
      console.error(
        '[RTC] Failed to fetch blocked users',
        await response.text()
      );
      return { blockedUsers: [], blockedByUsers: [] };
    }
    const data = (await response.json()) as {
      blockedUsers?: { id: string }[];
      blockedByUserIds?: string[];
    };
    return {
      blockedUsers: (data.blockedUsers ?? []).map((entry) => entry.id),
      blockedByUsers: data.blockedByUserIds ?? [],
    };
  } catch (error) {
    console.error('[RTC] Blocked users fetch error', error);
    return { blockedUsers: [], blockedByUsers: [] };
  }
};
