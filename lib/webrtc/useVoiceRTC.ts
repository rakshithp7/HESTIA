import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import 'webrtc-adapter';
import DetectRTC from 'detectrtc';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type VoiceRTCConfig = {
  topic: string;
};

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

export function useVoiceRTC({ topic }: VoiceRTCConfig) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const clientId = useMemo(() => getOrCreateClientId(), []);

  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [micPermissionChecked, setMicPermissionChecked] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  // Media and connection references
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // Connect to signaling channel when topic is provided
  useEffect(() => {
    if (!topic) return;

    // Create a channel for this topic
    const channel = supabase.channel(`rtc:voice:${topic}`, {
      config: { presence: { key: clientId } },
    });

    // Add error handling for channel connection issues
    channel.on('system', { event: 'error' }, (payload: { error: unknown }) => {
      console.error('Supabase channel error:', payload.error);
      setStatus('media-error');
    });

    // Handle presence sync to find potential peers
    const onPresenceSync = () => {
      // Skip if already in a room
      if (roomId) return;

      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
      const others = Object.keys(state).filter((k) => k !== clientId);

      if (others.length > 0) {
        // Create a room ID with the first available peer
        const receiverId = others[0];
        const newRoomId = [clientId, receiverId].sort().join(':');

        // Signal to the peer
        channel.send({
          type: 'broadcast',
          event: 'pair',
          payload: { initiatorId: clientId, receiverId, roomId: newRoomId },
        });

        setRoomId(newRoomId);
        setStatus('connecting');
      } else {
        setStatus('waiting');
      }
    };

    // Listen for pairing messages
    channel
      .on('presence', { event: 'sync' }, onPresenceSync)
      .on('broadcast', { event: 'pair' }, (msg) => {
        const payload = msg.payload as { receiverId: string; roomId: string };
        if (payload.receiverId === clientId) {
          setRoomId(payload.roomId);
          setStatus('connecting');
        }
      })
      .subscribe(async (subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          await channel.track({ clientId });

          // If we were in a session that ended, we need to re-enter the matching pool
          if (status === 'ended') {
            setStatus('waiting');
            onPresenceSync(); // Try to find a new match immediately
          }
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, topic, clientId, roomId, status]);

  // Set up WebRTC when we have a room
  useEffect(() => {
    if (!roomId) return;

    // Configure ICE servers with multiple fallbacks for better NAT traversal
    const rtcConfig: RTCConfiguration = {
      iceServers: [
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
      ],
      iceCandidatePoolSize: 10,
    };

    // Create peer connection
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;
    remoteStreamRef.current = new MediaStream();

    // Handle incoming tracks
    pc.ontrack = (ev) => {
      ev.streams[0]?.getTracks().forEach((t) => remoteStreamRef.current?.addTrack(t));
      if (audioElRef.current) {
        audioElRef.current.srcObject = remoteStreamRef.current!;
        void audioElRef.current.play().catch(() => undefined);
      }
    };

    // Create a channel for this specific room
    const roomChannel = supabase.channel(`rtc:room:${roomId}`);

    // Add error handling for room channel connection issues
    roomChannel.on('system', { event: 'error' }, (payload: { error: unknown }) => {
      console.error('Supabase room channel error:', payload.error);
      setStatus('media-error');
    });

    // Send ICE candidates to peer
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        roomChannel.send({
          type: 'broadcast',
          event: 'ice',
          payload: { candidate: ev.candidate.toJSON(), roomId },
        });
      }
    };

    // Start local media capture
    const startLocalMedia = async (): Promise<boolean> => {
      try {
        if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
          setStatus('media-error');
          return false;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        localStreamRef.current = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        setMicReady(true);
        return true;
      } catch (err: unknown) {
        const name = (err as Error)?.name || '';
        if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('permission-denied');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') setStatus('no-mic');
        else setStatus('media-error');
        return false;
      }
    };

    // Create and send offer (for initiator)
    const createOffer = async () => {
      await startLocalMedia();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      roomChannel.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'offer', sdp: offer.sdp!, roomId },
      });
    };

    // Create and send answer (for receiver)
    const createAnswer = async (offerSdp: string) => {
      await startLocalMedia();
      await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      roomChannel.send({
        type: 'broadcast',
        event: 'sdp',
        payload: { type: 'answer', sdp: answer.sdp!, roomId },
      });
    };

    // Handle SDP, ICE, and session end messages
    roomChannel
      .on('broadcast', { event: 'sdp' }, async (msg) => {
        const payload = msg.payload as { type: 'offer' | 'answer'; sdp: string; roomId: string };
        if (payload.roomId !== roomId) return;

        if (payload.type === 'offer' && pc.signalingState === 'stable') {
          await createAnswer(payload.sdp);
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        }
      })
      .on('broadcast', { event: 'ice' }, async (msg) => {
        const payload = msg.payload as { candidate: RTCIceCandidateInit; roomId: string };
        if (payload.roomId !== roomId) return;
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      })
      .on('broadcast', { event: 'end_session' }, (msg) => {
        const payload = msg.payload as { roomId: string };
        if (payload.roomId !== roomId) return;

        console.log('Remote peer ended the session');

        // Clean up current connection
        try {
          pc.close();
        } catch (e) {
          console.error('Error closing connection:', e);
        }

        // Stop local tracks
        localStreamRef.current?.getTracks().forEach((t) => t.stop());

        // Reset state to allow re-matching
        setStatus('ended');
        setRoomId(null);

        // Unsubscribe from this room channel
        roomChannel.unsubscribe();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Determine who initiates the call based on client ID
          const [a] = roomId.split(':');
          const isInitiator = clientId === a;
          if (isInitiator) await createOffer();
        }
      });

    // Update status based on connection state with better logging
    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state changed:', pc.connectionState);

      if (pc.connectionState === 'connected') {
        console.log('WebRTC connection established successfully');
        setStatus('connected');
      }

      if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
        console.log('WebRTC connection ended with state:', pc.connectionState);
        setStatus('ended');
      }
    };

    // Add ice connection state monitoring
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed:', pc.iceConnectionState);
    };

    // Add signaling state monitoring
    pc.onsignalingstatechange = () => {
      console.log('Signaling state changed:', pc.signalingState);
    };

    // Cleanup function
    return () => {
      roomChannel.unsubscribe();
      pc.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [supabase, roomId, clientId]);

  // Handle mute state changes
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  // User-initiated microphone request - wrapped in useCallback to avoid dependency issues
  const requestLocalAudio = useCallback(async (): Promise<boolean> => {
    console.log('requestLocalAudio called');
    try {
      // Don't request again if we already have a stream
      if (localStreamRef.current && micReady) {
        console.log('Microphone already enabled');
        return true;
      }

      await new Promise<void>((resolve) => DetectRTC.load(() => resolve()));
      if (!DetectRTC.isWebRTCSupported) {
        console.log('WebRTC not supported');
        setStatus('media-error');
        return false;
      }
      if (!DetectRTC.hasMicrophone) {
        console.log('No microphone detected');
        setStatus('no-mic');
        return false;
      }

      console.log('Requesting microphone access...');
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
        setStatus('permission-denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        console.log('No microphone found');
        setStatus('no-mic');
      } else {
        console.log('Media error');
        setStatus('media-error');
      }
      return false;
    }
  }, [setStatus, setMicReady, micReady]);

  // Automatically check for microphone access on component mount
  useEffect(() => {
    if (typeof navigator === 'undefined' || micPermissionChecked) return;

    const checkMicrophoneAccess = async () => {
      try {
        // First check if browser supports WebRTC
        await new Promise<void>((resolve) => DetectRTC.load(() => resolve()));
        if (!DetectRTC.isWebRTCSupported) {
          setStatus('media-error');
          setMicPermissionChecked(true);
          return;
        }

        // Check if device has microphone
        if (!DetectRTC.hasMicrophone) {
          setStatus('no-mic');
          setMicPermissionChecked(true);
          return;
        }

        // Check if we already have permission
        if (DetectRTC.isWebsiteHasWebcamPermissions) {
          // We might already have permission, try to get the stream
          await requestLocalAudio();
        }
      } catch (err) {
        // Ignore errors here - we'll just show the button
        console.log('Initial microphone check error:', err);
      } finally {
        setMicPermissionChecked(true);
      }
    };

    checkMicrophoneAccess();
  }, [micPermissionChecked, requestLocalAudio, setStatus, setMicPermissionChecked]);

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
      if (roomId) {
        const roomChannel = supabase.channel(`rtc:room:${roomId}`);
        roomChannel
          .send({
            type: 'broadcast',
            event: 'end_session',
            payload: { roomId },
          })
          .then(() => {
            // Wait a moment to ensure message is sent before closing
            setTimeout(() => {
              roomChannel.unsubscribe();
            }, 300);
          })
          .catch(console.error);
      }

      // Close the connection
      pcRef.current?.close();
    } catch (err) {
      console.error('Error ending session:', err);
    }

    // Stop all tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Reset state
    setStatus('ended');
    setRoomId(null); // Clear room ID to allow re-matching
  };

  return {
    status,
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
  };
}

// Helper function to generate or retrieve client ID
function getOrCreateClientId(): string {
  // Only access localStorage on the client side
  if (typeof window === 'undefined') {
    return generateUUIDv4(); // Return a temporary ID during SSR
  }

  const key = 'rtc_client_id';
  let id = localStorage?.getItem(key);
  if (!id) {
    id = generateUUIDv4();
    try {
      localStorage?.setItem(key, id);
    } catch {
      // ignore quota or privacy errors; ephemeral id is fine
    }
  }
  return id;
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
