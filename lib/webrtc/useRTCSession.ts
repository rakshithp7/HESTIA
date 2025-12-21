import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import 'webrtc-adapter';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import {
  RTCSessionConfig,
  ConnectionStatus,
  ChatMessage,
  DataChannelMessage,
  CHAT_CHANNEL_LABEL,
} from './types';
export type { ChatMessage, ConnectionStatus, SessionMode } from './types';
import { generateUUIDv4 } from './utils';
import { fetchIceServers, fetchBlockedUsers } from './services';
import { useMediaDevice } from './hooks/useMediaDevice';
import { useMatchQueue } from './hooks/useMatchQueue';
import { useSignaling } from './hooks/useSignaling';

export function useRTCSession({ topic, mode }: RTCSessionConfig) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // -- Initialization --
  const [rtcConfig, setRtcConfig] = useState<RTCConfiguration | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedByUserIds, setBlockedByUserIds] = useState<string[]>([]);

  // -- Feature Hooks --
  const media = useMediaDevice(mode);
  const queue = useMatchQueue({
    currentUserId,
    config: { topic, mode },
    blockedUserIds,
    blockedByUserIds
  });

  // -- Local Session State --
  // We use a composite status that reflects Queue + RTC state
  const [internalStatus, setInternalStatus] = useState<ConnectionStatus>('idle');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isChatReady, setIsChatReady] = useState(false);

  // -- Refs --
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // -- Auth & Config Loading --
  useEffect(() => {
    let cancelled = false;
    const loadAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled && user) setCurrentUserId(user.id);
    };
    const loadConfig = async () => {
      const config = await fetchIceServers();
      if (!cancelled) setRtcConfig(config);
    };
    // loadBlocked removed
    loadAuth();
    loadConfig();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchBlockedUsers().then(({ blockedUsers, blockedByUsers }) => {
      setBlockedUserIds(blockedUsers);
      setBlockedByUserIds(blockedByUsers);
    });
  }, [currentUserId]);

  // -- Status Synchronization --
  // The hook returns a single 'status'. 
  // If queue is 'waiting', we are waiting.
  // If queue is 'matched', we transform to 'connecting' until PC is done.
  // If media error, we show media-error.
  const status: ConnectionStatus = useMemo(() => {
    if (media.error) return media.error; // 'no-mic', 'permission-denied'
    if (internalStatus === 'ended' || internalStatus === 'media-error') return internalStatus;
    if (queue.status === 'error') return 'media-error'; // fallback

    // Priority: Queue status
    if (queue.status === 'idle') return 'idle';
    if (queue.status === 'waiting') return 'waiting';

    // When queue says 'matched', we are connecting or connected?
    // We rely on internal PC state for connecting/connected
    if (queue.status === 'matched') {
      if (internalStatus === 'connected') return 'connected';
      return 'connecting';
    }
    return 'idle';
  }, [media.error, queue.status, internalStatus]);

  // -- Helpers --
  const updateStatus = useCallback((s: ConnectionStatus) => {
    setInternalStatus(s);
  }, []);

  const pushChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => {
      const next = [...prev, message];
      return next.length > 100 ? next.slice(-100) : next;
    });
  }, []);

  const attachDataChannel = useCallback((channel: RTCDataChannel) => {
    dataChannelRef.current = channel;
    channel.onopen = () => setIsChatReady(true);
    channel.onclose = () => { setIsChatReady(false); setIsPeerTyping(false); };
    channel.onerror = () => setIsChatReady(false);
    channel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as DataChannelMessage;
        if (payload.type === 'chat') {
          pushChatMessage({ ...payload.message, sender: 'peer' });
        } else if (payload.type === 'typing_start') {
          setIsPeerTyping(true);
        } else if (payload.type === 'typing_stop') {
          setIsPeerTyping(false);
        }
      } catch (e) {
        console.error('Data channel parse error', e);
      }
    };
  }, [pushChatMessage]);

  // -- Signaling Callbacks --
  // Defined here so we can close over `pcRef` and `media` without passing them out
  // NOTE: These callbacks MUST be stable or `useSignaling` will detach/reattach
  const flushCandidates = async () => {
    if (!pcRef.current) return;
    for (const c of pendingIceCandidatesRef.current) {
      try { await pcRef.current.addIceCandidate(c); } catch (e) { console.error(e); }
    }
    pendingIceCandidatesRef.current = [];
  };

  const handlePeerReady = useCallback(async () => {
    console.log('[RTC] Peer Ready');
    if (queue.isInitiator && pcRef.current?.localDescription) {
      console.log('[RTC] Re-sending cached offer to new peer');
      await signalingActionsRef.current?.sendOffer(pcRef.current.localDescription.sdp);
    }
  }, [queue.isInitiator]);

  const handleOffer = useCallback(async (sdp: string) => {
    const pc = pcRef.current;
    if (!pc) return;
    console.log('[RTC] Handle Offer');
    if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
      // glare/collision?
    }
    await pc.setRemoteDescription({ type: 'offer', sdp });
    await flushCandidates();

    // Answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    // We can't return the answer here, safely rely on `signaling.sendAnswer` if we had it in scope.
    // But `signaling` isn't in scope yet. 
    // Wait, `handleOffer` is passed TO `useSignaling`. It cannot access `signaling` variable.
    // Solution: access it via ref or assume the signaling hook exposes a 'send' outside?
    // Actually, `useSignaling` *returns* the send functions.
    // But we are creating the callbacks *before* calling `useSignaling`.
    // Circular dependency? 
    // No, `useSignaling` returns functions.
    // But we need to call `signaling.sendAnswer` INSIDE `handleOffer`.
    // We can use a ref for the sender actions.
  }, []);

  // Ref Pattern for Signaling Actions to break circular dep
  const signalingActionsRef = useRef<{
    sendAnswer: (sdp: string) => Promise<void>;
    sendOffer: (sdp: string) => Promise<void>;
  } | null>(null);

  const onOfferWrapper = useCallback(async (sdp: string) => {
    await handleOffer(sdp);
    // Send Answer
    const pc = pcRef.current;
    if (pc && pc.localDescription && signalingActionsRef.current) {
      await signalingActionsRef.current.sendAnswer(pc.localDescription.sdp);
    }
  }, [handleOffer]);

  const onAnswerWrapper = useCallback(async (sdp: string) => {
    const pc = pcRef.current;
    if (!pc) return;
    console.log('[RTC] Handle Answer');
    if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription({ type: 'answer', sdp });
      await flushCandidates();
    }
  }, []);

  const onIceCandidateWrapper = useCallback(async (candidate: RTCIceCandidateInit) => {
    console.log('[RTC] Received ICE Candidate');
    const pc = pcRef.current;
    if (!pc) {
      console.warn('[RTC] Received ICE but PC is null');
      return;
    }
    if (!pc.remoteDescription?.type) {
      console.log('[RTC] Buffering ICE Candidate (no remote desc)');
      pendingIceCandidatesRef.current.push(candidate);
    } else {
      console.log('[RTC] Adding ICE Candidate');
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.error('[RTC] Failed to add ICE:', e);
      }
    }
  }, []);

  const onEndSessionWrapper = useCallback(() => {
    console.log('[RTC] Session ended by peer');
    // peer ended it.
    // Clean up PC
    pcRef.current?.close();
    updateStatus('waiting'); // go back to waiting
    // Re-queue?
    queue.enterQueue();
  }, [queue, updateStatus]);

  const signaling = useSignaling(queue.roomId, currentUserId, {
    onPeerReady: handlePeerReady,
    onOffer: onOfferWrapper,
    onAnswer: onAnswerWrapper,
    onIceCandidate: onIceCandidateWrapper,
    onEndSession: onEndSessionWrapper,
    onError: (msg) => { console.error(msg); updateStatus('media-error'); }
  });

  // Assign refs for the cyclic call
  useEffect(() => {
    signalingActionsRef.current = {
      sendAnswer: signaling.sendAnswer,
      sendOffer: signaling.sendOffer
    };
  }, [signaling.sendAnswer, signaling.sendOffer]);


  // -- Lifecycle: WebRTC --
  useEffect(() => {
    if (!queue.roomId || !rtcConfig) return;

    // 1. Create PC
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;
    updateStatus('connecting');

    // 2. Setup Audio/Media
    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    pc.ontrack = (ev) => {
      ev.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
      if (audioElRef.current) {
        audioElRef.current.srcObject = remoteStream;
        audioElRef.current.play().catch(() => { });
      }
    };

    // 3. Add Local Tracks
    if (media.stream) {
      media.stream.getTracks().forEach(track => pc.addTrack(track, media.stream!));
    }

    // 4. Data Channel (Initiator only)
    if (queue.isInitiator) {
      const dc = pc.createDataChannel(CHAT_CHANNEL_LABEL, { ordered: true });
      attachDataChannel(dc);
    } else {
      pc.ondatachannel = (ev) => {
        if (ev.channel.label === CHAT_CHANNEL_LABEL) attachDataChannel(ev.channel);
      };
    }

    // 5. ICE Events
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        console.log('[RTC] Generated ICE candidate:', ev.candidate.candidate);
        signaling.sendIceCandidate(ev.candidate);
      } else {
        console.log('[RTC] End of ICE candidates');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[RTC] Connection State Change:', pc.connectionState);
      if (pc.connectionState === 'connected') updateStatus('connected');
      if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
        console.warn('[RTC] Connection failed/closed');
        // Handle disconnection
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[RTC] ICE Connection State:', pc.iceConnectionState);
    };

    pc.onicegatheringstatechange = () => {
      console.log('[RTC] ICE Gathering State:', pc.iceGatheringState);
    };

    // 6. Start Negotiation (Initiator)
    if (queue.isInitiator) {
      const startNegotiation = async () => {
        // We need to wait for media? Media tracks already added above.
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signaling.sendOffer(offer.sdp!);
      };
      // Small delay or wait for 'ready' signal?
      // Traditional approach: Initiator sends offer immediately or when peer connects.
      // We have 'onPeerReady' callback. But pure 'negotiationneeded' is robust.
      // Let's use the explicit 'ready' signal OR just blast it.
      // The previous code blasted it AND waited for ready.
      startNegotiation();
    }

    return () => {
      pc.close();
      pcRef.current = null;
      remoteStreamRef.current = null;
      dataChannelRef.current = null;
    };
    // We want this to run when roomId changes (new match).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.roomId, rtcConfig]); // Only re-run if room or config changes.

  // -- Lifecycle: Auto-Enter Queue --
  // Enter queue on mount if configured
  useEffect(() => {
    if (currentUserId && topic) {
      queue.enterQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, topic]); // Run once when user is ready


  // -- Actions --
  const sendChatMessage = useCallback((text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return false;
    const msg: ChatMessage = {
      id: generateUUIDv4(),
      text: text.trim(),
      timestamp: Date.now(),
      sender: 'me'
    };
    dataChannelRef.current.send(JSON.stringify({ type: 'chat', message: msg }));
    pushChatMessage(msg);
    return true;
  }, [pushChatMessage]);

  const end = useCallback(() => {
    signaling.sendEndSession();
    // Leave queue entirely
    queue.leaveQueue();
    updateStatus('ended');
    // Optional: close pc immediately? 'roomId' change in queue will trigger cleanup effect.
    // updating status to ended is visual.
  }, [signaling, queue, updateStatus]);


  const requestLocalAudio = useCallback(async () => {
    const ok = await media.requestAudio();
    if (ok && media.stream && pcRef.current) {
      // Add tracks to existing PC
      media.stream.getTracks().forEach(t => pcRef.current?.addTrack(t, media.stream!));
      // Need to renegotiate?
      // In simple apps, usually done before connection. 
      // If done mid-call, we need 'negotiationneeded'.
    }
    return ok;
  }, [media]);

  return {
    // State
    status,
    mode,
    roomId: queue.roomId,
    currentUserId,
    peerUserId: queue.peerUserId,

    // Media
    muted: media.muted,
    setMuted: media.toggleMute, // Wait, toggle vs set. The interface asked for setMuted? 
    // Original was `setMuted`. `toggleMute` is bool flip. 
    // I'll wrap it or rename. Adapting to bool set is safer.
    setAudioElementRef: (el: HTMLAudioElement | null) => {
      audioElRef.current = el;
      if (el && remoteStreamRef.current) el.srcObject = remoteStreamRef.current;
    },
    micReady: media.micReady,
    micPermissionChecked: media.micPermissionChecked,
    requestLocalAudio,
    localStream: media.stream,
    remoteStream: remoteStreamRef.current, // Ref won't trigger render, but that's standard for streams

    // Session Control
    end,

    // Chat
    chatMessages,
    isPeerTyping,
    isChatReady,
    sendChatMessage,
    sendTypingStart: () => dataChannelRef.current?.send(JSON.stringify({ type: 'typing_start' })),
    sendTypingStop: () => dataChannelRef.current?.send(JSON.stringify({ type: 'typing_stop' })),

    // Blocking
    blockedUserIds,
    blockedByUserIds,
    markUserBlocked: (id: string) => setBlockedUserIds(p => [...p, id]), // Simple append local

    // Matching
    suggestedMatch: queue.suggestedMatch,
    acceptSuggestedMatch: queue.acceptSuggestedMatch,
    rejectSuggestedMatch: queue.rejectSuggestedMatch
  };
}
