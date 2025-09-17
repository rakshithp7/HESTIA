'use client';
import React from 'react';
import { MicOff, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { useVoiceRTC } from '@/lib/webrtc/useVoiceRTC';
import AudioWaveform from '@/components/AudioWaveform';
import { SessionContext } from './layout';

export default function ConnectSessionPage() {
  const params = useSearchParams();
  const topic = (params.get('topic') || '').toString();
  const rtcHook = useVoiceRTC({ topic });
  const {
    status,
    muted,
    setMuted,
    setAudioElementRef,
    micReady,
    micPermissionChecked,
    requestLocalAudio,
    localStream,
    remoteStream,
    end,
  } = rtcHook;

  // Create a stable wrapper for requestLocalAudio to ensure it's properly bound
  // and doesn't cause unnecessary re-renders
  const handleRequestLocalAudio = React.useCallback(async () => {
    console.log('Requesting local audio from stable wrapper');
    try {
      return await requestLocalAudio();
    } catch (err) {
      console.error('Error in handleRequestLocalAudio:', err);
      return false;
    }
  }, [requestLocalAudio]);

  return (
    <SessionContext.Provider value={{ end }}>
      <SessionContent
        status={status}
        muted={muted}
        setMuted={setMuted}
        setAudioElementRef={setAudioElementRef}
        micReady={micReady}
        micPermissionChecked={micPermissionChecked}
        requestLocalAudio={handleRequestLocalAudio}
        localStream={localStream}
        remoteStream={remoteStream}
      />
    </SessionContext.Provider>
  );
}

function SessionContent({
  status,
  muted,
  setMuted,
  setAudioElementRef,
  micReady,
  micPermissionChecked,
  requestLocalAudio,
  localStream,
  remoteStream,
}: {
  status: string;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  setAudioElementRef: (el: HTMLAudioElement | null) => void;
  micReady: boolean;
  micPermissionChecked: boolean;
  requestLocalAudio: () => Promise<boolean>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}) {
  // Get connection status display info
  const getStatusInfo = () => {
    switch (status) {
      case 'waiting':
        return { text: 'Waiting for someone to join...', icon: <Loader2 className="size-6 animate-spin" /> };
      case 'connecting':
        return { text: 'Establishing connection...', icon: <Loader2 className="size-6 animate-spin" /> };
      case 'connected':
        return { text: 'Connected', icon: null };
      case 'permission-denied':
        return { text: 'Microphone permission denied', icon: null };
      case 'no-mic':
        return { text: 'No microphone detected', icon: null };
      case 'media-error':
        return { text: 'Error accessing microphone', icon: null };
      case 'ended':
        return { text: 'Call ended', icon: null };
      default:
        return { text: 'Initializing...', icon: <Loader2 className="size-6 animate-spin" /> };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Panel - Peer */}
      <div className="relative rounded-3xl border-[4px] border-primary/60 p-6 min-h-[420px] flex flex-col items-center justify-between">
        <div className="absolute left-4 top-3 text-sm opacity-70">Peer</div>
        <div className="flex flex-col items-center justify-center flex-1 w-full">
          {status === 'connected' ? (
            <AudioWaveform
              audioStream={remoteStream}
              isActive={status === 'connected'}
              color="var(--primary)"
              className="mb-4"
              // Remote stream doesn't have a muted state we control
            />
          ) : (
            <div className="flex flex-col items-center justify-center">
              {statusInfo.icon}
              <div className="mt-4 text-base font-medium">{statusInfo.text}</div>
            </div>
          )}
        </div>
        <audio ref={setAudioElementRef} autoPlay playsInline className="hidden" />
      </div>

      {/* Right Panel - You */}
      <div className="relative rounded-3xl border-[4px] border-primary/60 p-6 min-h-[420px] flex flex-col items-center justify-between">
        <div className="absolute right-4 top-3 text-sm opacity-70">You</div>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
          {micReady ? (
            <>
              <AudioWaveform
                audioStream={localStream}
                isActive={micReady}
                muted={muted}
                color="var(--primary)"
                className="mb-4"
              />
              <div className="text-sm opacity-70">{muted ? 'Microphone muted' : 'Speaking'}</div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center">
              {micPermissionChecked && (
                <Button
                  variant="outline"
                  className="mb-4 gap-2"
                  onClick={async (e) => {
                    // Prevent default to avoid any form submission
                    e.preventDefault();
                    console.log('Enable Microphone button clicked');
                    try {
                      const result = await requestLocalAudio();
                      console.log('Microphone access result:', result);
                    } catch (err) {
                      console.error('Error enabling microphone:', err);
                    }
                  }}>
                  <Mic className="size-4" />
                  <span>Enable Microphone</span>
                </Button>
              )}

              {!micPermissionChecked ? (
                <>
                  <Loader2 className="size-6 animate-spin mb-4" />
                  <div className="text-sm opacity-70">Checking microphone access...</div>
                </>
              ) : (
                <div className="text-sm opacity-70">
                  {status === 'permission-denied'
                    ? 'Microphone access denied. Please allow access in your browser settings.'
                    : status === 'no-mic'
                    ? 'No microphone detected on your device.'
                    : 'Microphone access required'}
                </div>
              )}
            </div>
          )}
        </div>
        {micReady && (
          <Button
            variant={muted ? 'outline' : 'ghost'}
            className="gap-2"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? 'Unmute' : 'Mute'}>
            <MicOff className="size-4" />
            <span>{muted ? 'Unmute' : 'Mute'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
