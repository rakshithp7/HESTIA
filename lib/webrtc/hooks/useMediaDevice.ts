import { useState, useRef, useCallback, useEffect } from 'react';
import { SessionMode } from '../types';

// Dynamic import helper for DetectRTC to avoid SSR issues
const getDetectRTC = async () => {
    if (typeof window === 'undefined') return null;
    const { default: DetectRTC } = await import('detectrtc');
    return DetectRTC;
};

type UseMediaDeviceResult = {
    stream: MediaStream | null;
    micReady: boolean;
    micPermissionChecked: boolean;
    muted: boolean;
    error: 'permission-denied' | 'no-mic' | 'media-error' | null;
    requestAudio: () => Promise<boolean>;
    toggleMute: () => void;
    stopTracks: () => void;
};

export function useMediaDevice(mode: SessionMode): UseMediaDeviceResult {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [micReady, setMicReady] = useState(false);
    const [micPermissionChecked, setMicPermissionChecked] = useState(false);
    const [muted, setMuted] = useState(false);
    const [error, setError] = useState<'permission-denied' | 'no-mic' | 'media-error' | null>(null);

    const isChatMode = mode === 'chat';

    const stopTracks = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setStream(null);
            setMicReady(false);
        }
    }, []);

    const requestAudio = useCallback(async (): Promise<boolean> => {
        console.log('requestLocalAudio called');
        setError(null);

        if (isChatMode) {
            console.log('requestLocalAudio skipped in chat-only mode');
            return false;
        }

        try {
            // Don't request again if we already have a stream
            if (streamRef.current && micReady) {
                console.log('Microphone already enabled');
                return true;
            }

            // Only use DetectRTC in browser environment
            const detectRTC = await getDetectRTC();
            if (detectRTC) {
                await new Promise<void>((resolve) => detectRTC.load(() => resolve()));
                if (!detectRTC.isWebRTCSupported) {
                    console.log('WebRTC not supported');
                    setError('media-error');
                    return false;
                }
                if (!detectRTC.hasMicrophone) {
                    console.log('No microphone detected');
                    setError('no-mic');
                    return false;
                }
            }

            console.log('Requesting microphone access...');
            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                setError('media-error');
                return false;
            }
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: false,
            });
            console.log('Microphone access granted');

            streamRef.current = newStream;
            setStream(newStream);
            setMicReady(true);
            return true;
        } catch (err: unknown) {
            console.error('Error accessing microphone:', err);
            const name = (err as Error)?.name || '';
            if (name === 'NotAllowedError' || name === 'SecurityError') {
                console.log('Permission denied');
                setError('permission-denied');
            } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
                console.log('No microphone found');
                setError('no-mic');
            } else {
                console.log('Media error');
                setError('media-error');
            }
            return false;
        }
    }, [isChatMode, micReady]);

    // Initial Check
    useEffect(() => {
        if (isChatMode) {
            if (!micPermissionChecked) setMicPermissionChecked(true);
            return;
        }

        if (typeof window === 'undefined' || micPermissionChecked) return;

        const checkMicrophoneAccess = async () => {
            try {
                const detectRTC = await getDetectRTC();
                if (detectRTC) {
                    await new Promise<void>((resolve) => detectRTC.load(() => resolve()));
                    if (!detectRTC.isWebRTCSupported) {
                        setError('media-error');
                        setMicPermissionChecked(true);
                        return;
                    }
                    if (!detectRTC.hasMicrophone) {
                        setError('no-mic');
                        setMicPermissionChecked(true);
                        return;
                    }
                    if (detectRTC.isWebsiteHasWebcamPermissions) {
                        await requestAudio();
                    }
                }
            } catch (err) {
                console.log('Initial microphone check error:', err);
            } finally {
                setMicPermissionChecked(true);
            }
        };

        void checkMicrophoneAccess();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isChatMode]); // Deliberately fewer deps to run once on mount per mode

    // Handle Mute
    const toggleMute = useCallback(() => {
        const next = !muted;
        setMuted(next);
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
        }
    }, [muted]);

    // Watch for external mute changes (if any) or cleanup
    useEffect(() => {
        // Sync mute state to tracks if stream changes
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach((t) => (t.enabled = !muted));
        }
    }, [stream, muted]);

    useEffect(() => {
        return () => {
            stopTracks();
        };
    }, [stopTracks]);

    return {
        stream,
        micReady,
        micPermissionChecked,
        muted,
        error,
        requestAudio,
        toggleMute,
        stopTracks
    };
}
