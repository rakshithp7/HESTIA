import React from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AudioWaveform from '@/components/AudioWaveform';

interface VoiceSectionProps {
  status: string;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  setAudioElementRef: (el: HTMLAudioElement | null) => void;
  micReady: boolean;
  micPermissionChecked: boolean;
  requestLocalAudio: () => Promise<boolean>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export function VoiceSection({
  status,
  muted,
  setMuted,
  setAudioElementRef,
  micReady,
  micPermissionChecked,
  requestLocalAudio,
  localStream,
  remoteStream,
}: VoiceSectionProps) {
  const getStatusInfo = () => {
    switch (status) {
      case 'waiting':
        return { text: 'Waiting...', icon: <Loader2 className="size-4 animate-spin" /> };
      case 'connecting':
        return { text: 'Connecting...', icon: <Loader2 className="size-4 animate-spin" /> };
      case 'connected':
        return { text: 'Connected', icon: null };
      case 'permission-denied':
        return { text: 'Mic denied', icon: null };
      case 'no-mic':
        return { text: 'No mic', icon: null };
      case 'ended':
        return { text: 'Call ended', icon: null };
      default:
        return { text: 'Init...', icon: <Loader2 className="size-4 animate-spin" /> };
    }
  };

  const statusInfo = getStatusInfo();

  const getMicStatusInfo = () => {
    if (!micPermissionChecked) {
      return { text: 'Checking mic...', icon: <Loader2 className="size-4 animate-spin" /> };
    }
    switch (status) {
      case 'permission-denied':
        return { text: 'Mic access denied', icon: null };
      case 'no-mic':
        return { text: 'No mic detected', icon: null };
      default:
        return { text: 'Mic required', icon: null };
    }
  };

  const micStatusInfo = getMicStatusInfo();

  return (
    <div className="flex flex-col gap-4 h-full w-full">
      {/* Peer Voice Panel */}
      <div className="relative rounded-2xl border-2 border-secondary p-4 h-1/2">
        <div className="absolute left-2 top-2 text-base opacity-70">Peer</div>
        <div className="flex flex-col items-center justify-center pt-6 h-full">
          {status === 'connected' ? (
            <AudioWaveform
              audioStream={remoteStream}
              isActive={status === 'connected'}
              color="var(--secondary)"
              className="mb-8 h-16"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              {statusInfo.icon}
              <div className="mt-2 text-sm">{statusInfo.text}</div>
            </div>
          )}
        </div>
        <audio ref={setAudioElementRef} autoPlay playsInline className="hidden" />
      </div>

      {/* Your Voice Panel */}
      <div className="relative rounded-2xl border-2 border-primary p-4 h-1/2">
        <div className="absolute right-2 top-2 text-base opacity-70">You</div>
        <div className="flex flex-col items-center justify-center pt-6 h-full">
          {micReady ? (
            <>
              <AudioWaveform
                audioStream={localStream}
                isActive={micReady}
                muted={muted}
                color="var(--primary)"
                className="mb-4 h-16"
              />
              <div className="text-sm opacity-70 mb-4">{muted ? 'Muted' : 'Speaking'}</div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setMuted(!muted)}
                aria-label={muted ? 'Unmute' : 'Mute'}>
                <MicOff className="size-3" />
                <span className="text-sm">{muted ? 'Unmute' : 'Mute'}</span>
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              {micPermissionChecked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mb-2 gap-1"
                  onClick={() => requestLocalAudio().catch((err) => console.error('Error enabling microphone:', err))}>
                  <Mic className="size-3" />
                  <span className="text-sm">Enable Mic</span>
                </Button>
              )}
              <div className="flex flex-col items-center gap-2">
                {micStatusInfo.icon}
                <div className="text-sm opacity-70">{micStatusInfo.text}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
