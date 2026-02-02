'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOptionalRTCSession } from '@/components/providers/RTCSessionProvider';
import { cn } from '@/lib/utils';

export function ConnectedSessionStatusBar() {
  const pathname = usePathname();
  const router = useRouter();
  const sessionContext = useOptionalRTCSession();

  // Don't show on the session page itself or if no active session
  const isOnSessionPage = pathname === '/connect/session';
  const shouldShow =
    sessionContext?.isSessionActive &&
    !isOnSessionPage &&
    sessionContext.rtcSession?.status === 'connected';

  const handleClick = () => {
    if (sessionContext?.sessionConfig) {
      const params = new URLSearchParams({
        topic: sessionContext.sessionConfig.topic,
        mode: sessionContext.sessionConfig.mode,
      });
      router.push(`/connect/session?${params.toString()}`);
    }
  };

  if (!shouldShow) return null;

  const sessionConfig = sessionContext!.sessionConfig!;

  return (
    <div className="md:hidden">
      <button
        onClick={handleClick}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 w-full h-10',
          'bg-gradient-to-r from-primary/90 to-primary/80',
          'border-b-2 border-primary-foreground/20',
          'text-primary-foreground',
          'flex items-center justify-center gap-2 px-4',
          'transition-all duration-300 ease-in-out',
          'hover:from-primary hover:to-primary/90',
          'animate-in slide-in-from-top duration-300'
        )}
      >
        {/* Connection indicator (green dot) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <div className="size-2 bg-green-400 rounded-full animate-pulse" />
            <div className="absolute inset-0 size-2 bg-green-400 rounded-full animate-ping opacity-75" />
          </div>

          {/* Topic text */}
          <span className="text-sm font-medium truncate max-w-[200px]">
            Connected: {sessionConfig.topic}
          </span>
        </div>

        {/* Tap indicator */}
        <span className="text-xs opacity-80 ml-auto">Tap to return</span>
      </button>

      {/* Spacer to push content down when status bar is shown */}
      <div className="h-10" />
    </div>
  );
}
