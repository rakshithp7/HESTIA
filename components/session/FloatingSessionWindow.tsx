'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, Minimize2, Maximize2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatSection } from '@/components/chat/ChatSection';
import AudioWaveform from '@/components/AudioWaveform';
import { useOptionalRTCSession } from '@/components/providers/RTCSessionProvider';
import { cn } from '@/lib/utils';

// Constants
const EXPANDED_WIDTH = 350;
const EXPANDED_HEIGHT = 500;
const MINIMIZED_WIDTH = 250;
const MINIMIZED_HEIGHT = 48; // Standard header height

const STORAGE_KEY_EXPANDED = 'docked-window-expanded';

export function FloatingSessionWindow() {
  const pathname = usePathname();
  const router = useRouter();
  const sessionContext = useOptionalRTCSession();

  // State
  const [isExpanded, setIsExpanded] = useState(true);

  // Persist expanded state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_EXPANDED);
    if (saved !== null) {
      setIsExpanded(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Don't show on the session page itself or if no active session
  const isOnSessionPage = pathname === '/connect/session';
  const shouldShow =
    sessionContext?.isSessionActive &&
    !isOnSessionPage &&
    sessionContext.rtcSession?.status === 'connected';

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleEndSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessionContext?.endSession) {
      sessionContext.endSession();
    }
  };

  const handleReturnToSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessionContext?.sessionConfig) {
      const params = new URLSearchParams({
        topic: sessionContext.sessionConfig.topic,
        mode: sessionContext.sessionConfig.mode,
      });
      router.push(`/connect/session?${params.toString()}`);
    }
  };

  if (!shouldShow) return null;

  const rtcSession = sessionContext!.rtcSession!;
  const sessionConfig = sessionContext!.sessionConfig!;
  const isVoiceMode = sessionConfig.mode === 'voice';

  return (
    <div
      className={cn(
        'fixed bottom-0 right-4 z-[9999]',
        'hidden md:flex flex-col',
        'bg-background border-x border-t border-primary/20 rounded-t-lg shadow-2xl',
        'transition-all duration-300 ease-in-out'
      )}
      style={{
        width: isExpanded ? `${EXPANDED_WIDTH}px` : `${MINIMIZED_WIDTH}px`,
        height: isExpanded ? `${EXPANDED_HEIGHT}px` : `${MINIMIZED_HEIGHT}px`,
      }}
    >
      {/* Header Bar (Always visible) */}
      <div
        className={cn(
          'flex items-center justify-between px-3 h-12 shrink-0 cursor-pointer',
          'bg-primary text-primary-foreground rounded-t-lg',
          'transition-colors hover:bg-primary/90'
        )}
        onClick={handleToggleExpand}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <span className="font-medium truncate text-sm">
            {sessionConfig.topic}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-2">
          {/* Open Session Page */}
          <Button
            size="icon"
            variant="ghost"
            className="size-6 hover:bg-primary-foreground/20 text-primary-foreground p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleReturnToSession(e);
            }}
            title="Open full session page"
          >
            <ExternalLink className="size-3" />
          </Button>
          {/* Maximize/Minimize Icon */}
          <Button
            size="icon"
            variant="ghost"
            className="size-6 hover:bg-primary-foreground/20 text-primary-foreground p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand();
            }}
          >
            {isExpanded ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
          </Button>

          {/* Close/End Session Icon */}
          <Button
            size="icon"
            variant="ghost"
            className="size-6 hover:bg-destructive hover:text-white text-primary-foreground p-0"
            onClick={handleEndSession}
          >
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {/* Content Area (Hidden when minimized) */}
      <div
        className={cn(
          'flex-1 flex flex-col overflow-hidden bg-background',
          !isExpanded && 'hidden'
        )}
      >
        {/* Voice Section - Compact waveforms */}
        {isVoiceMode && (
          <div className="flex flex-row px-3 py-2 border-b border-border gap-3 bg-muted/30 shrink-0">
            {/* Peer Waveform */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-medium text-muted-foreground">
                Peer
              </span>
              <AudioWaveform
                audioStream={rtcSession.remoteStream}
                isActive={rtcSession.status === 'connected'}
                color="var(--secondary)"
                compact
                className="flex-1"
              />
            </div>

            {/* Local Waveform */}
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs font-medium text-muted-foreground">
                You
              </span>
              <AudioWaveform
                audioStream={rtcSession.localStream}
                isActive={rtcSession.micReady}
                muted={rtcSession.muted}
                color="var(--primary)"
                compact
                className="flex-1"
              />
            </div>
          </div>
        )}

        {/* Chat Section - Compact */}
        <div
          className="flex-1 min-h-0 flex flex-col relative"
          onClick={(e) => e.stopPropagation()}
        >
          <ChatSection
            messages={rtcSession.chatMessages}
            isPeerTyping={rtcSession.isPeerTyping}
            isChatReady={rtcSession.isChatReady}
            onSendMessage={rtcSession.sendChatMessage}
            onTypingStart={rtcSession.sendTypingStart}
            onTypingStop={rtcSession.sendTypingStop}
            compact
          />
          {/* Overlay link to full session page */}
          <div className="absolute top-2 right-2 z-10 opacity-0 hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="h-6 text-xs shadow-sm"
              onClick={handleReturnToSession}
            >
              Open Full View
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
