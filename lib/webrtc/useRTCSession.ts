import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import 'webrtc-adapter';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Dynamic import helper for DetectRTC to avoid SSR issues
const getDetectRTC = async () => {
  if (typeof window === 'undefined') return null;
  const { default: DetectRTC } = await import('detectrtc');
  return DetectRTC;
};

type SessionMode = 'voice' | 'chat';

type RTCSessionConfig = {
  topic: string;
  mode: SessionMode;
};

// Chat message types
export interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  sender: 'me' | 'peer';
}

type DataChannelMessage = { type: 'chat'; message: ChatMessage } | { type: 'typing_start' } | { type: 'typing_stop' };

// Simple connection status types
type ConnectionStatus =
  | 'idle'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'permission-denied'
  | 'no-mic'
  | 'media-error'
  | 'ended';

const CHAT_CHANNEL_LABEL = 'chat';
const MAX_CHAT_MESSAGES = 100;
const CONNECTION_TIMEOUT_MS = 10000;
const ACTIVE_SESSION_STATUSES: ConnectionStatus[] = ['connecting', 'connected'];
const UNKNOWN_SUPABASE_ERROR = 'Unknown Supabase channel error.';
const PRESENCE_THROTTLE_MS = 500;

const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302',
    ],
  },
  { urls: ['stun:global.stun.twilio.com:3478', 'stun:stun.cloudflare.com:3478'] },
];

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};

const describeSupabaseError = (payload: unknown): string => {
  if (!payload) return UNKNOWN_SUPABASE_ERROR;
  if (payload instanceof Error) return payload.message || UNKNOWN_SUPABASE_ERROR;
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'number' || typeof payload === 'boolean') return String(payload);
  if (typeof payload === 'object') {
    const details = payload as Record<string, unknown>;
    const candidate = details.error ?? details.message ?? details.reason;
    if (candidate instanceof Error) return candidate.message || UNKNOWN_SUPABASE_ERROR;
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object' && 'message' in candidate) {
      const nested = (candidate as { message?: unknown }).message;
      if (typeof nested === 'string') return nested;
    }
    try {
      return JSON.stringify(details);
    } catch {
      // fall through
    }
  }
  return UNKNOWN_SUPABASE_ERROR;
};

