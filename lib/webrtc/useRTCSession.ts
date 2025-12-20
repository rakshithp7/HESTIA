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
const ACTIVE_SESSION_STATUSES: ConnectionStatus[] = ['connecting', 'connected'];
const UNKNOWN_SUPABASE_ERROR = 'Unknown Supabase channel error.';
const POLLING_INTERVAL_MS = 3000;

// STUN servers for WebRTC
const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
    ],
  },
];

const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
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

  // Matching Logic State
  const [suggestedMatch, setSuggestedMatch] = useState<{ topic: string; similarity: number } | null>(null);
  const startTimeRef = useRef<number | null>(null);


  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchIceServers = async () => {
      try {
        const response = await fetch('/api/turn');
        if (!response.ok) throw new Error('Failed to fetch ICE servers');
        const turnServers = await response.json();
        if (!cancelled) {
          setRtcConfig({
            ...DEFAULT_RTC_CONFIG,
            iceServers: [...(DEFAULT_RTC_CONFIG.iceServers || []), ...turnServers],
          });
        }
      } catch (error) {
        console.warn('Failed to load TURN servers, falling back to STUN', error);
        if (!cancelled) setRtcConfig(DEFAULT_RTC_CONFIG);
      }
    };
    void fetchIceServers();
    return () => { cancelled = true; };
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
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
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

  // State Refs
  const isInitiatorRef = useRef(false);
  const queueIdRef = useRef<string | null>(null);
  const isPollingRef = useRef(false);
  const endedByPeerRef = useRef(false);

  // Helpers
  const cleanupMatchQueue = useCallback(async () => {
    const queueId = queueIdRef.current;
    if (!queueId) return;
    try {
      await supabase.from('match_queue').delete().eq('id', queueId);
      console.log('[RTC] Removed from match queue', queueId);
    } catch (err) {
      console.error('[RTC] Failed to remove from queue', err);
    }
    queueIdRef.current = null;
  }, [supabase]);

  const cleanupActiveMatch = useCallback(async (roomIdValue?: string | null) => {
    // We rely on DB 'match_queue' updates or simple room channel closure.
    // Ideally we should mark the queue item as 'finished' or delete it.
    // For now, we'll just close channels.
    // Check if we need to call API cleanup
    const targetRoomId = roomIdValue ?? roomIdRef.current;
    if (targetRoomId) {
      // Optional: Notify API that match is done
      // await fetch('/api/match/cleanup', ...);
    }
  }, [roomIdRef]);

  const resetSessionState = useCallback(
    ({
      nextStatus,
      clearRoom = true,
      requeue = false,
      reason = 'unknown' // Add debug reason
    }: {
      nextStatus: ConnectionStatus;
      clearRoom?: boolean;
      requeue?: boolean;
      reason?: string;
    }) => {
      console.log(`[RTC] resetSessionState called. Next: ${nextStatus}, Reason: ${reason}`);
      closeChatChannel();
      stopLocalTracks();
      clearRemoteStream();
      setMuted(false);
      setMicReady(false);
      setChatMessages([]);
      pendingIceCandidatesRef.current = [];
      updatePeerUserId(null);
      isInitiatorRef.current = false;
      endedByPeerRef.current = false;

      const activeRoomId = roomIdRef.current;
      if (clearRoom && activeRoomId) {
        void cleanupActiveMatch(activeRoomId);
        updateRoomId(null);
      }

      updateStatus(nextStatus);

      if (requeue) {
        // ...
      }
    },
    [
      cleanupActiveMatch,
      closeChatChannel,
      stopLocalTracks,
      clearRemoteStream,
      setMicReady,
      setMuted,
      setChatMessages,
      updatePeerUserId,
      updateRoomId,

      updateStatus,
      roomIdRef
    ]
  );

  const acceptSuggestedMatch = useCallback(async () => {
    if (!suggestedMatch || !currentUserId || !myEmbeddingRef.current) return;

    // Force match by setting threshold to 0 to accept the best available candidate
    // which should be the one we suggested (or better if someone new joined)
    try {
      const excludedIds = Array.from(new Set([
        ...Array.from(blockedUsersRef.current),
        ...Array.from(blockedByUsersRef.current)
      ]));

      const { data, error } = await supabase.rpc('find_match', {
        p_user_id: currentUserId,
        p_topic_embedding: myEmbeddingRef.current,
        p_mode: mode,
        p_excluded_user_ids: excludedIds,
        p_threshold: 0.0 // Force match
      });

      if (error) {
        console.error('[RTC] Force match error', error);
        toast.error('Failed to connect to suggested match');
      } else {
        const match = data && data[0];
        if (match && match.match_found) {
          console.log('[RTC] Force match successful!', match);
          isInitiatorRef.current = true;
          updateRoomId(match.match_room_id);
          updatePeerUserId(match.peer_user_id);
          updateStatus('connecting');
          setSuggestedMatch(null); // Clear suggestion
        } else {
          toast.error('Suggested match is no longer available');
          setSuggestedMatch(null);
        }
      }
    } catch (err) {
      console.error('[RTC] Accept match error', err);
    }
  }, [suggestedMatch, currentUserId, mode, supabase, updateRoomId, updatePeerUserId, updateStatus]);

  // Queue Logic
  const myEmbeddingRef = useRef<number[] | null>(null);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  const enterMatchQueue = useCallback(async () => {
    if (!currentUserId || !topic) return;

    // reset state
    queueIdRef.current = null;
    setActiveQueueId(null);
    isInitiatorRef.current = false;
    updateStatus('waiting');

    try {
      // 1. Get Embedding
      // Optimization: if myEmbeddingRef is set and topic hasn't changed... 
      // but simplistic approach: just fetch.
      const embedRes = await fetch('/api/ai/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: topic }),
      });
      if (!embedRes.ok) throw new Error('Failed to generate embedding');
      const { embedding } = await embedRes.json();
      myEmbeddingRef.current = embedding;

      // Start the timer for dynamic thresholding
      startTimeRef.current = Date.now();
      setSuggestedMatch(null);

      // 2. Insert into Queue
      const { data, error } = await supabase
        .from('match_queue')
        .insert({
          user_id: currentUserId,
          topic,
          topic_embedding: embedding,
          mode,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) throw error;
      queueIdRef.current = data.id;
      setActiveQueueId(data.id);
      console.log('[RTC] Entered match queue', data.id);

    } catch (err) {
      console.error('[RTC] Queue entry failed', err);
      updateStatus('media-error');
      toast.error('Failed to join matchmaking queue');
    }
  }, [currentUserId, topic, mode, supabase, updateStatus]);

  // Polling for Match (Active)
  useEffect(() => {
    if (status !== 'waiting' || !currentUserId) return;

    const interval = setInterval(async () => {
      if (!myEmbeddingRef.current) return;
      if (isPollingRef.current) return; // Prevent Overlap

      isPollingRef.current = true;
      try {
        const excludedIds = Array.from(new Set([
          ...Array.from(blockedUsersRef.current),
          ...Array.from(blockedByUsersRef.current)
        ]));

        // Dynamic Threshold Calculation
        // Start: 0.80, Min: 0.55, Rate: 0.01/sec
        // After 25s: 0.80 - 0.25 = 0.55
        const elapsedSec = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
        const decay = elapsedSec * 0.01;
        const currentThreshold = Math.max(0.55, 0.80 - decay);

        console.log(`[RTC] Polling... Elapsed: ${elapsedSec.toFixed(1)}s, Threshold: ${currentThreshold.toFixed(3)}`);

        // Debug Log
        // Only run debug occasionally efficiently or if we are hunting for suggestions?
        // Let's run it only if we are in fallback mode (threshold at bottom) OR for debugging (conditional)
        // For now, let's keep the debug log but maybe less verbose?
        /*
        supabase.rpc('debug_matches', {
          p_user_id: currentUserId,
          p_topic_embedding: myEmbeddingRef.current,
          p_mode: mode
        }).then(({ data }) => {
          if (data && data.length > 0) {
            console.log('[RTC DEBUG] Potential Matches:', data);
          }
        });
        */

        const { data, error } = await supabase.rpc('find_match', {
          p_user_id: currentUserId,
          p_topic_embedding: myEmbeddingRef.current,
          p_mode: mode,
          p_excluded_user_ids: excludedIds,
          p_threshold: currentThreshold
        });

        if (error) {
          console.error('[RTC] find_match RPC error', error);
        } else {
          const match = data && data[0];
          if (match && match.match_found) {
            console.log('[RTC] Match found via RPC!', match);
            isInitiatorRef.current = true; // Mark as initiator
            updateRoomId(match.match_room_id);
            updatePeerUserId(match.peer_user_id);
            updateStatus('connecting');
            setSuggestedMatch(null);
            return; // Stop here
          }
        }

        // FALLBACK LOGIC: If threshold reached bottom and no match, look for suggestions
        if (currentThreshold <= 0.551) { // 0.55 + epsilon
          const { data: suggestions } = await supabase.rpc('debug_matches', {
            p_user_id: currentUserId,
            p_topic_embedding: myEmbeddingRef.current,
            p_mode: mode
          });

          if (suggestions && suggestions.length > 0) {
            const best = suggestions[0];
            // Update suggested match if it's different and reasonable (e.g. > 0.1? to avoid complete garbage)
            if (best.similarity > 0.3) {
              // Only update if topic is different to avoid flicker? 
              // Or just update.
              setSuggestedMatch({ topic: best.topic, similarity: best.similarity });
            }
          }
        }

      } catch (err) {
        console.error('[RTC] Poll error', err);
      } finally {
        isPollingRef.current = false;
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [status, currentUserId, mode, supabase, updateStatus, updateRoomId, updatePeerUserId]);

  // Heartbeat Mechanism to prevent Zombies
  useEffect(() => {
    if (!activeQueueId || status !== 'waiting') return;

    const interval = setInterval(async () => {
      console.log('[RTC] Sending heartbeat...');
      const { error } = await supabase
        .from('match_queue')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeQueueId);

      if (error) console.error('[RTC] Heartbeat failed', error);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [activeQueueId, status, supabase]);

  // Realtime Match Listener (Passive)
  useEffect(() => {
    // Only listen if we are in the queue
    if (!activeQueueId || status !== 'waiting') return;
    const qId = activeQueueId;

    const channel = supabase
      .channel(`queue:${qId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'match_queue', filter: `id=eq.${qId}` },
        (payload) => {
          const newRow = payload.new as { status: string; room_id: string };
          if (newRow.status === 'matched' && newRow.room_id) {
            console.log('[RTC] Match found via Realtime!', newRow.room_id);
            isInitiatorRef.current = false; // Passive
            updateRoomId(newRow.room_id);
            updateStatus('connecting');
            // peerUserId will be unknown until we handshake or query room?
            // Actually, we can just proceed. Handshake SDP exchange verifies connection.
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, status, activeQueueId, updateRoomId, updateStatus]);

  // Init/Cleanup
  useEffect(() => {
    if (!topic || !currentUserId) return;

    // Only enter if idle? 
    // If we just mounted, we are idle.
    enterMatchQueue();

    return () => {
      void cleanupMatchQueue();
      setActiveQueueId(null);
    };
  }, [topic, currentUserId, enterMatchQueue, cleanupMatchQueue]);



  // WebRTC Connection Logic (Modified for Room)
  useEffect(() => {
    if (!roomId || !rtcConfig) return;

    endedByPeerRef.current = false;
    pendingIceCandidatesRef.current = [];

    const pc = new RTCPeerConnection(rtcConfig);
    console.log('[RTC] Creating PeerConnection with config:', {
      ...rtcConfig,
      iceServers: rtcConfig.iceServers?.map(s => ({ ...s, credential: '***', username: '***' }))
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
      config: { broadcast: { ack: true } },
    });
    roomChannelRef.current = roomChannel;

    roomChannel.on('system', { event: 'error' }, (payload?: { error?: unknown }) => {
      const message = describeSupabaseError(payload?.error ?? payload);
      console.error('Supabase room channel error:', message);
      resetSessionState({ nextStatus: 'media-error', requeue: true, reason: `Supabase System Error: ${message}` });
      roomChannelRef.current = null;
      roomChannel.unsubscribe();
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      console.log('[RTC] Sending ICE candidate');
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
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          updateStatus('media-error'); return false;
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
        // simplistic error handling for brevity
        updateStatus('media-error');
        return false;
      }
    };

    const createOffer = async () => {
      console.log('[RTC] Creating Offer...');
      const mediaReady = await startLocalMedia();
      if (!mediaReady) return;
      const offer = await pc.createOffer();
      console.log('[RTC] Setting Local Description (Offer)');
      await pc.setLocalDescription(offer);
      roomChannel.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'offer', sdp: offer.sdp!, roomId },
      });
    };

    const createAnswer = async (offerSdp: string) => {
      console.log('[RTC] Creating Answer...');
      const mediaReady = await startLocalMedia();
      if (!mediaReady) return;
      console.log('[RTC] Setting Remote Description (Offer)');
      await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      await flushPendingIceCandidates();
      const answer = await pc.createAnswer();
      console.log('[RTC] Setting Local Description (Answer)');
      await pc.setLocalDescription(answer);
      roomChannel.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'answer', sdp: answer.sdp!, roomId },
      });
    };

    const sendOfferSignal = async () => {
      if (!pc.localDescription) {
        await createOffer();
      } else {
        console.log('[RTC] Resending existing Offer...');
        roomChannel.send({
          type: 'broadcast',
          event: 'sdp',
          payload: { type: 'offer', sdp: pc.localDescription.sdp!, roomId },
        });
      }
    };

    roomChannel
      .on('broadcast', { event: 'ready' }, async (msg) => {
        const payload = msg.payload as { roomId: string };
        if (payload.roomId !== roomId) return;
        console.log('[RTC] Received Peer Ready signal');
        if (isInitiatorRef.current && pc.signalingState !== 'stable') {
          console.log('[RTC] Peer is ready, sending Offer');
          await sendOfferSignal();
        }
      })
      .on('broadcast', { event: 'sdp' }, async (msg) => {
        const payload = msg.payload as { type: 'offer' | 'answer'; sdp: string; roomId: string };
        if (payload.roomId !== roomId) return;

        if (payload.type === 'offer') {
          // If we are initiator and have-local-offer, we have a collision.
          // But normally passives just accept.
          if (pc.signalingState === 'stable' || pc.signalingState === 'have-remote-offer') {
            // Already handling?
          }
          console.log('[RTC] Received SDP Offer');
          await createAnswer(payload.sdp);
        } else if (payload.type === 'answer') {
          console.log('[RTC] Received SDP Answer');
          if (pc.signalingState === 'have-local-offer') {
            console.log('[RTC] Setting Remote Description (Answer)');
            await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
            await flushPendingIceCandidates();
          }
        }
      })
      .on('broadcast', { event: 'ice' }, async (msg) => {
        const payload = msg.payload as { candidate: RTCIceCandidateInit; roomId: string };
        if (payload.roomId !== roomId) return;
        console.log('[RTC] Received ICE candidate');
        try {
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            console.log('[RTC] Buffering ICE candidate (Remote description not set)');
            pendingIceCandidatesRef.current.push(payload.candidate);
          } else {
            console.log('[RTC] Adding ICE candidate');
            await pc.addIceCandidate(payload.candidate);
            console.log('[RTC] Added ICE candidate');
          }
        } catch (error) {
          console.error('Error adding ICE:', error);
        }
      })
      .on('broadcast', { event: 'end_session' }, (msg) => {
        // ... same end logic
        const payload = msg.payload as { roomId: string; senderId?: string };
        if (payload.roomId !== roomId) return;
        if (payload.senderId === currentUserId) return;
        endedByPeerRef.current = true;
        try { pc.close(); } catch { }
        resetSessionState({ nextStatus: 'waiting', requeue: true });
        // Requeue? If peer ended, maybe we go back to queue. USE REQUEUE FLAG.
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // ALWAYS send ready signal so the other side knows we are here
          roomChannel.send({
            type: 'broadcast',
            event: 'ready',
            payload: { roomId }
          });

          // ONLY OFFER IF INITIATOR
          if (isInitiatorRef.current) {
            console.log('[RTC] I am initiator, sending offer...');
            await sendOfferSignal();
          } else {
            console.log('[RTC] I am passive, waiting for offer...');
          }
        }
      });

    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') updateStatus('connected');
      if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
        if (endedByPeerRef.current) {
          endedByPeerRef.current = false;
          updateStatus('waiting');
        } else if (ACTIVE_SESSION_STATUSES.includes(statusRef.current)) {
          resetSessionState({ nextStatus: 'ended', requeue: true });
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[RTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.error('[RTC] ICE connection failed. Possible NAT/Firewall issue.');
        // Optional: Retry or fallback?
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[RTC] Signaling state changed:', pc.signalingState);
    };

    pc.onicegatheringstatechange = () => {
      console.log('[RTC] ICE gathering state:', pc.iceGatheringState);
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
    rtcConfig,
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

    resetSessionState({ nextStatus: 'ended', requeue: true, reason: 'User requested end' });
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
    suggestedMatch,
    acceptSuggestedMatch
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
