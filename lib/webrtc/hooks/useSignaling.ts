import { useEffect, useRef, useMemo, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { describeSupabaseError } from '../utils';

type SignalingCallbacks = {
  onPeerReady: () => void;
  onOffer: (sdp: string) => void;
  onAnswer: (sdp: string) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onEndSession: (senderId?: string) => void;
  onError: (error: string) => void;
};

type UseSignalingResult = {
  sendOffer: (sdp: string) => Promise<void>;
  sendAnswer: (sdp: string) => Promise<void>;
  sendIceCandidate: (candidate: RTCIceCandidate) => Promise<void>;
  sendReady: () => Promise<void>;
  sendEndSession: () => Promise<void>;
};

export function useSignaling(
  roomId: string | null,
  currentUserId: string | null,
  callbacks: SignalingCallbacks
): UseSignalingResult {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep callbacks fresh without re-triggering effect
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!roomId) return;

    // console.log('[RTC] Subscribing to room:', roomId);
    const channel = supabase.channel(`rtc:room:${roomId}`, {
      config: { broadcast: { ack: true } },
    });
    channelRef.current = channel;

    channel
      .on('system', { event: 'error' }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = describeSupabaseError((payload as any)?.error ?? payload);
        console.error('Supabase room channel error:', msg);
        callbacksRef.current.onError(msg);
      })
      .on('broadcast', { event: 'ready' }, (msg) => {
        const payload = msg.payload as { roomId: string; senderId: string };
        if (payload.roomId !== roomId || payload.senderId === currentUserId)
          return;
        callbacksRef.current.onPeerReady();
      })
      .on('broadcast', { event: 'sdp' }, (msg) => {
        const payload = msg.payload as {
          type: 'offer' | 'answer';
          sdp: string;
          roomId: string;
          senderId: string;
        };
        if (payload.roomId !== roomId || payload.senderId === currentUserId)
          return;
        if (payload.type === 'offer') {
          callbacksRef.current.onOffer(payload.sdp);
        } else if (payload.type === 'answer') {
          callbacksRef.current.onAnswer(payload.sdp);
        }
      })
      .on('broadcast', { event: 'ice' }, (msg) => {
        const payload = msg.payload as {
          candidate: RTCIceCandidateInit;
          roomId: string;
          senderId: string;
        };
        if (payload.roomId !== roomId || payload.senderId === currentUserId)
          return;
        callbacksRef.current.onIceCandidate(payload.candidate);
      })
      .on('broadcast', { event: 'end_session' }, (msg) => {
        const payload = msg.payload as { roomId: string; senderId: string };
        if (payload.roomId !== roomId) return;
        if (payload.senderId === currentUserId) return; // Ignore my own end message
        callbacksRef.current.onEndSession(payload.senderId);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce presence
          channel.send({
            type: 'broadcast',
            event: 'ready',
            payload: { roomId, senderId: currentUserId },
          });
        }
      });

    return () => {
      // console.log('[RTC] Unsubscribing room:', roomId);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId, currentUserId, supabase]);

  const sendOffer = useCallback(
    async (sdp: string) => {
      if (!roomId || !channelRef.current) return;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'offer', sdp, roomId, senderId: currentUserId },
      });
    },
    [roomId, currentUserId]
  );

  const sendAnswer = useCallback(
    async (sdp: string) => {
      if (!roomId || !channelRef.current) return;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'answer', sdp, roomId, senderId: currentUserId },
      });
    },
    [roomId, currentUserId]
  );

  const sendIceCandidate = useCallback(
    async (candidate: RTCIceCandidate) => {
      if (!roomId || !channelRef.current) return;
      await channelRef.current.send({
        type: 'broadcast',
        event: 'ice',
        payload: {
          candidate: candidate.toJSON(),
          roomId,
          senderId: currentUserId,
        },
      });
    },
    [roomId, currentUserId]
  );

  const sendReady = useCallback(async () => {
    if (!roomId || !channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'ready',
      payload: { roomId, senderId: currentUserId },
    });
  }, [roomId, currentUserId]);

  const sendEndSession = useCallback(async () => {
    if (!roomId || !channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'end_session',
      payload: { roomId, senderId: currentUserId },
    });
  }, [roomId, currentUserId]);

  return {
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendReady,
    sendEndSession,
  };
}