export function useRTCSession({ topic, mode }: RTCSessionConfig) {
  const isChatMode = mode === 'chat';
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [status, setStatusState] = useState<ConnectionStatus>('idle');
  const statusRef = useRef<ConnectionStatus>('idle');
  const updateStatus = useCallback(
    (next: ConnectionStatus) => {
      if (statusRef.current === next) return;
      statusRef.current = next;
      setStatusState(next);
      console.log('[RTC] status updated:', next);
    },
    [setStatusState]
  );
  const [muted, setMuted] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [micPermissionChecked, setMicPermissionChecked] = useState(false);
  const [roomId, setRoomIdState] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const updateRoomId = useCallback(
    (next: string | null) => {
      if (roomIdRef.current === next) return;
      roomIdRef.current = next;
      setRoomIdState(next);
      console.log('[RTC] roomId updated:', next);
    },
    [setRoomIdState]
  );

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isChatReady, setIsChatReady] = useState(false);
  const [activePeerUserId, setActivePeerUserId] = useState<string | null>(null);
  const peerUserIdRef = useRef<string | null>(null);
  const updatePeerUserId = useCallback(
    (next: string | null) => {
      if (peerUserIdRef.current === next) return;
      peerUserIdRef.current = next;
      setActivePeerUserId(next);
    },
    [setActivePeerUserId]
  );

  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedByUserIds, setBlockedByUserIds] = useState<string[]>([]);
  const blockedUsersRef = useRef<Set<string>>(new Set());
  const blockedByUsersRef = useRef<Set<string>>(new Set());
  const syncBlockedUsers = useCallback(
    (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      blockedUsersRef.current = new Set(uniqueIds);
      setBlockedUserIds(uniqueIds);
    },
    [setBlockedUserIds]
  );
  const syncBlockedByUsers = useCallback(
    (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      blockedByUsersRef.current = new Set(uniqueIds);
      setBlockedByUserIds(uniqueIds);
    },
    [setBlockedByUserIds]
  );
  const appendBlockedUser = useCallback((userId: string | null) => {
    if (!userId || blockedUsersRef.current.has(userId)) return;
    const next = new Set(blockedUsersRef.current);
    next.add(userId);
    blockedUsersRef.current = next;
    setBlockedUserIds(Array.from(next));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolveUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error) {
          console.error('[RTC] Failed to resolve current user', error);
          return;
        }
        setCurrentUserId(user?.id ?? null);
      } catch (err) {
        if (!cancelled) console.error('[RTC] Unexpected auth error', err);
      }
    };
    void resolveUser();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const loadBlocked = async () => {
      try {
        const response = await fetch('/api/blocked');
        if (!response.ok) {
          console.error('[RTC] Failed to fetch blocked users', await response.text());
          return;
        }
        const data = (await response.json()) as { blockedUsers?: { id: string }[]; blockedByUserIds?: string[] };
        if (!cancelled) {
          syncBlockedUsers((data.blockedUsers ?? []).map((entry) => entry.id));
          syncBlockedByUsers(data.blockedByUserIds ?? []);
        }
      } catch (error) {
        if (!cancelled) console.error('[RTC] Blocked users fetch error', error);
      }
    };
    void loadBlocked();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, syncBlockedUsers, syncBlockedByUsers]);

  // Media and connection references
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const matchingChannelRef = useRef<RealtimeChannel | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPresenceRef = useRef<{ availability: 'waiting' | 'busy'; roomId: string | null } | null>(null);
  const lastPresenceRef = useRef<{ availability: 'waiting' | 'busy'; roomId: string | null } | null>(null);
  const lastPresenceTimestampRef = useRef(0);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const pushChatMessage = useCallback(
    (message: ChatMessage) => {
      setChatMessages((prev) => {
        const next = [...prev, message];
        return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
      });
    },
    [setChatMessages]
  );

  const handleDataChannelMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as DataChannelMessage;
        if (payload.type === 'chat') {
          pushChatMessage({ ...payload.message, sender: 'peer' });
        } else if (payload.type === 'typing_start') {
          setIsPeerTyping(true);
        } else if (payload.type === 'typing_stop') {
          setIsPeerTyping(false);
        }
      } catch (err) {
        console.error('Error parsing data channel message:', err);
      }
    },
    [pushChatMessage, setIsPeerTyping]
  );

  const attachChatChannelHandlers = useCallback(
    (channel: RTCDataChannel) => {
      channel.onmessage = handleDataChannelMessage;
      channel.onopen = () => {
        console.log('Data channel opened');
        setIsChatReady(true);
      };
      channel.onclose = () => {
        console.log('Data channel closed');
        setIsChatReady(false);
        setIsPeerTyping(false);
      };
      channel.onerror = (error) => {
        console.error('Data channel error:', error);
        setIsChatReady(false);
      };
      return channel;
    },
    [handleDataChannelMessage, setIsChatReady, setIsPeerTyping]
  );

  const closeChatChannel = useCallback(() => {
    try {
      dataChannelRef.current?.close();
    } catch (error) {
      console.error('Error closing data channel:', error);
    }
    dataChannelRef.current = null;
    setIsChatReady(false);
    setIsPeerTyping(false);
  }, [setIsChatReady, setIsPeerTyping]);

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const clearRemoteStream = useCallback(() => {
    remoteStreamRef.current = null;
    const audioElement = audioElRef.current;
    if (audioElement) {
      audioElement.srcObject = null;
    }
  }, []);

  const getOpenDataChannel = useCallback(() => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      return null;
    }
    return channel;
  }, []);

  type PresenceMeta = {
    userId: string;
    mode: SessionMode;
    status?: 'waiting' | 'busy';
    roomId?: string | null;
  };

  const sendPresenceNow = useCallback(() => {
    if (!currentUserId) return;

    if (presenceTimeoutRef.current) {
      clearTimeout(presenceTimeoutRef.current);
      presenceTimeoutRef.current = null;
    }

    const payload = pendingPresenceRef.current;
    if (!payload) return;

    const channel = matchingChannelRef.current;
    if (!channel) {
      if (!presenceTimeoutRef.current) {
        presenceTimeoutRef.current = setTimeout(() => {
          presenceTimeoutRef.current = null;
          sendPresenceNow();
        }, PRESENCE_THROTTLE_MS);
      }
      return;
    }

    pendingPresenceRef.current = null;
    lastPresenceRef.current = payload;
    lastPresenceTimestampRef.current = Date.now();

    void channel
      .track({ userId: currentUserId, mode, status: payload.availability, roomId: payload.roomId })
      .catch((err) => console.error('Error updating presence state:', err));
  }, [currentUserId, mode]);

  const announcePresence = useCallback(
    (availability: 'waiting' | 'busy', activeRoomId: string | null) => {
      if (!currentUserId) return;
      const target = { availability, roomId: activeRoomId };
      const last = lastPresenceRef.current;
      const pending = pendingPresenceRef.current;

      if (pending && pending.availability === target.availability && pending.roomId === target.roomId) {
        return;
      }

      if (last && last.availability === target.availability && last.roomId === target.roomId) {
        return;
      }

      pendingPresenceRef.current = target;

      const now = Date.now();
      const elapsed = now - lastPresenceTimestampRef.current;
      const shouldSendImmediately = elapsed >= PRESENCE_THROTTLE_MS || !lastPresenceRef.current;

      if (shouldSendImmediately) {
        sendPresenceNow();
        return;
      }

      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
      }

      presenceTimeoutRef.current = setTimeout(() => {
        presenceTimeoutRef.current = null;
        sendPresenceNow();
      }, Math.max(PRESENCE_THROTTLE_MS - elapsed, 0));
    },
    [currentUserId, sendPresenceNow]
  );

  const flushPendingIceCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    const queue = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error flushing ICE candidate:', error);
      }
    }
  }, []);

  const attemptMatch = useCallback(() => {
    const channel = matchingChannelRef.current;
    if (!channel || roomIdRef.current) {
      console.log('[RTC] attemptMatch skipped; channel?', !!channel, 'roomId?', roomIdRef.current);
      return;
    }

    const state = channel.presenceState() as Record<string, PresenceMeta[]>;
    console.log('[RTC] Presence snapshot:', state);

    if (Object.keys(state).length <= 1) {
      console.log('[RTC] Only self in presence; remain waiting');
      if (statusRef.current !== 'waiting') {
        updateStatus('waiting');
      }
      announcePresence('waiting', null);
      return;
    }

    const availablePeerEntry = Object.entries(state).find(([key, metas]) => {
      if (key === currentUserId) return false;
      if (blockedUsersRef.current.has(key)) {
        console.log('[RTC] Skipping peer I blocked', key);
        return false;
      }
      if (blockedByUsersRef.current.has(key)) {
        console.log('[RTC] Skipping peer that blocked me', key);
        return false;
      }
      const meta = metas?.[0] as PresenceMeta | undefined;
      console.log('[RTC] Evaluating peer for match', key, meta);
      if (!meta) return false;
      return meta.status === 'waiting' && !meta.roomId && meta.mode === mode;
    });

    if (availablePeerEntry) {
      const [receiverId] = availablePeerEntry;
      if (!currentUserId || !receiverId) return;
      const newRoomId = buildRoomId(currentUserId, receiverId, mode);
      console.log('[RTC] Matching with peer', receiverId, 'roomId', newRoomId);

      channel
        .send({
          type: 'broadcast',
          event: 'pair',
          payload: { initiatorId: currentUserId, receiverId, roomId: newRoomId },
        })
        .catch((err) => console.error('Error sending pair signal:', err));

      updateRoomId(newRoomId);
      updatePeerUserId(receiverId);
      updateStatus('connecting');
      announcePresence('busy', newRoomId);
    } else {
      console.log('[RTC] No compatible peer found; stay waiting');
      if (statusRef.current !== 'waiting') {
        updateStatus('waiting');
      }
      announcePresence('waiting', null);
    }
  }, [announcePresence, currentUserId, mode, updatePeerUserId, updateStatus, updateRoomId]);

  const cleanupActiveMatch = useCallback(async (roomIdValue?: string | null) => {
    const targetRoomId = roomIdValue ?? roomIdRef.current;
    if (!targetRoomId) return;

    try {
      const response = await fetch('/api/match/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: targetRoomId }),
      });
      if (!response.ok) {
        console.error('[RTC] Failed to cleanup match', await response.text());
      }
    } catch (error) {
      console.error('[RTC] Cleanup match error', error);
    }
  }, []);

  const resetSessionState = useCallback(
    ({
      nextStatus,
      clearRoom = true,
      requeue = false,
    }: {
      nextStatus: ConnectionStatus;
      clearRoom?: boolean;
      requeue?: boolean;
    }) => {
      closeChatChannel();
      stopLocalTracks();
      clearRemoteStream();
      setMuted(false);
      setMicReady(false);
      setChatMessages([]);
      pendingIceCandidatesRef.current = [];
      updatePeerUserId(null);
      const activeRoomId = roomIdRef.current;
      if (clearRoom && activeRoomId) {
        void cleanupActiveMatch(activeRoomId);
      }
      if (clearRoom) updateRoomId(null);
      updateStatus(nextStatus);
      if (requeue) {
        announcePresence('waiting', null);
        attemptMatch();
      }
    },
    [
      announcePresence,
      attemptMatch,
      clearRemoteStream,
      closeChatChannel,
      stopLocalTracks,
      updateRoomId,
      updateStatus,
      setMicReady,
      setMuted,
      setChatMessages,
      updatePeerUserId,
      cleanupActiveMatch,
    ]
  );

  const registerMatch = useCallback(
    async (roomIdValue: string, peerUserId: string) => {
      if (!roomIdValue || !peerUserId) return false;
      try {
        const response = await fetch('/api/match/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: roomIdValue, topic, mode, peerUserId }),
        });

        if (response.status === 409) {
          let blockedBy: 'self' | 'peer' | null = null;
          try {
            const payload = (await response.json()) as { blockedBy?: 'self' | 'peer' };
            blockedBy = payload.blockedBy ?? null;
          } catch {
            // ignore parse errors
          }

          if (blockedBy === 'self') {
            toast('Skipped a blocked match', {
              description: 'We are looking for another person to chat with.',
            });
          }

          updatePeerUserId(null);
          resetSessionState({ nextStatus: 'waiting', requeue: true });
          return false;
        }

        if (!response.ok) {
          console.error('[RTC] Failed to register match', await response.text());
          return false;
        }

        return true;
      } catch (error) {
        console.error('[RTC] register match error', error);
        return false;
      }
    },
    [mode, resetSessionState, topic, updatePeerUserId]
  );

  useEffect(() => {
    if (status === 'connecting') {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = setTimeout(() => {
        if (statusRef.current === 'connecting') {
          console.log('Connection timed out, returning to waiting.');
          updateRoomId(null);
          updateStatus('waiting');
          announcePresence('waiting', null);
          attemptMatch();
        }
      }, CONNECTION_TIMEOUT_MS);
    } else if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [status, announcePresence, attemptMatch, updateRoomId, updateStatus]);

  useEffect(() => {
    if (!roomId || !activePeerUserId) return;
    void registerMatch(roomId, activePeerUserId);
  }, [activePeerUserId, registerMatch, roomId]);

  useEffect(() => {
    return () => {
      void cleanupActiveMatch();
    };
  }, [cleanupActiveMatch]);
  const endedByPeerRef = useRef(false);

  useEffect(() => {
    return () => {
      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
        presenceTimeoutRef.current = null;
      }
    };
  }, []);

  // Connect to signaling channel when topic is provided
  useEffect(() => {
    if (!topic || !currentUserId) return;

    const channelName = `rtc:${mode}:${topic}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    });

    matchingChannelRef.current = channel;
    sendPresenceNow();

    console.log('[RTC] Subscribing to channel', channelName, 'mode', mode, 'userId', currentUserId);

    channel.on('system', { event: 'error' }, (payload?: { error?: unknown }) => {
      const message = describeSupabaseError(payload?.error ?? payload);
      console.error('Supabase channel error:', message);
      updateStatus('media-error');
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        console.log('[RTC] Presence sync received');
        attemptMatch();
      })
      .on('broadcast', { event: 'pair' }, (msg) => {
        const payload = msg.payload as { receiverId: string; initiatorId: string; roomId: string };
        console.log('[RTC] Pair broadcast received', payload);
        if (payload.receiverId !== currentUserId || roomIdRef.current) return;

        if (blockedUsersRef.current.has(payload.initiatorId)) {
          console.log('[RTC] Ignoring blocked initiator', payload.initiatorId);
          announcePresence('waiting', null);
          return;
        }

        if (blockedByUsersRef.current.has(payload.initiatorId)) {
          console.log('[RTC] Initiator has blocked me; ignoring pair', payload.initiatorId);
          announcePresence('waiting', null);
          return;
        }

        updateRoomId(payload.roomId);
        updatePeerUserId(payload.initiatorId);
        updateStatus('connecting');
        announcePresence('busy', payload.roomId);
      })
      .subscribe(async (subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          console.log('[RTC] Matching channel subscribed');
          announcePresence('waiting', null);
          attemptMatch();
        }
      });

    return () => {
      console.log('[RTC] Unsubscribing from channel', channelName);
      matchingChannelRef.current = null;
      pendingPresenceRef.current = null;
      lastPresenceRef.current = null;
      lastPresenceTimestampRef.current = 0;
      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
        presenceTimeoutRef.current = null;
      }
      channel.unsubscribe();
    };
  }, [
    supabase,
    topic,
    mode,
    currentUserId,
    attemptMatch,
    announcePresence,
    sendPresenceNow,
    updateRoomId,
    updateStatus,
    updatePeerUserId,
  ]);

  // Set up WebRTC when we have a room
  useEffect(() => {
    if (!roomId) return;

    endedByPeerRef.current = false;
    pendingIceCandidatesRef.current = [];

    const pc = new RTCPeerConnection({
      ...DEFAULT_RTC_CONFIG,
      iceServers: DEFAULT_RTC_CONFIG.iceServers?.map((server) => ({ ...server })),
    });
    pcRef.current = pc;

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      stream.getTracks().forEach((track) => remoteStream.addTrack(track));
      const audioElement = audioElRef.current;
      if (audioElement) {
        audioElement.srcObject = remoteStream;
        void audioElement.play().catch(() => undefined);
      }
    };

    dataChannelRef.current = attachChatChannelHandlers(
      pc.createDataChannel(CHAT_CHANNEL_LABEL, {
        ordered: true,
        maxPacketLifeTime: 3000,
      })
    );

    pc.ondatachannel = (event) => {
      if (event.channel.label === CHAT_CHANNEL_LABEL) {
        dataChannelRef.current = attachChatChannelHandlers(event.channel);
      }
    };

    const roomChannel = supabase.channel(`rtc:room:${roomId}`, {
      config: {
        broadcast: { ack: true },
      },
    });
    roomChannelRef.current = roomChannel;

    roomChannel.on('system', { event: 'error' }, (payload?: { error?: unknown }) => {
      const message = describeSupabaseError(payload?.error ?? payload);
      console.error('Supabase room channel error:', message);
      resetSessionState({ nextStatus: 'media-error', requeue: true });
      roomChannelRef.current = null;
      roomChannel.unsubscribe();
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      roomChannel.send({
        type: 'broadcast',
        event: 'ice',
        payload: { candidate: event.candidate.toJSON(), roomId },
      });
    };

    const startLocalMedia = async (): Promise<boolean> => {
      if (isChatMode) {
        setMicReady(false);
        return true;
      }

      try {
        if (
          typeof navigator === 'undefined' ||
          !('mediaDevices' in navigator) ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          updateStatus('media-error');
          return false;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        setMicReady(true);
        return true;
      } catch (err: unknown) {
        const name = (err as Error)?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') updateStatus('permission-denied');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') updateStatus('no-mic');
        else updateStatus('media-error');
        return false;
      }
    };

    const createOffer = async () => {
      const mediaReady = await startLocalMedia();
      if (!mediaReady) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      roomChannel.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'offer', sdp: offer.sdp!, roomId },
      });
    };

    const createAnswer = async (offerSdp: string) => {
      const mediaReady = await startLocalMedia();
      if (!mediaReady) return;
      await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      await flushPendingIceCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      roomChannel.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'answer', sdp: answer.sdp!, roomId },
      });
    };

    roomChannel
      .on('broadcast', { event: 'sdp' }, async (msg) => {
        const payload = msg.payload as { type: 'offer' | 'answer'; sdp: string; roomId: string };
        if (payload.roomId !== roomId) return;

        if (payload.type === 'offer' && pc.signalingState === 'stable') {
          await createAnswer(payload.sdp);
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
          await flushPendingIceCandidates();
        }
      })
      .on('broadcast', { event: 'ice' }, async (msg) => {
        const payload = msg.payload as { candidate: RTCIceCandidateInit; roomId: string };
        if (payload.roomId !== roomId) return;
        try {
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            pendingIceCandidatesRef.current.push(payload.candidate);
            return;
          }

          await pc.addIceCandidate(payload.candidate);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      })
      .on('broadcast', { event: 'end_session' }, (msg) => {
        const payload = msg.payload as { roomId: string; senderId?: string };
        if (payload.roomId !== roomId) return;
        if (payload.senderId === currentUserId) return;

        console.log('Remote peer ended the session');
        endedByPeerRef.current = true;
        toast('Session closed by peer', {
          description: 'Looking for another match...',
        });

        try {
          pc.close();
        } catch (error) {
          console.error('Error closing connection:', error);
        }

        resetSessionState({ nextStatus: 'waiting', requeue: true });
        roomChannelRef.current = null;
        roomChannel.unsubscribe();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const [a] = roomId.split(':');
          const isInitiator = currentUserId === a;
          if (isInitiator) await createOffer();
        }
      });

    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state changed:', pc.connectionState);

      if (pc.connectionState === 'connected') {
        console.log('WebRTC connection established successfully');
        updateStatus('connected');
      }

      if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
        console.log('WebRTC connection ended with state:', pc.connectionState);
        const wasPeerEnded = endedByPeerRef.current;
        if (wasPeerEnded) {
          endedByPeerRef.current = false;
          updateStatus('waiting');
          return;
        }

        if (!ACTIVE_SESSION_STATUSES.includes(statusRef.current)) {
          console.log('Skipping session end handling because status is', statusRef.current);
          return;
        }

        resetSessionState({ nextStatus: 'ended', requeue: true });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed:', pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log('Signaling state changed:', pc.signalingState);
    };

    return () => {
      roomChannelRef.current = null;
      roomChannel.unsubscribe();
      pc.close();
      pcRef.current = null;
      closeChatChannel();
      stopLocalTracks();
      clearRemoteStream();
      pendingIceCandidatesRef.current = [];
    };
  }, [
    supabase,
    roomId,
    currentUserId,
    mode,
    isChatMode,
    attachChatChannelHandlers,
    announcePresence,
    attemptMatch,
    closeChatChannel,
    stopLocalTracks,
    clearRemoteStream,
    flushPendingIceCandidates,
    resetSessionState,
    updateStatus,
    updateRoomId,
    setMicReady,
    setMuted,
    setChatMessages,
  ]);

  // Handle mute state changes
  useEffect(() => {
    if (isChatMode) return;

    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted, isChatMode]);

  // User-initiated microphone request - wrapped in useCallback to avoid dependency issues
  const requestLocalAudio = useCallback(async (): Promise<boolean> => {
    console.log('requestLocalAudio called');

    if (isChatMode) {
      console.log('requestLocalAudio skipped in chat-only mode');
      return false;
    }

    try {
      // Don't request again if we already have a stream
      if (localStreamRef.current && micReady) {
        console.log('Microphone already enabled');
        return true;
      }

      // Only use DetectRTC in browser environment
      const detectRTC = await getDetectRTC();
      if (detectRTC) {
        await new Promise<void>((resolve) => detectRTC.load(() => resolve()));
        if (!detectRTC.isWebRTCSupported) {
          console.log('WebRTC not supported');
          updateStatus('media-error');
          return false;
        }
        if (!detectRTC.hasMicrophone) {
          console.log('No microphone detected');
          updateStatus('no-mic');
          return false;
        }
      }

      console.log('Requesting microphone access...');
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        updateStatus('media-error');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      console.log('Microphone access granted');

      localStreamRef.current = stream;
      const pc = pcRef.current;
      if (pc) {
        console.log('Adding tracks to peer connection');
        try {
          const senders = pc.getSenders();
          const audioSenders = senders.filter((sender) => sender.track && sender.track.kind === 'audio');

          // If we already have audio senders, replace tracks instead of adding new ones
          if (audioSenders.length > 0) {
            console.log('Replacing existing audio tracks');
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
              for (let i = 0; i < Math.min(audioSenders.length, audioTracks.length); i++) {
                audioSenders[i].replaceTrack(audioTracks[i]);
              }
            }
          } else {
            // Otherwise add new tracks
            console.log('Adding new audio tracks');
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          }
        } catch (err) {
          console.error('Error adding/replacing tracks:', err);
        }
      } else {
        console.log('No peer connection available');
      }

      setMicReady(true);
      return true;
    } catch (err: unknown) {
      console.error('Error accessing microphone:', err);
      const name = (err as Error)?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        console.log('Permission denied');
        updateStatus('permission-denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        console.log('No microphone found');
        updateStatus('no-mic');
      } else {
        console.log('Media error');
        updateStatus('media-error');
      }
      return false;
    }
  }, [updateStatus, setMicReady, micReady, isChatMode]);

  // Automatically check for microphone access on component mount
  useEffect(() => {
    if (isChatMode) {
      if (!micPermissionChecked) setMicPermissionChecked(true);
      return;
    }

    if (typeof window === 'undefined' || micPermissionChecked) return;

    const checkMicrophoneAccess = async () => {
      try {
        // First check if browser supports WebRTC
        const detectRTC = await getDetectRTC();
        if (detectRTC) {
          await new Promise<void>((resolve) => detectRTC.load(() => resolve()));
          if (!detectRTC.isWebRTCSupported) {
            updateStatus('media-error');
            setMicPermissionChecked(true);
            return;
          }

          // Check if device has microphone
          if (!detectRTC.hasMicrophone) {
            updateStatus('no-mic');
            setMicPermissionChecked(true);
            return;
          }

          // Check if we already have permission
          if (detectRTC.isWebsiteHasWebcamPermissions) {
            // We might already have permission, try to get the stream
            await requestLocalAudio();
          }
        }
      } catch (err) {
        // Ignore errors here - we'll just show the button
        console.log('Initial microphone check error:', err);
      } finally {
        setMicPermissionChecked(true);
      }
    };

    checkMicrophoneAccess();
  }, [isChatMode, micPermissionChecked, requestLocalAudio, updateStatus, setMicPermissionChecked]);

  // Set audio element reference
  const setAudioElementRef = (el: HTMLAudioElement | null) => {
    audioElRef.current = el;
    if (el && remoteStreamRef.current) {
      el.srcObject = remoteStreamRef.current;
    }
  };

  // End call with notification to peer
  const end = () => {
    try {
      // Send end session message to the room channel if we have a roomId
      if (roomId && currentUserId) {
        const roomChannel = roomChannelRef.current;
        if (roomChannel) {
          roomChannel
            .send({
              type: 'broadcast',
              event: 'end_session',
              payload: { roomId, senderId: currentUserId },
            })
            .catch((error) => console.error('Failed to send end_session event:', error));
        } else {
          console.warn('Attempted to end session without an active room channel');
        }
      }

      // Close the connection
      pcRef.current?.close();
    } catch (err) {
      console.error('Error ending session:', err);
    }

    resetSessionState({ nextStatus: 'ended', requeue: true });
  };

  // Chat functions
  const sendChatMessage = useCallback(
    (text: string) => {
      const channel = getOpenDataChannel();
      if (!channel) {
        console.warn('Data channel not ready');
        return false;
      }

      try {
        const message: ChatMessage = {
          id: generateUUIDv4(),
          text: text.trim(),
          timestamp: Date.now(),
          sender: 'me',
        };

        const payload: DataChannelMessage = { type: 'chat', message };
        channel.send(JSON.stringify(payload));
        pushChatMessage(message);
        return true;
      } catch (error) {
        console.error('Error sending chat message:', error);
        return false;
      }
    },
    [getOpenDataChannel, pushChatMessage]
  );

  const sendTypingStart = useCallback(() => {
    const channel = getOpenDataChannel();
    if (!channel) return;

    try {
      channel.send(JSON.stringify({ type: 'typing_start' }));
    } catch (error) {
      console.error('Error sending typing start:', error);
    }
  }, [getOpenDataChannel]);

  const sendTypingStop = useCallback(() => {
    const channel = getOpenDataChannel();
    if (!channel) return;

    try {
      channel.send(JSON.stringify({ type: 'typing_stop' }));
    } catch (error) {
      console.error('Error sending typing stop:', error);
    }
  }, [getOpenDataChannel]);

  return {
    status,
    mode,
    roomId,
    currentUserId,
    peerUserId: activePeerUserId,
    blockedUserIds,
    blockedByUserIds,
    muted,
    setMuted,
    setAudioElementRef,
    micReady,
    micPermissionChecked,
    requestLocalAudio,
    end,
    // Expose streams for visualization
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
    // Chat functionality
    chatMessages,
    isPeerTyping,
    isChatReady,
    sendChatMessage,
    sendTypingStart,
    sendTypingStop,
    markUserBlocked: appendBlockedUser,
  };
}

function buildRoomId(userA: string, userB: string, sessionMode: SessionMode): string {
  const sortedPair = [userA, userB].sort();
  const timestamp = Date.now().toString(36);
  const nonce = generateUUIDv4();
  return `${sortedPair.join(':')}:${sessionMode}:${timestamp}:${nonce}`;
}

// Simple UUID v4 generator
function generateUUIDv4(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side fallback
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 10);
    return `ssr-${timestamp}-${randomStr}`;
  }

  // Client-side implementation
  // Prefer native randomUUID when available
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  // Fallback using getRandomValues, else Math.random
  const bytes = new Uint8Array(16);
  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = (Math.random() * 256) & 255;
  }
  // RFC 4122 variant + version
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const b = Array.from(bytes, toHex).join('');
  return `${b.substring(0, 8)}-${b.substring(8, 12)}-${b.substring(12, 16)}-${b.substring(16, 20)}-${b.substring(20)}`;
}
